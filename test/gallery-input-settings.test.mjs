import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/gallery-input-settings.js',import.meta.url),'utf8');
function fixture({checking=false,stored=new Map(),open=true}={}){
 const events=new Map(),viewer={open},window={localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)}};
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

test('whole-stroke setup learns the deliberate sign rather than its first opposite subpixel packet',()=>{
 for(const sign of [-1,1]){
  const stored=new Map([['keha-gallery-pad-direction-v2',String(-sign)]]),f=fixture({checking:'11',stored});
  assert.equal(f.api.wheelDelta(-sign*.4),.4);assert.equal(f.api.isCalibrating(),true);
  assert.equal(f.api.wheelDelta(sign*120),120);assert.equal(f.api.wheelDelta(sign*40),40);
  assert.equal(stored.get('keha-gallery-pad-direction-v2'),String(-sign),'The first jitter packet must not save the wrong direction');
  f.api.finishWheelDirection();assert.equal(f.api.isCalibrating(),false);assert.equal(f.api.wheelFactor(),sign);
  const reload=fixture({checking:'11',stored});assert.equal(reload.api.isCalibrating(),false);assert.equal(reload.api.wheelDelta(sign*120),120);assert.equal(reload.api.wheelDelta(-sign*120),-120);
 }
});

test('desktop reference setup combines the existing pad action and the existing screen motion without changing the pad setting',()=>{
 const bridgeKey='keha-desktop-gesture-bridge-v14',directionKey='keha-gallery-pad-direction-v2';
 for(const factor of [-1,1])for(const pad of [-1,1])for(const touch of [-1,1]){
  const stored=new Map([[directionKey,String(factor)]]),f=fixture({checking:'14',stored});
  assert.equal(f.api.isCalibrating(),false);assert.equal(f.api.wheelDelta(pad*factor*120),pad*120,'The reference must preserve the already-working selection');
  assert.equal(f.api.desktopBridgePhase(),'pad');f.api.commitTouchGesture(touch*120);assert.equal(f.api.desktopBridgePhase(),'pad','The screen cannot become the pad reference');
  for(const invalid of [0,NaN,Infinity]){f.api.observePadGesture(invalid);f.api.commitPadGesture(invalid);}
  assert.equal(f.api.desktopBridgePhase(),'pad');f.api.observePadGesture(pad*120);f.api.commitPadGesture(pad*120);
  assert.equal(f.api.desktopBridgePhase(),'touch');assert.equal(stored.has(bridgeKey),false,'An incomplete pair must not survive a reload');
  f.api.observeTouchGesture(touch*120);assert.equal(f.api.touchAction(touch),pad);assert.equal(f.api.padMotion(pad*120),touch*120);
  for(const invalid of [0,NaN,Infinity])f.api.commitTouchGesture(invalid);
  assert.equal(f.api.desktopBridgePhase(),'touch');f.api.commitTouchGesture(touch*120);assert.equal(f.api.desktopBridgePhase(),'ready');
  assert.equal(stored.get(directionKey),String(factor));assert.deepEqual(JSON.parse(stored.get(bridgeKey)),{pad,touch});
  const reopened=fixture({stored});assert.equal(reopened.events.size,0,'Ordinary browsing does not display setup');assert.equal(reopened.api.desktopBridgePhase(),'ready');
  assert.equal(reopened.api.wheelDelta(-pad*factor*120),-pad*120);assert.equal(reopened.api.touchAction(-touch),-pad);assert.equal(reopened.api.padMotion(-pad*120),-touch*120);
  const oldLink=fixture({checking:'11',stored});assert.equal(oldLink.api.isCalibrating(),false,'An older setup URL must not overwrite a completed pair');assert.equal(oldLink.api.wheelFactor(),factor);
  reopened.api.commitTouchGesture(-touch*120);reopened.api.commitPadGesture(-pad*120);assert.deepEqual(JSON.parse(stored.get(bridgeKey)),{pad,touch},'Later left/right browsing cannot relearn the reference');
  reopened.api.resetBridge();assert.equal(reopened.api.desktopBridgePhase(),'pad');assert.equal(stored.has(bridgeKey),false);assert.equal(stored.get(directionKey),String(factor));
 }
});

test('ordinary browsing and invalid saved reference pairs keep the previous device behavior',()=>{
 for(const value of [undefined,'{}','{"pad":0,"touch":1}','{"pad":1,"touch":-2}','broken']){
  const f=fixture({stored:new Map(value?[['keha-desktop-gesture-bridge-v14',value]]:[])});
  assert.equal(f.api.desktopBridgeActive(),false);assert.equal(f.api.touchAction(-1),-1);assert.equal(f.api.padMotion(-120),-120);
 }
});
