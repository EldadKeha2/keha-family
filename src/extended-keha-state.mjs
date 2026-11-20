import family from './family.mjs';
import {EXTENDED_PEOPLE,createExtendedFamily} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {uid} from './http.mjs';
import {linkSharedProfile} from './nakash-shared.mjs';

export function initializeExtendedKeha(state) {
  if(state.extendedKehaReady)return;
  state.ctx.storage.transactionSync(()=>{
    const migration='extended-saadia-chart-2026-11-20-v1';
    const updateChart=!state.rows('SELECT id FROM meta WHERE id=?',migration).length;
    const kehatMigration='extended-kehat-two-branches-2026-11-20-v1';
    const updateKehat=!state.rows('SELECT id FROM meta WHERE id=?',kehatMigration).length;
    for(const seed of EXTENDED_PEOPLE){
      if(seed.placeholder)continue;
      const person={...seed,birthday:'1.1.1111',extra:true,extendedKeha:true,profileId:null,revision:uid()};
      // Never replace an existing date, biography, portrait or name on deploy.
      state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)',seed.id,JSON.stringify(person));
      if(updateChart&&seed.id==='keha-zechariah'){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',migration+':backup:'+seed.id,JSON.stringify(saved));
        if(saved.name==='זכריה קהא'){
          saved.name=seed.name;delete saved.firstName;delete saved.lastName;
        }
        if(!saved.nameEn||saved.nameEn==='Zechariah Keha')saved.nameEn=seed.nameEn;
        if(!saved.englishName||saved.englishName==='Zechariah Keha')saved.englishName=seed.englishName;
        if(!saved.about)saved.about=seed.about;
        saved.aliases=[...new Set([...(saved.aliases||[]),...seed.aliases])];
        state.savePerson(saved);
      }
      if(updateKehat&&seed.id==='kehat-jidaan'){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',kehatMigration+':backup:'+seed.id,JSON.stringify(saved));
        if(seed.aliases.includes(saved.name)){
          saved.name=seed.name;delete saved.firstName;delete saved.lastName;
        }
        if(!saved.nameEn||saved.nameEn==='Jidaan Kehat')saved.nameEn=seed.nameEn;
        if(!saved.englishName||saved.englishName==='Jidaan Kehat')saved.englishName=seed.englishName;
        saved.aliases=[...new Set([...(saved.aliases||[]),...seed.aliases])];
        state.savePerson(saved);
      }
    }
    for(const seed of EXTENDED_PEOPLE){
      if(!seed.sharedProfileId)continue;
      linkSharedProfile(state,state.sharedNakashIdentities,seed);
      if(seed.deceased){
        const person=state.person(state.sharedNakashIdentities[seed.id]||seed.id);
        if(!person.deceased){person.deceased=true;state.savePerson(person);}
      }
    }
    if(updateChart)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',migration,'done');
    if(updateKehat)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',kehatMigration,'done');
    state.peopleRevision=uid();state.peopleCache=null;
  });
  state.extendedKehaReady=true;
}

export function extendedKehaItems(state,args={}) {
  const ids=JSON.stringify(Object.keys((args.branch==='shlomo'?createShlomoFamily:createExtendedFamily)({...family,sharedPeople:state.run('people').people}).people));
  const categories=JSON.stringify(args.branch==='shlomo'?['nakash:shlomo','gallery','videos','nostalgia']:['nakash:extended','nakash:shlomo','gallery','videos','nostalgia']);
  return state.rows("SELECT data FROM media WHERE category IN (SELECT value FROM json_each(?)) OR person_id IN (SELECT value FROM json_each(?)) OR id IN (SELECT media_id FROM media_tags WHERE person_id IN (SELECT value FROM json_each(?))) ORDER BY rowid DESC",categories,ids,ids).map(row=>JSON.parse(row.data))
    .filter(item=>!args.kind || (item.kind || (item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document'))===args.kind)
    .map(item=>{
      const people=state.tagIds(item.id);
      return {...item,people,branch:item.category?.startsWith('nakash:')?item.category.slice(7):'keha',branches:[args.branch || 'extended']};
    })
    .filter(item=>!args.personId || item.personId===args.personId || item.people.includes(args.personId))
    .map(item=>({...item,faces:state.faces(item.id),faceSummary:item.mime?.startsWith('image/')?state.faceSummary(item):undefined,tagsRevision:state.tagsRevision(item.id)}));
}
