import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/assets/updates.js',import.meta.url),'utf8');
const all=()=>Object.fromEntries(['birthdays','anniversaries','memorials'].map(key=>[key,{enabled:true,ids:null}]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function fixture({hash='#updates',english=false,respond=()=>({})}={}){
  const handlers=new Map(),windowHandlers=new Map(),nodes=new Map(),requests=[],location={hash};let html='';
  const makeNode=id=>({id,value:'',checked:false,disabled:false,textContent:'',hidden:false,querySelectorAll:()=>[],addEventListener:(type,handler)=>handlers.set(id+':'+type,handler)});
  for(const id of ['updatesView','updatesContent','emailPreviewFrame','emailPreviewDialog'])nodes.set(id,makeNode(id));
  const content=nodes.get('updatesContent');
  Object.defineProperty(content,'innerHTML',{get:()=>html,set(value){
    html=value;for(const id of [...nodes.keys()])if(!['updatesView','updatesContent','emailPreviewFrame','emailPreviewDialog'].includes(id))nodes.delete(id);
    for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
      const node=makeNode(match[1]);node.value=/\bvalue="([^"]*)"/.exec(match[0])?.[1]||'';node.checked=/\bchecked\b/.test(match[0]);nodes.set(node.id,node);
    }
  }});
  const people=[{id:'a',name:'Alice',nameEn:'Alice'},{id:'b',name:'Bob',nameEn:'Bob'}];
  const window={FAMILY_API_TOKEN:'public-test-token',FAMILY_DATA:{units:{}},FamilyApp:{getPeople:()=>people,getPerson:id=>people.find(p=>p.id===id),nameOf:id=>people.find(p=>p.id===id).name,getView:()=>'updates'},FamilyI18n:{isEnglish:english,language:english?'en-US':'he',locale:english?'en-US':'he-IL',searchNames:p=>p.name,error:v=>v,async fetch(url,options){
    const action=url.replace('api/updates/',''),body=options.body?JSON.parse(options.body):undefined;requests.push({action,body});
    if(action==='config')return Response.json({enabled:true});
    const value=await respond(action,body);return Response.json(value?.body??value,{status:value?.status??200,headers:value?.headers});
  }},addEventListener:(type,handler)=>windowHandlers.set(type,handler)};
  const document={getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,handler)=>handlers.set('document:'+type,handler)};
  const history={replaceState(_state,_title,url){location.hash=url;}};
  vm.runInContext(source,vm.createContext({window,document,history,location,URLSearchParams,console}));handlers.get('document:DOMContentLoaded')();await tick();
  const click=async(selector,properties={})=>{handlers.get('updatesContent:click')({target:{closest:s=>s===selector?properties:null}});await tick();};
  const submit=async id=>{await handlers.get('updatesContent:submit')({preventDefault(){},target:nodes.get(id)});await tick();};
  return {requests,nodes,location,click,submit,get html(){return html;},async navigate(value){location.hash=value;windowHandlers.get('hashchange')();await tick();},change(target){handlers.get('updatesContent:change')({target});},input(id,value){nodes.get(id).value=value;handlers.get('updatesContent:input')({target:{id,value,hasAttribute:()=>false}});}};
}

test('registration explains existing-address management and offers a separate management request in both languages',async()=>{
  for(const english of [false,true]){
    const f=await fixture({english});assert.match(f.html,english?/Already subscribed\? Update or unsubscribe/:/כבר רשומים\? עדכון או הסרה/);
    assert.match(f.html,english?/existing subscription/:/ההרשמה הקיימת/);assert.ok(f.nodes.has('updatesLinkForm'));
    f.input('updatesEmail','visitor@example.net');f.nodes.get('updatesConsent').checked=true;await f.submit('updatesForm');
    assert.equal(f.requests.at(-1).action,'register');assert.equal(f.requests.at(-1).body.email,'visitor@example.net');assert.equal(f.requests.at(-1).body.consent,true);
    assert.match(f.nodes.get('updatesMessage').textContent,english?/existing subscribers receive a link/:/לכתובת שכבר רשומה יישלח קישור/);
    f.input('updatesLinkEmail','visitor@example.net');await f.submit('updatesLinkForm');assert.equal(f.requests.at(-1).action,'request-link');assert.match(f.nodes.get('updatesLinkMessage').textContent,english?/update your preferences or unsubscribe/:/לעדכון ההעדפות או להסרה/);assert.equal(f.nodes.get('updatesMessage').textContent,'');
  }
});

test('one private page loads current choices, saves them, and confirms removal without sending on page load',async()=>{
  const token='a'.repeat(64),prefs=all();prefs.birthdays.ids=['a'];
  const f=await fixture({hash:'#updates/manage/'+token,respond(action){return action==='preferences'?{email:'owner@example.net',preferences:prefs,language:'he',revision:'revision-1'}:action==='save'?{saved:true,revision:'revision-2'}:{saved:true,unsubscribed:true};}});
  assert.match(f.html,/owner@example.net/);assert.match(f.html,/שמירת ההעדפות/);assert.match(f.html,/הסרה מרשימת התפוצה/);assert.equal(f.requests.some(r=>r.action==='unsubscribe'),false);
  f.change({id:'updatesLanguage',value:'en-GB',dataset:{},hasAttribute:()=>false});await f.submit('updatesForm');
  const save=f.requests.at(-1);assert.equal(save.action,'save');assert.deepEqual(save.body.preferences,prefs);assert.equal(save.body.language,'en-GB');assert.equal(save.body.revision,'revision-1');
  await f.click('[data-updates-unsubscribe]');assert.ok(f.nodes.has('updatesForm'));assert.match(f.html,/כן, הסירו אותי/);assert.equal(f.requests.some(r=>r.action==='unsubscribe'),false);
  await f.click('[data-updates-cancel-removal]');assert.ok(!f.html.includes('כן, הסירו אותי'));assert.ok(f.nodes.has('updatesForm'));
  await f.click('[data-updates-unsubscribe]');await f.click('[data-updates-action]',{dataset:{updatesAction:'unsubscribe'}});
  assert.equal(f.requests.at(-1).action,'unsubscribe');assert.equal(f.requests.at(-1).body.token,token);assert.equal(f.location.hash,'#updates');assert.match(f.html,/ההסרה הושלמה/);assert.ok(!f.nodes.has('updatesForm'));
  await f.click('[data-updates-register]');assert.ok(f.nodes.has('updatesEmail'));
});

test('legacy unsubscribe links open the same preferences page with a cancellable removal question',async()=>{
  const token='b'.repeat(64),f=await fixture({hash:'#updates/unsubscribe/'+token,english:true,respond:()=>({email:'owner@example.net',preferences:all(),language:'en-US',revision:'r'})});
  assert.equal(f.location.hash,'#updates/manage/'+token);assert.ok(f.nodes.has('updatesForm'));assert.match(f.html,/Save preferences/);assert.match(f.html,/Yes, unsubscribe me/);assert.equal(f.requests.some(r=>r.action==='unsubscribe'),false);
  await f.click('[data-updates-cancel-removal]');assert.ok(f.nodes.has('updatesForm'));assert.ok(!f.html.includes('Yes, unsubscribe me'));
});

test('invalid private links never show default preferences or active save and removal controls',async()=>{
  const f=await fixture({hash:'#updates/manage/'+'0'.repeat(64),respond:()=>({status:404,body:{error:'הקישור אינו תקף. בקשו קישור חדש במייל.'}})});
  assert.ok(!f.nodes.has('updatesForm'));assert.ok(!f.html.includes('data-updates-unsubscribe'));assert.match(f.nodes.get('updatesError').textContent,/הקישור אינו תקף/);
  await f.click('[data-updates-register]');assert.equal(f.location.hash,'#updates');assert.ok(f.nodes.has('updatesLinkForm'));
});
test('request throttling explains the wait beside the email form and preserves the entered address',async()=>{
  for(const english of [false,true]){
    const f=await fixture({english,respond:()=>({status:429,headers:{'Retry-After':'60'},body:{error:'Too many requests',code:'UPDATES_RATE_LIMIT',retryAfter:60}})});
    f.input('updatesLinkEmail','owner@example.net');await f.submit('updatesLinkForm');
    assert.match(f.nodes.get('updatesLinkError').textContent,english?/about a minute/:/כדקה/);assert.equal(f.nodes.get('updatesLinkEmail').value,'owner@example.net');assert.equal(f.nodes.get('updatesLinkMessage').textContent,'');assert.equal(f.location.hash,'#updates');
  }
});

test('a slow response for a previous private link cannot replace the next subscriber preferences',async()=>{
  const a='a'.repeat(64),b='b'.repeat(64);let resolveA;
  const previous=new Promise(resolve=>resolveA=resolve);
  const f=await fixture({hash:'#updates/manage/'+a,respond:(_action,body)=>body.token===a?previous:{email:'second@example.net',preferences:all(),language:'he',revision:'second'}});
  assert.ok(!f.nodes.has('updatesForm'));await f.navigate('#updates/manage/'+b);assert.match(f.html,/second@example.net/);
  resolveA({email:'first@example.net',preferences:all(),language:'he',revision:'first'});await tick();assert.match(f.html,/second@example.net/);assert.ok(!f.html.includes('first@example.net'));
  await f.submit('updatesForm');assert.equal(f.requests.at(-1).body.token,b);assert.equal(f.requests.at(-1).body.revision,'second');
});
