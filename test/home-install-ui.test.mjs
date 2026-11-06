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

// Only controller-facing DOM APIs are modeled. Native dialog focus containment,
// operating-system install prompts and phone layout are checked in the browser.
function fixture({mobile=true,standalone=false,iosStandalone=false,english=false,userAgent='Mozilla/5.0 (Linux; Android 16) Chrome/141.0.0.0 Mobile Safari/537.36',maxTouchPoints=0,userAgentMobile=false,clipboard='works',share='missing',installedRelated='missing',iframe=false,entryUrl,autoReady=true,nativeDialog=true}={}){
  const nodes=new Map(),copied=[],shared=[],relatedCalls=[];
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
  document.documentElement=new Element('html');document.documentElement.lang=english?'en-US':'he';
  document.getElementById=id=>nodes.get(id)||null;
  const window=new EventTarget();window.top=iframe?{}:window;window.FamilyI18n={isEnglish:english,language:english?'en-US':'he'};
  const queries=new Map();
  const matchMedia=query=>{if(!queries.has(query)){const media=new EventTarget();media.matches=query.includes('display-mode')?standalone:mobile;queries.set(query,media);}return queries.get(query);};
  const navigator={userAgent,maxTouchPoints,standalone:iosStandalone,userAgentData:{mobile:userAgentMobile}};
  if(installedRelated!=='missing')navigator.getInstalledRelatedApps=async()=>{relatedCalls.push(true);if(installedRelated==='throw')throw Error('Detection unavailable');return typeof installedRelated==='function'?installedRelated():installedRelated;};
  if(share!=='missing')navigator.share=async payload=>{shared.push(payload);if(share!=='works'){const error=Error('Share unavailable');error.name=share;throw error;}};
  if(clipboard!=='missing')navigator.clipboard={writeText:async value=>{if(clipboard==='blocked')throw Error('Clipboard denied');copied.push(value);}};
  const location=new URL(entryUrl||'https://family.example/?game=neto-tetris&lang='+window.FamilyI18n.language+'#games');window.location=location;
  const context=vm.createContext({window,document,navigator,location,matchMedia,URL,URLSearchParams,Event,console,setTimeout:(fn,delay)=>{const timer=setTimeout(fn,delay);timer.unref();return timer;},clearTimeout});
  const ready=()=>{document.readyState='interactive';document.dispatchEvent(new Event('DOMContentLoaded'));document.readyState='complete';};
  vm.runInContext(source,context);if(autoReady)ready();
  const button=()=>card.querySelector('[data-home-install-action]');
  return {window,document,card,dialog,queries,nodes,copied,shared,relatedCalls,button,ready,location,
    click(element){element.dispatchEvent(new Event('click',{cancelable:true}));},
    resize(value){const media=matchMedia('(max-width: 700px)');media.matches=value;media.dispatchEvent(new Event('change'));},
    standalone(value){const media=matchMedia('(display-mode: standalone)');media.matches=value;media.dispatchEvent(new Event('change'));},
    offer({outcome='dismissed',error=false}={}){
      let calls=0;const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=()=>{calls++;return error?Promise.reject(Error('Prompt unavailable')):Promise.resolve();};
      event.userChoice=Promise.resolve({outcome});window.dispatchEvent(event);return {event,get calls(){return calls;}};
    }
  };
}

test('phone toolbar responds to viewport changes and keeps both controls in installed apps',()=>{
  const f=fixture();assert.equal(f.card.hidden,false);assert.equal(f.dialog.open,false);assert.equal(f.button().getAttribute('aria-label'),'התקן קיצור דרך לאתר');assert.equal(f.card.querySelector('[data-home-install-share]').getAttribute('aria-label'),'שיתוף האתר');assert.equal(f.button().textContent,'התקן');assert.match(f.card.innerHTML,/>שיתוף</);
  f.resize(false);assert.equal(f.card.hidden,true);f.resize(true);assert.equal(f.card.hidden,false);
  f.standalone(true);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);assert.equal(f.card.querySelector('[data-home-install-share]').hidden,false);f.standalone(false);assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);
  assert.equal(fixture({mobile:false}).card.hidden,true);
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
  f.click(f.button());await tick();assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);
  assert.match(f.dialog.innerHTML,/Chrome/);assert.match(f.dialog.innerHTML,/הוספה למסך הבית/);
});

test('accepted prompt does not claim installation until the installed event arrives',async()=>{
  const f=fixture(),offer=f.offer({outcome:'accepted'});f.click(f.button());await tick();
  assert.equal(offer.calls,1);assert.equal(f.card.hidden,false);
  f.click(f.button());await tick();assert.equal(f.dialog.open,true);f.window.dispatchEvent(new Event('appinstalled'));assert.equal(f.card.hidden,false);assert.equal(f.button().hidden,false);assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());f.click(f.button());assert.equal(f.dialog.open,false);assert.equal(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');assert.equal(offer.calls,1);
});

test('unavailable native prompt opens manual help and re-enables the trigger',async()=>{
  const f=fixture(),offer=f.offer({error:true});f.click(f.button());await tick();
  assert.equal(offer.calls,1);assert.equal(f.dialog.open,true);assert.equal(f.button().disabled,false);
});

test('iPhone and touch iPad use Share instructions, while embedded browsers explain opening the full browser',async()=>{
  for(const options of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari/604.1'},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari/605.1',maxTouchPoints:5}
  ]){
    const f=fixture(options);f.click(f.button());await tick();assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/Safari/);assert.match(f.dialog.innerHTML,/שיתוף/);assert.match(f.dialog.innerHTML,/הוספה למסך הבית/);
  }
  const embedded=fixture({userAgent:'Mozilla/5.0 (Linux; Android 16) Instagram WhatsApp FBAN/FB4A'});embedded.click(embedded.button());await tick();
  assert.match(embedded.dialog.innerHTML,/Chrome/);assert.match(embedded.dialog.innerHTML,/בדפדפן|דפדפן/);
});

test('manual dialog closes and restores button focus',async()=>{
  const f=fixture();f.click(f.button());await tick();assert.equal(f.dialog.open,true);
  f.click(f.dialog.querySelector('[data-home-install-close]'));assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());
});

test('manual installation help has direct instructions without clipboard controls',async()=>{
  for(const options of [{},{english:true},{clipboard:'missing'},{clipboard:'blocked'}]){
    const f=fixture(options);f.click(f.button());await tick();
    assert.equal(f.dialog.open,true);assertNoInstallationCopy(f.dialog);assert.equal(f.copied.length,0);
  }
});

test('English toolbar and platform instructions contain localized visible copy',async()=>{
  const f=fixture({english:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'});f.click(f.button());await tick();
  assert.equal(f.button().getAttribute('aria-label'),'Install site shortcut');assert.equal(f.button().textContent,'Install');assert.match(f.dialog.innerHTML,/Share/);assert.doesNotMatch(f.card.innerHTML+f.dialog.innerHTML,/[\u0590-\u05ff]/);
});

test('share uses the native share sheet only after a tap and sends a localized installation invitation',async()=>{
  const f=fixture({share:'works',english:true});assert.equal(f.shared.length,0);
  f.click(f.card.querySelector('[data-home-install-share]'));assert.equal(f.shared.length,1);await tick();
  assert.equal(f.copied.length,0);assert.equal(f.shared[0].title,'Keha Family Home');
  assert.equal(f.shared[0].url,'https://family.example/?lang=en-US&install=1#home');
  assert.equal(f.card.querySelector('[data-home-install-share]').disabled,false);
  assert.match(f.card.querySelector('[data-home-install-share-status]').textContent,/Link ready to share/);
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
    const offer=f.offer();assert.equal(offer.calls,0);assert.equal(f.dialog.open,true);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,label);
    f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
    assert.equal(offer.calls,1);assert.equal(f.button().disabled,false);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-start]').textContent,label);
    assert.equal(f.dialog.querySelector('[data-home-install-invite-status]').textContent,english?'Tap again for installation instructions.':'לחצו שוב להנחיות ההוספה.');
  }
});

test('accepting an invitation prompt does not claim installation until appinstalled',async()=>{
  const f=fixture({entryUrl:'https://family.example/?lang=he&install=1#home'});await tick();
  const offer=f.offer({outcome:'accepted'});f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
  assert.equal(offer.calls,1);assert.equal(f.dialog.querySelector('[data-home-install-invite-installed]'),null);
  assert.equal(f.dialog.open,true);assert.equal(f.dialog.querySelector('[data-home-install-invite-status]').textContent,'השלימו את ההוספה בטלפון.');
  assert.notEqual(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
  f.window.dispatchEvent(new Event('appinstalled'));await tick();
  assert.ok(f.dialog.querySelector('[data-home-install-invite-installed]'));assert.equal(f.dialog.querySelector('[data-home-install-invite-start]'),null);
  f.click(f.button());assert.equal(offer.calls,1);assert.equal(f.card.querySelector('[data-home-install-status]').textContent,'קיצור הדרך כבר מותקן');
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
    {userAgent:'Mozilla/5.0 (X11; Linux x86_64) Firefox/145.0',browser:/iPhone \/ iPad/}
  ]){
    const f=fixture({...options,entryUrl:'https://family.example/?lang=en-US&install=1#home',english:true,clipboard:'blocked'});await tick();
    assert.equal(f.dialog.open,true);f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
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
    assertNoInstallationCopy(f.dialog);f.click(f.dialog.querySelector('[data-home-install-invite-start]'));await tick();
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
    const accepted=options.english?'Finish adding it on your phone.':'השלימו את ההוספה בטלפון.';
    assert.equal(f.button().disabled,false);assert.equal(f.card.querySelector('[data-home-install-status]').textContent,accepted);assert.equal(f.dialog.querySelector('[data-home-install-help-status]').textContent,accepted);
    const consumed=f.dialog.querySelector('[data-home-install-native-start]');assert.ok(!consumed||consumed.hidden||consumed.disabled);
    assert.equal(f.dialog.querySelector('[data-home-install-instructions]').hidden,false);
    f.window.dispatchEvent(new Event('appinstalled'));assert.equal(f.dialog.open,false);assert.equal(f.document.activeElement,f.button());
  }
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
  const f=fixture();assert.doesNotMatch(f.card.innerHTML,/<img|data-home-install-heading|data-home-install-description/);
});
