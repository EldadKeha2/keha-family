import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PHOTO_LABELS,photoLabels,photoLabelName} from '../public/assets/photo-labels-catalog.mjs';
const source=(await readFile(new URL('../public/assets/photo-labels.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function fixture(english=false){
 let viewportHeight=800,footerHeight=300;const frames=[],styles=new Map(),classes=new Set();
 const nodes=new Map(),handlers=new Map(),listeners=new Map(),requests=[],pending=[],saved=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,innerHTML:'',classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},style:{getPropertyValue:key=>styles.get(key),setProperty:(key,value)=>styles.set(key,value)},addEventListener:(name,fn)=>handlers.set(id+':'+name,fn),querySelector:selector=>id==='mediaViewer'?node(selector):null,getBoundingClientRect:()=>({height:id==='.media-viewer-footer'?footerHeight:id==='.face-zoom-toolbar'?70:60}),replaceChildren(){this.innerHTML='';}});return nodes.get(id);};
 const window={FamilyI18n:{isEnglish:english,error:String,fetch:async(path,options)=>{const body=JSON.parse(options.body);requests.push({path,body});return new Promise(resolve=>pending.push((ok=true)=>{const id=path.split('/')[2],labels=new Set(saved.get(id)||[]);if(body.tagged)labels.add(body.label);else labels.delete(body.label);if(ok)saved.set(id,photoLabels([...labels]));resolve(Response.json(ok?{saved:true,operation:'labels',scope:'gallery',item:{id,kind:'photo',labels:saved.get(id)}}:{error:'Save failed'},{status:ok?200:503}));}));}},FamilyApp:{apiEnabled:true},get innerHeight(){return viewportHeight;},addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);}};
 const document={readyState:'complete',activeElement:null,getElementById:node};
 vm.runInNewContext(source,{window,document,PHOTO_LABELS,photoLabels,photoLabelName,Response,CustomEvent,matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
 return{requests,pending,saved,window,fit(footer=300,height=800){footerHeight=footer;viewportHeight=height;node('mediaViewer').open=true;for(const fn of listeners.get('resize')||[])fn();for(const fn of frames.splice(0))fn();return Number.parseFloat(styles.get('--photo-fit-height'));},mount(id,labels=[]){saved.set(id,labels);window.FamilyPhotoLabels.mount({id,kind:'photo',labels});},toggle(label,checked=true){handlers.get('mediaPhotoLabels:change')({target:{dataset:{photoLabelOption:label},checked}});},get html(){return node('mediaPhotoLabels').innerHTML;},async reply(ok=true){pending.shift()(ok);await new Promise(resolve=>setImmediate(resolve));}};
}
test('rapid label changes are serialized and the final checkbox choices are preserved',async()=>{
 const f=fixture();f.mount('a');f.toggle('birthdays');f.toggle('holidays');f.toggle('birthdays',false);assert.equal(f.requests.length,1);await f.reply();assert.equal(f.requests.length,2);await f.reply();assert.equal(f.requests.length,3);await f.reply();
 assert.deepEqual(f.saved.get('a'),['holidays']);assert.match(f.html,/photo-label-chip">חגים/);assert.doesNotMatch(f.html,/photo-label-chip">ימי הולדת/);assert.equal(f.requests[2].body.tagged,false);
});
test('a late save cannot attach labels or errors to the next photo, and failed choices can be retried',async()=>{
 const f=fixture(true);f.mount('a');f.toggle('abroad');f.mount('b',['purim']);await f.reply();assert.match(f.html,/photo-label-chip">Purim/);assert.doesNotMatch(f.html,/photo-label-chip">Abroad/);
 f.toggle('holidays');await f.reply(false);assert.match(f.html,/Save failed/);assert.deepEqual(f.saved.get('b'),['purim']);assert.doesNotMatch(f.html,/photo-label-chip">Holidays/);
 f.toggle('holidays');await f.reply();assert.deepEqual(f.saved.get('b'),['purim','holidays']);assert.doesNotMatch(f.html,/Save failed/);assert.match(f.html,/photo-label-chip">Holidays/);
});

test('a long list of people cannot shrink the mobile photo, and rotation still respects the viewport',()=>{
 const f=fixture();f.mount('group-photo');const withShortList=f.fit(80),withManyPeople=f.fit(1400),withLabelsExpanded=f.fit(1800);
 assert.ok(withShortList>400,'A portrait phone reserves a large photo area');assert.equal(withManyPeople,withShortList,'Dozens of names scroll below the image instead of reducing it');assert.equal(withLabelsExpanded,withShortList,'Expanding subject labels also leaves the photo size intact');
 const landscape=f.fit(1400,360);assert.ok(landscape>100&&landscape<=360-60-70,'The photo and its controls remain usable after rotation');assert.equal(f.fit(1400,800),withShortList,'Returning to portrait restores the large photo');
});
