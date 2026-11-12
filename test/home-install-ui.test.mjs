import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/home-install.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const decodeHTML=value=>value.replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[entity]));
const assertNoInstallationCopy=dialog=>{
  assert.equal(dialog.querySelector('[data-home-install-copy]'),null);
  assert.equal(dialog.querySelector('#homeInstallLink'),null);
  assert.doesNotMatch(dialog.innerHTML,/<(?:input|textarea)\b|copy|paste|העתק|להדביק|הדבקה/i);
};
const assertProgress=(f,active)=>{
  const bars=[f.card.querySelector('[data-home-install-progress]'),f.dialog.querySelector('[data-home-install-progress]')].filter(Boolean);
  if(active)assert.ok(bars.length,'An active installation has visible progress');
  assert.equal(bars.some(bar=>!bar.hidden),active);
  for(const bar of bars){assert.equal(bar.getAttribute('role'),'progressbar');assert.equal(bar.hasAttribute('aria-valuenow'),false);assert.equal(bar.hasAttribute('value'),false);}
};
const assertSuccess=f=>{
  const success=f.dialog.querySelector('[data-home-install-success]');assert.ok(success);assert.equal(f.dialog.open,true);
  assert.ok(success.getAttribute('role')==='status'||['polite','assertive'].includes(success.getAttribute('aria-live')),'Completion is announced accessibly');
  assert.ok(f.dialog.querySelector('[data-home-install-success-browse]'));assertProgress(f,false);
};

// Only controller-facing DOM APIs are modeled. Native dialog focus containment,
// operating-system install prompts and phone layout are checked in the browser.
function fixture({mobile=true,standalone=false,iosStandalone=false,english=false,userAgent='Mozilla/5.0 (Linux; Android 16) Chrome/141.0.0.0 Mobile Safari/537.36',maxTouchPoints=0,userAgentMobile=false,clipboard='works',share='missing',installedRelated='missing',iframe=false,entryUrl,autoReady=true,nativeDialog=true,recordNavigation=false,clientHints='missing',webInstall='missing'}={}){
  const nodes=new Map(),copied=[],shared=[],relatedCalls=[],assignments=[],reloads=[],webInstallCalls=[];
  const timers=new Map();let clock=0,nextTimer=0;
  const schedule=(fn,delay=0)=>{const id=++nextTimer;timers.set(id,{fn,at:clock+Math.max(0,Number(delay)||0)});return id;};
  const advanceTime=async milliseconds=>{
    const until=clock+milliseconds;
    for(;;){
      const next=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!next)break;
      clock=next[1].at;timers.delete(next[0]);next[1].fn();await tick();
    }
    clock=until;await tick();
  };
  const document=new EventTarget();document.activeElement=null;document.readyState='loading';document.visibilityState='visible';
  class Element extends EventTarget{
    constructor(tag='div'){
      super();this.tagName=tag;this.hidden=false;this.open=false;this.disabled=false;this.dataset={};this.attrs=new Map();this.children=new Map();this.textContent='';this.value='';this.modalCalls=0;
      const classes=new Set();this.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name)};
      if(tag==='dialog'&&!nativeDialog){this.showModal=undefined;this.close=undefined;}
    }
    setAttribute(name,value){this.attrs.set(name,String(value));}
    getAttribute(name){return this.attrs.get(name)??null;}
    removeAttribute(name){this.attrs.delete(name);}
    hasAttribute(name){return this.attrs.has(name);}
    set dir(value){this.setAttribute('dir',value);}
    get dir(){return this.getAttribute('dir')||'';}
    focus(){document.activeElement=this;}
    select(){this.selected=true;}
    showModal(){this.open=true;this.modalCalls++;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
    getBoundingClientRect(){return {left:0,right:320,top:0,bottom:400};}
    contains(node){return node===this||[...this.children.values()].includes(node);}
    closest(selector){return this.attrs.has(selector.replace(/^\[|\]$/g,''))?this:null;}
    querySelector(selector){return this.children.get(selector)??null;}
    querySelectorAll(selector){const one=this.querySelector(selector);return one?[one]:[];}
    set innerHTML(html){
      this.html=html;this.children=new Map();
      for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)){
        const child=new Element(match[1]);
        const contentStart=match.index+match[0].length,contentEnd=html.indexOf('</'+match[1]+'>',contentStart);
        if(contentEnd>=0)child.textContent=decodeHTML(html.slice(contentStart,contentEnd).replace(/<[^>]*>/g,''));
        for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){
          const value=decodeHTML(attr[2]??'');
          child.setAttribute(attr[1],value);if(attr[1]==='hidden')child.hidden=true;
          if(attr[1]==='id'){child.id=value;nodes.set(value,child);this.children.set('#'+value,child);}
          if(attr[1].startsWith('data-')){this.children.set('['+attr[1]+']',child);child.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;}
          if(attr[1]==='class')for(const name of value.split(/\s+/)){this.children.set('.'+name,child);child.classList.add(name);}
          if(attr[1]==='value')child.value=value;
          if(attr[1]==='for')this.children.set(match[1]+'[for="'+value+'"]',child);
        }
      }
    }
    get innerHTML(){return this.html||'';}
  }
  const card=new Element('section'),dialog=new Element('dialog');nodes.set('homeInstall',card);nodes.set('homeInstallDialog',dialog);
  const windowsLink=new Element('a');windowsLink.setAttribute('href','#install-desktop');windowsLink.children.set('span',new Element('span'));nodes.set('desktopShortcutLink',windowsLink);
  document.documentElement=new Element('html');document.documentElement.lang=english?'en-US':'he';
  document.getElementById=id=>nodes.get(id)||null;
  const window=new EventTarget();window.top=iframe?{}:window;window.FamilyI18n={isEnglish:english,language:english?'en-US':'he'};
  const queries=new Map();
  const matchMedia=query=>{if(!queries.has(query)){const media=new EventTarget();media.matches=query.includes('display-mode')?standalone:mobile;queries.set(query,media);}return queries.get(query);};
  const navigator={userAgent,maxTouchPoints,standalone:iosStandalone,userAgentData:{mobile:userAgentMobile}};
  if(webInstall!=='missing')navigator.install=()=>{webInstallCalls.push(true);if(webInstall==='works')return Promise.resolve({manifestId:'https://family.example/'});const error=Error('Install unavailable');error.name=webInstall;return Promise.reject(error);};
  if(clientHints!=='missing')navigator.userAgentData.getHighEntropyValues=async()=>{if(clientHints==='denied')throw Error('Client hints unavailable');return clientHints;};
  if(installedRelated!=='missing')navigator.getInstalledRelatedApps=async()=>{relatedCalls.push(true);if(installedRelated==='throw')throw Error('Detection unavailable');return typeof installedRelated==='function'?installedRelated():installedRelated;};
  if(share!=='missing')navigator.share=async payload=>{shared.push(payload);if(share!=='works'){const error=Error('Share unavailable');error.name=share;throw error;}};
  if(clipboard!=='missing')navigator.clipboard={writeText:async value=>{if(clipboard==='blocked')throw Error('Clipboard denied');copied.push(value);}};
  const location=new URL(entryUrl||'https://family.example/?game=neto-tetris&lang='+window.FamilyI18n.language+'#games');window.location=location;
  location.reload=()=>reloads.push(location.href);
  if(recordNavigation)location.assign=value=>assignments.push(String(value));
  const context=vm.createContext({window,document,navigator,location,matchMedia,URL,URLSearchParams,Event,console,setTimeout:schedule,clearTimeout:id=>timers.delete(id)});
  const ready=()=>{document.readyState='interactive';document.dispatchEvent(new Event('DOMContentLoaded'));document.readyState='complete';};
  vm.runInContext(source,context);if(autoReady)ready();
  const button=()=>card.querySelector('[data-home-install-action]');
  return {window,document,card,dialog,queries,nodes,copied,shared,relatedCalls,button,ready,location,advanceTime,assignments,reloads,windowsLink,webInstallCalls,
    click(element){const event=new Event('click',{cancelable:true});element.dispatchEvent(event);return event;},
    resize(value){const media=matchMedia('(max-width: 700px)');media.matches=value;media.dispatchEvent(new Event('change'));},
    standalone(value){const media=matchMedia('(display-mode: standalone)');media.matches=value;media.dispatchEvent(new Event('change'));},
    offer({outcome='dismissed',error=false,choicePending=false}={}){
      let calls=0;const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=()=>{calls++;return error?Promise.reject(Error('Prompt unavailable')):Promise.resolve();};
      let resolveChoice;event.userChoice=choicePending?new Promise(resolve=>{resolveChoice=resolve;}):Promise.resolve({outcome});
      window.dispatchEvent(event);return {event,get calls(){return calls;},choose(value=outcome){resolveChoice?.({outcome:value});}};
    }
  };
}

test('phone toolbar responds to viewport changes and keeps both controls in installed apps',()=>{
  const f=fixture();assert.equal(f.card.hidden,false);assert.equal(f.dialog.open,false);assert.equal(f.button().getAttribute('aria-label'),'התקן קיצור דרך לאתר');assert.equal(f.card.querySelector('[data-home-install-share]').getAttribute('aria-label'),'שיתוף האתר');assert.equal(f.button().textContent,'התקן');assert.match(f.card.innerHTML,/>שיתוף</);
  f.resize(false);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,true);assert.equal(f.card.querySelector('[data-home-install-share]').hidden,false);f.resize(true);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);
  f.standalone(true);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);assert.equal(f.card.querySelector('[data-home-install-share]').hidden,false);f.standalone(false);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);
  assert.equal(fixture({mobile:false}).card.hidden,false);assert.equal(fixture({mobile:false}).button().hidden,true);
  assert.equal(fixture({mobile:false,userAgentMobile:true}).card.hidden,false);
  for(const options of [{standalone:true},{iosStandalone:true}]){const installed=fixture(options);assert.equal(installed.card.hidden,false);assert.equal(installed.button().hidden,false);assert.equal(installed.card.querySelector('[data-home-install-share]').hidden,false);}
});

test('already installed shortcut announces its state instead of reopening installation',()=>{
  for(const options of [{standalone:true},{iosStandalone:true}]){
    const f=fixture(options),offer=f.offer();f.click(f.button());
    assert.equal(f.button().hidden,false);assert.equal(offer.calls,0);assert.equal(f.dialog.open,false);
    const status=f.card.querySelector('[data-home-install-status]');assert.equal(status.hidden,false);assert.equal(status.textContent,'קיצור הדרך כבר מותקן');
  }
  const english=fixture({english:true,standalone:true});english.click(english.button());
  assert.equal(english.card.querySelector('[data-home-install-status]').textContent,'The shortcut is already installed');assert.equal(english.dialog.open,false);
});

test('normal browser detects only this installed web app by its manifest or identity',async()=>{
  for(const app of [
    {platform:'webapp',url:'https://family.example/manifest.webmanifest'},
    {platform:'webapp',id:'https://family.example/'}
  ]){
    const f=fixture({installedRelated:[app]});await tick();f.click(f.button());await tick();
    assert.ok(f.relatedCalls.length>0);assert.equal(f.button().hidden,false);assert.equal(f.dialog.open,false);
    assert.equal(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
  }
});

test('unknown installed state, unrelated apps and detection failure retain installation help',async()=>{
  for(const installedRelated of ['missing',[],[{platform:'webapp',url:'https://other.example/manifest.webmanifest',id:'https://other.example/'}],'throw']){
    const f=fixture({installedRelated});await tick();f.click(f.button());await tick();
    assert.equal(f.dialog.open,true);assert.notEqual(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
  }
});

test('embedded preview does not query installed apps and never treats absent prompt as installed',async()=>{
  const f=fixture({iframe:true,installedRelated:[{platform:'webapp',id:'https://family.example/'}]});await tick();
  f.click(f.button());await tick();assert.equal(f.relatedCalls.length,0);assert.equal(f.dialog.open,true);
});

test('Android native prompt requires a tap, is consumed once and dismissal leaves working manual help',async()=>{
  const f=fixture({installedRelated:[]}),offer=f.offer();assert.equal(offer.event.defaultPrevented,true);assert.equal(offer.calls,0);
  f.click(f.button());f.click(f.button());assert.equal(offer.calls,1);await tick();assert.equal(f.card.hidden,false);
  assertProgress(f,false);
  f.click(f.button());await tick();assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);
  assert.match(f.dialog.innerHTML,/Chrome/);assert.match(f.dialog.innerHTML,/הוספה למסך הבית/);
});

test('header installation shows indeterminate requesting and accepted progress without claiming completion',async()=>{
  const f=fixture(),offer=f.offer({outcome:'accepted',choicePending:true});assertProgress(f,false);
  f.click(f.button());await tick();assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);assertProgress(f,true);
  assert.equal(f.button().disabled,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  offer.choose();await tick();assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  f.window.dispatchEvent(new Event('appinstalled'));await tick();assertProgress(f,true);
  assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);assert.notEqual(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
  assert.ok(f.dialog.querySelector('[data-home-install-check-icon]'));
});

test('unavailable native prompt opens manual help and re-enables the trigger',async()=>{
  const f=fixture(),offer=f.offer({error:true});f.click(f.button());await tick();
  assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);assert.equal(f.button().disabled,false);assertProgress(f,false);
});

test('iPhone and touch iPad use Share instructions, while embedded browsers explain opening the full browser',async()=>{
  for(const options of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari/604.1'},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari/605.1',maxTouchPoints:5}
  ]){
    const f=fixture(options);f.click(f.button());await tick();assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/Safari/);assert.match(f.dialog.innerHTML,/שיתוף/);assert.match(f.dialog.innerHTML,/הוספה למסך הבית/);
    assert.ok(f.dialog.querySelector('[data-home-install-apple-steps]'));assert.equal(f.dialog.querySelector('[data-home-install-invite-start]'),null);assert.equal(f.dialog.querySelector('[data-home-install-profile]'),null);
    f.click(f.dialog.querySelector('[data-home-install-language]'));
    assert.ok(f.dialog.querySelector('[data-home-install-apple-steps]'));assert.equal(f.dialog.querySelector('[data-home-install-invite-start]'),null);assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
  }
  const embedded=fixture({userAgent:'Mozilla/5.0 (Linux; Android 16) Instagram WhatsApp FBAN/FB4A'});embedded.click(embedded.button());await tick();
  assert.match(embedded.dialog.innerHTML,/Chrome/);assert.match(embedded.dialog.innerHTML,/בדפדפן|דפדפן/);
  assert.equal(embedded.dialog.querySelector('[data-home-install-profile]'),null);
});

test('manual dialog closes and restores button focus',async()=>{
  const f=fixture();f.click(f.button());await tick();assert.equal(f.dialog.open,true);
  f.click(f.dialog.querySelector('[data-home-install-close]'));assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());
});

test('manual installation help has direct instructions without clipboard controls',async()=>{
  for(const options of [{},{english:true},{clipboard:'missing'},{clipboard:'blocked'}]){
    const f=fixture(options);f.click(f.button());await tick();
    assert.equal(f.dialog.open,true);assertNoInstallationCopy(f.dialog);assert.equal(f.copied.length,0);assertProgress(f,false);
  }
});

test('English toolbar and platform instructions contain localized visible copy',async()=>{
  const f=fixture({english:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'});f.click(f.button());await tick();
  assert.equal(f.button().getAttribute('aria-label'),'Install site shortcut');assert.equal(f.button().textContent,'Install');assert.match(f.dialog.innerHTML,/Share/);assert.doesNotMatch(f.card.innerHTML+f.dialog.innerHTML,/[\u0590-\u05ff]/);
});

test('share on phones and computers sends the same localized installation invitation only after a tap',async()=>{
  for(const mobile of [true,false]){
    const f=fixture({mobile,share:'works',english:true,userAgent:mobile?'Mozilla/5.0 (Linux; Android 16) Chrome/141.0.0.0 Mobile Safari/537.36':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36'});assert.equal(f.shared.length,0);assert.equal(f.card.hidden,false);
    f.click(f.card.querySelector('[data-home-install-share]'));assert.equal(f.shared.length,1);await tick();
    assert.equal(f.copied.length,0);assert.equal(f.shared[0].title,'Keha Family Home');
    assert.equal(f.shared[0].url,'https://family.example/?lang=en-US&install=1#home');
    assert.equal(f.card.querySelector('[data-home-install-share]').disabled,false);
    assert.match(f.card.querySelector('[data-home-install-share-status]').textContent,/Link ready to share/);
  }
});

test('cancelling the native share sheet is silent and does not copy anything',async()=>{
  const f=fixture({share:'AbortError'});f.click(f.card.querySelector('[data-home-install-share]'));await tick();
  assert.equal(f.shared.length,1);assert.equal(f.copied.length,0);assert.equal(f.card.querySelector('[data-home-install-share-status]').textContent,'');
  assert.ok(!f.nodes.get('homeInstallShareLink')||f.nodes.get('homeInstallShareLink').hidden);assert.equal(f.card.querySelector('[data-home-install-share]').disabled,false);
});

test('missing or failed Web Share copies the invitation, and unavailable clipboard exposes a selected readable invitation',async()=>{
  for(const share of ['missing','NotAllowedError']){
    const f=fixture({share});f.click(f.card.querySelector('[data-home-install-share]'));await tick();
    assert.deepEqual(f.copied,['https://family.example/?lang=he&install=1#home']);assert.ok(!f.nodes.get('homeInstallShareLink')||f.nodes.get('homeInstallShareLink').hidden);
  }
  for(const clipboard of ['missing','blocked']){
    const f=fixture({clipboard});f.click(f.card.querySelector('[data-home-install-share]'));await tick();
    const input=f.nodes.get('homeInstallShareLink');assert.equal(f.dialog.open,true);assert.equal(input.hidden,false);assert.equal(input.selected,true);
    assert.equal(input.value,'https://family.example/?lang=he&install=1#home');assert.equal(f.document.activeElement,input);
    assert.equal(f.dialog.querySelector('label[for="homeInstallShareLink"]').hidden,false);
    assert.equal(f.card.querySelector('[data-home-install-share]').disabled,false);f.dialog.close();assert.equal(f.document.activeElement,f.card.querySelector('[data-home-install-share]'));
  }
});

test('an installed sender shares an installation invitation that an independent recipient can install',async()=>{
  const sender=fixture({standalone:true,share:'works',english:true}),senderOffer=sender.offer();
  sender.click(sender.card.querySelector('[data-home-install-share]'));await tick();
  assert.equal(senderOffer.calls,0);assert.equal(sender.shared.length,1);
  assert.equal(sender.shared[0].url,'https://family.example/?lang=en-US&install=1#home');
  const recipient=fixture({entryUrl:sender.shared[0].url,english:true});await tick();
  assert.equal(recipient.dialog.open,true);assert.ok(recipient.dialog.querySelector('[data-home-install-invite-start]'));
  assert.equal(recipient.dialog.querySelector('[data-home-install-invite-installed]'),null);
  assert.doesNotMatch(recipient.dialog.innerHTML,/[֐-׿]/);
  const recipientOffer=recipient.offer({outcome:'accepted'});assert.equal(recipientOffer.calls,0);
  recipient.click(recipient.dialog.querySelector('[data-home-install-invite-start]'));await tick();
  assert.equal(recipientOffer.calls,1);assert.equal(senderOffer.calls,0);
});

test('incoming invitation waits for DOM readiness and a user tap before prompting',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home',autoReady:false}),offer=f.offer();
  assert.equal(f.dialog.open,false);assert.equal(offer.calls,0);
  f.ready();await tick();assert.equal(f.dialog.open,true);assert.equal(offer.calls,0);
  assert.ok(f.dialog.querySelector('[data-home-install-invite-browse]'));
  f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
  assert.equal(offer.calls,1);
  f.click(f.button());await tick();assert.equal(offer.calls,1,'The retained native event cannot be prompted twice');
});

test('a native offer arriving after the invitation opens is available from its install action',async()=>{
  for(const english of [false,true]){
    const label=english?'Install':'התקן',f=fixture({english,entryUrl:'https://family.example/?lang='+(english?'en-US':'he')+'&install=1#home'});await tick();
    assert.equal(f.dialog.open,true);assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,label);assertNoInstallationCopy(f.dialog);
    const progress=f.dialog.querySelector('[data-home-install-progress]');assert.ok(progress);assert.equal(progress.hidden,true);
    const offer=f.offer();assert.equal(offer.calls,0);assert.equal(f.dialog.open,true);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,label);
    f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
    assert.equal(offer.calls,1);assert.equal(f.button().disabled,false);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,label);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-status]').textContent,english?'Tap again for installation instructions.':'לחצו שוב להנחיות ההוספה.');
    assertProgress(f,false);
  }
});

test('accepted and appinstalled invitation notifications await actual icon confirmation',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();
  const offer=f.offer({outcome:'accepted'});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
  assert.equal(offer.calls,1);assert.equal(f.dialog.querySelector('[data-home-install-invite-installed]'),null);
  assert.equal(f.dialog.open,true);assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  assert.notEqual(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
  f.window.dispatchEvent(new Event('appinstalled'));await tick();
  assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  f.click(f.dialog.querySelector('[data-home-install-check-icon]'));assertSuccess(f);assert.match(f.dialog.innerHTML,/האייקון מוכן/);
  f.click(f.dialog.querySelector('[data-home-install-success-browse]'));assert.equal(f.dialog.open,false);
  f.click(f.button());assert.equal(offer.calls,1);assert.equal(f.dialog.open,false);assert.equal(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
});

test('installed invitation recipients see their local installed state and browse without prompting',async()=>{
  for(const options of [{standalone:true},{iosStandalone:true},{installedRelated:[{platform:'webapp',id:'https://family.example/'}]}]){
    const f=fixture({...options,entryUrl:'https://family.example/?lang=he&install=1#home'}),offer=f.offer();await tick();
    assert.equal(f.dialog.open,true);assert.ok(f.dialog.querySelector('[data-home-install-invite-installed]'));
    assert.equal(f.dialog.querySelector('[data-home-install-invite-start]'),null);assert.equal(offer.calls,0);
    f.click(f.dialog.querySelector('[data-home-install-invite-browse]'));assert.equal(f.dialog.open,false);assert.equal(offer.calls,0);
  }
});

test('invitation browse dismisses the introduction permanently for this page and install=0 never opens it',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();
  assert.equal(f.dialog.open,true);f.click(f.dialog.querySelector('[data-home-install-invite-browse]'));assert.equal(f.dialog.open,false);
  const shown=f.dialog.modalCalls;f.window.dispatchEvent(new Event('pageshow'));f.document.dispatchEvent(new Event('visibilitychange'));await tick();
  assert.equal(f.dialog.open,false);assert.equal(f.dialog.modalCalls,shown);
  const ordinary=fixture({entryUrl:'https://family.example/?lang=he&install=0#home'});await tick();
  assert.equal(ordinary.dialog.open,false);assert.equal(ordinary.dialog.modalCalls,0);
});

test('shared installation links leave desktop browsers on the website at every viewport width',async()=>{
  for(const userAgent of [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/145.0'
  ])for(const mobile of [false,true]){
    const entryUrl='https://family.example/?lang=he&install=1#home',f=fixture({userAgent,mobile,entryUrl,autoReady:false,recordNavigation:true}),offer=f.offer();
    f.ready();await tick();assert.equal(f.dialog.open,false);assert.equal(f.dialog.modalCalls,0);assert.equal(offer.calls,0);assert.equal(f.card.hidden,false);assert.equal(f.card.querySelector('[data-home-install-share]').hidden,false);
    f.resize(!mobile);f.window.dispatchEvent(new Event('pageshow'));f.window.dispatchEvent(new Event('focus'));f.document.dispatchEvent(new Event('visibilitychange'));await tick();
    assert.equal(f.dialog.open,false);assert.equal(f.dialog.modalCalls,0);assert.equal(offer.calls,0);assert.deepEqual(f.assignments,[]);assert.equal(f.location.href,entryUrl);
  }
});

test('phones and tablets receive shared installation invitations even with wide viewports',async()=>{
  for(const options of [
    {userAgent:'Mozilla/5.0 (Linux; Android 16) Chrome/141.0.0.0 Safari/537.36'},
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'},
    {userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Safari/604.1'},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1',maxTouchPoints:5},
    {userAgent:'Mozilla/5.0 (Tablet; rv:145.0) Gecko/20100101 Firefox/145.0'},
    {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36',userAgentMobile:true}
  ]){
    const f=fixture({...options,mobile:false,entryUrl:'https://family.example/?lang=he&install=1#home',autoReady:false}),offer=f.offer();
    assert.equal(f.dialog.open,false);f.ready();await tick();assert.equal(f.dialog.open,true);assert.equal(offer.calls,0);
    if(f.dialog.querySelector('[data-home-install-apple-steps]')){assert.equal(f.dialog.querySelector('[data-home-install-invite-start]'),null);assert.equal(offer.calls,0);}
    else{f.click(f.dialog.querySelector('[data-home-install-invite-start]'));assert.equal(offer.calls,1);await tick();}
  }
});

test('older phones without native dialog support can open and dismiss an installation invitation',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home',nativeDialog:false});await tick();
  assert.equal(f.dialog.open,true);assert.equal(f.dialog.hasAttribute('open'),true);
  assert.equal(f.dialog.getAttribute('role'),'dialog');assert.equal(f.dialog.getAttribute('aria-modal'),'true');
  assert.equal(f.dialog.classList.contains('home-install-dialog-fallback'),true);
  f.click(f.dialog.querySelector('[data-home-install-invite-browse]'));assert.equal(f.dialog.open,false);
  assert.equal(f.dialog.hasAttribute('open'),false);assert.equal(f.document.activeElement,f.card.querySelector('[data-home-install-share]'));
});

test('invitation without a native prompt opens localized platform steps without copying or pasting',async()=>{
  for(const options of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',browser:/Safari/,otherBrowser:/Chrome/},
    {userAgent:'Mozilla/5.0 (Linux; Android 16) Chrome/141.0.0.0 Mobile Safari/537.36',browser:/Chrome/,otherBrowser:/Safari/},
    {userAgent:'Mozilla/5.0 (X11; Linux x86_64) Firefox/145.0',browser:/iPhone \/ iPad/,desktop:true}
  ]){
    const f=fixture({...options,entryUrl:'https://family.example/?lang=en-US&install=1#home',english:true,clipboard:'blocked'});await tick();
    if(options.desktop){assert.equal(f.dialog.open,false);f.click(f.button());}
    else{assert.equal(f.dialog.open,true);const start=f.dialog.querySelector('[data-home-install-invite-start]');if(start)f.click(start);else assert.ok(f.dialog.querySelector('[data-home-install-apple-steps]'));}
    await tick();assert.equal(f.dialog.open,true);
    assert.match(f.dialog.innerHTML,options.browser);assert.match(f.dialog.innerHTML,/Add to Home [Ss]creen/);assert.doesNotMatch(f.dialog.innerHTML,/[֐-׿]/);
    if(options.otherBrowser)assert.doesNotMatch(f.dialog.innerHTML,options.otherBrowser);
    assertNoInstallationCopy(f.dialog);assert.equal(f.copied.length,0);
  }
});

test('WhatsApp installation uses the app menu to open a full browser without copy instructions',async()=>{
  for(const options of [
    {userAgent:'Mozilla/5.0 (Linux; Android 16) WhatsApp/2.26.1',browser:/Chrome/},
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) WhatsApp/2.26.1',browser:/Safari/}
  ]){
    const f=fixture({...options,entryUrl:'https://family.example/?lang=en-US&install=1#home',english:true});await tick();
    assertNoInstallationCopy(f.dialog);const start=f.dialog.querySelector('[data-home-install-invite-start]');if(start)f.click(start);else assert.ok(f.dialog.querySelector('[data-home-install-apple-steps]'));await tick();
    assert.match(f.dialog.innerHTML,/menu/i);assert.match(f.dialog.innerHTML,/Open in browser/);assert.match(f.dialog.innerHTML,options.browser);assertNoInstallationCopy(f.dialog);
  }
});

test('a native prompt arriving during manual help offers a direct one-use Install action in that dialog',async()=>{
  for(const options of [{},{english:true},{nativeDialog:false}]){
    const f=fixture(options);f.click(f.button());await tick();assert.equal(f.dialog.open,true);
    assert.equal(f.dialog.querySelector('[data-home-install-native-start]').hidden,true);assert.equal(f.dialog.querySelector('[data-home-install-instructions]').hidden,false);
    const opened=f.dialog.modalCalls,offer=f.offer({outcome:'accepted'}),action=f.dialog.querySelector('[data-home-install-native-start]');
    assert.equal(offer.calls,0);assert.equal(f.dialog.open,true);assert.equal(f.dialog.modalCalls,opened);
    assert.ok(action);assert.equal(action.hidden,false);assert.equal(action.disabled,false);assert.equal(action.textContent,options.english?'Install':'התקן');assertNoInstallationCopy(f.dialog);
    assert.equal(f.dialog.querySelector('[data-home-install-instructions]').hidden,true);
    f.click(action);f.click(action);assert.equal(offer.calls,1);assert.equal(action.disabled,true);await tick();
    const accepted=f.card.querySelector('[data-home-install-status]').textContent;
    assert.ok(accepted);assert.equal(f.dialog.querySelector('[data-home-install-help-status]').textContent,accepted);assertProgress(f,true);
    const consumed=f.dialog.querySelector('[data-home-install-native-start]');assert.ok(!consumed||consumed.hidden||consumed.disabled);
    f.window.dispatchEvent(new Event('appinstalled'));await tick();assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
    f.standalone(true);assertSuccess(f);f.click(f.dialog.querySelector('[data-home-install-success-browse]'));assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());
  }
});

test('unconfirmed acceptance stops progress after twenty seconds and explains that completion is unknown',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();
  const offer=f.offer({outcome:'accepted'});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();assertProgress(f,true);
  await f.advanceTime(19999);assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  await f.advanceTime(1);assertProgress(f,false);
  const message='הטלפון לא שלח אישור סיום. בדקו אם האייקון מופיע במסך הבית.';
  assert.equal(f.card.querySelector('[data-home-install-status]').textContent,message);assert.equal(f.dialog.querySelector('[data-home-install-invite-status]').textContent,message);
  assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);assert.equal(offer.calls,1);
  f.click(f.dialog.querySelector('[data-home-install-check-icon]'));assertSuccess(f);
});

test('matching installed-app detection confirms completion on return to the page without another prompt',async()=>{
  for(const eventName of ['pageshow','focus']){
    let apps=[];const f=fixture({english:true,installedRelated:()=>apps,entryUrl:'https://family.example/?lang=en-US&install=1#home'});await tick();
    const offer=f.offer({outcome:'accepted'});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
    f.window.dispatchEvent(new Event('appinstalled'));await tick();assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);assertProgress(f,true);
    apps=[{platform:'webapp',id:'https://family.example/'}];f.window.dispatchEvent(new Event(eventName));await tick();
    assertSuccess(f);assert.equal(offer.calls,1);assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);assert.doesNotMatch(f.dialog.innerHTML,/icon is ready|icon.*(?:is|on).*home screen/i);
    await f.advanceTime(20000);assertSuccess(f);
  }
});

test('an early appinstalled event and late user choice cannot turn confirmed completion back into progress',async()=>{
  let apps=[];const f=fixture({installedRelated:()=>apps,entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();
  const offer=f.offer({outcome:'accepted',choicePending:true});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
  f.window.dispatchEvent(new Event('appinstalled'));await tick();assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  apps=[{platform:'webapp',url:'https://family.example/manifest.webmanifest'}];f.window.dispatchEvent(new Event('focus'));await tick();assertSuccess(f);
  offer.choose();await tick();assertSuccess(f);await f.advanceTime(20000);assertSuccess(f);assert.equal(offer.calls,1);
});

test('appinstalled while browsing does not open an unsolicited success dialog',async()=>{
  const f=fixture();f.window.dispatchEvent(new Event('appinstalled'));await tick();assert.equal(f.dialog.open,false);assertProgress(f,false);
  f.click(f.button());await tick();assert.equal(f.dialog.open,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
});

test('in-dialog English translation preserves the native event and requesting and accepted progress',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();const offer=f.offer({outcome:'accepted',choicePending:true});
  f.click(f.dialog.querySelector('[data-home-install-language]'));
  assert.equal(f.dialog.getAttribute('dir'),'ltr');assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,'Install');assert.equal(f.button().textContent,'התקן');assert.equal(offer.calls,0);
  assert.equal(f.dialog.querySelector('[data-home-install-language]').textContent,'Hebrew');assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
  f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();assert.equal(offer.calls,1);assertProgress(f,true);
  f.click(f.dialog.querySelector('[data-home-install-language]'));assert.equal(f.dialog.getAttribute('dir'),'rtl');assertProgress(f,true);assert.equal(offer.calls,1);
  offer.choose();await tick();assertProgress(f,true);
  f.click(f.dialog.querySelector('[data-home-install-language]'));assert.equal(f.dialog.getAttribute('dir'),'ltr');assertProgress(f,true);assert.equal(offer.calls,1);
  f.window.dispatchEvent(new Event('appinstalled'));await tick();assertProgress(f,true);assert.equal(f.dialog.querySelector('[data-home-install-success]'),null);
  f.standalone(true);assertSuccess(f);assert.equal(f.dialog.getAttribute('dir'),'ltr');assert.ok(f.dialog.querySelector('[data-home-install-language]'));
  f.click(f.dialog.querySelector('[data-home-install-language]'));assert.equal(f.dialog.getAttribute('dir'),'rtl');assertSuccess(f);assert.match(f.dialog.innerHTML,/ההתקנה הושלמה/);assert.doesNotMatch(f.dialog.innerHTML,/האייקון מוכן/);
});

test('manual help translates in place without losing a late native installation offer',async()=>{
  const f=fixture();f.click(f.button());await tick();const offer=f.offer({outcome:'accepted'}),opened=f.dialog.modalCalls;
  f.click(f.dialog.querySelector('[data-home-install-language]'));
  assert.equal(f.dialog.open,true);assert.equal(f.dialog.modalCalls,opened);assert.equal(f.dialog.getAttribute('dir'),'ltr');assertNoInstallationCopy(f.dialog);
  assert.equal(f.dialog.querySelector('[data-home-install-native-start]').textContent,'Install');assert.equal(offer.calls,0);assert.equal(f.button().textContent,'התקן');
  f.click(f.dialog.querySelector('[data-home-install-native-start]'));await tick();assert.equal(offer.calls,1);assertProgress(f,true);
  f.click(f.dialog.querySelector('[data-home-install-check-icon]'));assertSuccess(f);assert.equal(f.dialog.getAttribute('dir'),'ltr');assert.ok(f.dialog.querySelector('[data-home-install-language]'));
  f.click(f.dialog.querySelector('[data-home-install-success-browse]'));assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());
});

test('translated installer continues to the English home only when Continue is chosen',async()=>{
  for(const complete of [false,true]){
    const f=fixture({recordNavigation:true,entryUrl:'https://family.example/?game=ruti-house&lang=he&install=1#games'});await tick();
    f.click(f.dialog.querySelector('[data-home-install-language]'));assert.deepEqual(f.assignments,[]);assert.equal(f.button().textContent,'התקן');
    if(complete){
      const offer=f.offer({outcome:'accepted'});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();assertProgress(f,true);
      assert.deepEqual(f.assignments,[]);f.click(f.dialog.querySelector('[data-home-install-check-icon]'));assertSuccess(f);assert.equal(offer.calls,1);assert.deepEqual(f.assignments,[]);
    }
    f.click(f.dialog.querySelector(complete?'[data-home-install-success-browse]':'[data-home-install-invite-browse]'));
    assert.equal(f.dialog.open,false);assert.deepEqual(f.assignments,['https://family.example/?lang=en-US#home']);
    const destination=new URL(f.assignments[0]);assert.equal(destination.searchParams.has('install'),false);assert.equal(destination.searchParams.has('game'),false);
  }
  const help=fixture({recordNavigation:true,share:'works'});help.click(help.button());await tick();help.click(help.dialog.querySelector('[data-home-install-language]'));
  assert.deepEqual(help.assignments,[]);help.click(help.dialog.querySelector('[data-home-install-close]'));assert.deepEqual(help.assignments,[]);assert.equal(help.button().textContent,'התקן');
  help.click(help.card.querySelector('[data-home-install-share]'));await tick();assert.equal(help.shared[0].url,'https://family.example/?lang=en-US&install=1#home');
});

test('manifest has a stable identity, home launch and real correctly sized phone icons',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const manifestPath=html.match(/<link\s+rel="manifest"\s+href="([^"]+)"/);assert.ok(manifestPath,'Page links the web app manifest');
  const publicRoot=new URL('../public/',import.meta.url),manifest=JSON.parse(await readFile(new URL(manifestPath[1].replace(/^\//,''),publicRoot),'utf8'));
  assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.ok(manifest.related_applications?.some(app=>app.platform==='webapp'&&app.url==='https://keha-family.eldadkeha.workers.dev/manifest.webmanifest'&&app.id==='https://keha-family.eldadkeha.workers.dev/'),'Manifest associates its installed web app with the production site');assert.equal(manifest.display,'standalone');assert.equal(new URL(manifest.start_url,'https://family.example').hash,'#home');
  for(const size of [192,512]){
    const icon=manifest.icons.find(icon=>icon.sizes===`${size}x${size}`);assert.ok(icon);const png=await readFile(new URL(icon.src.replace(/^\//,''),publicRoot));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  const applePath=html.match(/<link\s+rel="apple-touch-icon"\s+(?:sizes="180x180"\s+)?href="([^"]+)"/);assert.ok(applePath);const apple=await readFile(new URL(applePath[1].replace(/^\//,''),publicRoot));assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
  assert.doesNotMatch(source,/serviceWorker\s*\.\s*register|caches\s*\./,'Shortcut support does not cache family data');
});


test('phone shortcut and share toolbar has one header location rather than a duplicate home card',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const header=html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1];assert.ok(header);
  assert.equal([...html.matchAll(/id="homeInstall"/g)].length,1);assert.match(header,/id="homeInstall"/);
  const home=html.match(/<section id="homeView"[\s\S]*?<\/section>/)?.[0];assert.ok(home);assert.doesNotMatch(home,/id="homeInstall"/);
  const f=fixture(),phoneMarkup=f.card.innerHTML.replace(/<button[^>]*data-desktop-install-action[^>]*>[\s\S]*?<\/button>/g,'');
  assert.doesNotMatch(phoneMarkup,/<img|data-home-install-heading|data-home-install-description/);
  assert.equal(f.card.querySelector('[data-desktop-install-action]').hidden,true);
});

const desktopUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36';
const desktopFixture=options=>fixture({userAgent:desktopUA,mobile:false,...options});

test('desktop header and footer respond immediately when installed-app detection never returns',()=>{
  for(const footer of [false,true]){
    const f=desktopFixture({installedRelated:()=>new Promise(()=>{})});
    const action=footer?f.windowsLink:f.card.querySelector('[data-desktop-install-action]');
    f.click(action);
    assert.equal(f.dialog.open,true,'The click must show help before waiting for the browser');
    assert.equal(f.dialog.querySelector('[data-desktop-install-instructions]').hidden,false);
    assert.equal(f.card.querySelector('[data-desktop-install-action]').disabled,false);
  }
});

test('an unresponsive desktop prompt keeps visible instructions and releases the busy button',async()=>{
  const f=desktopFixture(),offer=f.offer({choicePending:true}),button=f.card.querySelector('[data-desktop-install-action]');
  f.click(button);assert.equal(offer.calls,1);assert.equal(f.dialog.open,false);
  assert.ok(f.card.querySelector('[data-home-install-status]').textContent);
  await f.advanceTime(8000);assert.equal(button.disabled,false);assert.equal(f.dialog.open,true);
  offer.choose('accepted');await tick();assert.equal(f.dialog.open,true);
});

test('desktop shortcut and refresh controls use the site logo and remain absent from phone and tablet layouts',()=>{
  for(const english of [false,true]){
    const f=desktopFixture({english}),install=f.card.querySelector('[data-desktop-install-action]'),refresh=f.card.querySelector('[data-desktop-refresh]');
    assert.equal(install.hidden,false);assert.equal(refresh.hidden,false);assert.match(install.textContent,english?/Install app/:/התקנת האפליקציה/);
    assert.equal(f.card.querySelector('.desktop-shortcut-logo').getAttribute('src'),'assets/app-icons/icon-192.png');
    f.resize(true);assert.equal(install.hidden,true);assert.equal(refresh.hidden,true);
    f.resize(false);assert.equal(install.hidden,false);assert.equal(refresh.hidden,false);
  }
  for(const options of [{},{mobile:false},{mobile:false,userAgentMobile:true},{mobile:false,userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Safari/604.1'}]){
    const f=fixture(options);assert.equal(f.card.querySelector('[data-desktop-install-action]').hidden,true);assert.equal(f.card.querySelector('[data-desktop-refresh]').hidden,true);
  }
});

test('desktop native installation uses one user click and one retained offer without claiming completion on acceptance',async()=>{
  const f=desktopFixture(),offer=f.offer({outcome:'accepted',choicePending:true}),button=f.card.querySelector('[data-desktop-install-action]');
  assert.equal(offer.calls,0);f.click(button);f.click(button);assert.equal(offer.calls,1);assert.equal(button.disabled,true);
  offer.choose();await tick();assert.equal(button.disabled,false);assert.match(f.card.querySelector('[data-home-install-status]').textContent,/הדפדפן משלים/);
  assert.doesNotMatch(f.card.querySelector('[data-home-install-status]').textContent,/ההתקנה הושלמה/);
  f.window.dispatchEvent(new Event('appinstalled'));await tick();assert.match(f.card.querySelector('[data-home-install-status]').textContent,/ההתקנה הושלמה/);
  f.click(button);assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);
  assert.equal(f.dialog.querySelector('[data-desktop-native-start]').hidden,true);
  assert.match(f.dialog.innerHTML,/האפליקציה כבר מותקנת/);
});

test('desktop dismissal and an unavailable native prompt leave useful computer instructions in both languages',async()=>{
  for(const english of [false,true]){
    const f=desktopFixture({english}),offer=f.offer(),button=f.card.querySelector('[data-desktop-install-action]');
    f.click(button);await tick();assert.equal(offer.calls,1);f.click(button);await tick();assert.equal(f.dialog.open,true);
    assert.ok(f.dialog.querySelector('[data-desktop-install-instructions]'));assert.doesNotMatch(f.dialog.innerHTML,/<ol>|<li>/);
    assert.doesNotMatch(f.dialog.innerHTML,/Android|iPhone|iPad/);if(english)assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
    f.click(f.dialog.querySelector('[data-home-install-close]'));assert.equal(f.document.activeElement,button);
  }
});

test('a late desktop install offer is available directly inside the open instructions',async()=>{
  const f=desktopFixture();f.click(f.card.querySelector('[data-desktop-install-action]'));await tick();
  assert.equal(f.dialog.open,true);const offer=f.offer({outcome:'accepted'}),action=f.dialog.querySelector('[data-desktop-native-start]');
  assert.equal(action.hidden,false);assert.equal(offer.calls,0);f.click(action);await tick();assert.equal(offer.calls,1);
  f.window.dispatchEvent(new Event('appinstalled'));assert.equal(f.dialog.open,false);
});

test('desktop help follows Edge and Safari and installed-app detection keeps desktop-icon instructions available',async()=>{
  for(const [userAgent,expected,absent]of [[desktopUA+' Edg/141.0',/Install app/,/Safari|Android/],['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15',/Dock/,/Chrome|Android/]]){
    const f=desktopFixture({userAgent});f.click(f.card.querySelector('[data-desktop-install-action]'));await tick();assert.match(f.dialog.innerHTML,expected);assert.doesNotMatch(f.dialog.innerHTML,absent);
  }
  const installed=desktopFixture({installedRelated:[{platform:'webapp',id:'https://family.example/'}]});await tick();const offer=installed.offer();
  installed.click(installed.card.querySelector('[data-desktop-install-action]'));await tick();assert.equal(offer.calls,0);assert.equal(installed.dialog.open,true);
  assert.equal(installed.dialog.querySelector('[data-desktop-install-instructions]').hidden,true);
});

test('desktop refresh reloads the current game, person or album URL and cannot be invoked from mobile',()=>{
  for(const hash of ['#games/ruti-house','#person/eldad','#weddings/u-eldad','#nursery/yona','#gallery']){
    const entryUrl='https://family.example/?lang=en-US&media=photo'+hash,f=desktopFixture({entryUrl});
    f.click(f.card.querySelector('[data-desktop-refresh]'));assert.deepEqual(f.reloads,[entryUrl]);assert.equal(f.location.href,entryUrl);
    f.resize(true);f.click(f.card.querySelector('[data-desktop-refresh]'));assert.equal(f.reloads.length,1);
  }
  const phone=fixture();phone.click(phone.card.querySelector('[data-desktop-refresh]'));assert.equal(phone.reloads.length,0);
});

test('the native Windows app keeps refresh and omits a redundant browser installation action',()=>{
  const f=desktopFixture({userAgent:desktopUA+' KehaFamilyDesktop/1.0.0'});
  assert.equal(f.card.querySelector('[data-desktop-install-action]').hidden,true);
  assert.equal(f.card.querySelector('[data-desktop-refresh]').hidden,false);
  assert.equal(f.card.querySelector('[data-home-install-actions]').getAttribute('data-installed'),'true');
});

test('Windows desktop shortcuts open the browser help and preserve return focus',async()=>{
  for(const nt of ['6.1','6.2','6.3','10.0'])for(const english of [false,true]){
    const f=desktopFixture({userAgent:`Mozilla/5.0 (Windows NT ${nt}; Win64; x64) Chrome/109.0.0.0`,english});
    assert.equal(f.windowsLink.hidden,false);
    assert.equal(f.windowsLink.getAttribute('href'),'#install-desktop');
    assert.equal(f.click(f.windowsLink).defaultPrevented,true);await tick();
    assert.ok(f.dialog.querySelector('[data-desktop-install-instructions]'));
    assert.equal(f.dialog.querySelector('[data-windows-direct-download]'),null);
    f.click(f.dialog.querySelector('[data-home-install-close]'));assert.equal(f.document.activeElement,f.windowsLink);
  }
});

test('modern Windows always offers the browser shortcut regardless of version or client-hint availability',async()=>{
  for(const english of [false,true])for(const clientHints of ['missing','denied',{platform:'Windows',platformVersion:'13.0.0',bitness:'64',architecture:'x86'},{platform:'Windows',platformVersion:'10.0.0',bitness:'32',architecture:'x86'},{platform:'Windows',platformVersion:'13.0.0',bitness:'64',architecture:'arm'}]){
    const f=desktopFixture({english,clientHints});await tick();
    assert.equal(f.windowsLink.hidden,false);
    assert.equal(f.windowsLink.getAttribute('href'),'#install-desktop');
    assert.equal(f.windowsLink.querySelector('span').textContent,english?'Install app':'התקנת האפליקציה');
    assert.equal(f.click(f.windowsLink).defaultPrevented,true);await tick();
    assert.ok(f.dialog.querySelector('[data-desktop-install-instructions]'));
    assert.doesNotMatch(f.dialog.innerHTML,/\.exe|Microsoft Store|data-windows-direct-download|data-windows-browser-shortcut/);
    if(english)assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
  }
});

test('the desktop footer uses the same browser prompt as the logo button without navigating to a download',async()=>{
  const f=desktopFixture(),offer=f.offer({outcome:'accepted'});
  assert.equal(f.click(f.windowsLink).defaultPrevented,true);await tick();assert.equal(offer.calls,1);
  assert.equal(f.dialog.open,false);assert.equal(f.location.hash,'#games');
});

test('the footer shortcut is available on desktop browsers and hidden on phones and inside the native app',()=>{
  for(const f of [fixture(),desktopFixture({userAgent:desktopUA+' KehaFamilyDesktop/2.0.0'})])assert.equal(f.windowsLink.hidden,true);
  for(const userAgent of [desktopUA,'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15','Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0.0.0'])assert.equal(desktopFixture({userAgent}).windowsLink.hidden,false);
});


test('desktop bookmark and desktop shortcut are separate actions with keyboard help and independent focus',async()=>{
  for(const [userAgent,key]of [[desktopUA,'Ctrl + D'],['Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/141.0','⌘ + D']])for(const english of [false,true]){
    const f=desktopFixture({userAgent,english}),bookmark=f.card.querySelector('[data-desktop-bookmark-action]'),offer=f.offer();
    assert.equal(bookmark.hidden,false);assert.notEqual(bookmark,f.card.querySelector('[data-desktop-install-action]'));
    f.click(bookmark);assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/data-desktop-bookmark-shortcut/);
    assert.ok(f.dialog.innerHTML.includes(key));assert.equal(offer.calls,0);
    assert.equal(f.dialog.querySelector('[data-desktop-native-start]'),null);assert.equal(f.dialog.querySelector('[data-desktop-fullscreen]'),null);
    assert.equal(f.copied.length,0);assert.equal(f.shared.length,0);
    if(english)assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
    f.click(f.dialog.querySelector('[data-home-install-close]'));assert.equal(f.document.activeElement,bookmark);
    f.click(f.card.querySelector('[data-desktop-install-action]'));assert.equal(offer.calls,1);await tick();
  }
});

test('bookmark instructions translate without changing actions and cannot open on mobile or in the native app',()=>{
  const f=desktopFixture();f.click(f.card.querySelector('[data-desktop-bookmark-action]'));
  f.click(f.dialog.querySelector('[data-home-install-language]'));assert.equal(f.dialog.getAttribute('dir'),'ltr');
  assert.match(f.dialog.innerHTML,/Browser bookmark/);assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
  for(const mobile of [fixture(),fixture({mobile:false}),desktopFixture({userAgent:desktopUA+' KehaFamilyDesktop/2.0.0'})]){
    const button=mobile.card.querySelector('[data-desktop-bookmark-action]');assert.equal(button.hidden,true);mobile.click(button);assert.equal(mobile.dialog.open,false);
  }
});

test('the modern browser install API opens directly from one click without a custom instruction dialog',async()=>{
  for(const footer of [false,true]){
    const f=desktopFixture({webInstall:'works'}),offer=f.offer();assert.equal(f.webInstallCalls.length,0);
    f.click(footer?f.windowsLink:f.card.querySelector('[data-desktop-install-action]'));
    assert.equal(f.webInstallCalls.length,1);assert.equal(offer.calls,0);assert.equal(f.dialog.open,false);
    await tick();assert.equal(f.card.querySelector('[data-desktop-install-action]').disabled,false);
    assert.equal(f.card.querySelector('[data-home-install-status]').textContent,'האפליקציה מוכנה');
  }
});

test('canceling browser installation stays silent and an unsupported modern API preserves the retained offer',async()=>{
  const cancelled=desktopFixture({webInstall:'AbortError'});cancelled.click(cancelled.card.querySelector('[data-desktop-install-action]'));await tick();
  assert.equal(cancelled.dialog.open,false);assert.equal(cancelled.card.querySelector('[data-home-install-status]').textContent,'');
  const f=desktopFixture({webInstall:'NotSupportedError'}),offer=f.offer();f.click(f.card.querySelector('[data-desktop-install-action]'));await tick();
  assert.equal(f.webInstallCalls.length,1);assert.equal(offer.calls,0);assert.equal(f.dialog.open,true);
  assert.doesNotMatch(f.dialog.innerHTML,/<ol>|<li>|F11|העברה, שמירה ושיתוף/);
  f.click(f.dialog.querySelector('[data-desktop-native-start]'));assert.equal(offer.calls,1);await tick();assert.equal(f.webInstallCalls.length,1);
});

test('the desktop install fallback stays short in both languages and the browser API cannot be used from a phone',async()=>{
  for(const english of [false,true]){
    const f=desktopFixture({english});f.click(f.card.querySelector('[data-desktop-install-action]'));
    assert.doesNotMatch(f.dialog.innerHTML,/<ol>|<li>|F11|data-desktop-fullscreen/);
    assert.ok(f.dialog.querySelector('[data-desktop-install-instructions]'));
    if(english)assert.doesNotMatch(f.dialog.innerHTML,/[\u0590-\u05ff]/);
  }
  const phone=fixture({webInstall:'works'});phone.click(phone.card.querySelector('[data-desktop-install-action]'));await tick();assert.equal(phone.webInstallCalls.length,0);assert.equal(phone.dialog.open,false);
});
