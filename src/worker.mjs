import family from './family.mjs';
import {HttpError,json,fail,text,uid,readJSON,boundedBody,checkOrigin,equal} from './http.mjs';
import {configured,putObject,getObject,deleteObject} from './hf.mjs';
import {couple,weddingCollection} from './weddings.mjs';
export {FamilyState} from './state.mjs';
export const LIMITS={photo:50*1024*1024,video:90*1024*1024,story:22*1024*1024,attachment:10*1024*1024,attachmentTotal:20*1024*1024};
// Public visitors receive this request marker with the page. It is not a password.
export const PUBLIC_WRITE_TOKEN='family-public-v1';

function client(db){return async(action,p={})=>{
  const response=await db.fetch(new Request('https://state.internal/',{method:'POST',body:JSON.stringify({action,...p}),headers:{'Content-Type':'application/json'}}));
  const result=await response.json();if(!response.ok)throw new HttpError(response.status,result.error||'לא ניתן לשמור את השינוי.');return result;
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
async function streamUpload(request,maximum){
  const raw=request.headers.get('Content-Length'),size=Number(raw);
  if(raw===null||!Number.isSafeInteger(size))throw new HttpError(411,'לא התקבל גודל הקובץ. בחרו את הקובץ מחדש ונסו שוב.');
  if(size<=0)throw new HttpError(400,'הקובץ ריק.');if(size>maximum)throw new HttpError(413,'אפשר להעלות עד 50MB לתמונה ועד 90MB לסרטון.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'הקובץ לא התקבל.');
  const first=[];let firstLength=0;
  while(firstLength<Math.min(128,size)){
    const part=await reader.read();if(part.done){await reader.cancel();throw new HttpError(400,'ההעלאה הופסקה לפני סיומה.');}
    first.push(part.value);firstLength+=part.value.byteLength;
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
  return {size,head,body};
}
async function upload(request,env,db,ctx,{category,personId=null,mixed=false}){
  const videoCategory=new URL(request.url).searchParams.get('group')||'family';
  if(category==='videos'&&!['family','special-birthdays'].includes(videoCategory))throw new HttpError(400,'קטגוריית הסרטון אינה מוכרת.');
  if(!configured(env))throw new HttpError(503,'יש להשלים את חיבור האחסון לפני העלאת קבצים.');
  if(personId&&!family.people[personId])throw new HttpError(404,'האדם לא נמצא באילן המשפחה.');
  const media=await streamUpload(request,mixed||category==='videos'?LIMITS.video:LIMITS.photo);
  const id=uid(),original=filename(new URL(request.url).searchParams.get('filename'));
  let format;
  try{
    format=mixed?archiveFormat(media.head,original):sniff(media.head,category==='videos');
    if(format.maximum&&media.size>format.maximum)throw new HttpError(413,format.kind==='document'?'אפשר להעלות מסמך עד 10MB.':'אפשר להעלות תמונה עד 50MB.');
  }catch(error){await media.body.cancel();throw error;}
  const prefix=category.startsWith('wedding:')?['weddings',category.slice(8)]:[category,personId||'shared'];
  const item={id,category,personId,filename:original,name:original.replace(/\.[^.]*$/,'').replaceAll('_',' '),file:(personId?'gallery/':'')+id+format.ext,key:[...prefix,id+format.ext].join('/'),mime:format.mime,kind:format.kind||(format.mime.startsWith('image/')?'photo':'video'),size:media.size,caption:'',createdAt:new Date().toISOString()};
  if(category==='videos')item.videoCategory=videoCategory;
  let transfer=Promise.resolve(),body=media.body;
  if(typeof FixedLengthStream!=='undefined'){
    const fixed=new FixedLengthStream(media.size);transfer=body.pipeTo(fixed.writable);body=fixed.readable;
    // Catch immediately; Promise.all below still observes the original rejection.
    transfer.catch(()=>{});
  }
  await Promise.all([putObject(env,item.key,body,item.size,item.mime),transfer]);
  try{await db('media.add',{item});}
  catch(error){ctx.waitUntil(deleteObject(env,item.key).catch(()=>{}));throw error;}
  if(personId)return json({saved:true,file:item.file,person:await db('person',{id:personId})},201);
  return json({saved:true,file:item.file,collection:await db('collection',{kind:category})},201);
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
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
  headers.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url),path=url.pathname;
      if(!env.FAMILY_STATE)throw new HttpError(503,'צריך להשלים את הגדרת השמירה באתר.');
      const db=client(env.FAMILY_STATE.get(env.FAMILY_STATE.idFromName('keha-family')));
      if(!['GET','HEAD','POST'].includes(request.method))throw new HttpError(405,'הפעולה אינה נתמכת.');
      if(request.method==='POST'){
        checkOrigin(request);
        if(!equal(request.headers.get('X-Family-Token'),PUBLIC_WRITE_TOKEN))throw new HttpError(403,'יש לרענן את הדף לפני שמירת השינוי.');
      }
      if(path==='/family-data.js'&&request.method==='GET'){
        const {people}=await db('people');const merged={...family,people:Object.fromEntries(Object.entries(family.people).map(([id,p])=>[id,{...p,name:people[id]?.name||p.name,birthday:people[id]?.birthday||p.birthday}]))};
        return new Response('window.FAMILY_DATA='+JSON.stringify(merged)+';\nwindow.LOCAL_FAMILY_SERVER=true;\nwindow.FAMILY_API_TOKEN='+JSON.stringify(PUBLIC_WRITE_TOKEN)+';\nwindow.FAMILY_CLOUD=true;\n',{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
      }
      if(path==='/api/setup'&&request.method==='GET')return json({database:true,mediaConfigured:Boolean(configured(env)),limits:LIMITS});
      if(path==='/api/media'&&request.method==='GET')return json(await db('people'));
      if(path==='/api/export'&&request.method==='GET')return json(await db('export'),200,{'Content-Disposition':'attachment; filename="family-backup.json"'});
      let match;
      if((match=/^\/api\/people\/([^/]+)$/.exec(path))&&request.method==='GET')return snapshot(request,await db('person',{id:decodeURIComponent(match[1])}));
      if((match=/^\/api\/collections\/(photos|videos)$/.exec(path))&&request.method==='GET')return snapshot(request,await db('collection',{kind:match[1]}));
      if(path==='/api/stories'&&request.method==='GET')return snapshot(request,await db('stories'));
      if(path==='/api/weddings'&&request.method==='GET')return json(await db('weddings'));
      if((match=/^\/api\/weddings\/([^/]+)$/.exec(path))&&request.method==='GET')return json(await db('wedding',{id:decodeURIComponent(match[1])}));
      if(path==='/api/nostalgia'&&request.method==='GET')return snapshot(request,await db('collection',{kind:'nostalgia'}));
      if((match=/^\/media\/([a-f0-9]{32})$/.exec(path))&&['GET','HEAD'].includes(request.method)){
        const item=await db('media.get',{id:match[1]});
        if(item.provider==='youtube')return new Response(null,{status:302,headers:{Location:'https://www.youtube.com/watch?v='+item.youtubeId,'Cache-Control':'no-store'}});
        return await getObject(env,item,request);
      }
      if(request.method==='POST'){
        if((match=/^\/api\/media\/([a-f0-9]{32})\/(delete|restore)$/.exec(path))){
          const body=await readJSON(request,2000);return json(await db('media.'+match[2],{id:match[1],scope:body.scope}));
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
        if((match=/^\/api\/people\/([^/]+)\/(photos|caption|profile|birthday)$/.exec(path))){
          const id=decodeURIComponent(match[1]),action=match[2];
          if(action==='photos')return await upload(request,env,db,ctx,{category:'personal',personId:id});
          const body=await readJSON(request,40000);
          if(action==='birthday')return json(await db('birthday',{id,birthday:body.birthday,expectedBirthday:body.expectedBirthday}));
          if(action==='profile')return json(await db('profile',{id,file:body.file}));
          return json(await db('media.caption',{personId:id,file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/collections\/(photos|videos)\/(upload|caption)$/.exec(path))){
          if(match[2]==='upload')return await upload(request,env,db,ctx,{category:match[1]});
          const body=await readJSON(request,40000);return json(await db('media.caption',{kind:match[1],file:body.file,caption:body.caption}));
        }
        if((match=/^\/api\/stories(?:\/([a-f0-9]{24}))?$/.exec(path)))return await story(request,env,db,ctx,match[1]||null);
        throw new HttpError(404,'הפעולה לא נמצאה.');
      }
      if(path.startsWith('/api/')||path.startsWith('/media/'))throw new HttpError(404,'הפריט לא נמצא.');
      return secure(await env.ASSETS.fetch(request));
    }catch(error){return fail(error);}
  }
};
