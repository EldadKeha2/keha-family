import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/gallery-input-settings.js',import.meta.url),'utf8');
function fixture({checking=false,stored=new Map(),open=true}={}){
 const events=new Map(),viewer={open},window={localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)}};
 const document={getElementById:id=>id==='mediaViewer'?viewer:null,addEventListener:(name,fn)=>events.set(name,fn)};
 vm.runInNewContext(source,{window,document,location:{href:'https://family.test/'+(checking?'?gesture-check='+(checking===true?'6':checking):'')},URL,requestAnimationFrame(){}});
 return{api:window.FamilyGalleryInput,events,stored,viewer};
}
test('ordinary gallery browsing preserves its stored device direction without displaying setup',()=>{
 const f=fixture();assert.equal(f.api.wheelDelta(120),120);assert.equal(f.api.wheelDelta(-120),-120);assert.equal(f.api.isCalibrating(),false);assert.equal(f.events.size,0);assert.equal(f.stored.size,0);
 const reverse=fixture({stored:new Map([['keha-gallery-pad-direction-v2','-1']])});assert.equal(reverse.api.wheelDelta(-120),120);assert.equal(reverse.api.wheelDelta(120),-120);assert.equal(reverse.events.size,0);
});
test('one explicitly requested rightward pad gesture calibrates either OS sign and survives reopening',()=>{
 for(const raw of [-.75,.75]){
  const f=fixture({checking:true});assert.equal(f.api.isCalibrating(),true);assert.equal(f.api.wheelDelta(raw),Math.abs(raw));assert.equal(f.api.isCalibrating(),false);
  assert.equal(f.api.wheelDelta(-raw),-Math.abs(raw));assert.equal(f.stored.get('keha-gallery-pad-direction-v2'),String(Math.sign(raw)));
  const reopened=fixture({stored:f.stored});assert.equal(reopened.api.wheelDelta(raw),Math.abs(raw));assert.equal(reopened.api.isCalibrating(),false);
  const sameSetupURL=fixture({checking:true,stored:f.stored});assert.equal(sameSetupURL.api.isCalibrating(),false);assert.equal(sameSetupURL.api.wheelDelta(-raw),-Math.abs(raw));assert.equal(sameSetupURL.stored.get('keha-gallery-pad-direction-v2'),String(Math.sign(raw)),'Reloading the setup link cannot silently recalibrate a later leftward swipe');
 }
});
test('setup ignores empty input and waits until a media viewer is open',()=>{
 const f=fixture({checking:true,open:false});assert.equal(f.api.wheelDelta(0),0);assert.ok(Number.isNaN(f.api.wheelDelta(NaN)));assert.equal(f.api.wheelDelta(-.75),-.75);assert.equal(f.api.isCalibrating(),true);assert.equal(f.stored.size,0);
 f.viewer.open=true;assert.equal(f.api.wheelDelta(-.75),.75);assert.equal(f.api.isCalibrating(),false);
});
test('old direction attempts cannot silently keep reversing the new controller',()=>{
 const storage=new Map([['keha-gallery-pad-direction','-1']]);
 const ordinary=fixture({stored:storage});assert.equal(ordinary.api.wheelDelta(120),120);assert.equal(ordinary.api.isCalibrating(),false);
 const setup=fixture({checking:'7',stored:storage});assert.equal(setup.api.isCalibrating(),true);assert.equal(setup.api.wheelDelta(120),120);assert.equal(storage.get('keha-gallery-pad-direction-v2'),'1');
});

test('the guided link replaces an unconfirmed wrong direction on the first rightward pad gesture and keeps it on reload',()=>{
 for(const raw of [-120,120]){
  const stored=new Map([['keha-gallery-pad-direction-v2',String(-Math.sign(raw))]]),f=fixture({checking:'10',stored});
  assert.equal(f.api.isCalibrating(),true,'A saved sign from a failed earlier attempt must not skip the requested setup');
  assert.equal(f.api.wheelDelta(raw),120);assert.equal(f.api.isCalibrating(),false);
  const reload=fixture({checking:'10',stored});assert.equal(reload.api.isCalibrating(),false);
  assert.equal(reload.api.wheelDelta(-raw),-120,'Reload cannot misinterpret a later left swipe as calibration');
  const ordinary=fixture({stored});assert.equal(ordinary.api.wheelDelta(raw),120);assert.equal(ordinary.events.size,0);
 }
});

test('the direct reverse action switches the pad immediately, saves it and cancels pending calibration',()=>{
 const stored=new Map([['keha-gallery-pad-direction-v2','1']]),f=fixture({checking:'10',stored});
 assert.equal(f.api.isCalibrating(),true);f.api.reverseWheelDirection();
 assert.equal(f.api.wheelDelta(-120),120);assert.equal(f.api.isCalibrating(),false);
 const reload=fixture({checking:'10',stored});assert.equal(reload.api.wheelFactor(),-1);assert.equal(reload.api.isCalibrating(),false);
 reload.api.reverseWheelDirection();assert.equal(reload.api.wheelDelta(120),120);
});
