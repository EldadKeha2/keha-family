import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/gallery-input-settings.js',import.meta.url),'utf8');
function fixture({checking=false,stored=new Map(),open=true}={}){
 const events=new Map(),viewer={open},window={localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)}};
 const document={getElementById:id=>id==='mediaViewer'?viewer:null,addEventListener:(name,fn)=>events.set(name,fn)};
 vm.runInNewContext(source,{window,document,location:{href:'https://family.test/'+(checking?'?gesture-check=6':'')},URL,requestAnimationFrame(){}});
 return{api:window.FamilyGalleryInput,events,stored,viewer};
}
test('ordinary gallery browsing preserves its stored device direction without displaying setup',()=>{
 const f=fixture();assert.equal(f.api.wheelDelta(120),120);assert.equal(f.api.isCalibrating(),false);assert.equal(f.events.size,0);assert.equal(f.stored.size,0);
 const reverse=fixture({stored:new Map([['keha-gallery-pad-direction','-1']])});assert.equal(reverse.api.wheelDelta(-120),120);assert.equal(reverse.api.wheelDelta(120),-120);assert.equal(reverse.events.size,0);
});
test('one explicitly requested rightward pad gesture calibrates either OS sign and survives reopening',()=>{
 for(const raw of [-.75,.75]){
  const f=fixture({checking:true});assert.equal(f.api.isCalibrating(),true);assert.equal(f.api.wheelDelta(raw),Math.abs(raw));assert.equal(f.api.isCalibrating(),false);
  assert.equal(f.api.wheelDelta(-raw),-Math.abs(raw));assert.equal(f.stored.get('keha-gallery-pad-direction'),String(Math.sign(raw)));
  const reopened=fixture({stored:f.stored});assert.equal(reopened.api.wheelDelta(raw),Math.abs(raw));assert.equal(reopened.api.isCalibrating(),false);
  const sameSetupURL=fixture({checking:true,stored:f.stored});assert.equal(sameSetupURL.api.isCalibrating(),false);assert.equal(sameSetupURL.api.wheelDelta(-raw),-Math.abs(raw));assert.equal(sameSetupURL.stored.get('keha-gallery-pad-direction'),String(Math.sign(raw)),'Reloading the setup link cannot silently recalibrate a later leftward swipe');
 }
});
test('setup ignores empty input and waits until a media viewer is open',()=>{
 const f=fixture({checking:true,open:false});assert.equal(f.api.wheelDelta(0),0);assert.ok(Number.isNaN(f.api.wheelDelta(NaN)));assert.equal(f.api.wheelDelta(-.75),-.75);assert.equal(f.api.isCalibrating(),true);assert.equal(f.stored.size,0);
 f.viewer.open=true;assert.equal(f.api.wheelDelta(-.75),.75);assert.equal(f.api.isCalibrating(),false);
});
