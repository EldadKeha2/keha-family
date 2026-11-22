import family from './family.mjs';
import {HttpError,text} from './http.mjs';
import {normalizeSearch,searchVariants,searchNames,personRank,personSearchPriority,SEARCH_TYPES} from '../public/assets/site-search-core.mjs';
import {photoLabelName,photoLabels,normalizePhotoLabel} from '../public/assets/photo-labels-catalog.mjs';

const yearOf=value=>{const n=Number(value);return Number.isInteger(n)&&n>=1000&&n!==1111&&n<=new Date().getUTCFullYear()?n:null;};
const dateYear=value=>yearOf(String(value||'').match(/(?:^|[.\/-])(\d{4})(?:$|[-T])/u)?.[1]);
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const list=value=>Array.isArray(value)?value:[];
const countBy=(items,values)=>{const counts=new Map();for(const item of items)for(const value of new Set(values(item).filter(Boolean)))counts.set(String(value),(counts.get(String(value))||0)+1);return counts;};

// Search metadata inside the existing state object. Binary media and historical,
// removed, or administrative records never enter this index or its response.
export function searchSite(state,options={}){
  const q=text(options.q||'','חיפוש',200),query=normalizeSearch(q),person=String(options.person||''),type=options.type||'all',branch=String(options.branch||''),year=options.year?String(options.year):'',label=String(options.label||''),sort=options.sort||'relevance';
  const size=Number(options.size||24),requestedPage=Number(options.page||1);
  if(!['all',...SEARCH_TYPES].includes(type)||!['relevance','newest','oldest'].includes(sort)||!Number.isInteger(size)||size<1||size>48||!Number.isInteger(requestedPage)||requestedPage<1)throw new HttpError(400,'בחרו אפשרויות חיפוש תקינות.');
  if(branch&&!family.branches.some(item=>item.id===branch)||year&&!yearOf(year)||label&&!normalizePhotoLabel(label))throw new HttpError(400,'בחרו אפשרויות סינון תקינות.');
  const roster=state.run('people').people;
  const people=Object.fromEntries(Object.values(roster).map(p=>[p.id,{...family.people[p.id],...p,aliases:[...(family.people[p.id]?.aliases||[]),...(p.aliases||[])]}]));
  if(person&&!people[person])throw new HttpError(404,'בן או בת המשפחה לא נמצאו.');
  const selected=person?people[person]:null,selectedNames=selected?searchNames(selected).map(normalizeSearch):[];
  const queries=searchVariants(q),terms=selected&&(!query||queries.some(value=>selectedNames.includes(value)))?[]:queries.map(value=>value.split(' '));
  const queryPeople=!selected&&query?new Set(Object.values(people).filter(p=>personRank(p,q)>0).map(p=>p.id)):new Set();
  const personSummary=p=>({id:p.id,name:p.name,nameEn:p.nameEn||null,profile:p.profile||null,profileFraming:p.profileFraming||null,branch:p.branch||null,extra:Boolean(p.extra),extended:Boolean(p.extended)});
  const tags=new Map(),collections=new Map();
  for(const row of state.rows('SELECT t.media_id,t.person_id FROM media_tags t JOIN media m ON m.id=t.media_id')){if(!tags.has(row.media_id))tags.set(row.media_id,[]);tags.get(row.media_id).push(row.person_id);}
  for(const row of state.rows('SELECT c.media_id,c.collection FROM media_collections c JOIN media m ON m.id=c.media_id')){if(!collections.has(row.media_id))collections.set(row.media_id,[]);collections.get(row.media_id).push(row.collection);}
  const library=state.nostalgiaLibrary.read(),events=list(library.events),eventById=new Map(events.map(event=>[event.id,event]));
  const entries=[],eventPeople=new Map(),greetingsByWedding=new Map();
  for(const row of state.rows('SELECT wedding_id,data FROM greetings')){if(!greetingsByWedding.has(row.wedding_id))greetingsByWedding.set(row.wedding_id,[]);greetingsByWedding.get(row.wedding_id).push(JSON.parse(row.data));}
  function add(entry,words,personIds=[]){
    const body=normalizeSearch(words.join(' '));
    const mentions=selectedNames.some(name=>name&&body.includes(name));
    const inferred=selected?(mentions?[person]:[]):[...queryPeople].filter(id=>searchNames(people[id]).map(normalizeSearch).some(name=>name.includes(' ')&&body.includes(name)));
    const ids=[...new Set([...personIds,...inferred])].filter(id=>people[id]),names=ids.flatMap(id=>searchNames(people[id])),haystack=normalizeSearch([...words,...names].join(' '));
    if(selected&&!ids.includes(person)&&!mentions)return;
    const tagged=!selected&&ids.some(id=>queryPeople.has(id));
    if(terms.length&&!tagged&&!terms.some(words=>words.every(term=>haystack.includes(term))))return;
    const title=normalizeSearch([entry.title,entry.titleEn].join(' '));
    const score=entry.type==='person'?personRank(people[entry.id],q)+50+(2-personSearchPriority(people[entry.id],q,'keha-home'))*200+(selected&&entry.id===person?110:0):(selected&&ids.includes(person)?90:tagged?80:queries.some(value=>title.includes(value))?70:40);
    entries.push({...entry,personIds:ids,branches:[...new Set(ids.map(id=>people[id]?.branch).filter(Boolean))],labels:entry.labels||[],score,excerpt:plain(entry.excerpt).slice(0,230)});
  }
  if(query||person){
    for(const p of Object.values(people)){
      if(p.placeholder)continue;
      add({id:p.id,type:'person',title:p.name,titleEn:p.nameEn,href:'#person/'+encodeURIComponent(p.id),portrait:p.profile||null,year:dateYear(p.birthday),date:'',excerpt:p.about||p.notes||'',person:personSummary(p)},[...searchNames(p),p.about,p.aboutEn,p.notes,p.languages,p.countries,p.jobs,p.birthday],[p.id]);
    }
    for(const row of state.rows("SELECT data FROM media WHERE category!='attachment'")){
      const item=JSON.parse(row.data),kind=item.kind||(item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document');
      if(item.archiveExcluded||!['photo','video','document'].includes(kind))continue;
      const albums=[...new Set([item.category,...(collections.get(item.id)||[])])],eventItems=list(item.nostalgiaEventIds).map(id=>eventById.get(id)).filter(Boolean);
      const albumPeople=albums.flatMap(album=>album.startsWith('wedding:')?family.units[album.slice(8)]?.people||[]:album.startsWith('nursery:')?[album.slice(8)]:[]);
      const ids=[...(tags.get(item.id)||[]),...(item.category==='personal'?[item.personId]:[]),...albumPeople],labels=photoLabels(item.labels);
      for(const event of eventItems){if(!eventPeople.has(event.id))eventPeople.set(event.id,new Set());for(const id of ids)eventPeople.get(event.id).add(id);}
      const albumNames=albums.flatMap(album=>album.startsWith('wedding:')?(family.units[album.slice(8)]?.people||[]).flatMap(id=>searchNames(people[id]||{})):[]);
      add({id:item.id,type:kind,title:item.caption||item.name||item.filename,titleEn:item.nameEn,excerpt:item.caption||'',year:yearOf(item.takenDate?.year)||yearOf(eventItems[0]?.date?.year),date:item.createdAt||'',labels,_media:item},[item.name,item.nameEn,item.filename,item.caption,item.takenDate?.year,...labels.flatMap(id=>[photoLabelName(id),photoLabelName(id,true)]),...albumNames,...eventItems.flatMap(event=>[event.name,event.nameEn,event.location])],ids);
    }
    for(const [table,kind] of [['stories','story'],['recordings','voice']])for(const row of state.rows('SELECT data FROM '+table)){
      const item=JSON.parse(row.data);
      add({id:item.id,type:kind,title:item.title,excerpt:item.body,year:yearOf(item.year),date:item.createdAt||'',href:'#'+(kind==='story'?'stories':'voices'),content:kind==='story'?{id:item.id,title:item.title,body:item.body,author:item.author,year:item.year,attachments:list(item.attachments)}:{id:item.id,title:item.title,body:item.body,author:item.author,year:item.year,src:'/api/voices/'+item.id+'/audio'}},[item.title,item.body,item.author,item.year],list(item.personIds));
    }
    for(const row of state.rows('SELECT data FROM weddings')){
      const item=JSON.parse(row.data),unit=family.units[item.id];if(!unit||unit.people.length!==2)continue;
      const title=unit.people.map(id=>people[id]?.name).join(' · '),titleEn=unit.people.map(id=>people[id]?.nameEn).filter(Boolean).join(' · ');
      const greetings=greetingsByWedding.get(item.id)||[];
      add({id:item.id,type:'wedding',title,titleEn,excerpt:greetings.map(g=>[g.author,g.body,g.message].filter(Boolean).join(': ')).join(' · '),href:'#weddings/'+encodeURIComponent(item.id),year:dateYear(item.date),date:item.updatedAt||''},[title,titleEn,item.date,...greetings.flatMap(g=>[g.author,g.body,g.message])],unit.people);
    }
    for(const event of events){
      add({id:event.id,type:'event',title:event.name,titleEn:event.nameEn,excerpt:event.location,href:'#nostalgia/event/'+encodeURIComponent(event.id),year:yearOf(event.date?.year),date:event.createdAt||''},[event.name,event.nameEn,event.location,event.date?.year],[...(eventPeople.get(event.id)||[])]);
    }
  }
  const matches=(entry,{ignore}={})=>(ignore==='type'||type==='all'||entry.type===type)&&(ignore==='branch'||!branch||entry.branches.includes(branch))&&(ignore==='year'||!year||String(entry.year)===year)&&(ignore==='label'||!label||entry.labels.includes(label));
  const typeCounts=countBy(entries.filter(item=>matches(item,{ignore:'type'})),item=>[item.type]);
  const branchCounts=countBy(entries.filter(item=>matches(item,{ignore:'branch'})),item=>item.branches);
  const yearCounts=countBy(entries.filter(item=>matches(item,{ignore:'year'})),item=>[item.year]);
  const labelCounts=countBy(entries.filter(item=>matches(item,{ignore:'label'})),item=>item.labels);
  const found=entries.filter(item=>matches(item));
  found.sort((a,b)=>sort==='relevance'?b.score-a.score||b.date.localeCompare(a.date)||a.id.localeCompare(b.id):((a.year?String(a.year):a.date)||(sort==='oldest'?'9999':'' )).localeCompare((b.year?String(b.year):b.date)||(sort==='oldest'?'9999':''))*(sort==='oldest'?1:-1)||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(found.length/size)),page=Math.min(requestedPage,pages),slice=found.slice((page-1)*size,page*size);
  const publicMedia=new Map(state.mediaPublicMany(slice.filter(item=>item._media).map(item=>item._media)).map(item=>[item.id,item]));
  const items=slice.map(({_media,score,branches,personIds,...entry})=>({...entry,people:personIds.map(id=>personSummary(people[id])),...(_media?{media:publicMedia.get(entry.id)}:{})}));
  return {query:q,person:selected?personSummary(selected):null,items,count:found.length,page,pages,size,facets:{types:SEARCH_TYPES.filter(id=>typeCounts.has(id)).map(id=>({id,count:typeCounts.get(id)})),branches:family.branches.filter(b=>branchCounts.has(b.id)).map(b=>({id:b.id,name:b.title,nameEn:b.titleEn,count:branchCounts.get(b.id)})),years:[...yearCounts].sort((a,b)=>Number(b[0])-Number(a[0])).map(([id,count])=>({id,count})),labels:[...labelCounts].map(([id,count])=>({id,name:photoLabelName(id),nameEn:photoLabelName(id,true),count}))}};
}
