import {branchForPerson, BRANCHES, createFamily} from '../public/nakash/family-data.mjs';
import {toOriginalFamilyData} from '../public/nakash/tree-data-adapter.mjs';
import {normalizeSearch, searchNames} from '../public/assets/site-search-core.mjs';
import {DEFAULT_VIDEO_CATEGORIES} from '../public/assets/video-category-catalog.mjs';
import {normalizePhotoLabel, photoLabels} from '../public/assets/photo-labels-catalog.mjs';
import {photoDate} from '../public/assets/photo-date.mjs';
import {decodeUploadMetadata} from '../public/assets/photo-upload-metadata.mjs';
import {videoUploadMetadata} from '../public/assets/video-upload-metadata.mjs';
import {biographyValue, biographyDefaults, contentField} from './biography.mjs';
import {calendarDate, checkOrigin, equal, HttpError, json, readJSON, sha256, text, uid, boundedBody} from './http.mjs';
import {configured, deleteObject, getObject, putObject} from './hf.mjs';
import {galleryOrdering} from './gallery.mjs';
import {photoFrame} from './photo-framing.mjs';
import {photoTransform, transformPhotoFaces} from './photo-versions.mjs';
import {searchNakash} from './nakash-search.mjs';
import {zipStream} from './zip.mjs';
import {renderVideoRange, videoClipRoute, videoEditRoute} from './video-clip-route.mjs';
import {VideoEdits} from './video-edits.mjs';
import {restrictedOriginalPerson} from './family-content.mjs';
import {uploadFamilyDocument} from './family-content-route.mjs';

const route = /^\/nakash\/api\/compat\/(keha|haim|yehuda|medina)(\/api\/.*)$/;
const absent = () => new HttpError(404, 'הפריט המבוקש לא נמצא.');
const validId = id => /^[a-f0-9]{32}$/.test(id);
const albums = {photos:'photo',videos:'video',documents:'document'};
const filterKeys = ['all','untagged','partial','complete'];
export const portraitPath = '/nakash/api/profile-photo/';
const mediaPath = '/nakash/api/media/';

function created(item) {
  return item.createdAt || '1970-01-01T00:00:00.000Z';
}
function picture(item) {
  const display = item.filename || item.file || item.id + (item.kind==='video'?'.mp4':'.jpg');
  const tags = (item.people || []).map(id => typeof id === 'string' ? {id,personId:id,name:id} : id);
  const reviewed = Boolean(item.faceSummary?.reviewed);
  const faceSummary = {...item.faceSummary,reviewed,partial:!reviewed&&Boolean(item.people?.length)};
  const scope = item.personId?'personal:'+item.personId:item.kind==='video'?'videos':'gallery';
  return {
    id:item.id, kind:item.kind, file:item.file||item.id,
    src:mediaPath+item.id+(item.photoRevision||item.videoRevision?'?v='+(item.photoRevision||item.videoRevision):''),mime:item.mime,
    filename:display, name:item.name || display.replace(/\.[^.]*$/,''),
    caption:item.caption||'', tags, branches:item.branches, people:item.people, scope,
    collections:item.collections||[scope], tagsRevision:item.tagsRevision||'empty',
    takenDate:item.takenDate||null, takenDateRevision:item.takenDateRevision||null,
    createdAt:created(item), updatedAt:item.updatedAt||created(item),
    ...(item.kind==='photo'?{photoRevision:item.photoRevision||'original',faceSummary,labels:photoLabels(item.labels),framing:item.framing||null}:{}),
    ...(item.kind==='video'?{videoRevision:item.videoRevision||'original',videoCategory:item.videoCategory||'family',
      duration:item.duration||null, provider:item.provider || 'upload', ...(item.youtubeId?{youtubeId:item.youtubeId,youtubeStart:item.youtubeStart,youtubeEnd:item.youtubeEnd}:{})}:{}),
  };
}

function page(items, params, {sizeDefault=100, sortDefault='uploaded-desc', pageField='page', focus='', limit=200}={}) {
  const requested = Math.max(1, Math.trunc(Number(params.get(pageField))) || 1);
  const sizeField = pageField==='page'?'size':pageField+'Size';
  const sortField = pageField==='page'?'sort':pageField+'Sort';
  const seedField = pageField==='page'?'seed':pageField+'Seed';
  const size = params.get(sizeField)==='all'?Math.max(items.length,1):Math.max(1,Math.min(limit,Math.trunc(Number(params.get(sizeField)))||sizeDefault));
  const pages = Math.max(1,Math.ceil(items.length/size));
  const {sort,seed} = galleryOrdering({sort:params.get(sortField)||sortDefault,seed:params.get(seedField)});
  const rank = item => Math.imul(parseInt(item.id.slice(0,8),16)^seed,0x45d9f3b)>>>0;
  const byDate = item => item.takenDate?.year * 10000 + (item.takenDate?.month || 1) * 100 + (item.takenDate?.day || 1);
  const compare = sort.startsWith('tags-')?(a,b)=>(a.people?.length||0)-(b.people?.length||0):
    sort.startsWith('taken-')?(a,b)=>byDate(a)-byDate(b):
    sort.startsWith('modified-')?(a,b)=>(a.updatedAt||created(a)).localeCompare(b.updatedAt||created(b)):
    (a,b)=>created(a).localeCompare(created(b));
  const sorted = items.slice().sort((a,b)=>sort==='random'?rank(a)-rank(b)||a.id.localeCompare(b.id):
    sort.startsWith('taken-') && Boolean(byDate(a))!==Boolean(byDate(b))?Number(Boolean(byDate(b)))-Number(Boolean(byDate(a))):
    (sort.endsWith('-asc')?1:-1)*(compare(a,b)||0)||b.id.localeCompare(a.id));
  const position = focus ? sorted.findIndex(item=>item.id===focus) : -1;
  const current = position < 0 ? Math.min(pages,requested) : Math.floor(position/size)+1;
  return {items:sorted.slice((current-1)*size,current*size),page:current,size,pages,total:items.length,sort,seed};
}

export async function compatRoute(request, env, db, ctx, options, projection) {
  const url = new URL(request.url);
  const extended = /^\/keha-extended\/(?:(shlomo|zechariah|kehat)\/)?api\/compat(\/api\/.*)$/.exec(url.pathname);
  const match = extended ? [extended[0],extended[1]||'extended',extended[2]] : route.exec(url.pathname);
  if (!match) return null;
  const [,branch,path] = match, params = url.searchParams, method = request.method;
  const contentBranch=branch==='keha'&&params.get('familyScope')==='nakash'?'nakash':branch;
  async function snapshot(result){
    const revision=result.revision||await sha256(JSON.stringify(result)),etag='"'+revision+'"';
    return request.headers.get('If-None-Match')===etag?new Response(null,{status:304,headers:{ETag:etag}}):json({...result,revision},200,{ETag:etag});
  }
  const formDownload = method==='POST' && ['/api/media/download','/api/gallery/download'].includes(path);
  if (method==='POST') {
    checkOrigin(request);
    if (!formDownload && !equal(request.headers.get('X-Family-Token'),options.nakashToken)) throw new HttpError(403,'יש לרענן את הדף לפני שמירת השינוי.');
  }
  if (path==='/api/health' && method==='GET') return json({available:true,mediaConfigured:configured(env)});
  if (path==='/api/setup' && method==='GET') return json({mediaConfigured:configured(env)});
  const original = await projection();
  const nativeRoute = original.sharedPeople && options.nativeRoute ? async (source,path) => {
    const mediaId=/^\/api\/media\/([a-f0-9]{32})\//.exec(path)?.[1];
    if(mediaId)await db('content.media.authorize',{branch,id:mediaId});
    const response=await options.nativeRoute(source,path);
    if(!response.ok || !response.headers.get('Content-Type')?.includes('application/json'))return response;
    const result=await response.json();
    if(extended&&result.taggedPeople?.length){
      const ids=result.taggedPeople.filter(person=>!Object.hasOwn(names,person.id)).map(person=>person.id);
      if(ids.length)await db('nakash.extended.members',{branch,ids});
    }
    const display=p=>p&&names[p.id]?{...p,...(p.profile?.startsWith('/media/')?{profile:p.profile+(p.profile.includes('?')?'&':'?')+'portrait='+encodeURIComponent(p.id)}:{}),...(restrictedOriginalPerson(p.id)?{photoCount:0,videoCount:0,documentCount:0,mediaCount:0,gallery:[]}:{}),extra:names[p.id].extra,extended:names[p.id].extended,branch:names[p.id].branch}:p;
    if(result.person)result.person=display(result.person);
    if(result.people)result.people=Array.isArray(result.people)?result.people.map(display):Object.fromEntries(Object.entries(result.people).map(([id,p])=>[id,display(p)]));
    if(result.taggedPeople)result.taggedPeople=result.taggedPeople.map(display);
    // Native editors also return the original collection as a convenience.
    // A scoped app refreshes its own collection instead of receiving that album.
    delete result.albumUpdates;
    if(result.collection)delete result.collection;
    const headers=new Headers(response.headers);headers.delete('Content-Length');
    return json(result,response.status,Object.fromEntries(headers));
  } : null;
  const family = (options.createFamily || createFamily)(original);
  const scoped = toOriginalFamilyData(family);
  const profiles = (await db('nakash.compat.profiles')).profiles;
  const names = Object.fromEntries(Object.entries(scoped.people).map(([id,p]) => {
    const saved=profiles[id]||{};
    return [id,{...p,...saved,...(saved.profile?.startsWith('/media/')?{profile:saved.profile+(saved.profile.includes('?')?'&':'?')+'portrait='+encodeURIComponent(id)}:{}),...(restrictedOriginalPerson(id)?{photoCount:0,videoCount:0,documentCount:0,mediaCount:0,gallery:[]}:{}),extra:false,extended:false,branch:p.branch}];
  }));
  for(const [id,p] of Object.entries(profiles))if(p.extra&&!Object.hasOwn(names,id)&&(extended?branch==='extended'?['extended','shlomo','zechariah','kehat'].some(app=>p.nakashBranch===app||p.familyApps?.includes(app)):p.nakashBranch===branch||p.familyApps?.includes(branch):!p.extendedKeha))names[id]=p;
  const newProfiles=new Map();
  // Both shells use the original editor and the same underlying media record.
  // Authentication was checked above with the token for the originating shell.
  if(nativeRoute && /^\/api\/media\/[a-f0-9]{32}\//.test(path))return nativeRoute(request,path);
  async function categories() {
    return [...DEFAULT_VIDEO_CATEGORIES,...(await db('nakash.compat.categories',{branch})).categories];
  }
  const person = id => {
    if (!Object.hasOwn(names,id)) throw absent();
    return names[id];
  };
  async function tagPerson(selection) {
    if(selection?.personId)return person(selection.personId);
    const name=text(selection?.name,'שם',120,true).replace(/\s+/g,' ');
    const normalized=normalizeSearch(name);
    if(!normalized)throw new HttpError(400,'הזינו שם תקין.');
    const id='extra-nakash-'+(await sha256(branch+'\u001f'+normalized)).slice(0,24);
    if(Object.hasOwn(names,id))return names[id];
    const known=Object.values(names).find(p=>!p.extra&&searchNames(p).some(alias=>normalizeSearch(alias)===normalized));
    if(known)return known;
    const extra={id,name,branch,birthday:'1.1.1111',extra:true,revision:uid()};
    names[id]=extra;newProfiles.set(id,extra);
    return extra;
  }
  const collection = async (kind,personId) =>
    (await db(nativeRoute?'content.items':extended?'nakash.extended.items':'nakash.compat.items',{branch,...(kind?{kind}:{}),...(personId?{personId}:{})})).items.filter(item=>!item.deletedAt&&(!personId||item.personId===personId||item.people?.includes(personId)));
  const describe = item => ({
    ...picture(item),
    ...(nativeRoute?{src:'/media/'+item.id+(item.photoRevision?'?v='+item.photoRevision:'')}:{}),
    tags:(item.people||[]).filter(id=>Object.hasOwn(names,id)).map(id=>({id,personId:id,name:names[id].name})),
    ...(item.thumbnail?{thumbnailSrc:(nativeRoute?'/media/':mediaPath)+item.id+(nativeRoute?'?thumbnail=1&v=':'?asset=thumbnail&v=')+encodeURIComponent(item.thumbnail.revision)}:{}),
    ...(item.preview?{previewSrc:(nativeRoute?'/media/':mediaPath)+item.id+(nativeRoute?'?preview=1&v=':'?asset=preview&v=')+encodeURIComponent(item.preview.revision)}:{}),
  });
  const itemById = async (id,{deleted=false,writing=false}={}) => {
    const {item} = await db('nakash.get',{id});
    if ((!deleted && item.deletedAt) || !item.branches.includes(branch) && !(writing && item.branch===branch)) throw absent();
    return item;
  };
  const update = async (item,changes,expected={}) => {
    const result = await db('nakash.compat.update',{id:item.id,branch,changes:{...changes,updatedAt:new Date().toISOString()},expected,people:[...newProfiles.values()]});
    return result.item;
  };
  const itemFilter = (items, query, options) => {
    const search = normalizeSearch(query);
    const ids = new Set((options.person||'').split(',').filter(Boolean));
    for (const unitId of (options.unit||'').split(',').filter(Boolean)) {
      const stack=[unitId];
      while(stack.length){const unit=scoped.units[stack.pop()];if(unit){unit.people.forEach(id=>ids.add(id));stack.push(...unit.children);}}
    }
    const tags = (options.labels||'').split(',').filter(Boolean);
    return items.filter(item=>(!search||normalizeSearch([item.name,item.caption,...(item.people||[]).flatMap(id=>searchNames(names[id]||{}))].join(' ')).includes(search))
      && (!ids.size||(item.people||[]).some(id=>ids.has(id))) && tags.every(label=>photoLabels(item.labels).includes(label)));
  };
  const isFull = item => Boolean(item.faceSummary?.reviewed || item.reviewed);
  const status = item => isFull(item) ? 'complete' : item.people?.length ? 'partial' : 'untagged';
  function subjectBranches(people, homeBranch) {
    const subjects = [...new Set(people.map(id=>branchForPerson(family,id)||names[id]?.branch).filter(Boolean))];
    return subjects.length ? subjects : [homeBranch];
  }
  function tagsUpdate(item, people, fields={}) {
    return update(item,{...fields,people,branches:subjectBranches(people,item.branch),tagsRevision:uid()},
      {people:item.people||[]});
  }
  const box = value => {
    const {x,y,width,height} = value||{};
    if(![x,y,width,height].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||width<.0005||height<.0005||x+width>1.000001||y+height>1.000001) {
      throw new HttpError(400,'סימון אזור הפנים אינו תקין.');
    }
    return {x,y,width,height};
  };
  function faceState(item) {
    return {item:describe(item),faces:(item.faces||[]).map(face=>({...face,person:names[face.personId]})).filter(face=>face.person),
      ignoredFaces:item.ignoredFaces||[],detectedFaces:item.detectedFaces||[],unassignedFaces:item.unassignedFaces||[]};
  }
  async function gallery(kind,{all=false}={}) {
    const collectionKind = kind==='videos'?'video':'photo';
    const available = await collection(collectionKind);
    const filtered = itemFilter(available,params.get('q'),Object.fromEntries(params));
    const filters = Object.fromEntries(filterKeys.map(key=>[key,key==='all'?filtered.length:filtered.filter(item=>status(item)===key).length]));
    const filter = params.get('filter')||'all';
    const subset = filter==='all'?filtered:filtered.filter(item=>status(item)===filter);
    const base = !all&&(kind==='gallery'||params.get('paged')==='1')?page(subset,params):{items:subset};
    const {items,...pagination}=base;
    const revision = await sha256(JSON.stringify([items,pagination,filters]));
    return {kind, items:items.map(describe),count:pagination.total??items.length,revision,
      ...(base.page?{pagination:{...pagination,query:params.get('q')||'',filter,person:params.get('person')||'',unit:params.get('unit')||'',labels:params.get('labels')||''}}:{}),
      ...(kind==='gallery'?{filterCounts:filters}:{}), ...(kind==='videos'?{categories:await categories()}:{}),
      cover:items[0]?describe(items[0]):null};
  }
  async function personPage(id,{all=false}={}) {
    if(nativeRoute) {
      const result=await db('content.person',{...Object.fromEntries(params),branch,id,selection:all});
      if(all)return result;
      const p=result.person;
      return {...result,person:{...p,...(p.profile?.startsWith('/media/')?{profile:p.profile+(p.profile.includes('?')?'&':'?')+'portrait='+encodeURIComponent(id)}:{}),extra:person(id).extra,extended:person(id).extended,branch:person(id).branch}};
    }
    const p=person(id),items=await collection(null,id), data={};
    for(const [key,kind] of Object.entries(albums)){
      const options=Object.fromEntries(['person','unit','labels'].map(name=>[name,params.get(key+name[0].toUpperCase()+name.slice(1))]));
      const filtered=itemFilter(items.filter(item=>item.kind===kind),'',options);
      const a=all?{items:filtered}:page(filtered,params,{sizeDefault:10,pageField:key,focus:params.get('focus')});
      data[key]={...a,items:a.items.map(describe)};
    }
    return {person:p,albums:data,revision:await sha256(JSON.stringify([p,data]))};
  }
  async function upload(kind, owner, category) {
    if(!configured(env))throw new HttpError(503,'אחסון הקבצים אינו זמין כרגע.');
    const filename = (params.get('filename')||'upload').replace(/[\/\\\u0000-\u001f]/g,'_').slice(0,220);
    const incoming = await options.streamUpload(request, kind==='document'?options.limits.attachment:options.limits[kind], true);
    let format,meta;
    try {
      format=kind==='document'?options.archiveFormat(incoming.head,filename):options.sniff(incoming.head,kind==='video');
      if (kind==='document'&&!['photo','document'].includes(format.kind))throw new HttpError(415,'בחרו מסמך או צילום תעודה.');
      meta=incoming.metadata?decodeUploadMetadata(incoming.metadata):null;
    } catch(error) {await incoming.body.cancel().catch(()=>{});throw error;}
    const id = params.get('uploadId') || uid();
    if (!validId(id)){await incoming.body.cancel().catch(()=>{});throw new HttpError(400,'אישור ההעלאה אינו תקין.');}
    const found = await db('nakash.get',{id}).catch(error=>{if(error.status!==404)throw error;});
    if(found){
      await incoming.body.cancel().catch(()=>{});
      if (found.item.branch!==branch||found.item.filename!==filename) throw new HttpError(409,'הקובץ השתנה. בחרו אותו מחדש.');
      return json(owner?{saved:true,file:found.item.file,...await personPage(owner)}:{saved:true,file:found.item.file,collection:await gallery(category)});
    }
    const faceTags=[];
    for(const face of meta?.faces||[]){
      let tagged;
      try{tagged=await tagPerson(face);}catch(error){await incoming.body.cancel().catch(()=>{});throw error;}
      faceTags.push({personId:tagged.id,rect:face.rect,id:uid(),revision:uid()});
    }
    const people = [...new Set([owner,...faceTags.map(face=>face.personId)].filter(Boolean))];
    const branches = subjectBranches(people,branch);
    const item = {id, key:'nakash/'+uid()+format.ext,size:incoming.size,mime:format.mime,kind,branch,branches,people,
      personId:owner||null, file:id+format.ext,filename,caption:meta?.caption||'',takenDate:meta?.date||null,
      createdAt:new Date().toISOString(),...kind==='photo'&&meta?{
        faces:faceTags,
        labels:meta.labels,faceSummary:{reviewed:!!meta.complete},
      }:{},
      ...(kind==='video'?{videoCategory:params.get('group')||'family'}:{})};
    let body=incoming.body, transfer=Promise.resolve();
    if(typeof FixedLengthStream!=='undefined'){
      const fixed=new FixedLengthStream(incoming.size);
      transfer=body.pipeTo(fixed.writable);transfer.catch(()=>{});body=fixed.readable;
    }
    await Promise.all([putObject(env,item.key,body,item.size,item.mime),transfer]);
    try {await db('nakash.add',{item,people:[...newProfiles.values()]});}catch(error){ctx.waitUntil(deleteObject(env,item.key).catch(()=>{}));throw error;}
    return json(owner?{saved:true,file:item.file,...await personPage(owner)}:{saved:true,file:item.file,collection:await gallery(category)},201);
  }
  async function finalizeVideo(item, body) {
    if(item.kind!=='video')throw absent();
    if(item.videoUploadOperation&&item.videoUploadOperation===body.operationId) {
      return {saved:true,item:describe(item),collection:await gallery('videos')};
    }
    let metadata;
    try{metadata=videoUploadMetadata(body.metadata);}catch{throw new HttpError(400,'פרטי הסרטון אינם תקינים.');}
    const people=[...new Set([item.personId,...(await Promise.all(metadata.people.map(tagPerson))).map(person=>person.id)].filter(Boolean))];
    const rendered=metadata.range?await renderVideoRange(request,env,ctx,item,metadata.range,item.id):null;
    const changes={name:metadata.name,caption:metadata.caption,takenDate:metadata.date,people,
      branches:subjectBranches(people,item.branch),tagsRevision:uid(),videoRevision:uid(),
      videoCategory:metadata.group||item.videoCategory||'family',videoUploadOperation:body.operationId||null,...rendered};
    let saved;
    try{
      saved=await update(item,changes,{key:item.key,videoUploadOperation:item.videoUploadOperation||null});
    }catch(error){
      if(rendered&&error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,rendered.key).catch(()=>{}));
      throw error;
    }
    if(rendered)ctx.waitUntil(deleteObject(env,item.key).catch(()=>{}));
    return {saved:true,item:describe(saved),scope:'videos',operation:'video-upload',collection:await gallery('videos')};
  }
  async function changeVideo(item, action) {
    if (item.kind !== 'video' || item.branch !== branch) throw absent();
    const scope=describe(item).scope;
    const changed=(item,operation)=>({saved:true,item:describe(item),operation,scope});
    const edits=new VideoEdits({
      media:()=>item,
      tagsRevision:()=>item.tagsRevision||'empty',
      mediaChanged:changed,
    });
    const peopleFor=async selection=>selection===undefined?(item.people||[]):
      [...new Set([item.personId,...(await Promise.all(selection.map(tagPerson))).map(person=>person.id)].filter(Boolean))];
    const stored=async id=>{
      try{return (await db('nakash.get',{id})).item;}catch(error){if(error.status!==404)throw error;return null;}
    };
    const videoDb=async (operation,args)=>{
      if(operation==='video.edit.prepare')return edits.prepare(args);
      if(operation==='video.edit.save'){
        const {metadata,range,rendered}=args;
        const prepared=metadata||args;
        const people=await peopleFor(prepared.people);
        const original=item.videoOriginal||{key:item.key,mime:item.mime,size:item.size,duration:item.duration||null};
        const fields={name:prepared.name,caption:prepared.caption,nameEn:null,people,branches:subjectBranches(people,branch),
          tagsRevision:prepared.people?uid():item.tagsRevision||'empty',
          videoEdit:{operationId:prepared.operationId,fingerprint:prepared.fingerprint},
          ...(range&&rendered?{...rendered,videoOriginal:original,videoRevision:uid()}:{}),
        };
        const next=await update(item,fields,{key:item.key,videoRevision:item.videoRevision||null,updatedAt:item.updatedAt||null});
        return {...changed(next,'video-edit'),taggedPeople:[],storedKey:next.key};
      }
      if(operation==='video.clip.prepare'){
        if(!validId(args.clipId)||args.clipId===item.id)throw new HttpError(400,'אישור השמירה אינו תקין.');
        const prepared=edits.prepare({...args,operationId:args.clipId,range:{start:args.start,end:args.end}});
        const existing=await stored(args.clipId);
        if(existing){
          if(existing.clipSource!==item.id||existing.branch!==branch)throw new HttpError(409,'פרטי העריכה השתנו.');
          return {existing:{...changed(existing,'video-clip'),alreadySaved:true}};
        }
        return {...prepared,clipId:args.clipId,start:args.start,end:args.end};
      }
      if(operation==='video.clip.save'){
        const people=await peopleFor(args.people);
        const clip={...item,...args.item,id:args.clipId,name:args.name,caption:args.caption,people,
          nameEn:null,branches:subjectBranches(people,branch),clipSource:item.id,videoRevision:null,videoEdit:null,videoOriginal:null,
          filename:args.name+'.mp4',file:args.clipId+'.mp4',createdAt:new Date().toISOString(),updatedAt:null};
        try{await db('nakash.add',{item:clip,people:[...newProfiles.values()]});}catch(error){
          const existing=await stored(args.clipId);
          if(!existing||existing.clipSource!==item.id||existing.branch!==branch)throw error;
          return {...changed(existing,'video-clip'),storedKey:existing.key,alreadySaved:true};
        }
        return {...changed(clip,'video-clip'),storedKey:clip.key,taggedPeople:[]};
      }
      throw absent();
    };
    return action==='clip'?videoClipRoute(request,env,videoDb,ctx,item.id):
      videoEditRoute(request,env,videoDb,ctx,item.id,{removeOnly:action==='video-remove'});
  }
  const currentVersion=item=>({
    id:item.photoRevision||'original',key:item.key,mime:item.mime,size:item.size,filename:item.filename,
    createdAt:item.photoEditedAt||created(item),faces:item.faces||[],
  });
  function history(item) {
    const current=currentVersion(item);
    return [current,...(item.versions||[]).filter(version=>version.id!==current.id)];
  }
  function versionsResponse(item) {
    const current=item.photoRevision||'original';
    return {item:describe(item),currentVersion:current,versions:history(item).map(version=>({
      id:version.id,filename:version.filename,createdAt:version.createdAt,mime:version.mime,size:version.size,
      current:version.id===current,original:version.id==='original',src:mediaPath+item.id+'?version='+version.id,
    }))};
  }
  async function saveVersion(item,version,faces) {
    const next=await update(item,{
      key:version.key,mime:version.mime,size:version.size,photoRevision:version.id,photoEditedAt:new Date().toISOString(),
      versions:history(item),faces:faces.map(face=>({...face,revision:uid()})),thumbnail:null,preview:null,detectedFaces:[],ignoredFaces:[],
    },{photoRevision:item.photoRevision||null});
    return {saved:true,operation:'photo-edit',scope:describe(item).scope,...versionsResponse(next)};
  }

  if(method==='GET'){
    if(path==='/api/stories')return snapshot(await db('content.stories',{branch:contentBranch}));
    if(path==='/api/documents')return json(await db('content.documents',{branch:contentBranch}));
    if(path==='/api/media')return json({people:names,revision:await sha256(JSON.stringify(names))});
    if(path==='/api/tag-people')return json({people:Object.values(names)});
    if(path==='/api/search')return json(searchNakash(Object.values(names),(await collection()).map(describe),extended?scoped.branches:BRANCHES,params,branch));
    if(path==='/api/gallery/face-scan')return json({items:[],next:null});
    if(path==='/api/collections/videos/categories')return json({categories:await categories()});
  }
  if(method==='POST'&&path==='/api/documents/upload')return uploadFamilyDocument(request,env,db,ctx,options,contentBranch);
  const storyMatch=/^\/api\/stories(?:\/([a-f0-9]{24}))?(?:\/(category))?$/.exec(path);
  if(method==='POST'&&storyMatch&&nativeRoute){
    const id=storyMatch[1],snapshot=await db('content.stories',{branch:contentBranch});
    if(id&&!snapshot.stories.some(item=>item.id===id))throw absent();
    if(storyMatch[2]){
      const body=await readJSON(request,2000),previous=snapshot.stories.find(item=>item.id===id);
      return json(await db('content.story.save',{branch:contentBranch,id,fields:{...previous,category:body.category,expectedUpdatedAt:body.expectedUpdatedAt}}));
    }
    return options.story(request,env,async(action,args)=>action==='memory.story.save'||action==='story.save'?db('content.story.save',{...args,branch:contentBranch}):db(action,args),ctx,id||null);
  }
  if(method==='POST'&&path==='/api/collections/videos/categories'){
    const body=await readJSON(request,2000);
    const category={id:uid(),name:text(body.name,'שם הקטגוריה',80,true),nameEn:text(body.nameEn||'','שם באנגלית',80)};
    await db('nakash.compat.category.create',{branch,category});
    return json({category,categories:await categories(),collection:await gallery('videos')},201);
  }
  let m=/^\/api\/collections\/(photos|videos|gallery)(?:\/(upload))?$/.exec(path);
  if(m){
    if(method==='GET'&&!m[2])return json(await gallery(m[1]));
    if(method==='POST'&&m[2])return upload(m[1]==='videos'?'video':'photo',null,m[1]);
  }
  m=/^\/api\/people\/([a-z0-9_-]+)(?:\/([a-z-]+))?$/.exec(path);
  if(m){
    const [,requestedId,action]=m,id=original.identities?.[requestedId] || requestedId,p=person(id);
    if(method==='GET'){
      const result=await personPage(id,{all:action==='selection'});
      if(action==='page')return snapshot(result);
      if(action==='selection')return json(result.ids?result:{ids:result.albums[params.get('kind')]?.items.map(item=>item.id)||[]});
      if(!action)return json({...result,items:Object.values(result.albums).flatMap(album=>album.items)});
    }else if(method==='POST'){
      if(Object.hasOwn(albums,action))return upload(albums[action],id,'personal');
      if(nativeRoute&&['profile','about','biography','death-date'].includes(action))return nativeRoute(request,'/api/people/'+encodeURIComponent(id)+'/'+action);
      const body=await readJSON(request,40000);
      let field,value,expected,fallback;
      if(action==='profile'){
        const items=await collection('photo',id);
        const photo=body.restorePrevious?null:items.find(item=>item.file===body.file||item.id===body.file);
        if(!photo&&!body.restorePrevious)throw absent();
        const changes={profileFile:photo?.file||null,profileMediaId:photo?.id||null,profileFraming:photo?.framing||scoped.people[id].profileFraming||null};
        await db('nakash.compat.profile.save',{id,changes,revision:uid()});
        const profile=photo?mediaPath+photo.id:scoped.people[id].profile||null;
        return json({saved:true,person:{...p,...changes,profile}});
      }
      if(action==='about'){field=contentField('about',body.language);value=text(body.about,'אודות',10000);expected=body.expectedAbout;fallback='';}
      if(action==='biography'){field=contentField(body.section,body.language);value=biographyValue(body.section,body.value);expected=biographyValue(body.section,body.expectedValue);fallback=biographyDefaults[body.section];}
      if(action==='birthday'){field='birthday';value=body.birthday==='1.1.1111'?'1.1.1111':calendarDate(body.birthday||body.date);expected=body.expectedBirthday;fallback=p.birthday||'1.1.1111';}
      if(action==='death-date'){field='deathDate';value=body.date?calendarDate(body.date):null;expected=body.expectedDate;fallback=p.deathDate||null;}
      if(field){
        const {profile}=await db('nakash.compat.profile.save',{id,field,value,...(expected===undefined?{}:{expected}),fallback,revision:uid()});
        return json({saved:true,person:{...p,...profile,extra:p.extra,extended:p.extended,branch:p.branch}});
      }
    }
  }
  m=/^\/api\/media\/([a-f0-9]{32})\/(.+)$/.exec(path);
  if(m){
    const [,id,action]=m, item=await itemById(id,{deleted:method==='POST'&&action==='restore',writing:method==='POST'});
    if(method==='GET'){
      if(action==='view')return json({item:describe(item)});
      if(action==='tags')return json({item:describe(item),tags:describe(item).tags,revision:item.tagsRevision||'original'});
      if(action==='faces')return json(faceState(item));
      if(action==='versions'&&item.kind==='photo')return json(versionsResponse(item));
    }
    if(method==='POST'){
      if(['video-edit','video-remove','clip'].includes(action))return changeVideo(item,action);
      if(action==='edit'&&item.kind==='photo') {
        const nested=async (operation,args)=>{
          const reference=history(item).find(version=>version.id===args.baseVersion);
          if(!reference||args.expectedVersion!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה נערכה בינתיים. פתחו את העורך מחדש.');
          const transform=photoTransform(args.rotation,args.crop);
          if(operation==='photo.prepare')return {};
          const faces=transformPhotoFaces(reference.faces,transform);
          if(operation==='photo.save')return saveVersion(item,args.version,faces);
          if(operation==='photo.copy'){
            const {id,key,mime,size,filename}=args.version;
            const copy={...item,id,key,mime,size,filename,file:key.split('/').at(-1),createdAt:new Date().toISOString(),
              photoRevision:null,photoEditedAt:null,versions:[],faces,thumbnail:null,preview:null,detectedFaces:[],ignoredFaces:[]};
            await db('nakash.add',{item:copy});
            return {saved:true,operation:'photo-copy',scope:describe(copy).scope,item:describe(copy),sourceId:item.id,albumUpdates:{gallery:await gallery('gallery')}};
          }
          throw absent();
        };
        return options.editPhoto(request,env,nested,ctx,id);
      }
      if(['thumbnail','preview'].includes(action)) {
        const mediaDb=async (operation,args)=>{
          if(operation==='media.get')return item;
          if(operation==='media.public')return {item:describe(item)};
          if(operation==='photo.thumbnail'){
            const obsoleteKey=item[action]?.key;
            const next=await update(item,{[action]:args.thumbnail},{[action]:item[action]||null,photoRevision:item.photoRevision||null});
            return {saved:true,item:describe(next),obsoleteKey};
          }
          throw absent();
        };
        return options.saveThumbnail(request,env,mediaDb,ctx,id,action);
      }
      const body=await readJSON(request,64000);
      let changes,expected={};
      const restore=/^versions\/(original|[a-f0-9]{32})\/restore$/.exec(action);
      if(restore&&item.kind==='photo'){
        const selected=history(item).find(version=>version.id===restore[1]);
        if(!selected)throw absent();
        if(body.expectedVersion!==(item.photoRevision||'original'))throw new HttpError(409,'התמונה נערכה בינתיים. פתחו את העורך מחדש.');
        return json(await saveVersion(item,{...selected,id:uid()},selected.faces));
      }
      if(['tags','tag','tags/patch','untag','retag'].includes(action)){
        const people=new Set(item.people||[]);
        const scopePerson=typeof body.scope==='string'&&body.scope.startsWith('personal:')?body.scope.slice(9):null;
        const tagChanges=action==='tags/patch'?body.changes:action==='tag'?[body]:
          scopePerson?[{personId:scopePerson,tagged:action==='retag'}]:[];
        if(!Array.isArray(tagChanges)||tagChanges.length>150)throw new HttpError(400,'בחרו שמות מהרשימה.');
        if(action==='tags'){
          if(!Array.isArray(body.personIds)||body.personIds.length>150)throw new HttpError(400,'בחרו שמות מהרשימה.');
          people.clear();for(const selected of body.personIds){person(selected);people.add(selected);}
        }
        const taggedPeople=[];
        for(const change of tagChanges){
          const p=await tagPerson(change);
          if(change.tagged)people.add(p.id);else people.delete(p.id);
          if(change.tagged)taggedPeople.push({id:p.id,name:p.name,key:change.key||p.id});
        }
        const next=await tagsUpdate(item,[...people],{faces:(item.faces||[]).filter(face=>people.has(face.personId))});
        return json({saved:true,item:describe(next),taggedPeople,operation:action.startsWith('tag')?'tags':action});
      }
      if(action==='faces/save'||action==='faces/ignore'){
        const rect=box(body.rect),faces=(item.faces||[]).filter(face=>face.id!==body.faceId);
        const removed=(item.faces||[]).find(face=>face.id===body.faceId);
        if(removed&&removed.revision!==body.expectedRevision)throw new HttpError(409,'התיוג השתנה. פתחו שוב לפני השמירה.');
        const target=body.personId||body.name ? await tagPerson(body) : null;
        const face=target?{id:removed?.id||uid(),personId:target.id,rect,revision:uid()}:null;
        if(face)faces.push(face);
        const people=new Set(item.people||[]);
        if(removed&&!faces.some(face=>face.personId===removed.personId)&&removed.personId!==item.personId)people.delete(removed.personId);
        if(target)people.add(target.id);
        const ignoredFaces=action==='faces/ignore'?[...(item.ignoredFaces||[]),{rect}].slice(-150):item.ignoredFaces||[];
        const next=await tagsUpdate(item,[...people],{faces,ignoredFaces,faceSummary:{reviewed:false}});
        return json({...faceState(next),saved:true,face:face?{...face,person:target}:null,operation:'faces'});
      }
      if(action==='caption'){changes={caption:text(body.caption,'תיאור',5000)};if('expectedCaption'in body)expected.caption=body.expectedCaption;}
      if(action==='photo-date')changes={takenDate:photoDate(body.date),takenDateRevision:uid()};
      if(action==='framing')changes={framing:photoFrame(body.framing)};
      if(action==='video-category')changes={videoCategory:text(body.group,'קטגוריה',80,true)};
      if(action==='video-upload'||action==='video-upload-remove')return json(await finalizeVideo(item,body));
      if(action==='faces/review')changes={faceSummary:{...item.faceSummary,reviewed:!!body.complete}};
      if(action==='faces/detection'){
        const faces=Array.isArray(body.faces)?body.faces.slice(0,150).map(face=>({rect:box(face.rect||face)})):[];
        return json({...faceState(await update(item,{detectedFaces:faces,faceRevision:uid()})),saved:true});
      }
      if(['delete','restore'].includes(action))changes={deletedAt:action==='restore'?null:new Date().toISOString()};
      if(action==='labels'||action==='labels/patch'){
        const label=normalizePhotoLabel(body.label);if(!label)throw new HttpError(400,'בחרו תגית תקינה.');
        const labels=new Set(photoLabels(item.labels));if(body.tagged)labels.add(label);else labels.delete(label);changes={labels:[...labels]};
      }
      if(changes) return json({saved:true,item:describe(await update(item,changes,expected)),operation:action==='faces/review'?'face-review':action==='labels/patch'?'labels':action});
    }
  }
  if(method==='GET'&&path==='/api/gallery/selection')return json({ids:(await gallery('gallery',{all:true})).items.map(item=>item.id)});
  if(formDownload){
    const body=new URLSearchParams(new TextDecoder().decode(await boundedBody(request,500000)));
    if(!equal(body.get('token'),options.nakashToken))throw new HttpError(403,'יש לרענן את הדף לפני ההורדה.');
    let ids;try{ids=JSON.parse(body.get('ids'));}catch{throw new HttpError(400,'בחרו תמונות להורדה.');}
    if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>!validId(id)))throw new HttpError(400,'בחרו תמונות להורדה.');
    const items=nativeRoute?(await db('media.download',{ids})).items:await Promise.all([...new Set(ids)].map(id=>itemById(id)));
    const files=items.map(item=>({name:item.filename||item.file||item.id,open:()=>getObject(env,item,new Request(url.origin+mediaPath+item.id))}));
    return new Response(zipStream(files),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Nakash-media.zip"'}});
  }
  throw absent();
}
