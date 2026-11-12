import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import family from '../src/family.mjs';

const keyboard=await readFile(new URL('../public/assets/photo-keyboard.js',import.meta.url),'utf8');
const sources=Object.fromEntries(await Promise.all(['app','portal','archive'].map(async name=>[name,await readFile(new URL('../public/assets/'+name+'.js',import.meta.url),'utf8')])));
function fixture(name,{phone=false}={}){
 const nodes=new Map(),handlers=new Map(),requests=[];
 class Node extends EventTarget{
  constructor(){super();this.dataset={};this.style={};this.hidden=false;this.value='';this.innerHTML='';this.children=[];this.open=false;this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(key,value){this[key]=value;}querySelector(){return null;}querySelectorAll(){return [];}getBoundingClientRect(){return {top:100,left:0,width:400,height:300};}blur(){}contains(){return false;}insertAdjacentHTML(){}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const document={activeElement:null,getElementById:node,body:new Node(),documentElement:new Node(),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(type,fn)=>{if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);}};
 const window=new Node();Object.assign(window,{LOCAL_FAMILY_SERVER:true,FAMILY_DATA:structuredClone(family),FamilyDates:{parse:()=>null,age:()=>null},FamilyPeople:{activate(){}},FamilyApp:{apiEnabled:true,getView:()=> 'tree',toast(){}},FamilyMedia:{register(){},controls:()=>''},FamilyTags:{refresh(){}},scrollTo(){}});
 window.FamilyI18n={isEnglish:false,locale:'he-IL',t:String,error:String,html:(parts,...values)=>parts.reduce((text,part,i)=>text+part+(values[i]??''),''),word:(n,a,b)=>n===1?a:b,personName:p=>p.name,branchName:b=>b?.title||'',searchNames:p=>p.name,date:String,
  fetch:async(path,options)=>{if(options?.method==='POST')requests.push({path,body:JSON.parse(options.body)});return Response.json({people:[],items:[],count:0});}};
 vm.runInNewContext(keyboard+'\n'+sources[name],{window,document,navigator:{userAgent:phone?'Android Mobile':'Windows NT 10.0'},location:{hash:'#directory'},history:{pushState(){}},matchMedia:query=>({matches:query.includes('700px')&&phone}),innerWidth:phone?390:1280,innerHeight:900,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:()=>0,cancelAnimationFrame(){},CustomEvent});
 for(const fn of handlers.get('DOMContentLoaded')||[])fn();
 const area={value:'תיאור בעברית\nA second line',dataset:name==='app'?{owner:'yona',captionFile:'memory.jpg'}:name==='portal'?{sharedKind:'videos',sharedFile:'memory.mp4'}:{archiveScope:'nostalgia',archiveCaption:'memory.jpg'},closest:()=>null,matches:selector=>selector===({app:'textarea[data-caption-file]',portal:'textarea[data-shared-file]',archive:'[data-archive-caption]'}[name])};
 const emit=(type,flags={})=>{const event={target:area,key:'Enter',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...flags};for(const fn of handlers.get(type)||[])fn(event);return event;};
 return {requests,area,emit,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
for(const name of ['app','portal','archive'])test(name+' captions save through their existing endpoint on desktop Enter only',async()=>{
 const f=fixture(name);f.emit('input');
 assert.equal(f.emit('keydown',{shiftKey:true}).defaultPrevented,false);assert.equal(f.emit('keydown',{isComposing:true}).defaultPrevented,false);assert.equal(f.requests.length,0);
 assert.equal(f.emit('keydown').defaultPrevented,true);await f.flush();assert.equal(f.requests.length,1);
 const expected={app:'api/people/yona/caption',portal:'api/collections/videos/caption',archive:'api/nostalgia/caption'}[name];assert.equal(f.requests[0].path,expected);assert.equal(f.requests[0].body.caption,'תיאור בעברית\nA second line');
 const phone=fixture(name,{phone:true});phone.emit('input');assert.equal(phone.emit('keydown').defaultPrevented,false);assert.equal(phone.requests.length,0);
});
