import {HttpError} from './http.mjs';

export const VIDEO_ASSET_VARIANTS=['poster','faststart','low','medium'];
const revisionOf=item=>item.videoRevision||'original';
const isVideo=item=>!item.provider&&(item.kind==='video'||item.mime?.startsWith('video/'));
export function currentVideoAsset(item,variant,revision=revisionOf(item)){
  if(!isVideo(item)||!VIDEO_ASSET_VARIANTS.includes(variant)||revision!==revisionOf(item))return null;
  const asset=item.videoAssets?.[variant];
  return asset?.revision===revision&&!asset.skipped&&asset.key?asset:null;
}
export function videoAssetsPublic(item){
  if(!isVideo(item))return {};
  const revision=revisionOf(item),url=variant=>'/media/'+item.id+'?videoAsset='+variant+'&v='+encodeURIComponent(revision),poster=currentVideoAsset(item,'poster'),faststart=currentVideoAsset(item,'faststart');
  const playbackSources=['low','medium'].flatMap(quality=>{const asset=currentVideoAsset(item,quality);if(!asset)return [];return [{quality,src:url(quality),mime:asset.mime,size:asset.size,...Object.fromEntries(['width','height','duration','bitrate'].filter(key=>Number.isFinite(asset[key])).map(key=>[key,asset[key]]))}];});
  const duration=[item.duration,faststart?.duration,...playbackSources.map(source=>source.duration)].find(value=>Number.isFinite(value)&&value>0);
  return {...(duration?{duration}:{}),...(poster?{poster:url('poster'),posterSize:poster.size}:{}),...(faststart?{faststartSrc:url('faststart')}:{}),...(playbackSources.length?{playbackSources}:{})};
}
export function videoAssetsQueue(state,p={}){
  const after=Math.max(0,Math.floor(Number(p.after)||0)),limit=Math.min(25,Math.max(1,Math.floor(Number(p.limit)||10)));
  const revision="coalesce(json_extract(data,'$.videoRevision'),'original')";
  const missing=VIDEO_ASSET_VARIANTS.map(variant=>"coalesce(json_extract(data,'$.videoAssets."+variant+".revision'),'missing')!="+revision).join(' OR ');
  const pending="json_extract(data,'$.mime') LIKE 'video/%' AND coalesce(json_extract(data,'$.kind'),'video')='video' AND json_extract(data,'$.provider') IS NULL AND json_extract(data,'$.key') IS NOT NULL AND ("+missing+")";
  const rows=state.rows('SELECT rowid AS cursor,data FROM media WHERE rowid>? AND '+pending+' ORDER BY rowid LIMIT ?',after,limit);
  return {version:1,pending:state.rows('SELECT count(*) AS total FROM media WHERE '+pending)[0].total,items:rows.map(row=>{const item=JSON.parse(row.data),revision=revisionOf(item);return {cursor:row.cursor,id:item.id,src:'/media/'+item.id+'?v='+encodeURIComponent(revision),revision,mime:item.mime,size:item.size,...(Number.isFinite(item.duration)?{duration:item.duration}:{}),...Object.fromEntries(VIDEO_ASSET_VARIANTS.map(variant=>[variant,item.videoAssets?.[variant]?.revision!==revision]))};}),next:rows.at(-1)?.cursor||null};
}
export function saveVideoAsset(state,p){
  const item=state.media(p.id),variant=p.variant;
  if(!isVideo(item)||!VIDEO_ASSET_VARIANTS.includes(variant))throw new HttpError(400,'אפשר להכין גרסה מקדימה לסרטון מקומי בלבד.');
  if(p.revision!==revisionOf(item))throw new HttpError(409,'הסרטון השתנה בינתיים.');
  if(item.videoAssets?.[variant]?.revision===p.revision)return {saved:false,item:state.mediaPublic(item)};
  const asset=p.asset,prefix='video-assets/'+item.id+'/'+p.revision+'/'+variant+'/';
  if(asset?.revision!==p.revision||asset.skipped&&!['not-smaller','unsupported','already-faststart','not-needed'].includes(asset.reason)||!asset.skipped&&(!asset.key?.startsWith(prefix)||!Number.isSafeInteger(asset.size)||asset.size<1||asset.mime!==(variant==='poster'?'image/jpeg':'video/mp4')))throw new HttpError(400,'גרסת הסרטון אינה תקינה.');
  const previous=item.videoAssets?.[variant];item.videoAssets={...item.videoAssets,[variant]:asset};
  state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),item.id);
  state.touchPeople(state.relatedPeople(item));for(const kind of state.mediaCollections(item))state.touch(kind);
  return {saved:true,operation:'video-asset',scope:state.mediaScope(item),item:state.mediaPublic(item),...(previous?.key?.startsWith('video-assets/'+item.id+'/')?{obsoleteKey:previous.key}:{})};
}
