import {HttpError} from './http.mjs';

// Paging is a transport detail. Existing clients keep their complete arrays
// until they explicitly request paged=1; no visible page controls change.
export function collectionPageOptions(options={}){
  const page=Number(options.page||1),size=Number(options.size||100);
  if(!Number.isSafeInteger(page)||page<1||![25,50,100,200].includes(size))throw new HttpError(400,'בחרו עמוד תקין ועד 200 פריטים בכל בקשה.');
  return {page,size};
}
export function collectionPageRevision(revision,options={}){
  if(!options.paged)return revision;
  const {page,size}=collectionPageOptions(options);
  return revision+':transport-v1:'+page+':'+size;
}
export function collectionPage(options,total){
  const {page:requested,size}=collectionPageOptions(options),pages=Math.max(1,Math.ceil(total/size));
  return {page:Math.min(requested,pages),size,total,pages};
}
