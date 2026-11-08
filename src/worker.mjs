import family from './family.mjs';
import {HttpError,json,fail,text,uid,readJSON,boundedBody,checkOrigin,equal,stateFailure} from './http.mjs';
import {configured,putObject,getObject,deleteObject} from './hf.mjs';
import {couple,weddingCollection} from './weddings.mjs';
import {calendarResponse} from './calendar.mjs';
import {updatesRoute,dispatchUpdates,headRequestRoute} from './updates.mjs';
import {nurseryCollection} from './nursery.mjs';
import {galleryRevision} from './gallery.mjs';
import {zipStream} from './zip.mjs';
import {PHOTO_METADATA_HEADER,MAX_PHOTO_METADATA_BYTES,decodeUploadMetadata} from '../public/assets/photo-upload-metadata.mjs';
export {FamilyState} from './state.mjs';
export {FamilyUpdates} from './updates.mjs';
export const LIMITS={photo:50*1024*1024,video:90*1024*1024,story:22*1024*1024,attachment:10*1024*1024,attachmentTotal:20*1024*1024};
// Public visitors receive this request marker with the page. It is not a password.
export const PUBLIC_WRITE_TOKEN='family-public-v1';

function client(db){return async(action,p={})=>{
  let response;
  try{response=await db.fetch(new Request('https://state.internal/',{method:'POST',body:JSON.stringify({action,...p}),headers:{'Content-Type':'application/json'}}));}
  catch(error){throw stateFailure(error);}
  let result;try{result=await response.json();}catch{throw new HttpError(503,'לא ניתן להשלים את הפעולה כרגע. נסו שוב.','STATE_INVALID_RESPONSE');}
  if(!response.ok)throw new HttpError(response.status,result.error||'לא ניתן לשמור את השינוי.',result.code||(response.status>=500?'STATE_REQUEST_FAILED':null));return result;
};}
export function sniff(head,video=false){
  const starts=bytes=>bytes.every((byte,index)=>head[index]===byte),word=(a,b)=>new TextDecoder().decode(head.slice(a,b));
  if(video){
    if(word(4,8)==='ftyp'&&!['avif','avis','heic','heix','mif1','msf1'].includes(word(8,12)))return word(8,12)==='qt  '?{ext:'.mov',mime:'video/quicktime'}:{ext:'.mp4',mime:'video/mp4'};
    if(starts([0x1a,0x45,0xdf,0xa3])&&word(0,128).toLowerCase().includes('webm'))return {ext:'.webm',mime:'video/webm'};
    throw new HttpError(415,'בחרו סרטון MP4, WebM או MOV. לתאימות רחבה מומלץ MP4 עם קידוד H.264.');
  }
  if(starts([255,216,255]))return {ext:'.jpg',mime:'image/jpeg'};
  if(starts([137,80,78,71,13,10,26,10]))return {ext:'.png',mime:'image/png'};
  if(['GIF87a','GIF89a'].includes(word(0,6)))return {ext:'.gif',mime:'image/gif'};
  if(word(0,4)==='RIFF'&&word(8,12)==='WEBP')return {ext:'.webp',mime:'image/webp'};
  if(word(4,8)==='ftyp'&&['avif','avis'].includes(word(8,12)))return {ext:'.avif',mime:'image/avif'};
  throw new HttpError(415,'בחרו תמונת JPG, PNG, WebP, GIF או AVIF. תמונות HEIC יש להמיר ל־JPG.');
}
function archiveFormat(head,name){
  try{return {...sniff(head),kind:'photo',maximum:LIMITS.photo};}catch{}
  try{return {...sniff(head,true),kind:'video',maximum:LIMITS.video};}catch{}
  const ext=name.match(/\.[^.]+$/)?.[0].toLowerCase(),word=new TextDecoder().decode(head);
  const starts=bytes=>bytes.every((byte,index)=>head[index]===byte);
  const types={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.doc':'application/msword','.txt':'text/plain','.md':'text/markdown'};
  const valid=ext==='.pdf'?word.trimStart().startsWith('%PDF-'):ext==='.docx'?starts([80,75,3,4]):ext==='.doc'?starts([208,207,17,224,161,177,26,225]):['.txt','.md'].includes(ext)&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(word);
  if(valid)return {ext,mime:types[ext],kind:'document',maximum:LIMITS.attachment};
  throw new HttpError(415,'בחרו תמונה, סרטון MP4, WebM או MOV, או מסמך PDF, Word, TXT או Markdown.');
}
function filename(value){return String(value||'family').split(/[\\/]/).pop().replace(/[\x00-\x1f<>:"|?*]/g,'_').slice(0,200)||'family';}
async function streamUpload(request,maximum,withPhotoMetadata=false){
  const prefix=withPhotoMetadata?request.headers.get(PHOTO_METADATA_HEADER):null,metadataLength=prefix===null?0:Number(prefix);
  if(prefix!==null&&(!/^[0-9]+$/.test(prefix)||!Number.isSafeInteger(metadataLength)||metadataLength<2||metadataLength>MAX_PHOTO_METADATA_BYTES))throw new HttpError(400,'פרטי התמונה אינם תקינים. בחרו את התמונה מחדש.');
  const raw=request.headers.get('Content-Length'),declared=Number(raw),size=declared-metadataLength;
  if(raw===null||!Number.isSafeInteger(declared))throw new HttpError(411,'לא התקבל גודל הקובץ. בחרו את הקובץ מחדש ונסו שוב.');
  if(size<=0)throw new HttpError(400,'הקובץ ריק.');if(size>maximum)throw new HttpError(413,'אפשר להעלות עד 50MB לתמונה ועד 90MB לסרטון.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'הקובץ לא התקבל.');
  const first=[],metadata=metadataLength?new Uint8Array(metadataLength):null;let firstLength=0,metadataRead=0;
  while(firstLength<Math.min(128,size)){
    const part=await reader.read();if(part.done){await reader.cancel();throw new HttpError(400,'ההעלאה הופסקה לפני סיומה.');}
    let bytes=part.value;
    if(metadataRead<metadataLength){const amount=Math.min(metadataLength-metadataRead,bytes.byteLength);metadata.set(bytes.subarray(0,amount),metadataRead);metadataRead+=amount;bytes=bytes.subarray(amount);}
    if(bytes.byteLength){first.push(bytes);firstLength+=bytes.byteLength;}
    if(firstLength>size){await reader.cancel();throw new HttpError(400,'גודל הקובץ אינו מתאים לנתונים שהתקבלו.');}
  }
  const head=new Uint8Array(Math.min(128,firstLength));let offset=0;
  for(const part of first){const amount=Math.min(part.byteLength,head.length-offset);head.set(part.subarray(0,amount),offset);offset+=amount;if(offset===head.length)break;}
  let total=0,index=0;
  const body=new ReadableStream({
    async pull(controller){
      try{
        const next=index<first.length?{value:first[index++],done:false}:await reader.read();
        if(next.done){if(total!==size)throw new HttpError(400,'ההעלאה לא הושלמה.');controller.close();return;}
        total+=next.value.byteLength;if(total>size)throw new HttpError(400,'גודל הקובץ אינו תקין.');controller.enqueue(next.value);
      }catch(error){await reader.cancel().catch(()=>{});controller.error(error);}
    },cancel(reason){return reader.cancel(reason);}
  });
  return {size,head,body,metadata};
}
async function upload(request,env,db,ctx,{category,personId=null,mixed=false,mediaType='photo'}){
  const videoCategory=new URL(request.url).searchParams.get('group')||'family';
  if(category==='videos'&&!['family','special-birthdays'].includes(videoCategory))throw new HttpError(400,'קטגוריית הסרטון אינה מוכרת.');
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני העלאת קבצים.');
  if(personId)await db('person',{id:personId});
  const media=await streamUpload(request,mediaType==='document'?LIMITS.attachment:mixed||category==='videos'||mediaType==='video'?LIMITS.video:LIMITS.photo,true);
  const id=uid(),original=filename(new URL(request.url).searchParams.get('filename'));
  let format,metadata=null;
  try{
    format=mixed||mediaType==='document'?archiveFormat(media.head,original):sniff(media.head,category==='videos'||mediaType==='video');
    if(mediaType==='document'){if(!['document','photo'].includes(format.kind))throw new HttpError(415,'בחרו מסמך או צילום תעודה.');format={...format,kind:'document',maximum:LIMITS.attachment};}
    if(format.maximum&&media.size>format.maximum)throw new HttpError(413,format.kind==='document'?'אפשר להעלות מסמך עד 10MB.':'אפשר להעלות תמונה עד 50MB.');
    if(media.metadata){
      if(format.kind&&format.kind!=='photo'||!format.mime.startsWith('image/'))throw new HttpError(400,'אפשר לצרף תאריך ותיאור בהעלאה של תמונה בלבד.');
      try{metadata=decodeUploadMetadata(media.metadata);metadata.caption=text(metadata.caption,'תיאור',5000);}catch{throw new HttpError(400,'תאריך הצילום או התיאור אינם תקינים. אפשר להשאיר שדות תאריך לא ידועים ריקים.');}
    }
  }catch(error){await media.body.cancel();throw error;}
  const prefix=category.startsWith('wedding:')?['weddings',category.slice(8)]:category.startsWith('nursery:')?['nursery',category.slice(8)]:[category,personId||'shared'];
  const item={id,category,personId,filename:original,name:original.replace(/\.[^.]*$/,'').replaceAll('_',' '),file:(personId?'gallery/':'')+id+format.ext,key:[...prefix,id+format.ext].join('/'),mime:format.mime,kind:format.kind||(format.mime.startsWith('image/')?'photo':'video'),size:media.size,caption:'',createdAt:new Date().toISOString()};
  if(category==='videos')item.videoCategory=videoCategory;
  if(metadata){item.caption=metadata.caption;item.takenDate=metadata.date;item.takenDateRevision=uid();if(metadata.labels)item.labels=metadata.labels;}
  let transfer=Promise.resolve(),body=media.body;
  if(typeof FixedLengthStream!=='undefined'){
    const fixed=new FixedLengthStream(media.size);transfer=body.pipeTo(fixed.writable);body=fixed.readable;
    // Catch immediately; Promise.all below still observes the original rejection.
    transfer.catch(()=>{});
  }
  await Promise.all([putObject(env,item.key,body,item.size,item.mime),transfer]);
  try{await db('media.add',{item,familyPhoto:metadata?.familyPhoto===true,faces:metadata?.faces,complete:metadata?.complete===true});}
  catch(error){ctx.waitUntil(deleteObject(env,item.key).catch(()=>{}));throw error;}
  if(personId){const url=new URL(request.url);if(url.searchParams.get('layout')==='page')return json({saved:true,file:item.file,...await db('person.page',{id:personId,photos:url.searchParams.get('photos'),videos:url.searchParams.get('videos'),documents:url.searchParams.get('documents')})},201);return json({saved:true,file:item.file,person:await db('person',{id:personId})},201);}
  return json({saved:true,file:item.file,collection:await db('collection',{kind:category})},201);
}
async function editPhoto(request,env,db,ctx,id){
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני שמירת תמונות.');
  const params=new URL(request.url).searchParams;let crop;
  try{crop=JSON.parse(params.get('crop'));}catch{throw new HttpError(400,'פרטי החיתוך אינם תקינים.');}
  const change={id,expectedVersion:params.get('expectedVersion'),baseVersion:params.get('baseVersion'),rotation:Number(params.get('rotation')),crop};
  await db('photo.prepare',change);
  const media=await streamUpload(request,LIMITS.photo);let format;
  try{format=sniff(media.head);}catch(error){await media.body.cancel();throw error;}
  const versionId=uid(),version={id:versionId,key:'photo-versions/'+id+'/'+versionId+format.ext,mime:format.mime,size:media.size,filename:filename(params.get('filename'))};
  let body=media.body,transfer=Promise.resolve();
  if(typeof FixedLengthStream!=='undefined'){const fixed=new FixedLengthStream(media.size);transfer=body.pipeTo(fixed.writable);body=fixed.readable;transfer.catch(()=>{});}
  try{await Promise.all([putObject(env,version.key,body,media.size,format.mime),transfer]);}
  catch(error){ctx.waitUntil(deleteObject(env,version.key).catch(()=>{}));throw error;}
  try{return json(await db('photo.save',{...change,version}),201);}
  catch(error){
    // A known transaction rejection cannot reference this unique staged file.
    // Keep bytes after an uncertain state-service failure: its commit may have succeeded.
    if(error.status>=400&&error.status<500)ctx.waitUntil(deleteObject(env,version.key).catch(()=>{}));
    throw error;
  }
}
async function story(request,env,db,ctx,id){
  const bytes=await boundedBody(request,LIMITS.story),contentType=request.headers.get('Content-Type')||'';
  let fields={},files=[];
  if(contentType.startsWith('application/json')){
    try{fields=JSON.parse(new TextDecoder().decode(bytes));if(!fields||Array.isArray(fields)||typeof fields!=='object')throw Error();}catch{throw new HttpError(400,'פרטי הסיפור אינם תקינים.');}
  }else if(contentType.startsWith('multipart/form-data')){
    let form;try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new HttpError(400,'הטופס לא נקלט. נסו שוב.');}
    for(const key of ['title','body','author','year','expectedUpdatedAt']){const value=form.get(key);if(value!==null&&typeof value!=='string')throw new HttpError(400,'פרטי הסיפור אינם תקינים.');fields[key]=value||'';}
    files=form.getAll('files').filter(file=>typeof file!=='string'&&file.size>0);
  }else throw new HttpError(415,'יש לשלוח טופס סיפור תקין.');
  fields.title=text(fields.title,'כותרת',200,true);fields.author=text(fields.author||'','שם המספר או המספרת',100);fields.body=text(fields.body||'','תוכן הסיפור',100000);
  if(files.length>10||files.some(file=>file.size>LIMITS.attachment)||files.reduce((n,file)=>n+file.size,0)>LIMITS.attachmentTotal)throw new HttpError(413,'אפשר לצרף עד עשרה מסמכים, עד 10MB לקובץ ועד 20MB יחד.');
  if(files.length&&!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני צירוף מסמכים.');
  const uploaded=[],attachments=[],texts=[],metadata=[];
  try{
    for(const file of files){
      const name=filename(file.name),ext=name.match(/\.[^.]+$/)?.[0].toLowerCase();
      const types={'.txt':'text/plain','.md':'text/markdown','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
      if(!types[ext])throw new HttpError(415,'אפשר לצרף TXT, Markdown, PDF או Word מסוג DOCX.');
      const buffer=new Uint8Array(await file.arrayBuffer());
      if(ext==='.pdf'&&!new TextDecoder().decode(buffer.subarray(0,20)).trimStart().startsWith('%PDF-'))throw new HttpError(415,'קובץ ה־PDF אינו תקין.');
      if(ext==='.docx'&&!(buffer[0]===0x50&&buffer[1]===0x4b&&buffer[2]===3&&buffer[3]===4))throw new HttpError(415,'מסמך ה־Word אינו תקין.');
      if(['.txt','.md'].includes(ext)){
        let imported;try{imported=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{imported=new TextDecoder('windows-1255').decode(buffer);}
        if(imported.length>100000)throw new HttpError(413,'טקסט הסיפור ארוך מדי. אפשר עד 100,000 תווים.');texts.push(imported);
      }
      const mediaId=uid(),key='stories/'+mediaId+ext;
      await putObject(env,key,buffer,file.size,types[ext]);uploaded.push(key);
      metadata.push({id:mediaId,key,category:'attachment',filename:name,mime:types[ext],size:file.size,createdAt:new Date().toISOString()});
      attachments.push({name,size:file.size,src:'/media/'+mediaId});
    }
    if(!fields.body&&texts.length)fields.body=text(texts.join('\n\n'),'תוכן הסיפור',100000);
    const result=await db('story.save',{id,fields,attachments,files:metadata});return json(result,id?200:201);
  }catch(error){for(const key of uploaded)ctx.waitUntil(deleteObject(env,key).catch(()=>{}));throw error;}
}
function snapshot(request,result){const etag='"'+result.revision+'"';return request.headers.get('If-None-Match')===etag?new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':'no-store'}}):json(result,200,{ETag:etag});}
function secure(response){
  const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','SAMEORIGIN');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
  headers.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url),path=url.pathname;
      if(!env.FAMILY_STATE)throw new HttpError(503,'צריך להשלים את הגדרת השמירה באתר.');
      const db=client(env.FAMILY_STATE.get(env.FAMILY_STATE.idFromName('keha-family')));
      if(!['GET','HEAD','POST'].includes(request.method))throw new HttpError(405,'הפעולה אינה נתמכת.');
      if(path==='/api/gallery/download'&&request.method==='POST'){
        checkOrigin(request);
        const form=new URLSearchParams(new TextDecoder().decode(await boundedBody(request,4_000_000)));
        if(!equal(form.get('token'),PUBLIC_WRITE_TOKEN))throw new HttpError(403,'יש לרענן את הדף לפני ההורדה.');
        let ids;try{ids=JSON.parse(form.get('ids'));}catch{throw new HttpError(400,'בחרו תמונות להורדה.');}
        const {items}=await db('gallery.download',{ids});
        const entries=items.map(item=>({name:item.filename||item.name||item.file,open:signal=>getObject(env,item,new Request(url.origin+'/media/'+item.id),r=>fetch(r,{signal}))}));
        return new Response(zipStream(entries),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Keha-Family-Photos-'+new Date().toISOString().slice(0,10)+'.zip"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
      }
      if(request.method==='POST'&&path!=='/api/updates/one-click'){
        checkOrigin(request);
        if(!equal(request.headers.get('X-Family-Token'),PUBLIC_WRITE_TOKEN))throw new HttpError(403,'יש לרענן את הדף לפני שמירת השינוי.');
      }
      if(path.startsWith('/api/updates/'))return await updatesRoute(request,env,db);
      if(path==='/api/games/jachnun/head-request')return await headRequestRoute(request,env);
      if(path==='/api/games/jachnun/scores'){
        if(request.method==='GET')return json(await db('game.jachnun.scores'));
        if(request.method==='POST')return json(await db('game.jachnun.score.add',await readJSON(request,4096)));
        throw new HttpError(405,'הפעולה אינה נתמכת.');
      }
      if(path==='/api/games/rex/scores'){
        if(request.method==='GET')return json(await db('game.rex.scores'));
        if(request.method==='POST')return json(await db('game.rex.score.add',await readJSON(request,4096)));
        throw new HttpError(405,'הפעולה אינה נתמכת.');
      }
      if(path==='/api/games/neto-tetris/scores'){
        if(request.method==='GET')return json(await db('game.neto-tetris.scores'));
        if(request.method==='POST')return json(await db('game.neto-tetris.score.add',await readJSON(request,4096)));
        throw new HttpError(405,'הפעולה אינה נתמכת.');
      }
      if(path==='/api/games/ruti-house/scores'){
        if(request.method==='GET')return json(await db('game.ruti-house.scores'));
        if(request.method==='POST')return json(await db('game.ruti-house.score.add',await readJSON(request,4096)));
        throw new HttpError(405,'הפעולה אינה נתמכת.');
      }
      if(path==='/family-data.js'&&request.method==='GET'){
        let people={},dataAvailable=true;
        try{people=Object.fromEntries((await db('dates')).people.map(p=>[p.id,p]));}catch{dataAvailable=false;}
        const merged={...family,people:Object.fromEntries(Object.entries(family.people).map(([id,p])=>[id,{...p,name:people[id]?.name||p.name,birthday:people[id]?.birthday||p.birthday,deathDate:people[id]?.deathDate===undefined?p.deathDate||null:people[id].deathDate}]))};
        for(const person of Object.values(people))if(person.extra)merged.people[person.id]={id:person.id,name:person.name,firstName:person.name,lastName:'',birthday:person.birthday,extra:true,branch:null,generation:null,placeholder:false};
        return new Response('window.FAMILY_DATA='+JSON.stringify(merged)+';\nwindow.LOCAL_FAMILY_SERVER=true;\nwindow.FAMILY_API_TOKEN='+JSON.stringify(PUBLIC_WRITE_TOKEN)+';\nwindow.FAMILY_DATA_AVAILABLE='+dataAvailable+';\nwindow.FAMILY_CLOUD=true;\n',{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
      }
      if(path==='/api/setup'&&request.method==='GET')return json({database:true,mediaConfigured:Boolean(configured(env)),limits:LIMITS});
      if(path==='/api/health'&&request.method==='GET')return json(await db('health'));
      if(path==='/api/media'&&request.method==='GET'){
        if(request.headers.has('If-None-Match')){const {revision}=await db('people.revision');if(request.headers.get('If-None-Match')==='"'+revision+'"')return new Response(null,{status:304,headers:{ETag:'"'+revision+'"','Cache-Control':'no-store'}});}
        return snapshot(request,await db('people'));
      }
      if(path==='/api/tag-people'&&request.method==='GET')return json(await db('tag.people'));
      if(path==='/api/nursery'&&request.method==='GET')return json(await db('nursery'));
      if(path==='/api/memorial'&&request.method==='GET')return json(await db('memorial',{visitorId:/^[a-f0-9]{32}$/.test(request.headers.get('X-Candle-Visitor')||'')?request.headers.get('X-Candle-Visitor'):null}));
      if(path==='/api/games/who-is-it'&&request.method==='GET')return json(await db('game.quiz'));
      if(path==='/api/games/relationships'&&request.method==='GET')return json(await db('game.kinship'));
      if(path==='/api/games/who-is-missing'&&request.method==='GET')return json(await db('game.missing'));
      if(path==='/api/games/trivia'&&request.method==='GET')return json(await db('game.trivia',{language:url.searchParams.get('lang')||'he'}));
      if(path==='/api/games/trivia/questions'&&request.method==='POST')return json(await db('trivia.question.add',await request.json()));
      if(path==='/api/calendar'&&request.method==='GET'){
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const people=Object.fromEntries((await db('dates')).people.map(p=>[p.id,p]));
        return json(await calendarResponse(url.searchParams.get('date')||today,url.searchParams.get('mode')||'gregorian',people,ctx,url.searchParams.get('lang')||'he'));
      }
      if(path==='/api/export'&&request.method==='GET')return json(await db('export'),200,{'Content-Disposition':'attachment; filename="family-backup.json"'});
      let match;
      if(path==='/api/gallery/face-scan'&&request.method==='GET')return json(await db('gallery.face.scan',{after:url.searchParams.get('after')}));
      if(path==='/api/gallery/selection'&&request.method==='GET')return json(await db('gallery.selection',{person:url.searchParams.get('person'),unit:url.searchParams.get('unit'),labels:url.searchParams.get('labels'),query:url.searchParams.get('q')}));
      if((match=/^\/api\/media\/([a-f0-9]{32})\/versions$/.exec(path))&&request.method==='GET')return json(await db('photo.versions',{id:match[1]}));
      if((match=/^\/api\/media\/([a-f0-9]{32})\/faces$/.exec(path))&&request.method==='GET')return json(await db('media.faces',{id:match[1]}));
      if((match=/^\/api\/nursery\/([^/]+)$/.exec(path))&&request.method==='GET')return snapshot(request,await db('collection',{kind:nurseryCollection(decodeURIComponent(match[1])),page:url.searchParams.get('page')}));
      if((match=/^\/api\/media\/([a-f0-9]{32})\/tags$/.exec(path))&&request.method==='GET')return json(await db('media.tags',{id:match[1]}));
      if((match=/^\/api\/media\/([a-f0-9]{32})\/view$/.exec(path))&&request.method==='GET')return json(await db('media.public',{id:match[1]}));
      if((match=/^\/api\/people\/([^/]+)\/page$/.exec(path))&&request.method==='GET'){
        const id=decodeURIComponent(match[1]),pages=Object.fromEntries(['photos','videos','documents'].map(key=>[key,url.searchParams.get(key)]));
        if(request.headers.has('If-None-Match')){const current=await db('person.revision',{id}),revision=current.revision+':'+Object.values(pages).map(value=>Number(value||1)).join(':');if(request.headers.get('If-None-Match')==='"'+revision+'"')return new Response(null,{status:304,headers:{ETag:'"'+revision+'"','Cache-Control':'no-store'}});}
        const result=await db('person.page',{id,...pages});return snapshot(request,{...result,revision:result.person.revision+':'+['photos','videos','documents'].map(key=>result.albums[key].page).join(':')});
      }
      if((match=/^\/api\/people\/([^/]+)$/.exec(path))&&request.method==='GET')return snapshot(request,await db('person',{id:decodeURIComponent(match[1])}));
      if((match=/^\/api\/collections\/(photos|videos|gallery)$/.exec(path))&&request.method==='GET'){
        const kind=match[1],page=url.searchParams.get('page'),size=url.searchParams.get('size'),query=url.searchParams.get('q'),filter=url.searchParams.get('filter')||'all',person=url.searchParams.get('person'),unit=url.searchParams.get('unit'),labels=url.searchParams.get('labels'),sort=url.searchParams.get('sort'),seed=url.searchParams.get('seed');
        if(kind==='gallery'&&!['all','untagged','partial','complete'].includes(filter))throw new HttpError(400,'בחרו סינון תמונות תקין.');
        if(request.headers.has('If-None-Match')){
          const current=await db('collection.revision',{kind});
          const revision=kind==='gallery'?galleryRevision(current.revision,{page,size,query,filter,person,unit,labels,sort,seed}):current.revision;
          if(request.headers.get('If-None-Match')==='"'+revision+'"')return new Response(null,{status:304,headers:{ETag:'"'+revision+'"','Cache-Control':'no-store'}});
        }
        return snapshot(request,await db('collection',{kind,page,size,query,filter,person,unit,labels,sort,seed}));
      }
      if(path==='/api/stories'&&request.method==='GET')return snapshot(request,await db('stories'));
      if(path==='/api/weddings'&&request.method==='GET')return json(await db('weddings'));
      if((match=/^\/api\/weddings\/([^/]+)$/.exec(path))&&request.method==='GET')return json(await db('wedding',{id:decodeURIComponent(match[1])}));
      if(path==='/api/nostalgia'&&request.method==='GET')return snapshot(request,await db('collection',{kind:'nostalgia'}));
      if((match=/^\/media\/([a-f0-9]{32})$/.exec(path))&&['GET','HEAD'].includes(request.method)){
        const item=url.searchParams.has('version')?await db('photo.version',{id:match[1],versionId:url.searchParams.get('version')}):await db('media.get',{id:match[1]});
        if(item.provider==='youtube')return new Response(null,{status:302,headers:{Location:'https://www.youtube.com/watch?v='+item.youtubeId,'Cache-Control':'no-store'}});
        return await getObject(env,item,request);
      }
      if(request.method==='POST'){
        if((match=/^\/api\/media\/([a-f0-9]{32})\/faces\/ignore$/.exec(path))){const body=await readJSON(request,4096);return json(await db('media.face.ignore',{id:match[1],photoRevision:body.photoRevision,rect:body.rect,ignored:body.ignored}));}
        if(path==='/api/collections/cover'){const body=await readJSON(request,2000);return json(await db('collection.cover',{kind:body.collection,mediaId:body.mediaId}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/faces\/review$/.exec(path))){const body=await readJSON(request,4096);return json(await db('media.face.review',{id:match[1],photoRevision:body.photoRevision,tagsRevision:body.tagsRevision,complete:body.complete}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/faces\/detection$/.exec(path))){const body=await readJSON(request,32000);return json(await db('media.face.scan.save',{id:match[1],photoRevision:body.photoRevision,version:body.version,faces:body.faces}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/edit$/.exec(path)))return await editPhoto(request,env,db,ctx,match[1]);
        if((match=/^\/api\/media\/([a-f0-9]{32})\/versions\/(original|[a-f0-9]{32})\/restore$/.exec(path))){const body=await readJSON(request,2000);return json(await db('photo.restore',{id:match[1],versionId:match[2],expectedVersion:body.expectedVersion}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/collections$/.exec(path))){const body=await readJSON(request,2000);return json(await db('media.collection.add',{id:match[1],collection:body.collection,scope:body.scope,included:body.included}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/faces\/save$/.exec(path))){const body=await readJSON(request,4096);return json(await db('media.face.save',{id:match[1],faceId:body.faceId,personId:body.personId,name:body.name,rect:body.rect,expectedRevision:body.expectedRevision}));}
        if((match=/^\/api\/nursery\/([^/]+)\/upload$/.exec(path)))return await upload(request,env,db,ctx,{category:nurseryCollection(decodeURIComponent(match[1]))});
        if((match=/^\/api\/memorial\/([^/]+)\/candles$/.exec(path))){const body=await readJSON(request,1000);return json(await db('candle.light',{id:decodeURIComponent(match[1]),visitorId:body.visitorId}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/tags\/patch$/.exec(path))){const body=await readJSON(request,64000);return json(await db('media.tags.patch',{id:match[1],changes:body.changes}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/labels$/.exec(path))){const body=await readJSON(request,2000);return json(await db('media.labels.patch',{id:match[1],label:body.label,tagged:body.tagged}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/photo-date$/.exec(path))){const body=await readJSON(request,2000);return json(await db('media.photo-date',{id:match[1],date:body.date,expectedRevision:body.expectedRevision}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/caption$/.exec(path))){const body=await readJSON(request,40000);return json(await db('media.caption.id',{id:match[1],caption:body.caption,expectedCaption:body.expectedCaption}));}
        if((match=/^\/api\/media\/([a-f0-9]{32})\/(delete|restore|tags|tag|untag|retag)$/.exec(path))){
          const body=await readJSON(request,match[2]==='tags'?64000:2000);
          if(match[2]==='tags')return json(await db('media.tags.save',{id:match[1],personIds:body.personIds,newNames:body.newNames,expectedRevision:body.expectedRevision}));
          if(match[2]==='tag')return json(await db('media.tag',{id:match[1],personId:body.personId,name:body.name,tagged:body.tagged}));
          return json(await db('media.'+match[2],{id:match[1],scope:body.scope,restoreProfile:body.restoreProfile}));
        }
        if((match=/^\/api\/weddings\/([^/]+)\/(date|greetings|upload|caption)$/.exec(path))){
          const id=decodeURIComponent(match[1]),action=match[2],kind=weddingCollection(id);
          if(action==='upload')return await upload(request,env,db,ctx,{category:kind,mixed:true});
          const body=await readJSON(request,64000);
          if(action==='date')return json(await db('wedding.date',{id,date:body.date,expectedRevision:body.expectedRevision}));
          if(action==='greetings')return json(await db('greeting.add',{id,author:body.author,body:body.body}),201);
          return json(await db('media.caption',{kind,file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/nostalgia\/(upload|caption)$/.exec(path))){
          if(match[1]==='upload')return await upload(request,env,db,ctx,{category:'nostalgia',mixed:true});
          const body=await readJSON(request,40000);return json(await db('media.caption',{kind:'nostalgia',file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/people\/([^/]+)\/(photos|videos|documents|about|biography|caption|profile|birthday|death-date)$/.exec(path))){
          const id=decodeURIComponent(match[1]),action=match[2];
          if(action==='birthday')throw new HttpError(403,'תאריכי הלידה מעודכנים דרך מנהלי האתר בלבד.','BIRTHDAY_READ_ONLY');
          if(['photos','videos','documents'].includes(action))return await upload(request,env,db,ctx,{category:'personal',personId:id,mediaType:{photos:'photo',videos:'video',documents:'document'}[action]});
          const body=await readJSON(request,40000);
          if(action==='about')return json(await db('person.about',{id,about:body.about,expectedAbout:body.expectedAbout,language:body.language}));
          if(action==='biography')return json(await db('person.biography',{id,section:body.section,value:body.value,expectedValue:body.expectedValue,language:body.language}));
          if(action==='death-date')return json(await db('death.date',{id,date:body.date,expectedDate:body.expectedDate}));
          if(action==='profile')return json(await db('profile',{id,file:body.file}));
          return json(await db('media.caption',{personId:id,file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/collections\/(photos|videos|gallery)\/(upload|caption)$/.exec(path))){
          if(match[2]==='upload')return await upload(request,env,db,ctx,{category:match[1]});
          const body=await readJSON(request,40000);return json(await db('media.caption',{kind:match[1],file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/stories(?:\/([a-f0-9]{24}))?$/.exec(path)))return await story(request,env,db,ctx,match[1]||null);
        throw new HttpError(404,'הפעולה לא נמצאה.');
      }
      if(path.startsWith('/api/')||path.startsWith('/media/'))throw new HttpError(404,'הפריט לא נמצא.');
      if(path==='/'&&/^[a-f0-9]{32}$/.test(url.searchParams.get('media')||'')){
        const {item}=await db('media.public',{id:url.searchParams.get('media')});
        const response=await env.ASSETS.fetch(request),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const title=item.caption||item.name,canonical=new URL('/',url.origin);canonical.searchParams.set('media',item.id);
        const tags='<meta property="og:type" content="website"><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="Keha Family"><meta property="og:url" content="'+escape(canonical.href)+'">'+(item.kind==='photo'?'<meta property="og:image" content="'+escape(new URL(item.src,url.origin).href)+'">':'');
        const html=(await response.text()).replace('</head>',tags+'</head>');return secure(new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
      }
      return secure(await env.ASSETS.fetch(request));
    }catch(error){return fail(error);}
  },
  async scheduled(controller,env,ctx){
    const db=client(env.FAMILY_STATE.get(env.FAMILY_STATE.idFromName('keha-family')));
    ctx.waitUntil(dispatchUpdates(env,db,controller.scheduledTime||Date.now()));
  }
};
