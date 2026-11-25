import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import sharp from 'sharp';
import {ANDROID_LAUNCH_HOME,androidLaunchProfile} from '../src/android-launch.mjs';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {extendedKehaHTML,branchPortalHTML} from '../src/extended-keha.mjs';

const source=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const base=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
const manifests=new Map();
for(let quarter=4;quarter<=24;quarter++)manifests.set(quarter,JSON.parse(await readFile(new URL('../public'+ANDROID_LAUNCH_HOME+'density-'+quarter+'.webmanifest',import.meta.url),'utf8')));

function initialManifest(html,{density=3,agent='Mozilla/5.0 (Linux; Android 16) Chrome/144 Mobile Safari/537.36'}={}){
  const {document}=parseHTML(html);
  vm.runInNewContext(document.getElementById('familyAndroidLaunch').textContent,{document,window:{devicePixelRatio:density},navigator:{userAgent:agent}});
  return document.querySelector('link[rel="manifest"]').getAttribute('href');
}

// Chromium's ManifestIconSelector takes the nearest icon at or above the ideal,
// falling back to the largest usable smaller icon. Primary and splash requests
// prefer maskable icons and have different ideal sizes (83dp and 128dp).
function chromeIcon(manifest,ideal,minimum){
  const icons=manifest.icons.filter(icon=>icon.purpose==='maskable')
    .map(icon=>({...icon,size:Number(icon.sizes.split('x')[0])}))
    .filter(icon=>icon.size>=minimum).sort((a,b)=>a.size-b.size);
  return icons.find(icon=>icon.size>=Math.round(ideal))||icons.at(-1);
}

test('the Android page selects a density profile before installation without changing other families or platforms',()=>{
  for(const density of [1,1.01,1.25,1.5,2,2.625,2.75,2.8125,3,3.125,3.5,4,5,6]){
    const {quarter}=androidLaunchProfile(density);
    assert.equal(initialManifest(source,{density}),ANDROID_LAUNCH_HOME+'density-'+quarter+'.webmanifest');
  }
  for(const agent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)','Mozilla/5.0 (Windows NT 10.0) Chrome/144'])assert.equal(initialManifest(source,{agent}),'manifest.webmanifest');
  for(const html of [nakashHTML(source,'haim'),nakashHTML(source,'yehuda'),nakashHTML(source,'medina'),extendedKehaHTML(source),branchPortalHTML(source,'kehat'),branchPortalHTML(source,'zechariah-tzadok')]){
    const {document}=parseHTML(html);
    assert.equal(initialManifest(html),document.querySelector('link[rel="manifest"]').getAttribute('href'));
  }
});

test('Chrome chooses a normal launcher and a separate compensated splash across phone densities',()=>{
  for(let step=100;step<=600;step++){
    const density=step/100,profile=androidLaunchProfile(density),manifest=manifests.get(profile.quarter);
    const primary=chromeIcon(manifest,83*density,83),splash=chromeIcon(manifest,128*density,48*density);
    assert.equal(primary.src,ANDROID_LAUNCH_HOME+'launcher-'+profile.primarySize+'.png','Primary icon at density '+density);
    assert.equal(splash.src,ANDROID_LAUNCH_HOME+'splash-'+profile.splashSize+'.png','Splash icon at density '+density);
    assert.notEqual(primary.src,splash.src);
  }
});

test('every density retains the same application identity, native install fields and self association',()=>{
  for(const [quarter,manifest]of manifests){
    for(const key of ['id','start_url','scope','display','name','short_name','background_color','theme_color','prefer_related_applications'])assert.deepEqual(manifest[key],base[key],key);
    assert.deepEqual(manifest.icons.filter(icon=>icon.purpose==='any'),base.icons.filter(icon=>icon.purpose==='any'));
    const related=manifest.related_applications.find(app=>app.platform==='webapp');
    assert.equal(related.id,'https://keha-family.eldadkeha.workers.dev/');
    assert.equal(new URL(related.url).pathname,ANDROID_LAUNCH_HOME+'density-'+quarter+'.webmanifest');
  }
});

async function artwork(icon){
  const {data,info}=await sharp(new URL('../public'+icon.src,import.meta.url).pathname).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const size=Number(icon.sizes.split('x')[0]);assert.equal(info.width,size);assert.equal(info.height,size);
  const background=[247,243,233];let left=size,right=-1,top=size,bottom=-1;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*info.channels;
    if(background.some((value,channel)=>Math.abs(data[offset+channel]-value)>15)){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  const width=right-left+1,height=bottom-top+1;
  assert.ok(Math.abs(left*2+width-size)<=2&&Math.abs(top*2+height-size)<=2,'Artwork stays centered');
  assert.deepEqual([...data.subarray(0,3)],background);
  return {width:width/size,height:height/size};
}

test('the bitmap compensation cancels the 108/66 enlargement seen in the phone recordings',async()=>{
  for(const manifest of manifests.values()){
    const [primary,splash]=await Promise.all(manifest.icons.filter(icon=>icon.purpose==='maskable').map(artwork));
    for(const dimension of ['width','height']){
      const phoneFirst=primary[dimension],phoneSecond=splash[dimension]*108/66;
      assert.ok(Math.abs(phoneFirst-phoneSecond)<0.025,'The two native footprints match within raster rounding');
      assert.ok(phoneFirst>0.79,'The launcher keeps the original visible emblem size');
    }
  }
});
