import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {parseHTML} from 'linkedom';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {branchPortalHTML,extendedKehaHTML,shlomoKehaHTML} from '../src/extended-keha.mjs';
import {BRANCHES} from '../public/nakash/family-data.mjs';
import {BRANCH_PORTALS} from '../public/keha-extended/branch-portals.mjs';

const source=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const apps=[
  {home:'/',html:source},
  ...BRANCHES.filter(branch=>branch.id!=='keha').map(branch=>({home:'/nakash/'+branch.id+'/',html:nakashHTML(source,branch.id)})),
  {home:'/keha-extended/',html:extendedKehaHTML(source)},
  ...Object.values(BRANCH_PORTALS).map(portal=>({home:portal.home,html:branchPortalHTML(source,portal.id)})),
];

test('all eight Android launch screens use their family color before styles load and matching colored native icons',async()=>{
  assert.equal(apps.length,8);
  const colors=new Set(),icons=new Set();
  for(const app of apps){
    const manifest=JSON.parse(await readFile(new URL('../public'+app.home+'manifest.webmanifest',import.meta.url),'utf8'));
    colors.add(manifest.background_color);
    const {document}=parseHTML(app.html);
    assert.ok(document.getElementById('familyStartupBackground').textContent.includes('html,body{background:'+manifest.background_color+'}'),manifest.name);
    const expected=manifest.background_color.slice(1).match(/../g).map(value=>parseInt(value,16));
    for(const size of [192,512]){
      const icon=manifest.icons.find(item=>item.sizes===size+'x'+size&&item.purpose==='any');
      assert.ok(icon,manifest.name+' has a native '+size+' icon');
      const path=new URL(icon.src,'https://family.example').pathname;
      const bytes=await readFile(new URL('../public'+path,import.meta.url));
      const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,size);assert.equal(info.height,size);
      assert.deepEqual([...data.subarray(0,3)],expected,manifest.name+' icon background matches the Android splash');
      assert.ok(data.some((value,index)=>value!==expected[index%3]),'The family emblem is present on the colored canvas');
      if(size===192)icons.add(createHash('sha256').update(bytes).digest('hex'));
    }
    assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'&&icon.sizes==='512x512'));
  }
  assert.equal(colors.size,8);assert.equal(icons.size,8);
});

test('the original family logo keeps the same centered footprint across native launch icons',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  const pixels=async icon=>sharp(await readFile(new URL('../public'+new URL(icon.src,'https://family.example').pathname,import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const regular=await pixels(manifest.icons.find(icon=>icon.purpose==='any'&&icon.sizes==='512x512'));
  const maskable=await pixels(manifest.icons.find(icon=>icon.purpose==='maskable'));
  assert.ok(regular.data.equals(maskable.data),'Switching from the launcher icon to the splash icon must not resize or move the logo');
  const background=manifest.background_color.slice(1).match(/../g).map(value=>parseInt(value,16));
  const bounds=({data,info})=>{
    let left=info.width,top=info.height,right=-1,bottom=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const offset=(y*info.width+x)*info.channels;
      if(background.some((value,channel)=>Math.abs(data[offset+channel]-value)>15)){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
    }
    return {left,top,width:right-left+1,height:bottom-top+1};
  };
  const large=bounds(regular);
  assert.ok(large.width>256&&large.height>256,'The logo remains clearly visible');
  assert.ok(Math.abs(large.left*2+large.width-512)<=1&&Math.abs(large.top*2+large.height-512)<=1,'The logo remains centered');
  const small=bounds(await pixels(manifest.icons.find(icon=>icon.purpose==='any'&&icon.sizes==='192x192')));
  for(const dimension of ['left','top','width','height'])assert.ok(Math.abs(small[dimension]*512/192-large[dimension])<=2,'The 192px and 512px logos have matching '+dimension);
});

test('the original family alias retains its identity and receives the same olive launch branding',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/keha-extended/shlomo/manifest.webmanifest',import.meta.url),'utf8'));
  const {document}=parseHTML(shlomoKehaHTML(source));
  assert.equal(manifest.id,'/keha-extended/shlomo/');
  assert.ok(document.getElementById('familyStartupBackground').textContent.includes('html,body{background:'+manifest.background_color+'}'));
});
