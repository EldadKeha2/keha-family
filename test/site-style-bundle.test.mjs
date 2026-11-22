import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildSiteStyles} from '../scripts/build-site-styles.mjs';

const root=new URL('../',import.meta.url);

test('site bundle preserves every authored stylesheet byte and cascade position',async()=>{
  const sources=JSON.parse(await readFile(new URL('scripts/site-style-sources.json',root),'utf8'));
  assert.equal(sources.length,62);
  assert.equal(new Set(sources).size,sources.length);
  assert.equal(sources[0],'home-install.css');
  assert.deepEqual(sources.slice(-9),['photo-effects.css','photo-framing.css','desktop-media.css','site-search.css','desktop-share.css','founder-trees.css','family-documents.css','tree-fullscreen.css','tree-phone.css']);
  const parts=await Promise.all(sources.map(async name=>Buffer.concat([await readFile(new URL('public/assets/'+name,root)),Buffer.from('\n')])));
  const expected=Buffer.concat(parts),hash=createHash('sha256').update(expected).digest('hex').slice(0,16);
  const html=await readFile(new URL('public/index.html',root),'utf8');
  const links=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)];
  assert.deepEqual(links.map(match=>match[1]),['assets/site-styles-'+hash+'.css']);
  assert.deepEqual(await readFile(new URL('public/'+links[0][1],root)),expected);
  const headers=await readFile(new URL('public/_headers',root),'utf8');
  assert.match(headers,/\/assets\/site-styles-\*\.css\n\s+! Cache-Control\n\s+Cache-Control: public, max-age=31536000, immutable/);
});

test('source edits create a fresh cache URL and clean up only prior generated bundles',async()=>{
  const fixture=await mkdtemp(join(tmpdir(),'family-css-'));
  try{
    await mkdir(join(fixture,'public/assets'),{recursive:true});
    await mkdir(join(fixture,'scripts'));
    await writeFile(join(fixture,'scripts/site-style-sources.json'),JSON.stringify(['first.css','last.css']));
    await writeFile(join(fixture,'public/assets/first.css'),'.same { color: red; background:url(./decoration.svg) }');
    await writeFile(join(fixture,'public/assets/last.css'),'.same { color: blue }');
    await writeFile(join(fixture,'public/assets/unrelated.css'),'/* retain */');
    await writeFile(join(fixture,'public/index.html'),'<head>\n<link rel="stylesheet" href="assets/first.css?v=1">\n<link rel="stylesheet" href="assets/last.css?v=2">\n<script src="keep.js" defer></script>\n</head>');
    const first=await buildSiteStyles(fixture),again=await buildSiteStyles(fixture);
    assert.equal(again.name,first.name);
    assert.equal(await readFile(join(fixture,'public/assets/'+first.name),'utf8'),'.same { color: red; background:url(./decoration.svg) }\n.same { color: blue }\n');
    await writeFile(join(fixture,'public/assets/last.css'),'.same { color: green }');
    const next=await buildSiteStyles(fixture);
    assert.notEqual(next.name,first.name);
    const html=await readFile(join(fixture,'public/index.html'),'utf8');
    assert.ok(html.includes('assets/'+next.name));
    assert.ok(!html.includes(first.name));
    assert.ok(html.includes('<script src="keep.js" defer></script>'));
    assert.deepEqual((await readdir(join(fixture,'public/assets'))).sort(),['first.css','last.css',next.name,'unrelated.css'].sort());
    await writeFile(join(fixture,'public/index.html'),html.replace('</head>','<link rel="stylesheet" href="assets/unrelated.css">\n</head>'));
    await assert.rejects(buildSiteStyles(fixture),/Add unrelated\.css to scripts\/site-style-sources\.json/);
    assert.ok((await readFile(join(fixture,'public/index.html'),'utf8')).includes('unrelated.css'));
  }finally{await rm(fixture,{recursive:true,force:true});}
});

