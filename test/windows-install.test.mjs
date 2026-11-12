import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/windows-install.js',import.meta.url),'utf8');
const win64={userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',userAgentData:{platform:'Windows',mobile:false}};
function run(navigator=win64){const window={};vm.runInNewContext(source,{window,navigator});return window.FamilyWindowsInstall;}
const hints=(platformVersion,more={})=>({platform:'Windows',platformVersion,architecture:'x86',bitness:'64',...more});

test('Store routing respects our MSIX minimum while retaining the native app for supported earlier Windows 10',()=>{
  const api=run();
  for(const version of ['10.0.0','13.0.0','15.0.0'])assert.equal(api.classify(win64,hints(version),{storeAvailable:true}).route,'store',version);
  for(const version of ['5.0.0','7.0.0','8.0.0'])assert.equal(api.classify(win64,hints(version),{storeAvailable:true}).route,'native',version);
  assert.equal(api.classify(win64,hints('10.0.0')).route,'native','An unpublished Store product is never offered');
  assert.equal(api.distribution.storeAvailable,false);
});

test('legacy Windows, early Windows 10 and incompatible CPUs receive the browser shortcut',()=>{
  const api=run();
  for(const nt of ['5.1','6.1','6.2','6.3'])assert.equal(api.classify({userAgent:`Windows NT ${nt}; Win64; x64`}).route,'shortcut',nt);
  for(const version of ['0.0.0','1.0.0','2.0.0','3.0.0','4.0.0'])assert.equal(api.classify(win64,hints(version),{storeAvailable:true}).route,'shortcut',version);
  assert.equal(api.classify(win64,hints('13.0.0',{bitness:'32'}),{storeAvailable:true}).route,'shortcut');
  assert.equal(api.classify(win64,hints('13.0.0',{architecture:'arm'}),{storeAvailable:true}).route,'shortcut','We do not ship an ARM build');
  assert.equal(api.classify({userAgent:'Windows NT 6.1; WOW64'}).route,'shortcut');
});

test('missing, rejected and malformed client hints provide a choice rather than guessing compatibility',async()=>{
  const api=run();
  assert.equal(api.current.route,'options');
  for(const version of ['', 'unknown', '-1.0.0'])assert.equal(api.classify(win64,hints(version)).route,'options');
  assert.equal(api.classify({userAgent:'Windows NT 10.0'},hints('13.0.0',{bitness:''})).route,'options');
  const denied=run({...win64,userAgentData:{...win64.userAgentData,getHighEntropyValues:async()=>{throw Error('Denied');}}});
  assert.equal((await denied.ready).route,'options');
});

test('OS bitness rather than the browser process determines eligibility and high-entropy hints update the recommendation',async()=>{
  const api=run({...win64,userAgent:'Windows NT 10.0; WOW64',userAgentData:{...win64.userAgentData,getHighEntropyValues:async()=>hints('13.0.0')}});
  assert.equal((await api.ready).route,'native');
  assert.equal(api.current.bitness,64);
});

test('non-Windows and mobile devices never get a Windows download recommendation or a hints request',async()=>{
  for(const userAgent of ['Mozilla/5.0 (Macintosh; Intel Mac OS X)','Mozilla/5.0 (Linux; Android 16) Mobile','Mozilla/5.0 (iPhone)','Mozilla/5.0 (X11; Linux x86_64)']){
    let calls=0;const api=run({userAgent,userAgentData:{getHighEntropyValues:async()=>{calls++;return hints('13.0.0');}}});
    assert.equal((await api.ready).route,'none');assert.equal(calls,0);
  }
  assert.equal(run({...win64,userAgentData:{...win64.userAgentData,mobile:true}}).current.route,'none');
});
