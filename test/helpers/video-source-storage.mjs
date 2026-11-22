import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openAsBlob} from 'node:fs';
import {mkdir, mkdtemp, open, rename, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import worker, {FamilyState, PUBLIC_WRITE_TOKEN} from '../../src/worker.mjs';
import {VIDEO_PART_SIZE} from '../../src/video-multipart.mjs';

export async function videoSourceFixture(directory = tmpdir()) {
  const root = await mkdtemp(join(directory, 'staged-video-'));
  const database = new DatabaseSync(':memory:');
  const sql = {exec(query, ...args) {
    const statement = database.prepare(query);
    const rows = statement.columns().length ? statement.all(...args) : (statement.run(...args), []);
    return {toArray: () => rows};
  }};
  const storage = {sql, transactionSync(fn) {
    database.exec('BEGIN');
    try { const value = fn(); database.exec('COMMIT'); return value; }
    catch (error) { database.exec('ROLLBACK'); throw error; }
  }};
  const scope = new FamilyState({storage}, {});
  const env = {HF_NAMESPACE:'tests', HF_BUCKET:'family', HF_ACCESS_KEY_ID:'test', HF_SECRET_ACCESS_KEY:'test',
    FAMILY_STATE:{idFromName:()=>'family', get:()=>scope}};
  const origin = 'https://family.example';
  const uploads = new Map(), pending = [], calls = [];
  const originalFetch = globalThis.fetch;
  const ctx = {waitUntil:promise=>pending.push(promise)};
  const objectFile = key => join(root, key);
  globalThis.fetch = async request => {
    const url = new URL(request.url);
    assert.equal(url.hostname, 's3.hf.co');
    const key = url.pathname.replace(/^\/tests\/family\//,'');
    const file = objectFile(key);
    if (url.searchParams.has('uploads')) {
      const id = crypto.randomUUID(), tmp = join(root, id);
      await writeFile(tmp, '');
      uploads.set(id, {file, tmp, parts:new Map()});
      return new Response('<UploadId>'+id+'</UploadId>');
    }
    const id = url.searchParams.get('uploadId');
    if (id) {
      const draft = uploads.get(id);
      if (!draft) return new Response(null,{status:404});
      assert.equal(file, draft.file);
      if (request.method === 'PUT') {
        const n = Number(url.searchParams.get('partNumber'));
        const bytes = Buffer.from(await request.arrayBuffer());
        const etag = '"' + createHash('md5').update(bytes).digest('hex') + '"';
        const handle = await open(draft.tmp, 'r+');
        try { await handle.write(bytes, 0, bytes.length, (n-1)*VIDEO_PART_SIZE); }
        finally { await handle.close(); }
        draft.parts.set(n, {size:bytes.length, etag});
        return new Response(null,{headers:{ETag:etag}});
      }
      if (request.method === 'GET') {
        const parts = [...draft.parts].map(([n,p])=>'<Part><PartNumber>'+n+'</PartNumber><Size>'+p.size+'</Size><ETag>'+p.etag+'</ETag></Part>');
        return new Response('<ListPartsResult><IsTruncated>false</IsTruncated>'+parts.join('')+'</ListPartsResult>');
      }
      if (request.method === 'DELETE') {
        await rm(draft.tmp); uploads.delete(id); return new Response(null,{status:204});
      }
      assert.equal(request.method, 'POST');
      const manifest = await request.text();
      assert.deepEqual([...manifest.matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)].map(m=>Number(m[1])), [...draft.parts.keys()].sort((a,b)=>a-b));
      await mkdir(dirname(file),{recursive:true});
      await rename(draft.tmp, file);
      uploads.delete(id);
      return new Response('<CompleteMultipartUploadResult><ETag>confirmed</ETag></CompleteMultipartUploadResult>');
    }
    if (request.method === 'PUT') {
      await mkdir(dirname(file),{recursive:true});
      await writeFile(file,request.body);
      return new Response(null);
    }
    if (request.method === 'DELETE') {
      await rm(file,{force:true}); return new Response(null,{status:204});
    }
    const size = await stat(file).then(s=>s.size).catch(()=>null);
    if (size === null) return new Response(null,{status:404});
    const headers = {'Content-Length':String(size), 'Accept-Ranges':'bytes'};
    if (request.method === 'HEAD') return new Response(null,{headers});
    const blob = await openAsBlob(file), range = request.headers.get('Range');
    if (!range) return new Response(blob,{headers});
    const [,start,end] = /^bytes=(\d+)-(\d*)$/.exec(range);
    const last = Math.min(end?Number(end):size-1, size-1);
    return new Response(blob.slice(Number(start),last+1),{status:206,headers:{
      ...headers,'Content-Length':String(last-Number(start)+1),'Content-Range':'bytes '+start+'-'+last+'/'+size}});
  };
  async function request(path, options={}) {
    const headers = new Headers(options.headers);
    if (options.method==='POST') headers.set('Origin',origin);
    if (options.body instanceof Blob) headers.set('Content-Length',String(options.body.size));
    calls.push({action:new URL(path,origin).pathname.split('/').at(-1),part:headers.get('X-Upload-Part')});
    return worker.fetch(new Request(new URL(path,origin),{...options,headers}),env,ctx);
  }
  return {origin,request,env,scope,database,calls,objectFile,uploads,writeToken:PUBLIC_WRITE_TOKEN,
    async settle(){await Promise.all(pending.splice(0));},
    async close(){await this.settle();globalThis.fetch=originalFetch;database.close();await rm(root,{recursive:true,force:true});}};
}
