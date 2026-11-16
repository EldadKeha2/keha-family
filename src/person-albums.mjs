import {HttpError} from './http.mjs';
import {galleryOrdering,galleryRefinement,galleryLabels} from './gallery.mjs';

export const personAlbumKeys=['photos','videos','documents'];
const fields=['Size','Sort','Seed','Person','Unit','Labels'];
export function personPageParams(params){
  return Object.fromEntries([...personAlbumKeys,...['photos','videos'].flatMap(key=>fields.map(field=>key+field))].map(key=>[key,params.get(key)]));
}
export function personAlbumOptions(options,key){
  const page=Number(options[key]||1),value=options[key+'Size'],all=value==='all',size=all?null:Number(value||(key==='photos'?25:10));
  if(!Number.isSafeInteger(page)||page<1)throw new HttpError(400,'בחרו מספר עמוד תקין.');
  if(!all&&(!Number.isSafeInteger(size)||![10,20,25,50,100,200,300,400,500].includes(size)))throw new HttpError(400,'בחרו מספר פריטים תקין בעמוד.');
  const sort=options[key+'Sort'],order=sort?galleryOrdering({sort,seed:options[key+'Seed']}):{sort:'uploaded-desc',seed:null,sql:'m.rowid DESC',args:[]};
  const refinement=galleryRefinement({person:options[key+'Person'],unit:options[key+'Unit']}),labels=galleryLabels(options[key+'Labels']);
  return {page,size,all,order,refinement,labels};
}
export function personPageRevision(revision,options){
  return revision+':person-gallery-v1:'+JSON.stringify(personAlbumKeys.map(key=>{
    const {page,size,all,order,refinement,labels}=personAlbumOptions(options,key);
    return [page,all?'all':size,options[key+'Sort']||'legacy',order.seed,refinement.person,refinement.unit,labels];
  }));
}
