import family from './family.mjs';
import {EXTENDED_PEOPLE,createExtendedFamily} from '../public/keha-extended/family-data.mjs';
import {createShlomoFamily} from '../public/keha-extended/shlomo-data.mjs';
import {extendedGalleryGenerations,extendedGalleryPhoto} from '../public/keha-extended/gallery-generations.mjs';
import {BRANCH_PORTALS,createBranchPortal} from '../public/keha-extended/branch-portals.mjs';
import {uid} from './http.mjs';
import {linkSharedProfile} from './nakash-shared.mjs';
import {initializeKehatDocuments,initializeRegistryDocuments} from './kehat-documents.mjs';
import {REGISTRY_CORRECTION_IDS,REGISTRY_CORRECTION_FIELDS} from '../public/keha-extended/registry-evidence.mjs';

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
    const triMigration='extended-tri-ten-siblings-2026-11-21-v1';
    const updateTri=!state.rows('SELECT id FROM meta WHERE id=?',triMigration).length;
    const triParentageMigration='extended-tri-confirmed-parentage-yissachar-2026-11-21-v2';
    const updateTriParentage=!state.rows('SELECT id FROM meta WHERE id=?',triParentageMigration).length;
    const meravMigration='extended-kehat-merav-spelling-2026-11-21-v1';
    const updateMerav=!state.rows('SELECT id FROM meta WHERE id=?',meravMigration).length;
    const triArchiveMigration='extended-tri-childbirth-archive-1954-2026-11-21-v1';
    const updateTriArchive=!state.rows('SELECT id FROM meta WHERE id=?',triArchiveMigration).length;
    const triDeathMigration='extended-tri-confirmed-death-dates-2026-11-21-v1';
    const updateTriDeath=!state.rows('SELECT id FROM meta WHERE id=?',triDeathMigration).length;
    const lifeYearsMigration='extended-historical-life-years-2026-11-21-v1';
    const updateLifeYears=!state.rows('SELECT id FROM meta WHERE id=?',lifeYearsMigration).length;
    const saadiaNameMigration='extended-saadia-jidaan-keha-surname-2026-11-21-v1';
    const updateSaadiaName=!state.rows('SELECT id FROM meta WHERE id=?',saadiaNameMigration).length;
    const coupleSurnameMigration='extended-mordechai-dvora-keha-2026-11-22';
    const updateCoupleSurname=!state.rows('SELECT id FROM meta WHERE id=?',coupleSurnameMigration).length;
    const aharonNameMigration='extended-aharon-hovshi-keha-2026-11-22';
    const updateAharonName=!state.rows('SELECT id FROM meta WHERE id=?',aharonNameMigration).length;
    const registryMigration='extended-zechariah-ben-shalom-registry-2026-11-21-v1';
    const updateRegistry=!state.rows('SELECT id FROM meta WHERE id=?',registryMigration).length;
    const parentageNotes=new Set(['kehat-yaakov','kehat-yehudit','kehat-zechariah-ben-tzadok','kehat-amna','kehat-tziona','kehat-yaakov-yehudit']);
    const familyCorrectionNotes=new Set([...parentageNotes,'kehat-shori','kehat-mordechai','kehat-varda']);
    for(const seed of EXTENDED_PEOPLE){
      if(seed.placeholder)continue;
      const person={...seed,birthday:'1.1.1111',extra:true,extendedKeha:true,profileId:null,revision:uid()};
      // Never replace an existing date, biography, portrait or name on deploy.
      state.sql.exec('INSERT OR IGNORE INTO people (id,data) VALUES (?,?)',seed.id,JSON.stringify(person));
      if(updateAharonName&&seed.id==='saadia-aharon'){
        const saved=state.person(state.sharedNakashIdentities[seed.id]||seed.id);
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',aharonNameMigration+':backup:'+saved.id,JSON.stringify(saved));
        saved.aliases=[...new Set([...(saved.aliases||[]),saved.name,saved.nameEn,...seed.aliases].filter(alias=>alias&&alias!==seed.name&&alias!==seed.englishName))];
        Object.assign(saved,{name:seed.name,firstName:'אהרון',lastName:'חובשי קהא',nameEn:seed.englishName,englishName:seed.englishName});
        state.savePerson(saved);
        state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',aharonNameMigration,'done');
      }
      if(updateTri&&seed.triFamily){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',triMigration+':backup:'+seed.id,JSON.stringify(saved));
        // Correct only the old empty branch label. Preserve relatives' names,
        // dates, biographies, portraits, and every existing media/profile ID.
        if(seed.id==='keha-yosef-yissachar'&&saved.name==='יוסף יששכר'){
          saved.name=seed.name;delete saved.firstName;delete saved.lastName;
          for(const key of ['nameEn','englishName'])if(!saved[key]||saved[key]==='Yosef Yissachar')saved[key]=seed.englishName;
        }
        for(const key of ['researchNotes','researchSources','recordedParents','burialDate','maritalStatus'])if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
        if(seed.deceased)saved.deceased=true;
        saved.unit=seed.unit;
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[])])];
        state.savePerson(saved);
      }
      if(updateTriParentage&&seed.triFamily){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',triParentageMigration+':backup:'+seed.id,JSON.stringify(saved));
        for(const key of ['researchNotes','researchSources','unit'])if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
        const existingYear=Number(saved.birthday?.split('.').at(-1));
        if(!updateTriArchive&&seed.archiveBirthEvidence&&existingYear>1111&&existingYear!==seed.birthYear)saved.researchNotes+=' תאריך הלידה השמור בפרופיל ('+saved.birthday+') שונה משנת '+seed.birthYear+' שבשאלון; שני הרישומים נשמרים לבירור.';
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[])])];
        state.savePerson(saved);
      }
      if(updateTriParentage&&seed.id==='yissachar-yosef'){
        const backup=state.rows('SELECT value FROM meta WHERE id=?',triMigration+':backup:keha-yosef-yissachar')[0];
        if(backup){
          const original=JSON.parse(backup.value),saved=state.person(seed.id);
          for(const key of ['birthday','deathDate','deceased','about','aboutEn','languages','languagesEn','occupations','occupationsEn'])if(original[key]!==undefined)saved[key]=structuredClone(original[key]);
          state.savePerson(saved);
        }
      }
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
      if(updateMerav&&['kehat-merav','kehat-mordechai','kehat-varda'].includes(seed.id)){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',meravMigration+':backup:'+seed.id,JSON.stringify(saved));
        if(seed.id==='kehat-merav'&&['מרב','מרב קהת'].includes(saved.name)){
          saved.name=saved.name.replace('מרב','מירב');delete saved.firstName;delete saved.lastName;
        }
        if(seed.id==='kehat-merav')saved.aliases=[...new Set([...(saved.aliases||[]),'מרב'])];
        if(saved.researchNotes)saved.researchNotes=saved.researchNotes.replaceAll('מרב, שרון, עדי וטל','מירב, שרון, עדי וטל');
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
      if(updateTriArchive&&seed.archiveBirthEvidence){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',triArchiveMigration+':backup:'+seed.id,JSON.stringify(saved));
        for(const key of ['researchNotes','researchSources','parents','birthYear','birthYearSource','birthYearSourceEn','birthPlace','recordedParents','aliyahYear','occupation'])if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
        const existingYear=Number(saved.birthday?.split('.').at(-1));
        if(existingYear>1111&&existingYear!==seed.birthYear)saved.researchNotes+=' תאריך הלידה השמור בפרופיל ('+saved.birthday+') שונה משנת '+seed.birthYear+' שבשאלון; שני הרישומים נשמרים לבירור.';
        if(seed.id==='kehat-zechariah'&&saved.name==='זכריה קהת'){
          saved.name=seed.name;delete saved.firstName;delete saved.lastName;
          for(const key of ['nameEn','englishName'])if(!saved[key]||saved[key]==='Zechariah Kehat')saved[key]=seed[key];
        }
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[])])];
        saved.unit=seed.unit;
        state.savePerson(saved);
      }
      if(updateTriDeath&&['keha-yosef-yissachar','tri-yissachar'].includes(seed.id)&&seed.deathDate){
        const saved=state.person(seed.id);
        if(!saved.deathDate){
          state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',triDeathMigration+':backup:'+seed.id,JSON.stringify(saved));
          saved.deathDate=seed.deathDate;saved.deceased=true;state.savePerson(saved);
        }
      }
      if(updateLifeYears&&seed.historicalLifeEvidence){
        const saved=state.person(seed.id);
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',lifeYearsMigration+':backup:'+seed.id,JSON.stringify(saved));
        // Keep exact dates, portraits and family edits. Research ranges are
        // separate metadata, and an existing death date always takes priority.
        for(const key of ['birthYear','birthYearMin','birthYearMax','birthYearSource','birthYearSourceEn','deathYearSource','deathYearSourceEn','lifeRecords','researchNotes','researchSources','historicalLifeEvidence'])if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
        if(!saved.deathDate&&!saved.deathYear){
          if(seed.deathDate)saved.deathDate=seed.deathDate;
          else if(seed.deathYear)saved.deathYear=seed.deathYear;
        }
        if(seed.deceased)saved.deceased=true;
        state.savePerson(saved);
      }
      if(updateSaadiaName&&seed.id==='kehat-jidaan'){
        const saved=JSON.parse(state.rows('SELECT data FROM people WHERE id=?',seed.id)[0].data);
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',saadiaNameMigration+':backup:'+seed.id,JSON.stringify(saved));
        if(/קהת/.test(saved.name||'')||saved.lastName==='קהת'||seed.aliases.includes(saved.name)){
          saved.name=seed.name;delete saved.firstName;delete saved.lastName;
        }
        for(const key of ['nameEn','englishName'])if(!saved[key]||/Kehat/i.test(saved[key]))saved[key]=seed[key];
        saved.aliases=[...new Set([...(saved.aliases||[]).filter(alias=>!/קהת|Kehat/i.test(alias)),...(seed.aliases||[])])];
        state.savePerson(saved);
      }
    }
    if(updateCoupleSurname){
      for(const id of ['kehat-mordechai','kehat-varda']){
        const saved=state.person(id);
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',coupleSurnameMigration+':backup:'+id,JSON.stringify(saved));
        saved.name=saved.name.replace(/ קהת$/u,' קהא');
        if(saved.lastName==='קהת')saved.lastName='קהא';
        for(const key of ['nameEn','englishName']){
          if(saved[key])saved[key]=saved[key].replace(/ Kehat$/i,' Keha');
        }
        if(saved.researchNotes)saved.researchNotes=saved.researchNotes.replaceAll('מרדכי קהת','מרדכי קהא');
        state.savePerson(saved);
      }
      state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',coupleSurnameMigration,'done');
    }
    // Apply the owner's identity correction after the earlier migrations.
    if(updateRegistry)for(const seed of EXTENDED_PEOPLE){
      if(!REGISTRY_CORRECTION_IDS.includes(seed.id))continue;
      const id=state.sharedNakashIdentities[seed.id]||seed.id;
      const saved=state.person(id);
      if(!saved)continue;
      state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',registryMigration+':backup:'+id,JSON.stringify(saved));
      for(const key of REGISTRY_CORRECTION_FIELDS)if(seed[key]!==undefined)saved[key]=structuredClone(seed[key]);
      const oldNames={
        'keha-zechariah':['זכריה קהא','זכריה קהא הבן','זכריה בן סעדיה קהא'],
        'saadia-elder':['סעדיה קהא'],
      };
      if(oldNames[seed.id]?.includes(saved.name)){
        saved.name=seed.name;delete saved.firstName;delete saved.lastName;
        saved.nameEn=seed.nameEn;saved.englishName=seed.englishName;
      }
      // Replace the superseded genealogy, retaining family memories and media.
      if(['keha-zechariah','saadia-elder','keha-zechariah-father','saadia-saadia'].includes(seed.id)&&
        (!saved.about||/בנו של סעדיה|אחיו של סעדיה|סעדיה קהא הדוד|אביו של זכריה קהא הבן/.test(saved.about)))saved.about=seed.about;
      if(seed.id==='keha-zechariah'){
        if(saved.deathDate?.endsWith('.1979'))delete saved.deathDate;
        saved.deathYear=1957;saved.deceased=true;
        if(!saved.deathDate)saved.deathDate=seed.deathDate;
      }
      if(seed.id==='keha-yehudit'){saved.deathYear=1971;saved.deceased=true;}
      saved.aliases=[...new Set([...(saved.aliases||[]).filter(alias=>seed.id!=='keha-zechariah'||!alias.includes('בן סעדיה')),...(seed.aliases||[])])];
      state.savePerson(saved);
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
    if(updateTri)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',triMigration,'done');
    if(updateTriParentage)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',triParentageMigration,'done');
    if(updateTriDeath)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',triDeathMigration,'done');
    if(updateLifeYears)state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',lifeYearsMigration,'done');
    if(updateSaadiaName)state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',saadiaNameMigration,'done');
    if(updateRegistry)state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',registryMigration,'done');
    if(updateMerav)state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',meravMigration,'done');
    if(updateTriArchive){
      // This original scan was uploaded through the family archive and is
      // already linked to Zechariah and all ten children. Link the new mother
      // profile to that same file, retaining its ID, caption and original bytes.
      const documentId='993b035c6bdf42fdb37950489f291c92';
      const row=state.rows('SELECT data FROM media WHERE id=?',documentId)[0];
      if(row){
        state.sql.exec('INSERT OR IGNORE INTO meta (id,value) VALUES (?,?)',triArchiveMigration+':document-backup',row.data);
        const item=JSON.parse(row.data);
        item.documentPeople=[...new Set([...(item.documentPeople||[]),'tri-yona'])];
        state.sql.exec('UPDATE media SET data=? WHERE id=?',JSON.stringify(item),documentId);
        state.sql.exec('INSERT OR IGNORE INTO media_tags (media_id,person_id) VALUES (?,?)',documentId,'tri-yona');
        state.savePerson(state.person('tri-yona'));
      }
      state.sql.exec('INSERT INTO meta (id,value) VALUES (?,?)',triArchiveMigration,'done');
    }
    const householdMigration='extended-tri-households-2026-11-24-v1';
    if(!state.rows('SELECT id FROM meta WHERE id=?',householdMigration).length){
      const renamed=new Set(['tri-menachem','tri-esther','tri-rachel','tri-ronit','tri-david','tri-miriam','tri-hana','kehat-aharon']);
      const notes=new Set(['kehat-jidaan','kehat-aharon','kehat-yehudit','tri-hana','tri-esther','tri-ronit','tri-miriam','tri-binyamin','tri-hezi']);
      for(const seed of EXTENDED_PEOPLE){
        if(!renamed.has(seed.id)&&!notes.has(seed.id)&&seed.id!=='kehat-zechariah')continue;
        const saved=state.person(state.sharedNakashIdentities[seed.id]||seed.id);
        state.sql.exec('INSERT OR IGNORE INTO meta(id,value) VALUES(?,?)',householdMigration+':backup:'+saved.id,JSON.stringify(saved));
        saved.aliases=[...new Set([...(saved.aliases||[]),...(seed.aliases||[]),saved.name,saved.nameEn].filter(Boolean))];
        if(renamed.has(seed.id)){
          const [firstName,...rest]=seed.name.split(' ');
          Object.assign(saved,{name:seed.name,firstName,lastName:rest.join(' '),nameEn:seed.nameEn,englishName:seed.englishName});
        }
        if(notes.has(seed.id))saved.researchNotes=seed.researchNotes;
        state.savePerson(saved);
      }
      // Both free-name profiles were created for Miriam Tri in the two
      // Zechariah portals. Other Miriam profiles refer to different relatives.
      for(const id of ['extra-nakash-f6172e08ee7f90100e98875a','extra-nakash-b920bce618b9d0cf29801fb6']){
        const row=state.rows('SELECT data FROM people WHERE id=?',id)[0];
        if(row && !JSON.parse(row.data).mergedInto)linkSharedProfile(state,state.sharedNakashIdentities,{id,sharedProfileId:'tri-miriam'});
      }
      state.sql.exec('INSERT INTO meta(id,value) VALUES(?,?)',householdMigration,'done');
    }
    initializeKehatDocuments(state);
    initializeRegistryDocuments(state);
    state.peopleRevision=uid();state.peopleCache=null;
  });
  state.extendedKehaReady=true;
}

export function extendedKehaItems(state,args={}) {
  const source={...family,sharedPeople:state.run('people').people,identities:state.sharedNakashIdentities};
  const scoped=BRANCH_PORTALS[args.branch]?createBranchPortal(source,args.branch):(args.branch==='shlomo'?createShlomoFamily:createExtendedFamily)(source);
  const sharedGallery=!args.branch||args.branch==='extended';
  const cohorts=sharedGallery?extendedGalleryGenerations(scoped,source.sharedPeople,new Set(Object.values(family.people).filter(person=>person.generation>=3).map(person=>person.id))):null;
  const ids=JSON.stringify(Object.keys(scoped.people));
  const categories=JSON.stringify(BRANCH_PORTALS[args.branch]?['nakash:'+args.branch]:args.branch==='shlomo'?['nakash:shlomo','gallery','videos','nostalgia']:['nakash:extended','nakash:shlomo','nakash:zechariah','nakash:zechariah-tzadok','nakash:kehat','gallery','videos','nostalgia']);
  return state.rows("SELECT data FROM media WHERE category IN (SELECT value FROM json_each(?)) OR person_id IN (SELECT value FROM json_each(?)) OR id IN (SELECT media_id FROM media_tags WHERE person_id IN (SELECT value FROM json_each(?))) ORDER BY rowid DESC",categories,ids,ids).map(row=>JSON.parse(row.data))
    .filter(item=>!args.kind || (item.kind || (item.mime?.startsWith('image/')?'photo':item.mime?.startsWith('video/')?'video':'document'))===args.kind)
    .map(item=>{
      const people=state.tagIds(item.id);
      return {...item,people,branch:item.category?.startsWith('nakash:')?item.category.slice(7):'keha',branches:[args.branch || 'extended']};
    })
    .filter(item=>!sharedGallery||!(item.kind==='photo'||!item.kind&&item.mime?.startsWith('image/'))||extendedGalleryPhoto(item,cohorts,args.generation,id=>scoped.identities[id]||id))
    .filter(item=>!args.personId || item.personId===args.personId || item.people.includes(args.personId))
    .map(item=>({...item,faces:state.faces(item.id),faceSummary:item.mime?.startsWith('image/')?state.faceSummary(item):undefined,tagsRevision:state.tagsRevision(item.id)}));
}
