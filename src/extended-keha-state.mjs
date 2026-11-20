import family from './family.mjs';
import {EXTENDED_PEOPLE,createExtendedFamily} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {BRANCH_PORTALS,createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {uid} from './http.mjs';
import {linkSharedProfile} from './nakash-shared.mjs';

export function initializeExtendedKeha(state) {
  if(state.extendedKehaReady)return;
  state.ctx.storage.transactionSync(()=>{
    const migration='extended-saadia-chart-2026-11-20-v1';
    const updateChart=!state.rows('SELECT id FROM meta WHERE id=?',migration).length;
    const kehatMigration='extended-kehat-two-branches-2026-11-20-v1';
    const updateKehat=!state.rows('SELECT id FROM meta WHERE id=?',kehatMigration).length;
    const researchMigration='extended-kehat-certificate-families-2026-11-20-v1';
    const updateResearch=!state.rows('SELECT id FROM meta WHERE id=?',researchMigration).length;
    const parentageMigration='extended-kehat-yehudit-amna-2026-11-20-v1';
    const updateParentage=!state.rows('SELECT id FROM meta WHERE id=?',parentageMigration).length;
    const uriMigration='extended-kehat-uri-transcription-2026-11-20-v1';
    const updateUri=!state.rows('SELECT id FROM meta WHERE id=?',uriMigration).length;
    const familyCorrectionMigration='extended-kehat-tziona-three-siblings-2026-11-20-v1';
    const updateFamilyCorrection=!state.rows('SELECT id FROM meta WHERE id=?',familyCorrectionMigration).length;
    const parentageNotes=new Set(['kehat-yaakov','kehat-yehudit','kehat-zechariah-ben-tzadok','kehat-amna','kehat-tziona','kehat-yaakov-yehudit']);
    const familyCorrectionNotes=new Set([...parentageNotes,'kehat-shori','kehat-mordechai','kehat-varda']);
    for(const seed of EXTENDED_PEOPLE){
      if(seed.placeholder)continue;
      const person={...seed,birthday:'1.1.1111',extra:true,extendedKeha:true,profileId:null,revision:uid()};
      // Never replace an existing date, biography, portrait or name on deploy.
      state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)',seed.id,JSON.stringify(person));
      if(updateResearch&&(seed.id.startsWith('kehat-')||['saadia-saadia','saadia-shalom'].includes(seed.id))){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',researchMigration+':backup:'+seed.id,JSON.stringify(saved));
        // Biography, names chosen by relatives, dates and portraits stay intact.
        // Source notes and graph membership are separate, versioned metadata.
        for(const key of ['researchNotes','researchSources','researchBranch','birthYear','birthYearMin','birthYearMax','birthYearSource','birthYearSourceEn','deathBefore','lifeRecords'])if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
        if(seed.deathDate&&!saved.deathDate){saved.deathDate=seed.deathDate;saved.deceased=true;}
        saved.unit=seed.unit;
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[])])];
        state.savePerson(saved);
      }
      if(updateParentage&&parentageNotes.has(seed.id)){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',parentageMigration+':backup:'+seed.id,JSON.stringify(saved));
        saved.researchNotes=seed.researchNotes;
        state.savePerson(saved);
      }
      if(updateUri&&['kehat-ari','kehat-yaakov','kehat-yaakov-yehudit'].includes(seed.id)){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',uriMigration+':backup:'+seed.id,JSON.stringify(saved));
        if(seed.id==='kehat-ari'&&saved.name==='ארי קהת'){
          saved.name=seed.name;
          for(const key of ['nameEn','englishName'])if(!saved[key]||saved[key]==='Ari Kehat')saved[key]='Uri Kehat';
          saved.aliases=[...new Set([...(saved.aliases||[]),'ארי קהת'])];
        }
        if(saved.researchNotes)saved.researchNotes=saved.researchNotes.replaceAll('חבצלת, ארי וגילה','חבצלת, אורי וגילה');
        state.savePerson(saved);
      }
      if(updateFamilyCorrection&&familyCorrectionNotes.has(seed.id)){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',familyCorrectionMigration+':backup:'+seed.id,JSON.stringify(saved));
        saved.researchNotes=seed.researchNotes;
        // Correct the old transcription while retaining profile and album IDs.
        const oldName=seed.id==='kehat-varda'?'ורדה קהת':seed.id==='kehat-shori'?'שורי קהת':null;
        const oldEnglish=seed.id==='kehat-varda'?'Varda Kehat':'Shori Kehat';
        if(oldName&&saved.name===oldName){saved.name=seed.name;delete saved.firstName;delete saved.lastName;}
        if(oldName)for(const key of ['nameEn','englishName'])if(!saved[key]||saved[key]===oldEnglish)saved[key]=seed[key];
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[])])];
        state.savePerson(saved);
      }
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
    if(updateResearch)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',researchMigration,'done');
    if(updateParentage)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',parentageMigration,'done');
    if(updateUri)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',uriMigration,'done');
    if(updateFamilyCorrection)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',familyCorrectionMigration,'done');
    state.peopleRevision=uid();state.peopleCache=null;
  });
  state.extendedKehaReady=true;
}

export function extendedKehaItems(state,args={}) {
  const source={...family,sharedPeople:state.run('people').people,identities:state.sharedNakashIdentities};
  const scoped=BRANCH_PORTALS[args.branch]?createBranchPortal(source,args.branch):(args.branch==='shlomo'?createShlomoFamily:createExtendedFamily)(source);
  const ids=JSON.stringify(Object.keys(scoped.people));
  const categories=JSON.stringify(BRANCH_PORTALS[args.branch]?['nakash:'+args.branch]:args.branch==='shlomo'?['nakash:shlomo','gallery','videos','nostalgia']:['nakash:extended','nakash:shlomo','nakash:zechariah','nakash:kehat','gallery','videos','nostalgia']);
  return state.rows("SELECT data FROM media WHERE category IN (SELECT value FROM json_each(?)) OR person_id IN (SELECT value FROM json_each(?)) OR id IN (SELECT media_id FROM media_tags WHERE person_id IN (SELECT value FROM json_each(?))) ORDER BY rowid DESC",categories,ids,ids).map(row=>JSON.parse(row.data))
    .filter(item=>!args.kind || (item.kind || (item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document'))===args.kind)
    .map(item=>{
      const people=state.tagIds(item.id);
      return {...item,people,branch:item.category?.startsWith('nakash:')?item.category.slice(7):'keha',branches:[args.branch || 'extended']};
    })
    .filter(item=>!args.personId || item.personId===args.personId || item.people.includes(args.personId))
    .map(item=>({...item,faces:state.faces(item.id),faceSummary:item.mime?.startsWith('image/')?state.faceSummary(item):undefined,tagsRevision:state.tagsRevision(item.id)}));
}
