import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';
const source=await readFile(new URL('../public/assets/tags.js',import.meta.url),'utf8');
class NodeStub extends EventTarget{
 constructor(){super();this.dataset={};this.children=new Map();this.isConnected=true;this.scrollTop=0;this.className='';this.value='';this.hidden=false;}
 querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new NodeStub());return this.children.get(selector);}
 querySelectorAll(){return [];}
 replaceChildren(){}
 focus(){}
}
function fixture(){
 const nodes=new Map(),requests=[],events=[];
 const window={FAMILY_DATA:family,FamilyApp:{apiEnabled:true,toast(){}},addEventListener(){},dispatchEvent(event){events.push(event);}};
 window.FamilyI18n={t:v=>v,html:(parts,...values)=>parts.reduce((s,p,i)=>s+p+(values[i]??''),''),isEnglish:false,locale:'he-IL',personName:p=>p.name,searchNames:p=>p.name,branchName:p=>p?.title||'',error:v=>v,fetch:async(path,options)=>{requests.push({path,body:options?.body?JSON.parse(options.body):null});const id=path.split('/')[2];return Response.json({item:{id,kind:'photo',tags:[],tagsRevision:'new'},taggedPeople:[]});}};
 const document={addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{open:false});return nodes.get(id);}};
 const context=vm.createContext({window,document,Response,AbortController,CustomEvent,clearTimeout,setTimeout});vm.runInContext(source,context);
 return {tags:window.FamilyTags,requests,events};
}
const photo=id=>({id,kind:'photo',name:'Memory',tags:[],tagsRevision:'empty'});
test('switching images removes old checkbox and remove-button listeners from the reused tagging panel',async()=>{
 const f=fixture(),host=new NodeStub(),calls=[];
 f.tags.mountInline(host,photo('image-a'));const a=host._tagWidget.store;a.enqueue=(person,tagged)=>calls.push(['a',person.id,tagged]);
 f.tags.mountInline(host,photo('image-b'));const b=host._tagWidget.store;b.enqueue=(person,tagged)=>calls.push(['b',person.id,tagged]);
 const change=new Event('change');Object.defineProperty(change,'target',{value:{matches:s=>s==='[data-tag-person]',dataset:{tagPerson:'yona'},checked:true}});host.dispatchEvent(change);
 assert.deepEqual(calls,[['b','yona',true]],'A click in B must never write to closed image A');
 b.saved.set('yona',family.people.yona);const click=new Event('click');Object.defineProperty(click,'target',{value:{closest:s=>s==='[data-remove-person-tag]'?{dataset:{removePersonTag:'yona'}}:null}});host.dispatchEvent(click);
 assert.deepEqual(calls,[['b','yona',true],['b','yona',false]]);
 f.tags.clearInline(host);host.dispatchEvent(change);assert.equal(calls.length,2,'Closing the panel removes every delegated listener');assert.equal(f.requests.length,0,'Known tags and the roster need no extra requests on open');
});
test('rapid selections batch by image and collapse repeated changes to the same person',async()=>{
 const f=fixture(),host=new NodeStub();f.tags.mountInline(host,photo('image-a'));const store=host._tagWidget.store;
 store.enqueue(family.people.yona,true);store.enqueue(family.people.shlomo,true);store.enqueue(family.people.yona,false);
 assert.equal(f.requests.length,0);await store.run();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'api/media/image-a/tags/patch');
 assert.deepEqual(f.requests[0].body.changes.map(c=>[c.personId,c.tagged]),[['shlomo',true],['yona',false]]);f.tags.clearInline(host);
});
