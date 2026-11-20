import family from './family.mjs';
import {EXTENDED_PEOPLE,createExtendedFamily} from '../public/keha-extended/family-data.mjs';
import {uid} from './http.mjs';

export function initializeExtendedKeha(state) {
  if(state.extendedKehaReady)return;
  state.ctx.storage.transactionSync(()=>{
    for(const seed of EXTENDED_PEOPLE){
      if(seed.placeholder)continue;
      const person={...seed,birthday:'1.1.1111',extra:true,extendedKeha:true,profileId:null,revision:uid()};
      // Never replace an existing date, biography, portrait or name on deploy.
      state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)',seed.id,JSON.stringify(person));
    }
    state.peopleRevision=uid();state.peopleCache=null;
  });
  state.extendedKehaReady=true;
}

export function extendedKehaItems(state,args={}) {
  const ids=JSON.stringify(Object.keys(createExtendedFamily(family).people));
  return state.rows("SELECT data FROM media WHERE category='nakash:extended' OR person_id IN (SELECT value FROM json_each(?)) OR id IN (SELECT media_id FROM media_tags WHERE person_id IN (SELECT value FROM json_each(?))) ORDER BY rowid DESC",ids,ids).map(row=>JSON.parse(row.data))
    .filter(item=>!args.kind || (item.kind || (item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document'))===args.kind)
    .map(item=>{
      const people=state.tagIds(item.id);
      return {...item,people,branch:item.category?.startsWith('nakash:')?item.category.slice(7):'keha',branches:['extended']};
    })
    .filter(item=>!args.personId || item.personId===args.personId || item.people.includes(args.personId))
    .map(item=>({...item,faces:state.faces(item.id),faceSummary:item.mime?.startsWith('image/')?state.faceSummary(item):undefined,tagsRevision:state.tagsRevision(item.id)}));
}
