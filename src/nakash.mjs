import {BRANCHES, branchForPerson, createFamily} from '../public/nakash/family-data.mjs';
import {configured, deleteObject, getObject, putObject} from './hf.mjs';
import {checkOrigin, HttpError, json, readJSON, sha256, text, uid} from './http.mjs';
import {compatRoute,portraitPath} from './nakash-compat.mjs';

const branchIds = new Set(BRANCHES.map(branch => branch.id));
const capsule = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const galleryPath = '/nakash/api/media';
const adminPath = '/nakash/api/admin';
const assetPath = '/nakash/';
const uploadKind = new Set(['photo', 'video']);
const sessionCookie = '__Host-FamilyTrash';

function notFound() {
  return new HttpError(404, 'העמוד המבוקש לא נמצא.');
}

export function nakashProjection(family, names) {
  const people = Object.create(null);
  const units = Object.create(null);
  const seen = new Set();
  function visit(id, parent) {
    if (seen.has(id)) return false;
    seen.add(id);
    const unit = family.units[id];
    if (!unit) return false;
    const members = unit.people.filter(personId => family.people[personId] && !family.people[personId].placeholder);
    if (!members.length) return false;
    for (const personId of members) {
      const person = family.people[personId];
      people[personId] = {
        id: personId,
        name: names.get(personId) || person.name,
        englishName: person.englishName || person.nameEn || family.english?.people?.[personId],
        gender: person.gender,
        unit: id,
        deceased: Boolean(person.deceased),
      };
    }
    const children = unit.children.filter(child => visit(child, id));
    units[id] = {id, people: members, children, parent};
    if (unit.hasWedding === false) units[id].hasWedding = false;
    return true;
  }
  visit('u-root', null);
  return {people, units};
}

function publicMedia(item) {
  return {
    id: item.id,
    kind: item.kind,
    caption: item.caption,
    branches: item.branches,
    people: item.people,
    src: galleryPath + '/' + item.id,
  };
}

function readMetadata(request) {
  let metadata;
  try {
    const raw = request.headers.get('X-Nakash-Metadata') || '%7B%7D';
    if (raw.length > 6000) throw Error();
    metadata = JSON.parse(decodeURIComponent(raw));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw Error();
  } catch {
    throw new HttpError(400, 'פרטי ההעלאה אינם תקינים.');
  }
  const {caption = '', sharedBranches = [], people = []} = metadata;
  if (!Array.isArray(sharedBranches) || sharedBranches.length > 4 || sharedBranches.some(value => !branchIds.has(value))) {
    throw new HttpError(400, 'בחרו ענפים תקינים.');
  }
  if (!Array.isArray(people) || people.length > 40 || people.some(id => typeof id !== 'string' || !capsule.test(id))) {
    throw new HttpError(400, 'בחרו בני משפחה מאילן היוחסין.');
  }
  return {caption: text(caption, 'תיאור', 240), sharedBranches, people: [...new Set(people)]};
}

async function currentProjection(family, db) {
  const {people} = await db('dates');
  const result = nakashProjection(family, new Map(people.map(person => [person.id, person.name])));
  const {portraits} = await db('nakash.compat.portraits', {ids:Object.keys(result.people)});
  for (const [id,framing] of Object.entries(portraits)) {
    result.people[id].profile = portraitPath+id;
    result.people[id].profileFraming = framing;
  }
  return result;
}

function adminSession(request) {
  return request.headers.get('Cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1) || '';
}

export async function nakashRoute(request, env, db, ctx, options) {
  const {family, sniff, streamUpload, limits, recycleRoute} = options;
  const url = new URL(request.url);
  const {pathname: path} = url;
  const method = request.method;
  const branch = url.searchParams.get('branch');
  const kind = url.searchParams.get('kind');

  if(path.startsWith('/nakash/api/compat/')){
    const result=await compatRoute(request,env,db,ctx,options,()=>currentProjection(family,db));
    if(!result)throw notFound();
    return result;
  }
  if(path.startsWith(portraitPath)&&['GET','HEAD'].includes(method)){
    const id=path.slice(portraitPath.length),people=nakashProjection(family,new Map()).people;
    if(!capsule.test(id)||!Object.hasOwn(people,id))throw notFound();
    const {item}=await db('nakash.compat.portrait',{id});
    return getObject(env,item,request);
  }
  if (method === 'POST') checkOrigin(request);
  if (path === adminPath + '/login' && method === 'POST') {
    return recycleRoute(new Request(url.origin + '/api/trash/login', {
      method, body: request.body, duplex: 'half', headers: request.headers,
    }), env, db);
  }
  if (path === adminPath + '/upload-codes' && ['GET', 'POST'].includes(method)) {
    const session = adminSession(request);
    if (method === 'GET') return json(await db('nakash.admin', {session}));
    const body = await readJSON(request, 1024);
    if (!branchIds.has(body.branch)) throw new HttpError(400, 'בחרו ענף תקין.');
    const code = uid();
    await db('nakash.code', {branch: body.branch, digest: await sha256(code), session});
    return json({code}, 201);
  }
  if (path === '/nakash/api/family' && method === 'GET') return json(await currentProjection(family, db));

  if (path === galleryPath) {
    if (!branchIds.has(branch) || !uploadKind.has(kind)) throw new HttpError(400, 'בחרו ענף וסוג קובץ.');
    if (method === 'GET') {
      const page = Math.max(1, Math.min(10_000, Math.floor(Number(url.searchParams.get('page')) || 1)));
      const result = await db('nakash.list', {branch, kind, page});
      return json({items: result.items.map(publicMedia), hasMore: result.hasMore});
    }
    if (method !== 'POST') throw notFound();
    if (request.headers.get('X-Family-Token') !== options.nakashToken) throw new HttpError(403, 'יש לרענן את הדף לפני ההעלאה.');
    if (!configured(env)) throw new HttpError(503, 'אחסון הקבצים אינו זמין כרגע.');
    const metadata = readMetadata(request);
    const branches = new Set(metadata.sharedBranches);
    if (metadata.people.length) {
      const roster = createFamily(await currentProjection(family, db));
      for (const id of metadata.people) {
        if (!Object.hasOwn(roster.people, id)) throw new HttpError(400, 'בחרו בני משפחה מאילן היוחסין.');
        const memberBranch = branchForPerson(roster, id);
        if (memberBranch) branches.add(memberBranch);
      }
    }
    if (!branches.size) branches.add(branch);
    const upload = await streamUpload(request, limits[kind]);
    const id = uid();
    let format;
    try {
      format = sniff(upload.head, kind === 'video');
    } catch (error) {
      await upload.body.cancel().catch(() => {});
      throw error;
    }
    const key = 'nakash/' + id + format.ext;
    const item = {id, key, mime: format.mime, size: upload.size, kind, branch,
      caption: metadata.caption, branches: [...branches], people: metadata.people};
    let stream = upload.body;
    let transfer;
    if (typeof FixedLengthStream !== 'undefined') {
      const fixed = new FixedLengthStream(upload.size);
      transfer = stream.pipeTo(fixed.writable);
      transfer.catch(() => {});
      stream = fixed.readable;
    }
    await putObject(env, key, stream, upload.size, format.mime);
    await transfer;
    try {
      await db('nakash.add', {item});
    } catch (error) {
      if (error.status >= 400 && error.status < 500) ctx.waitUntil(deleteObject(env, key).catch(() => {}));
      throw error;
    }
    return json({item: publicMedia(item)}, 201);
  }
  if (path.startsWith(galleryPath + '/') && ['GET', 'HEAD'].includes(method)) {
    const id = path.slice(galleryPath.length + 1);
    if (!/^[a-f0-9]{32}$/.test(id)) throw notFound();
    const {item} = await db('nakash.get', {id});
    if(item.deletedAt)throw notFound();
    const version=url.searchParams.get('version');
    if(version&&version!==(item.photoRevision||'original')){
      const saved=item.versions?.find(candidate=>candidate.id===version);
      if(!saved)throw notFound();
      return getObject(env,{...item,...saved},request);
    }
    const asset = url.searchParams.get('asset');
    if(['thumbnail','preview'].includes(asset)&&item[asset])return getObject(env,{...item,...item[asset]},request);
    return getObject(env, item, request);
  }

  if (!['GET', 'HEAD'].includes(method) || path.startsWith('/nakash/api/')) throw notFound();
  const section = path === '/nakash' ? '' : path.slice('/nakash/'.length).replace(/\/$/, '');
  if (section === '' || section === 'inside' || branchIds.has(section)) {
    if (!path.endsWith('/')) return new Response(null, {status: 308, headers: {Location: path + '/' + url.search}});
    const asset = new Request(url.origin + assetPath, {method, headers: request.headers});
    return env.ASSETS.fetch(asset);
  }
  if (/^(?:brand-[a-z]+(?:-192|-512)?\.(?:svg|png)|media-adapter\.js|sw\.js|(?:(?:keha|haim|yehuda|medina)\/)?manifest\.webmanifest)$/.test(section)) {
    return env.ASSETS.fetch(request);
  }
  throw notFound();
}
