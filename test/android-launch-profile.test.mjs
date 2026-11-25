import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
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

test('Android launch profiles bypass adaptive splash rendering and provide full-resolution standard PNGs',async()=>{
  for(const manifest of manifests.values()){
    assert.deepEqual(manifest.icons,base.icons.filter(icon=>icon.purpose==='any'));
    assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
    assert.ok(manifest.icons.every(icon=>icon.type==='image/png'&&icon.purpose==='any'));
    for(const icon of manifest.icons){
      const bytes=await readFile(new URL('../public'+icon.src,import.meta.url));
      assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    }
  }
  const installedProfile=manifests.get(13);
  assert.ok(!installedProfile.icons.some(icon=>icon.purpose.split(/\s+/).includes('maskable')),'The exact manifest from the phone must no longer request the adaptive renderer');
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
