(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const data = window.FAMILY_DATA;
  const $ = id => document.getElementById(id);
  const people = Object.values(data.people).filter(person=>!person.structuralGroup);
  const media = new Map();
  const phoneQuery=matchMedia('(max-width:700px)'),isPhone=()=>phoneQuery.matches;
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),reducedMotion=()=>window.FamilyAccessibility?.isReducedMotion()??motionQuery.matches;
  const validViews=new Set(['home','tree','founder-tree','timeline','directory','gallery','calendar','videos','photos','stories','documents','voices','weddings','nostalgia','updates','memorial','person','games','nursery','screensaver','family-ai','search']);
  const scopedViews=document.documentElement?.dataset?.nakashViews;
  const compactTreeYears=Boolean(document.documentElement?.dataset?.extendedKeha||document.documentElement?.dataset?.branchPortal||document.documentElement?.dataset?.shlomoKeha==='true');
  const adaptiveTreeLayout=Boolean(document.documentElement?.dataset?.branchPortal);
  if(scopedViews)for(const view of validViews)if(!scopedViews.split(' ').includes(view))validViews.delete(view);
  const searchBranch=document.documentElement?.dataset?.nakashSearchBranch;
  const searchFamilyOrder=(a,b)=>Number(Boolean(searchBranch)&&b.branch===searchBranch)-Number(Boolean(searchBranch)&&a.branch===searchBranch);
  const requestedView=location.hash.slice(1).split('/')[0];
  const state = {view:validViews.has(requestedView)?requestedView:(isPhone()?'home':'tree'), branch:'all', mode:'overview', query:'', directoryGroup:'main', currentPerson:null, galleryFilter:'all', gallery:[], photoIndex:0, urls:[]};
  const camera = {x:0,y:0,scale:1,width:0,height:0};
  let motionFrame=0,suppressClickUntil=0,treeRenderVersion=0,treeCameraApplied=false;
  const treeTextScale=()=>Math.max(1,Math.min(2,(Number(window.FamilyAccessibility?.getSettings?.().text)||100)/100));
  let observedTextScale=treeTextScale();
  // Keep the original root-couple CSS on the top pair of either tree.
  const treeUnitKey=id=>scopedViews?id===data.root?'u-root':id==='u-root'?'u-nakash-keha':id:id;
  const branchFor = id => data.branches.find(b => b.id === id);
  const getMedia = p => media.get(p.id) || {};
  const nameOf = p => I18n.personName({...p,...getMedia(p)});
  const birthdayOf = p => getMedia(p).birthday || p.birthday;
  const isPlaceholder = p => p.placeholder && (getMedia(p).name||p.name) === p.name;
  const branchTitle = p => p.extra?I18n.t('מכרים וחברי משפחה'):p.extended?(I18n.isEnglish?'Extended family':'בני משפחה נוספים'):I18n.branchName(branchFor(p.branch)) || I18n.t('השורשים של כולנו');
  const generationName = n => ['',I18n.t('הדור הראשון'),I18n.t('הדור השני'),I18n.t('הדור השלישי'),I18n.t('הדור הרביעי'),I18n.t('הדור החמישי')][n] || I18n.html`דור ${n}`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = escapeHTML;
  const initials = p => nameOf(p).split(/\s+/).filter(Boolean).map(s => s[0]).slice(0,2).join('');
  const normalize = s => s.normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const silhouette = '<svg class="silhouette" viewBox="0 0 80 100" aria-hidden="true"><circle cx="40" cy="27" r="17"/><path d="M9 94V83c0-20 12-33 31-33s31 13 31 33v11Z"/></svg>';
  const femaleSilhouette = '<svg class="silhouette silhouette-female" viewBox="0 0 80 100" aria-hidden="true" data-placeholder-gender="f"><path d="M18 49V29C18 13 27 5 40 5s22 8 22 24v20l-13-5H31Z"/><circle cx="40" cy="29" r="13"/><path d="M32 44h16v11c12 3 17 12 19 23l5 16H8l5-16c2-11 7-20 19-23Z"/></svg>';
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>';
  const calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1"/></svg>';
  const imageIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="5" width="24" height="23" rx="2"/><circle cx="11" cy="12" r="2.5"/><path d="m5 24 8-8 5 5 4-4 6 7"/></svg>';
  let toastTimer;

  function portraitHTML(p) {
    const src = scopedViews?(getMedia(p).profile ?? p.profile):getMedia(p).profile;
    const person={...p,...getMedia(p)},placeholder=person.gender==='f'?femaleSilhouette:silhouette.replace('<svg ','<svg data-placeholder-gender="'+(person.gender==='m'?'m':'unknown')+'" ');
    return `<span class="portrait" aria-hidden="true">${placeholder}<span class="portrait-letter">${safe(initials(p))}</span>${src ? `<img class="profile-photo" ${window.FamilyPhotoFraming?.profile(person)||''} src="${safe(src)}" alt="" loading="lazy">` : ''}</span>`;
  }
  function birthdayHTML(input, editable = true, birthOnly = false) {
    const p={...input,...getMedia(input)};
    const aliyah=p.aliyahMonth?new Intl.DateTimeFormat(I18n.locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(p.aliyahYear,p.aliyahMonth-1,1))):p.aliyahYear;
    const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5L9 20l-6 1 1-6ZM14 5l5 5"/></svg>';
    const canEdit=Boolean(scopedViews&&apiEnabled&&!isPlaceholder(p));
    const deathEdit=canEdit&&p.deceased?`<button type="button" class="birthday-edit" data-edit-death="${safe(p.id)}" aria-label="${I18n.isEnglish?'Edit date of death':'עריכת תאריך פטירה'}">${pencil}</button>`:'';
    if(p.extra)return I18n.t('<span class="directory-branch">אלבום מתמונות וסרטונים שתויגו</span>');
    const invalid = getMedia(p).invalidBirthday;
    const value = birthdayOf(p), death = p.deathDate ? window.FamilyDates.parse(p.deathDate) : null;
    const age = invalid ? null : p.deceased ? death ? window.FamilyDates.age(value,death.date) : null : window.FamilyDates.age(value);
    const unknown = value === '1.1.1111';
    const candidate=candidateLifeRecord(p),candidateBirth=!(p.birthYear??p.birthYearMin)&&Boolean(candidate?.birthYearMin);
    const firstYear=p.birthYear??p.birthYearMin??candidate?.birthYearMin,lastYear=p.birthYear??p.birthYearMax??candidate?.birthYearMax;
    const yearOnly=unknown&&Number.isInteger(firstYear)&&Number.isInteger(lastYear)&&firstYear>1111&&lastYear>=firstYear&&lastYear<=new Date().getFullYear();
    const yearSource=candidateBirth?(I18n.isEnglish?'Gravestone match under research':'לפי מצבה שהשיוך שלה בבדיקה'):I18n.isEnglish?p.birthYearSourceEn:p.birthYearSource;
    const unknownLabel=yearOnly?`${firstYear===lastYear?firstYear:'\u2066'+firstYear+'–'+lastYear+'\u2069'}${candidateBirth?'?':''}${yearSource?' · '+yearSource:''}`:(I18n.isEnglish?'Not added yet':I18n.t('טרם הוזן'));
    const deathEvidence=treeDeathEvidence(p);
    const deathValueHTML=death?`<span class="person-death-date">${I18n.isEnglish?'Died on ':p.gender==='f'?'נפטרה ב־':'נפטר ב־'}<bdi>${safe(I18n.date(p.deathDate))}</bdi></span>`:deathEvidence.year?`<span class="person-death-date" title="${safe(deathEvidence.source||'')}">${deathEvidence.candidate?(I18n.isEnglish?'Death · gravestone match under research: ':'פטירה · שיוך המצבה בבדיקה: '):(I18n.isEnglish?'Died in ':p.gender==='f'?'נפטרה ב־':'נפטר ב־')}<bdi dir="ltr">${deathEvidence.year}${deathEvidence.candidate?'?':''}</bdi></span>`:'';
    const deathHTML=deathValueHTML?deathValueHTML.replace(/^(<span[^>]*>)/,`$1${deathEdit}<span class="life-date-value">`).replace(/<\/span>$/, '</span></span>'):'';
    const rangeLabel=range=>range?(range.min===range.max?String(range.min):range.min+'–'+range.max):'';
    const currentRange=!invalid&&yearOnly?rangeLabel(window.FamilyDates.ageRange?.(firstYear,lastYear)):!invalid&&p.deceased&&p.researchNotes&&!unknown?String(window.FamilyDates.age(value)??''):'';
    const deathRange=!invalid&&yearOnly&&death?rangeLabel(window.FamilyDates.ageRange?.(firstYear,lastYear,death.date)):'';
    const ageLine=(label,range)=>range?`<span class="person-age">${safe(label)} <bdi dir="ltr">${safe(range)}</bdi></span>`:'';
    const yearAgeHTML=ageLine(I18n.isEnglish?'Age at death:':'גיל בפטירה:',deathRange)+ageLine(I18n.isEnglish?(p.deceased?'Would be this age today:':'Calculated age today:'):(p.deceased?`אילו ${p.gender==='f'?'הייתה':'היה'} בחיים היום:`:'גיל מחושב להיום:'),currentRange);
    const deathBeforeHTML=!death&&p.deathBefore?`<span class="person-death-date">${safe(I18n.isEnglish?`Died before ${p.deathBefore}`:`${p.gender==='f'?'נפטרה':'נפטר'} לפני ${p.deathBefore}`)}</span>`:'';
    const birthdayEdit=canEdit?`<button type="button" class="birthday-edit" data-edit-birthday="${safe(p.id)}" aria-label="${I18n.isEnglish?'Edit date of birth':'עריכת תאריך לידה'}">${pencil}</button>`:'';
    if(birthOnly)return `<span class="birthday-line"><bdi>${safe(invalid?I18n.t('תאריך לבדיקה'):unknown?unknownLabel:I18n.date(value))}</bdi>${birthdayEdit}</span>${deathEdit}`;
    if(I18n.isEnglish)return `<span class="birthday-line"><bdi>${safe(invalid?'Date needs checking':unknown?unknownLabel:I18n.date(value))}</bdi>${birthdayEdit}</span>${age!==null?`<span class="person-age">(${p.deceased?`aged ${age} at death`:age})</span>`:''}${yearAgeHTML}${deathHTML}${deathBeforeHTML}${deathHTML?'':deathEdit}${p.aliyahYear?`<span class="person-aliyah-year">Moved to Israel in <bdi>${safe(aliyah)}</bdi></span>`:''}`;
    return I18n.html`<span class="birthday-line"><bdi>${safe(invalid ? I18n.t('תאריך לבדיקה') : unknown ? unknownLabel : I18n.date(value))}</bdi>${birthdayEdit}</span>${age !== null ? `<span class="person-age" aria-label="${p.deceased?I18n.t('גיל בפטירה'):I18n.t('גיל')} ${age}">${p.deceased?I18n.html`(${p.gender==='f'?I18n.t('בת'):I18n.t('בן')} ${age} בפטירת${p.gender==='f'?I18n.t('ה'):I18n.t('ו')})`:`(${age})`}</span>` : ''}${yearAgeHTML}${deathHTML}${deathBeforeHTML}${deathHTML?'':deathEdit}${p.aliyahYear?I18n.html`<span class="person-aliyah-year">${p.gender==='f'?I18n.t('עלתה'):I18n.t('עלה')} לארץ ב־<bdi>${safe(aliyah)}</bdi></span>`:''}`;
  }

  function rootHistoryHTML(p) {
    const value=birthdayOf(p),valid=!getMedia(p).invalidBirthday&&value!=='1.1.1111';
    const death=p.deathDate?window.FamilyDates.parse(p.deathDate):null;
    const deathAge=valid&&death?window.FamilyDates.age(value,death.date):null;
    let aliyahAge=null;
    if(valid&&p.aliyahYear){
      // Keep the precision of the known month/year rather than assuming a day.
      const first=new Date(p.aliyahYear,(p.aliyahMonth||1)-1,1),last=new Date(p.aliyahYear,p.aliyahMonth||12,0);
      const youngest=window.FamilyDates.age(value,first),oldest=window.FamilyDates.age(value,last);
      if(youngest!==null&&oldest!==null)aliyahAge=youngest===oldest?String(youngest):`${youngest}–${oldest}`;
    }
    const ageText=age=>I18n.isEnglish?`(aged ${age})`:`(${p.gender==='f'?'בת':'בן'} ${age})`;
    const eventHTML=(kind,label,date,age)=>`<div class="root-life-event root-${kind}"><span class="root-event-label">${safe(label)}</span><span class="root-event-value"><bdi>${safe(date)}</bdi>${age===null?'':` <span class="root-event-age">${safe(ageText(age))}</span>`}</span></div>`;
    const arrival=p.aliyahMonth?new Intl.DateTimeFormat(I18n.locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(p.aliyahYear,p.aliyahMonth-1,1))):p.aliyahYear;
    return (p.aliyahYear?eventHTML('aliyah',I18n.isEnglish?'Moved to Israel':p.gender==='f'?'עלתה לארץ':'עלה לארץ',arrival,aliyahAge):'')+
      (death?eventHTML('death',I18n.isEnglish?'Died':p.gender==='f'?'נפטרה':'נפטר',I18n.date(p.deathDate),deathAge):'');
  }

  function treeYear(value) {
    const year=Number(value);
    return Number.isInteger(year)&&year>1111&&year<=new Date().getFullYear()?year:null;
  }
  function treeDateYear(value){return treeYear(window.FamilyDates.parse(value)?.year);}
  function candidateLifeRecord(person){return person.lifeRecords?.find(record=>record.showYears&&record.status!=='confirmed');}
  function treeDeathEvidence(person){
    const year=treeDateYear(person.deathDate)||treeYear(person.deathYear);
    if(year)return {year,candidate:false,source:I18n.isEnglish?person.deathYearSourceEn:person.deathYearSource};
    const record=candidateLifeRecord(person);
    return {year:record&&(treeDateYear(record.deathDate)||treeYear(record.deathYear)),candidate:true,source:I18n.isEnglish?'The gravestone identity is under research. Open the profile for sources.':record?.note||'שיוך המצבה לאדם בבדיקה; המקורות בעמוד האישי.'};
  }
  function treeBirthYears(p){
    const person={...p,...getMedia(p)},dateYear=!person.invalidBirthday&&treeDateYear(birthdayOf(p));
    if(dateYear)return [dateYear,dateYear];
    const record=candidateLifeRecord(person);
    const first=treeYear(person.birthYear??person.birthYearMin??record?.birthYearMin),last=treeYear(person.birthYear??person.birthYearMax??record?.birthYearMax);
    return first&&last&&last>=first?[first,last]:null;
  }
  function treeHistoricalPerson(p){
    const person={...p,...getMedia(p)},years=treeBirthYears(p);
    if(person.deceased||treeDateYear(person.deathDate)||treeYear(person.deathYear))return true;
    const age=person.invalidBirthday?null:window.FamilyDates.age(birthdayOf(p));
    return age!==null?age>=70:Boolean(years&&new Date().getFullYear()-years[1]>=70);
  }
  function treeLifeYearsHTML(p,editable=true){
    const person={...p,...getMedia(p)},years=treeBirthYears(p),death=treeDeathEvidence(person);
    const candidateBirth=years&&!(!person.invalidBirthday&&treeDateYear(birthdayOf(p)))&&!(person.birthYear??person.birthYearMin)&&Boolean(candidateLifeRecord(person));
    const uncertainty=I18n.isEnglish?'The gravestone identity is under research. Open the profile for sources.':'שיוך המצבה לאדם בבדיקה; המקורות בעמוד האישי.';
    const mark=source=>`<abbr class="tree-year-uncertain" title="${safe(source||uncertainty)}" aria-label="${safe(uncertainty)}">?</abbr>`;
    const canEdit=editable&&scopedViews&&apiEnabled&&!isPlaceholder(p);
    const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5L9 20l-6 1 1-6ZM14 5l5 5"/></svg>';
    const edit=(kind,label)=>canEdit?`<button type="button" class="birthday-edit" data-edit-${kind}="${safe(p.id)}" aria-label="${safe(label)}">${pencil}</button>`:'';
    const birth=years?`<span class="tree-date-value" data-tree-birth-year${candidateBirth?' data-year-candidate':''}><span>${I18n.isEnglish?'Born:':'לידה:'}</span> <bdi dir="ltr">${years[0]===years[1]?years[0]:years[0]+'–'+years[1]}${candidateBirth?mark():''}</bdi></span>`:'';
    return `<span class="birthday-line">${edit('birthday',I18n.isEnglish?'Edit date of birth':'עריכת תאריך לידה')}${birth}</span>`+(death.year?`<span class="person-death-date" data-tree-death-year${death.candidate?' data-year-candidate':''}>${death.candidate?'':edit('death',I18n.isEnglish?'Edit date of death':'עריכת תאריך פטירה')}<span class="tree-date-value"><span>${I18n.isEnglish?'Died:':'פטירה:'}</span> <bdi dir="ltr">${death.year}${death.candidate?mark(death.source):''}</bdi></span></span>`:'');
  }
  function treePartnershipLabel(p,partnership,unit){
    if(!compactTreeYears)return partnership?(I18n.isEnglish?partnership.labelEn:partnership.label):'';
    const union=partnership||(!unit.relationships&&unit.people.length===2&&p.id!==unit.people[0]?unit:null);
    if(!union)return '';
    const soleMarriage=(unit.relationships||[]).filter(item=>item.relationship==='spouse').length===1;
    const wedding=union.hasWedding===false||unit.hasWedding===false?null:treeYear(union.weddingYear)||treeDateYear(union.weddingDate)||((!unit.relationships||soleMarriage)&&(treeYear(unit.weddingYear)||treeDateYear(unit.weddingDate)));
    const historical=union.people.some(id=>data.people[id]&&treeHistoricalPerson(data.people[id]))||Boolean(wedding&&new Date().getFullYear()-wedding>=70);
    if(wedding)return historical?(I18n.isEnglish?'Married: ':'נישואין: ')+wedding:'';
    const label=partnership?(I18n.isEnglish?partnership.labelEn:partnership.label):'';
    return /\d{4}/.test(label||'')||union.relationship==='spouse'&&(unit.relationships||[]).filter(item=>item.relationship==='spouse').length<2?'':label;
  }

  function treeRoleHTML(p,unit){
    const person={...p,...getMedia(p)},descendant=unit.people[0]===p.id;
    let label='',reference=null;
    const shortName=id=>nameOf(data.people[id]).split(/\s+/)[0];
    if(descendant){
      const parent=data.units[unit.parent];
      if(!parent||parent.siblingGroup)return '';
      const unions=parent.relationships?.filter(relation=>relation.children.includes(unit.id));
      const ids=unions?unions.flatMap(relation=>relation.people):parent.people;
      const parents=ids.map(id=>data.people[id]).filter(person=>person&&!person.structuralGroup&&!isPlaceholder(person));
      reference=parents.find(person=>person.gender==='m')||parents[0];if(!reference)return '';
      const adopted=unit.parentage==='adopted'||unions?.some(relation=>relation.relationship==='adopted');
      const grandchild=unit.parentage==='grandchild'||unions?.some(relation=>relation.relationship==='grandparent');
      const kind=I18n.isEnglish?grandchild?(person.gender==='f'?'Granddaughter':person.gender==='m'?'Grandson':'Grandchild'):adopted?(person.gender==='f'?'Adopted daughter':person.gender==='m'?'Adopted son':'Adopted child'):(person.gender==='f'?'Daughter':person.gender==='m'?'Son':'Child'):grandchild?(person.gender==='f'?'נכדה':person.gender==='m'?'נכד':'נכד/ה'):adopted?(person.gender==='f'?'בת מאומצת':person.gender==='m'?'בן מאומץ':'ילד/ה מאומצ/ת'):(person.gender==='f'?'בת':person.gender==='m'?'בן':'ילד/ה');
      label=kind+(I18n.isEnglish?' of ':' של ')+shortName(reference.id);
    }else{
      const union=unit.relationships?.find(relation=>relation.people.includes(p.id)&&relation.people.includes(unit.people[0]));
      const relation=union?.relationship||unit.relationship;
      if(!['spouse','former'].includes(relation))return '';
      reference=data.people[unit.people[0]];if(!reference)return '';
      const former=relation==='former';
      const kind=I18n.isEnglish?(former?'Former ':'')+(person.gender==='f'?'wife':person.gender==='m'?'husband':'partner'):former?(person.gender==='f'?'בת זוג לשעבר':person.gender==='m'?'בן זוג לשעבר':'בן/בת זוג לשעבר'):(person.gender==='f'?'אשתו':person.gender==='m'?'בעלה':'בן/בת זוג');
      label=(I18n.isEnglish?kind[0].toUpperCase()+kind.slice(1):kind)+(I18n.isEnglish?' of ':' של ')+shortName(reference.id);
    }
    return `<span class="tree-person-role" data-tree-role="${descendant?'descendant':'partner'}" data-role-person="${safe(reference.id)}" title="${safe(nameOf(reference))}">${safe(label)}</span>`;
  }

  function personCardHTML(p,partnership,unit) {
    const unset = birthdayOf(p) === '1.1.1111',rootPerson=data.units[data.root].people.includes(p.id);
    const partnershipLabel=treePartnershipLabel(p,partnership,unit);
    const partnershipHTML=partnershipLabel?`<span class="person-partnership" data-partnership="${safe(partnership?.relationship||unit.relationship)}">${safe(partnershipLabel)}</span>`:'';
    const founderLink=rootPerson?(window.FamilyFounderTrees?.linkHTML(p.id)||''):'';
    const roleHTML=treeRoleHTML(p,unit);
    if(rootPerson&&!isPhone()){
      const memorial=!scopedViews||p.deceased;
      const label=I18n.t('פתיחת העמוד האישי של ')+nameOf(p);
      return I18n.html`<article class="person-card${memorial?' memorial':''} root-person-card" data-person-card="${p.id}"><div class="root-person-identity"><button class="person-open root-person-portrait" data-person="${p.id}" aria-label="${safe(label)}">${portraitHTML(p)}<span class="person-name">${safe(nameOf(p))}${memorial?I18n.t(' <span class="memorial-inline">ז״ל</span>'):''}</span></button>${roleHTML}<div class="person-birthday root-person-birth${compactTreeYears?' tree-life-years':''}" data-birthday-for="${p.id}" data-birthday-readonly data-birthday-only${compactTreeYears?' data-tree-years':''}>${compactTreeYears?treeLifeYearsHTML(p,false):birthdayHTML(p,false,true)}</div>${partnershipHTML}</div><div class="root-person-details" data-root-history="${p.id}">${compactTreeYears?'':rootHistoryHTML(p)}</div>${founderLink}</article>`;
    }
    return I18n.html`<article class="person-card${p.deceased?' memorial':''}${isPlaceholder(p)?' placeholder-person':''}" data-person-card="${p.id}"><button class="person-open" data-person="${p.id}" aria-label="פתיחת העמוד האישי של ${safe(nameOf(p))}">${portraitHTML(p)}<span class="person-name${nameOf(p).length>17?' long-name':''}">${safe(nameOf(p))}${p.deceased?I18n.t(' <span class="memorial-inline">ז״ל</span>'):''}</span></button>${roleHTML}<div class="person-birthday${unset?' birthday-unset':''}${compactTreeYears?' tree-life-years':''}" data-birthday-for="${p.id}"${rootPerson?' data-birthday-readonly':''}${compactTreeYears?' data-tree-years':''}>${compactTreeYears?treeLifeYearsHTML(p,!rootPerson):birthdayHTML(p,!rootPerson)}</div>${partnershipHTML}${founderLink}</article>`;
  }
  function toast(message,action) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    if(action){const button=document.createElement('button');button.textContent=action.label;button.addEventListener('click',action.run);$('toast').append(button);}
    toastTimer = setTimeout(() => {$('toast').hidden = true;}, action?20000:6000);
  }
  function renderBranches() {
    $('branchBar').innerHTML = I18n.html`<button class="branch-chip all-chip${state.branch==='all'?' active':''}" data-branch="all" aria-pressed="${state.branch==='all'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v6M5 15V9h14v6M12 9v6"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="19" cy="18" r="2"/></svg> כל המשפחה</button>` + (searchBranch ? [...data.branches].sort((a,b) => Number(b.id===searchBranch)-Number(a.id===searchBranch)) : data.branches).map(b => `<button class="branch-chip${state.branch===b.id?' active':''}" data-branch="${b.id}" style="--branch-color:${b.color}" aria-pressed="${state.branch===b.id}"><span class="chip-dot"></span>${safe(I18n.branchName(b))}</button>`).join('');
  }
  function selectBranch(id) {
    $('searchResults').hidden=true;
    state.branch = id;
    if (id !== 'all') state.mode = 'branch';
    else state.mode = 'overview';
    renderBranches(); renderView();
  }
  function setView(view,syncRoute=true) {
    if(!validViews.has(view))return;
    const previous = state.view;
    stopTreeMotion();
    if(syncRoute){const target='#'+view;if(window.FamilyNavigation)window.FamilyNavigation.go(target);else if(location.hash!==target)history.pushState(null,'',target);}
    if($('mobileNavDialog').open)$('mobileNavDialog').close();
    state.view = view;
    if (previous !== view) {state.query='';$('searchInput').value='';}
    $('searchResults').hidden = true;
    renderView({preserveGalleryState:!syncRoute});
    if(previous!==view&&isPhone())window.scrollTo({top:0,behavior:'instant'});
  }
  function renderView({preserveGalleryState=false}={}) {
    document.body.dataset.activeView=state.view;
    document.querySelectorAll('[data-view]').forEach(el => {el.classList.toggle('active',el.dataset.view === state.view);el.setAttribute('aria-pressed',String(el.dataset.view === state.view));});
    if(state.view!=='tree')window.FamilyTreeGuide?.hide();
    const isTree = state.view === 'tree';
    const isDirectory = state.view === 'directory';
    const global = !isTree && !isDirectory;
    $('treeView').hidden = !isTree;
    $('directoryView').hidden = !isDirectory;
    $('branchBar').hidden = global||(isDirectory&&state.directoryGroup!=='main');
    const titles = {search:[I18n.isEnglish?'Family search':'חיפוש משפחתי',I18n.isEnglish?'People, memories and moments from across our home':'אנשים, זיכרונות ורגעים מכל הבית שלנו'],voices:[I18n.t('בקולם'),I18n.t('הקולות והסיפורים של המשפחה שלנו')],'family-ai':[I18n.t('בינה משפחתית'),I18n.t('רגעים של פעם מתעוררים לחיים')],screensaver:[I18n.t('שומר מסך משפחתי'),I18n.t('כל המשפחה, זיכרון אחרי זיכרון')],timeline:[I18n.t('ציר זמן משפחתי'),I18n.t('דורות של אנשים ורגעים, עשור אחר עשור')],nursery:[I18n.t('התינוקייה'),I18n.t('ההתחלה של כולנו')],games:[I18n.isEnglish?'Family Games':'משחקי משפחה',I18n.isEnglish?'The faces that make us a family':'מכירים את הפנים שמרכיבות את המשפחה'],memorial:[I18n.t('לזכרם'),I18n.t('הזיכרונות נשארים איתנו')],person:[I18n.t('עמוד אישי'),I18n.t('סיפור חיים, תמונות וזיכרונות')],updates:[I18n.t('הרשמה לעדכונים'),I18n.t('תזכורות משפחתיות, ישר למייל')],home:[I18n.t('הבית שלנו'),I18n.t('כל המשפחה, במקום אחד')],gallery:[I18n.t('הגלריה המשפחתית'),I18n.t('תמונות, אנשים ורגעים ששומרים יחד')],calendar:[I18n.t('לוח שנה משפחתי'),I18n.t('השנה המשפחתית שלנו')],tree:[I18n.t('האילן המשפחתי'),(scopedViews?(document.documentElement?.dataset?.shlomoKeha==='true'?(I18n.isEnglish?'The family of Shlomo and Yona Keha':'המשפחה של שלמה ויונה קהא'):(I18n.isEnglish?'Four branches from shared roots':'משורש משותף, ארבעה ענפים')):I18n.t('משורש משותף, שישה ענפים של אהבה'))],directory:[I18n.t('כל בני המשפחה'),I18n.t('האלבומים וימי ההולדת של כולנו')],videos:[I18n.t('סרטוני המשפחה'),I18n.t('הקולות, הצחוק והרגעים שנשארים איתנו')],photos:[I18n.t('תמונות משפחתיות'),I18n.t('אלבום אחד, אינספור זיכרונות משותפים')],stories:[I18n.t('הסיפורים שלנו'),I18n.t('יומן משפחתי, מהעבר ועד היום')],weddings:[I18n.t('החתונות שלנו'),I18n.t('סיפורי האהבה, הברכות והרגעים מהיום המיוחד')],nostalgia:[I18n.t('פינת הנוסטלגיה'),I18n.t('תמונות, סרטים ומכתבים שמחזירים אותנו הביתה')]};
    titles.documents=[I18n.isEnglish?'Documents and rare recordings':(scopedViews?'מסמכים ותיעודים':'תעודות מסמכים ותיעודים נדירים'),I18n.isEnglish?'Original records, certificates and voices from our past':'תעודות, מסמכים היסטוריים והקלטות ששומרים לדורות'];
    const [title,subtitle] = titles[state.view] || titles.tree;
    $('workspaceTitle').textContent = title;
    $('mobileViewTitle').textContent=title;
    const portal=document.documentElement?.dataset?.branchPortal;
    const portalSubtitle=portal?(I18n.isEnglish?document.documentElement.dataset.branchTaglineEn:document.documentElement.dataset.branchTagline):null;
    $('workspaceSubtitle').textContent = isTree&&portalSubtitle?portalSubtitle:subtitle;
    const workspaceDetail=$('workspaceDetail');workspaceDetail.hidden=state.view!=='calendar';workspaceDetail.textContent=state.view==='calendar'?I18n.t('ימי הולדת, חגים ומועדים בלוח עברי ולועזי'):'';
    $('searchInput').placeholder = state.view==='videos' ? (I18n.isEnglish?'Search':'חיפוש') : state.view==='timeline' ? I18n.t('חיפוש בשם או בשנת לידה') : state.view==='nursery' ? I18n.t('חיפוש בן או בת משפחה') : global ? state.view==='stories'?(isPhone()?(I18n.isEnglish?'Search stories':'חיפוש סיפורים'):I18n.t('חיפוש בסיפורים ובשנים')):I18n.t('חיפוש לפי כיתוב, שם קובץ או אדם') : I18n.t('חיפוש בן או בת משפחה');
    const searchWrap=$('searchInput').closest?.('.search-wrap');if(searchWrap)searchWrap.hidden=state.view==='family-ai';
    $('searchInput').setAttribute('aria-label', state.view==='nursery'?I18n.t('חיפוש בני משפחה'):global?I18n.t('חיפוש בתוכן המשפחתי'):I18n.t('חיפוש בני משפחה'));
    window.FamilySiteSearch?.activate(state.view);
    window.FamilyPortal?.activate(state.view,{preserveGalleryState});
    window.FamilyMemories?.activate(state.view);
    window.FamilyDocuments?.activate(state.view);
    window.FamilyArchive?.activate(state.view);
    window.FamilyCalendar?.activate(state.view);
    window.FamilyTimeline?.activate(state.view);
    window.FamilyHome?.activate(state.view);
    window.FamilyFounderTrees?.activate(state.view);
    window.FamilyScreensaver?.activate(state.view);
    window.FamilyAI?.activate(state.view);
    window.FamilyUpdates?.activate(state.view);
    window.FamilyPeople?.activate(state.view);
    window.FamilyMemorial?.activate(state.view);
    window.FamilyNursery?.activate(state.view);
    window.FamilyGames?.activate(state.view);
    if (isTree) renderTree(); else if (isDirectory) renderDirectory();
  }
  function inBranch(person,id){return id==='all'||person.branch===id||person.branches?.includes(id);}
  function directoryMatches(query) {
    return people.filter(p => (state.directoryGroup==='friends'?p.extra&&getMedia(p).mediaCount>0:state.directoryGroup==='extended'?p.extended&&!p.extra:!p.extended&&!p.extra) && (state.directoryGroup!=='main'||inBranch(p,state.branch)) && (!query || normalize(I18n.searchNames({...p,...getMedia(p)})).includes(query))).sort(searchFamilyOrder);
  }
  function renderDirectory() {
    const query = normalize(state.query);
    document.querySelectorAll('[data-directory-group]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.directoryGroup===state.directoryGroup)));
    $('branchBar').hidden=state.directoryGroup!=='main';
    $('directoryHelp').textContent=I18n.t(state.directoryGroup==='friends'?'לחיצה על כרטיס פותחת את התמונות שבהן תויגו':'לחיצה על כרטיס פותחת את העמוד האישי');
    const selected = directoryMatches(query);
    $('directoryCount').textContent = I18n.html`${selected.length} ${I18n.isEnglish?I18n.word(selected.length,'card','cards'):I18n.t('כרטיסים')}${state.directoryGroup==='main'&&state.branch!=='all'?' · '+I18n.branchName(branchFor(state.branch)):''}`;
    $('directoryGrid').innerHTML = selected.map(p=>I18n.html`<article class="directory-card${p.deceased?' memorial':''}" data-person-card="${p.id}"><button class="directory-open" data-person="${p.id}" aria-label="${p.extra?I18n.t('פתיחת האלבום של '):I18n.t('פתיחת העמוד האישי של ')}${safe(nameOf(p))}">${portraitHTML(p)}<strong>${safe(nameOf(p))}${p.deceased?I18n.t(' <span class="memorial-inline">ז״ל</span>'):''}</strong><span class="directory-branch">${safe(branchTitle(p))}</span></button><div class="directory-date"${p.extra?'':` data-birthday-for="${p.id}"`}>${p.extra?I18n.html`${getMedia(p).photoCount||0} ${I18n.t((getMedia(p).photoCount||0)===1?'תמונה מתויגת':'תמונות מתויגות')}`:birthdayHTML(p)}</div></article>`).join('');
    $('emptySearch').textContent=I18n.t(state.directoryGroup==='friends'&&!query?'מכרים וחברי משפחה יופיעו כאן אוטומטית אחרי תיוג בשם חדש.':'לא נמצאו שמות מתאימים. נסו לחפש בשם הפרטי.');
    $('emptySearch').hidden = selected.length > 0;
  }

  function treePeopleHTML(unit) {
    if(unit.siblingGroup)return `<div class="tree-sibling-group"><strong>${I18n.isEnglish?'Ten siblings':'עשרת האחים'}</strong><span>${I18n.isEnglish?'Ora’s family testimony · parents under research':'עדות אורה · ההורים בבירור'}</span></div>`;
    const display=unit.displayPeople||unit.people;
    const cards=display.map(id=>personCardHTML(data.people[id],id===unit.people[0]?null:unit.relationships?.find(item=>item.people.includes(id)),unit)).join('');
    if(!unit.relationships)return cards;
    const links=unit.relationships.filter(item=>item.people.length>1).map(item=>{
      const coordinates=item.people.map(id=>{
        const coordinate=(display.indexOf(id)+.5)/display.length*100;
        return I18n.isEnglish?coordinate:100-coordinate;
      });
      return `<path class="${safe(item.relationship)}" d="M${Math.min(...coordinates)} 6H${Math.max(...coordinates)}"/>`;
    }).join('');
    return `<svg class="tree-partnerships" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">${links}</svg>`+cards;
  }

  function renderTree(preserveCamera=false) {
    if(window.FamilyExtendedKeha?.renderTree(state))return;
    window.FamilyTreeGuide?.hide();
    const textScale=treeTextScale(),viewport=$('treeViewport'),renderVersion=++treeRenderVersion;
    const previous=preserveCamera&&treeCameraApplied&&camera.width&&camera.height?{scale:camera.scale,x:(viewport.clientWidth/2-camera.x)/(camera.width*camera.scale),y:(viewport.clientHeight/2-camera.y)/(camera.height*camera.scale)}:null;
    const phone=isPhone(),overview=state.branch==='all'&&state.mode==='overview';
    const rootId=state.branch==='all'?data.root:branchFor(state.branch).unit;
    const rootHistorySpace=!compactTreeYears&&!phone&&data.units[rootId].people.some(id=>data.people[id].aliyahYear)?40*textScale:0;
    const desktopOverview=!phone&&overview;
    const gap=(phone?20:desktopOverview?20:36)*textScale,levelHeight=(phone?223:desktopOverview?303:372)*textScale,top=(phone?40:desktopOverview?45:70)*textScale,pad=(phone?25:desktopOverview?32:48)*textScale;
    const positions=[],lines=[],connections=[],widths=new Map(),layouts=new Map();
    const children=unit=>overview&&unit.id!==data.root?[]:unit.children;
    const nodeWidth=unit=>(unit.siblingGroup?(phone?240:300):adaptiveTreeLayout?unit.people.length*(phone?136:146)+Math.max(0,unit.people.length-1)*(phone?14:28):!phone&&unit.id===data.root?788:unit.people.length>=2?(phone?174:desktopOverview?300:320)+(unit.people.length-2)*(phone?90:desktopOverview?160:174):(phone?80:desktopOverview?132:146))*textScale;
    function measure(id){
      const unit=data.units[id],kids=children(unit),childLefts=new Map();
      kids.forEach(measure);
      const rowWidth=row=>row.reduce((sum,child)=>sum+widths.get(child),0)+Math.max(0,row.length-1)*gap;
      const row=(ids,left,span,rtl=true)=>{
        let cursor=rtl?left+span:left;
        for(const child of ids){const w=widths.get(child);childLefts.set(child,rtl?cursor-w:cursor);cursor+=(rtl?-1:1)*(w+gap);}
      };
      let width,anchor;
      if(unit.splitPartnerships&&kids.length){
        // Keep each marriage's whole subtree on its partner's side of the
        // central parent. Children with no identified mother stay in the middle.
        const display=unit.displayPeople||unit.people,pivot=display.indexOf(unit.people[0]),sides={before:[],after:[],middle:[]};
        for(const child of kids){
          const relation=unit.relationships?.find(item=>item.children.includes(child));
          const partner=relation?.people.find(person=>person!==unit.people[0]);
          sides[partner?(display.indexOf(partner)<pivot?'before':'after'):'middle'].push(child);
        }
        const left=I18n.isEnglish?sides.before:sides.after,right=I18n.isEnglish?sides.after:sides.before;
        const lw=rowWidth(left),rw=rowWidth(right),cw=Math.max(nodeWidth(unit),rowWidth(sides.middle));
        const centerLeft=lw+(left.length?gap:0);
        anchor=centerLeft+cw/2;width=centerLeft+cw+(right.length?gap:0)+rw;
        row(left,0,lw,!I18n.isEnglish);
        row(sides.middle,centerLeft+(cw-rowWidth(sides.middle))/2,rowWidth(sides.middle),!I18n.isEnglish);
        row(right,centerLeft+cw+(right.length?gap:0),rw,!I18n.isEnglish);
      }else{
        const total=rowWidth(kids),childAnchor=kids.length===1?layouts.get(kids[0]).anchor:total/2;
        const before=Math.max(0,nodeWidth(unit)/2-childAnchor),after=Math.max(0,childAnchor+nodeWidth(unit)/2-total);
        width=before+total+after;anchor=before+childAnchor;
        row(kids,before,total);
      }
      widths.set(id,width);layouts.set(id,{anchor,childLefts});return width;
    }
    function place(id,left,depth,spacing=0){
      const unit=data.units[id],layout=layouts.get(id),x=left+layout.anchor,y=top+depth*levelHeight+(depth?rootHistorySpace:0)+spacing,partnershipSpace=phone&&unit.relationships?100*textScale:0;
      positions.push({id,unit,x,y,width:nodeWidth(unit),depth});const kids=children(unit),centers=[];
      for(const child of kids){const childLeft=left+layout.childLefts.get(child);centers.push(childLeft+layouts.get(child).anchor);place(child,childLeft,depth+(data.units[child].parentage==='grandchild'?2:1),spacing+partnershipSpace);}
      if(kids.length){
        const display=unit.displayPeople||unit.people,groups=(unit.relationships||[]).map(union=>({union,kids:kids.filter(child=>union.children.includes(child))})).filter(group=>group.kids.length);
        const assigned=new Set(groups.flatMap(group=>group.kids)),remaining=kids.filter(child=>!assigned.has(child));
        if(remaining.length)groups.push({union:null,kids:remaining});
        groups.forEach(({union,kids:groupKids},index)=>{
          const offset=union?union.people.reduce((sum,id)=>sum+(display.indexOf(id)+.5)/display.length,0)/union.people.length-.5:0;
          connections.push({id,x:x+(I18n.isEnglish?1:-1)*offset*nodeWidth(unit),y,centers:groupKids.map(child=>centers[kids.indexOf(child)]),depth,partnershipSpace,
            parentPeople:union?.people,parentRelationship:union?.relationship,childUnits:groupKids,depthStep:union?.relationship==='grandparent'?2:1,lane:(index-(groups.length-1)/2)*14*textScale});
        });
      }
    }
    let width,height;
    if(phone&&overview&&!adaptiveTreeLayout){
      width=520*textScale;height=(scopedViews&&data.branches.length<=4?570:740)*textScale;const root=data.units[data.root];positions.push({id:root.id,unit:root,x:260*textScale,y:45*textScale,width:174*textScale,depth:0});lines.push(`<path d="M${260*textScale} ${158*textScale}V${(scopedViews&&data.branches.length<=4?360:530)*textScale}"/>`);
      data.branches.forEach((branch,index)=>{const x=(index%2===0?380:140)*textScale,y=(220+Math.floor(index/2)*170)*textScale,unit=data.units[branch.unit];positions.push({id:unit.id,unit,x,y,width:174*textScale,depth:1});lines.push(`<path d="M${260*textScale} ${y-30*textScale}H${x}V${y-10*textScale}"/>`);});
    }else{width=measure(rootId)+2*pad;place(rootId,pad,0);height=Math.max(...positions.map(item=>item.y))+((phone?150:desktopOverview?260:overview?316:278)+30)*textScale;}
    camera.width=width;camera.height=height;const world=$('treeWorld');$('treeViewport').dataset.overview=String(overview);world.style.setProperty('--a11y-tree-scale',String(textScale));world.style.width=width+'px';world.style.height=height+'px';
    $('treeNodes').innerHTML=positions.map(({unit,x,y,width:w,depth})=>{const branch=branchFor(unit.branch);let label='';if(unit.id!==data.root&&(depth===0||overview))label=`<span class="branch-label" style="--branch-color:${branch?.color||'#a2824c'}">${safe(I18n.branchName(branch)||'')}</span>`;if(unit.parentage==='adopted')label=`<span class="branch-label">${I18n.isEnglish?'Adopted son':'בן מאומץ'}</span>`;if(unit.parentage==='grandchild')label=`<span class="branch-label">${I18n.isEnglish?'Grandson · father under research':'נכד · האב בבירור'}</span>`;if(scopedViews&&unit.relationship==='former')label=`<span class="branch-label" style="--branch-color:${branch?.color||'#a2824c'}">${I18n.isEnglish?'Former partners':'בני זוג לשעבר'}</span>`;const open=overview&&unit.id!==data.root?I18n.html`<button class="branch-open" data-open-branch="${unit.branch}" style="--branch-color:${branch.color}" aria-label="פתיחת ${safe(I18n.branchName(branch))}">${safe(I18n.branchName(branch))} <span class="branch-count">${people.filter(person=>inBranch(person,unit.branch)&&!isPlaceholder(person)).length}</span>${arrow}</button>`:'';return `<div class="tree-unit${unit.people.length===2?' couple':''}" data-unit="${treeUnitKey(unit.id)}" style="left:${x-w/2}px;top:${y}px;width:${w}px">${label}${unit.people.length===2?'<span class="union-diamond" aria-hidden="true"></span>':''}${treePeopleHTML(unit)}${open}</div>`;}).join('');
    let rootSpacingAdjustment=0,rootContentHeight=0;
    if(!phone&&rootHistorySpace){
      const rootElement=world.querySelector(`[data-unit="${treeUnitKey(rootId)}"]`),firstChild=positions.find(item=>item.depth===1);
      if(rootElement&&firstChild){
        // Reserve space below the actual dates for the connector and branch labels.
        rootContentHeight=rootElement.offsetHeight;
        rootSpacingAdjustment=Math.max(0,top+rootContentHeight+96*textScale-firstChild.y);
        if(rootSpacingAdjustment){
          for(const item of positions)if(item.depth>0){item.y+=rootSpacingAdjustment;world.querySelector(`[data-unit="${treeUnitKey(item.id)}"]`).style.top=item.y+'px';}
          for(const connection of connections)if(connection.depth>0)connection.y+=rootSpacingAdjustment;
          height+=rootSpacingAdjustment;camera.height=height;world.style.height=height+'px';
        }
      }
    }
    if(compactTreeYears){
      // Text wrapping and browser font enlargement can make a generation taller
      // than its nominal row. Measure the rendered cards before drawing lines.
      const depths=[...new Set(positions.map(item=>item.depth))].sort((a,b)=>a-b);
      let previousBottom=null;
      for(const depth of depths){
        const row=positions.filter(item=>item.depth===depth),rowTop=Math.min(...row.map(item=>item.y));
        const shift=previousBottom===null?0:Math.max(0,previousBottom+72*textScale-rowTop);
        for(const item of row){
          item.y+=shift;
          world.querySelector(`[data-unit="${treeUnitKey(item.id)}"]`).style.top=item.y+'px';
        }
        previousBottom=Math.max(...row.map(item=>item.y+(world.querySelector(`[data-unit="${treeUnitKey(item.id)}"]`).offsetHeight||0)));
      }
      for(const connection of connections)connection.y=positions.find(item=>item.id===connection.id).y;
      height=Math.max(height,previousBottom+48*textScale);camera.height=height;world.style.height=height+'px';
    }
    if(desktopOverview){
      const buttons=[...world.querySelectorAll('.branch-open')];
      if(buttons.length){
        // Keep every branch button below the tallest card, including memorial dates.
        const captionTop=Math.max(...buttons.map(button=>button.offsetTop),...buttons.flatMap(button=>[...button.parentElement.querySelectorAll('.person-card')].map(card=>card.offsetHeight+14*textScale)));
        for(const button of buttons){
          button.style.top=captionTop+'px';
          height=Math.max(height,button.parentElement.offsetTop+captionTop+button.offsetHeight+24*textScale);
        }
        camera.height=height;world.style.height=height+'px';
      }
    }
    const incomingAnchor=childId=>{
      const child=data.units[childId],position=positions.find(item=>item.id===childId);
      if(!child||!position)return null;
      const node=world.querySelector(`[data-unit="${treeUnitKey(childId)}"] [data-person-card="${child.people[0]}"] .portrait`);
      const rect=node?.getBoundingClientRect?.(),worldRect=world.getBoundingClientRect?.();
      if(rect?.width&&worldRect?.width)return (rect.left+rect.width/2-worldRect.left)*width/worldRect.width;
      const display=child.displayPeople||child.people,slot=(display.indexOf(child.people[0])+.5)/display.length-.5;
      return position.x+(I18n.isEnglish?1:-1)*slot*position.width;
    };
    for(const {id,x,y,centers,depth,partnershipSpace=0,parentPeople,parentRelationship,childUnits,depthStep=1,lane=0} of connections){
      const targets=childUnits.map(childId=>({unit:childId,person:data.units[childId].people[0],x:incomingAnchor(childId),y:positions.find(item=>item.id===childId).y}));
      const childCenters=targets.map(target=>target.x);
      const extra=(depth===0?rootHistorySpace+rootSpacingAdjustment:0)+partnershipSpace,historyRoot=depth===0&&rootContentHeight>0;
      // Join the parents' relationship line; label clearance belongs below them.
      const contentBottom=y+(world.querySelector(`[data-unit="${treeUnitKey(id)}"]`).offsetHeight||0);
      const start=parentPeople?.length>1?y+(phone?37:76)*textScale:compactTreeYears?contentBottom+12*textScale:historyRoot?y+rootContentHeight+12*textScale:y+(phone?115:261)*textScale+extra;
      const middle=(compactTreeYears?Math.max(contentBottom+28*textScale,Math.min(...targets.map(target=>target.y))-40*textScale):historyRoot?y+levelHeight+extra-60*textScale:y+(phone?155:294)*textScale+extra)+lane,end=y+levelHeight*depthStep-7*textScale+extra;
      if(parentPeople)lines.push(`<g data-parent-unit="${safe(id)}" data-parent-people="${safe(parentPeople.join(' '))}" data-child-units="${safe(childUnits.join(' '))}" data-parent-relationship="${safe(parentRelationship)}"${parentRelationship==='grandparent'?' stroke-dasharray="6 5"':''}>`);
      lines.push(`<path d="M${x} ${start}V${middle}"/><circle class="connector-start" cx="${x}" cy="${start}" r="2.5"/>`);
      if(parentPeople||childCenters.length>1)lines.push(`<path d="M${Math.min(x,...childCenters)} ${middle}H${Math.max(x,...childCenters)}"/>`);
      for(const target of targets)lines.push(`<path class="descendant-connector" data-child-unit="${safe(target.unit)}" data-child-person="${safe(target.person)}" d="M${target.x} ${middle}V${compactTreeYears?target.y-7*textScale:end}"/>`);
      if(parentPeople)lines.push('</g>');
    }
    $('treeConnectors').setAttribute('width',width);$('treeConnectors').setAttribute('height',height);$('treeConnectors').innerHTML=lines.join('');

    const roots=scopedViews?(window.FamilyExtendedKeha?.title?.()||data.units[data.root].people.map(id=>nameOf(data.people[id])).join(' · ')):I18n.t('יונה ושלמה');
    const branchesLabel=scopedViews?(I18n.isEnglish?'All the family · '+data.branches.length+' branches':'כל המשפחה · '+data.branches.length+' ענפים'):I18n.t('כל המשפחה · ששת הענפים');
    $('treeBreadcrumb').textContent=state.branch==='all'?(overview?branchesLabel:I18n.t('כל המשפחה · כל הדורות')):roots+' › '+I18n.branchName(branchFor(state.branch));
    for(const [id,selected]of [['overviewButton',overview],['fullTreeButton',!overview]]){$(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));}
    const guidance=overview?I18n.t('גררו ימינה ושמאלה בין הענפים'):I18n.t('גררו את העץ כדי לטייל בין הדורות · + להתקרבות');
    $('treeHelpInline').textContent=phone?'':guidance;
    $('canvasHint').innerHTML=phone?I18n.t('<span aria-hidden="true">✧</span> צבטו להגדלה · גררו לטיול בין הענפים'):'';
    requestAnimationFrame(()=>{if(state.view!=='tree'||renderVersion!==treeRenderVersion)return;const viewport=$('treeViewport');if(previous){camera.scale=previous.scale;camera.x=viewport.clientWidth/2-previous.x*width*camera.scale;camera.y=viewport.clientHeight/2-previous.y*height*camera.scale;clampCamera();}else{const fit=Math.min((viewport.clientWidth-(desktopOverview?28:30))/width,(viewport.clientHeight-(desktopOverview?24:70))/height,desktopOverview?1:1.06);camera.scale=phone?fit*textScale:desktopOverview?0.7:Math.max(.9,Math.min(1.06,fit));camera.x=(viewport.clientWidth-width*camera.scale)/2;camera.y=phone?Math.max(12,(viewport.clientHeight-60-height*camera.scale)/2):desktopOverview?Math.max(8,Math.min(18,(viewport.clientHeight-height*camera.scale)/2)):25;}treeCameraApplied=true;applyCamera();window.FamilyTreeGuide?.show();});
  }
  function applyCamera(){
    $('treeWorld').style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
    $('zoomValue').textContent=Math.round(camera.scale*100)+'%';
  }
  function stopTreeMotion(){if(motionFrame)cancelAnimationFrame(motionFrame);motionFrame=0;}
  window.addEventListener('family-accessibility-changed',()=>{if(reducedMotion())stopTreeMotion();const next=treeTextScale();if(next!==observedTextScale){observedTextScale=next;if(state.view==='tree')renderTree(true);}});
  function clampCamera(){
    if(!isPhone())return;const viewport=$('treeViewport'),w=camera.width*camera.scale,h=camera.height*camera.scale;
    camera.x=w<viewport.clientWidth-20?(viewport.clientWidth-w)/2:Math.max(viewport.clientWidth-w-65,Math.min(65,camera.x));
    camera.y=h<viewport.clientHeight-40?Math.max(10,(viewport.clientHeight-55-h)/2):Math.max(viewport.clientHeight-h-65,Math.min(65,camera.y));
  }
  function zoom(factor,cx,cy){
    stopTreeMotion();const viewport=$('treeViewport');cx=cx??viewport.clientWidth/2;cy=cy??viewport.clientHeight/2;
    const old=camera.scale;camera.scale=Math.max(isPhone() ? .035 : .08,Math.min(isPhone()?3.5:2.4,old*factor));camera.x=cx-(cx-camera.x)*camera.scale/old;camera.y=cy-(cy-camera.y)*camera.scale/old;clampCamera();applyCamera();
  }
  function fitTree(){stopTreeMotion();const viewport=$('treeViewport'),desktopOverview=!isPhone()&&state.branch==='all'&&state.mode==='overview';camera.scale=Math.min((viewport.clientWidth-(desktopOverview?28:30))/camera.width,(viewport.clientHeight-(desktopOverview?24:75))/camera.height,desktopOverview?1:1.1);camera.x=(viewport.clientWidth-camera.width*camera.scale)/2;camera.y=desktopOverview?Math.max(8,Math.min(18,(viewport.clientHeight-camera.height*camera.scale)/2)):Math.max(12,(viewport.clientHeight-55-camera.height*camera.scale)/2);applyCamera();}

  const apiEnabled = window.LOCAL_FAMILY_SERVER === true;
  const drafts = new Map();
  const uploads = [];
  let uploadRunning = false;
  let galleryRevision = null;
  let gallerySignature = '';
  let galleryLoading = false;
  let mediaLoading = false;
  let mediaRevision=null,mediaLoadedAt=0,mediaDirty=false;
  const keyFor = (personId, file) => personId + '\u001f' + file;
  const imageTypes = /\.(jpe?g|png|webp|gif|avif)$/i;

  function updatePersonUI(personId, item) {
    let p = data.people[personId];
    if(!p&&item.extra){p={id:personId,name:item.name,firstName:item.name,lastName:'',extra:true,birthday:item.birthday||'1.1.1111',branch:null,generation:null,placeholder:false};data.people[personId]=p;people.push(p);}
    if(!p)return;
    const previous = getMedia(p);
    media.set(personId, {...previous, ...item});
    if(previous.profile!==item.profile||previous.profileFile!==item.profileFile)window.dispatchEvent(new CustomEvent('family-profile-changed',{detail:{id:personId}}));
    for(const field of ['deathDate','deathYear','deathYearSource','deathYearSourceEn','birthYear','birthYearMin','birthYearMax','birthYearSource','birthYearSourceEn','lifeRecords'])if(field in item)p[field]=item[field];
    if('deceased' in item)p.deceased=item.deceased;
    if('aliyahYear' in item)p.aliyahYear=item.aliyahYear;
    if('aliyahMonth' in item)p.aliyahMonth=item.aliyahMonth;
    if((previous.birthday||p.birthday)!==birthdayOf(p)||(previous.name||p.name)!==(item.name||p.name))window.dispatchEvent(new CustomEvent('family-person-changed',{detail:{id:personId}}));
    for (const node of document.querySelectorAll('[data-person], [data-search-person]')) {
      if ((node.dataset.person||node.dataset.searchPerson) !== personId) continue;
      if (previous.profile !== item.profile) {
        const portrait = node.querySelector('.portrait');
        if (portrait) portrait.outerHTML = portraitHTML(p);
      }
      const name = node.querySelector('.person-name');
      if (name) name.innerHTML = safe(nameOf(p)) + (p.deceased ? I18n.t(' <span class="memorial-inline">ז״ל</span>') : '');
      const strong = node.querySelector('strong');
      if (strong) strong.innerHTML = safe(nameOf(p)) + (p.deceased ? I18n.t(' <span class="memorial-inline">ז״ל</span>') : '');
      const birthday = node.closest('[data-person-card]')?.querySelector('[data-birthday-for]');
      const person={...p,...getMedia(p)},signature=[birthdayOf(p),person.invalidBirthday,person.deceased,person.deathDate,person.deathYear,person.birthYear,person.birthYearMin,person.birthYearMax,JSON.stringify(person.lifeRecords),new Date().toDateString()].join('|');
      if (birthday && birthday.dataset.dateSignature !== signature) {birthday.innerHTML=birthday.hasAttribute('data-tree-years')?treeLifeYearsHTML(p,!birthday.hasAttribute('data-birthday-readonly')):birthdayHTML(p,!birthday.hasAttribute('data-birthday-readonly'),birthday.hasAttribute('data-birthday-only'));birthday.dataset.dateSignature=signature;}
      const history=node.closest('.root-person-card')?.querySelector('[data-root-history]');if(history)history.innerHTML=compactTreeYears?'':rootHistoryHTML(p);
      node.setAttribute('aria-label', I18n.t('פתיחת העמוד האישי של ') + nameOf(p));
    }
    if (state.currentPerson === personId && $('personDialog').open) {
      $('galleryTitle').textContent = I18n.t('הגלריה של ') + nameOf(p);
      const profileDate=$('profileBirthday'),signature=[birthdayOf(p),getMedia(p).invalidBirthday,p.deceased,p.deathDate,p.deathYear,p.birthYear,p.birthYearMin,p.birthYearMax,JSON.stringify(p.lifeRecords),new Date().toDateString()].join('|');
      if(profileDate && profileDate.dataset.dateSignature!==signature){profileDate.innerHTML=birthdayHTML(p);profileDate.dataset.dateSignature=signature;}
    }
  }

  function openPerson(personId) {
    personId=data.identities?.[personId] || personId;
    if(window.FamilyPeople){window.FamilyPeople.open(personId);return;}
    if (!data.people[personId]) return;
    if($('calendarDayDialog').open)$('calendarDayDialog').close();
    flushDrafts();
    state.currentPerson = personId;
    state.galleryFilter = 'all';
    state.gallery = [];
    galleryRevision = null;
    gallerySignature = '';
    const p = data.people[personId];
    $('personBody').innerHTML = I18n.html`<header class="gallery-header"><div><h2 id="galleryTitle">הגלריה של ${safe(nameOf(p))}</h2><div class="profile-birthday" id="profileBirthday">${birthdayHTML(p)}</div><span id="galleryCount" class="gallery-count"></span></div></header><section class="photo-dropzone${apiEnabled ? '' : ' offline'}" id="photoDropzone" aria-label="אזור להעלאת תמונות"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 27v7h26v-7M20 28V6m-8 8 8-8 8 8"/></svg><button class="primary-button upload-photos" id="uploadPhotos" ${apiEnabled ? '' : 'disabled'}>הוספת תמונות</button><button class="secondary-button mobile-camera" id="capturePersonPhoto" ${apiEnabled ? '' : 'disabled'}>צילום תמונה</button><span>בחרו תמונות מהגלריה או מהמצלמה<span class="desktop-paste"> · אפשר לגרור לכאן או להדביק צילום עם <bdi>Ctrl+V</bdi></span></span></section><div id="uploadState" class="upload-state" role="status"></div><div class="archive-filters personal-gallery-filters" id="personalMediaFilters" aria-label="סינון האלבום האישי"><button data-person-media-filter="all" aria-pressed="true">הכול</button><button data-person-media-filter="photo" aria-pressed="false">תמונות</button><button data-person-media-filter="video" aria-pressed="false">סרטונים</button></div><div class="photo-gallery-grid" id="galleryGrid"></div><div class="gallery-empty-state" id="galleryEmpty" ${apiEnabled ? 'hidden' : ''}>${apiEnabled ? I18n.t('אין עדיין תמונות בגלריה') : I18n.t('השמירה אינה זמינה כרגע')}</div>`;
    if (!$('personDialog').open) $('personDialog').showModal();
    $('personDialog').scrollTop = 0;
    const cached = getMedia(p);
    if (Array.isArray(cached.gallery)) renderGallery(cached);
    if (apiEnabled) refreshOpenGallery(true);
  }

  function draftStatus(personId, file, text, failed=false) {
    if (state.currentPerson !== personId || !$('personDialog').open) return;
    const area = Array.from($('galleryGrid').querySelectorAll('textarea')).find(el => el.dataset.captionFile === file);
    if (!area) return;
    const status = area.closest('.gallery-photo').querySelector('[data-caption-status]');
    status.textContent = text;
    status.classList.toggle('save-error', failed);
  }

  function renderGallery(item) {
    if (!Array.isArray(item.gallery)) return;
    const personId=state.currentPerson,scope='personal:'+personId;
    const items=item.gallery.filter(media=>state.galleryFilter==='all'||media.kind===state.galleryFilter);
    state.gallery=items;window.FamilyMedia.register(scope,items);
    const photoCount=item.photoCount??item.gallery.filter(media=>media.kind==='photo').length,videoCount=item.videoCount||0;
    $('galleryCount').textContent=[photoCount?(photoCount===1?I18n.t('תמונה אחת'):photoCount+I18n.t(' תמונות')):'',videoCount?(videoCount===1?I18n.t('סרטון אחד'):videoCount+I18n.t(' סרטונים')):''].filter(Boolean).join(' · ');
    $('galleryEmpty').hidden=items.length>0;
    $('galleryEmpty').textContent=item.gallery.length?I18n.t('אין פריטים בבחירה הזו. אפשר לבחור בסוג אחר.'):I18n.t('אין עדיין תמונות או סרטונים באלבום');
    $('personalMediaFilters').querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.personMediaFilter===state.galleryFilter)));
    const grid=$('galleryGrid'),previous=new Map([...grid.children].map(card=>[card.dataset.mediaFile,card])),cards=[];
    for(const item of items){
      let card=previous.get(item.file);
      if(!card||card.dataset.mediaSrc!==item.src){
        card=document.createElement('article');card.className='gallery-photo';card.dataset.mediaFile=item.file;card.dataset.mediaSrc=item.src;
        let viewer;
        if(item.provider==='youtube')viewer=I18n.html`<button class="personal-video-cover" data-media-open="${safe(item.id)}" data-media-scope="${safe(scope)}" aria-label="ניגון ${safe(I18n.mediaName(item))} בגלריה"><span aria-hidden="true">▶</span><strong>${safe(I18n.mediaName(item))}</strong></button>`;
        else if(item.kind==='video')viewer=I18n.html`<video class="person-gallery-video" controls playsinline preload="none" ${item.poster?`poster="${safe(item.poster)}"`:''} data-preview-src="${safe(window.FamilyVideoDelivery?.src(item)||item.faststartSrc||item.src)}" aria-label="${safe(I18n.mediaName(item))}"></video><p class="video-codec-note" hidden>הסרטון לא מתנגן בדפדפן הזה. אפשר לפתוח אותו בגלריה ולהוריד את המקור.</p><div class="personal-media-name">${safe(I18n.mediaName(item))}</div>`;
        else viewer=I18n.html`<button class="gallery-image" data-media-open="${safe(item.id||item.file)}" data-media-scope="${safe(scope)}" aria-label="פתיחת התמונה ${safe(I18n.mediaName(item))}"><img src="${safe(item.thumbnailSrc||item.src)}" ${window.FamilyPhotoThumbnails?.attributes(item)||''} alt="${safe(item.caption||I18n.mediaName(item))}" loading="lazy" decoding="async"></button>`;
        const captionId='caption-'+personId+'-'+encodeURIComponent(item.file);
        card.innerHTML=viewer+(item.linked?I18n.t('<p class="linked-media-note">מופיע באלבום הזה בזכות תיוג</p>'):'')+window.FamilyMedia.controls(item,scope)+I18n.html`<div class="caption-editor"><label class="visually-hidden" for="${safe(captionId)}">כיתוב ל${item.kind==='video'?I18n.t('סרטון'):I18n.t('תמונה')} ${safe(I18n.mediaName(item))}</label><textarea dir="auto" id="${safe(captionId)}" data-caption-file="${safe(item.file)}" data-owner="${personId}" rows="2" maxlength="5000" placeholder="מי מופיע כאן? איפה ומתי? כתבו כאן…" ${apiEnabled?'':'disabled'}></textarea><div class="caption-toolbar"><span data-caption-status role="status"></span><button data-save-caption="${safe(item.file)}" data-owner="${personId}">שמירה</button></div></div>`;
        const player=card.querySelector('video');
        player?.addEventListener('error',()=>{card.querySelector('.video-codec-note').hidden=false;});
        for(const event of ['loadeddata','canplay'])player?.addEventListener(event,()=>{card.querySelector('.video-codec-note').hidden=true;});
      }
      const player=card.querySelector('video');if(player)window.FamilyVideoDelivery?.bind(player,item);
      const area=card.querySelector('textarea'),draft=drafts.get(keyFor(personId,item.file));
      if(area!==document.activeElement)area.value=draft?.dirty?draft.value:item.caption||'';
      cards.push(card);
    }
    const wanted=new Set(cards);for(const card of [...grid.children])if(!wanted.has(card)){card.querySelectorAll('video').forEach(video=>video.pause());card.remove();}
    let anchor=grid.firstElementChild;for(const card of cards){if(card===anchor)anchor=anchor.nextElementSibling;else grid.insertBefore(card,anchor);}
    window.FamilyVideoPreviews?.watch(grid);
    window.FamilyTags.refresh(grid,items);galleryRevision=item.revision;
  }

  async function refreshOpenGallery(force=false) {
    if (!apiEnabled || !$('personDialog').open || galleryLoading) return;
    const personId = state.currentPerson;
    galleryLoading = true;
    try {
      const headers = !force && galleryRevision ? {'If-None-Match':'"' + galleryRevision + '"'} : {};
      const response = await I18n.fetch('api/people/' + encodeURIComponent(personId), {headers, cache:'no-store'});
      if (response.status === 304) return;
      const result = await response.json();
      if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('לא ניתן לפתוח את הגלריה.'));
      updatePersonUI(personId, result);
      if (personId === state.currentPerson && $('personDialog').open) renderGallery(result);
    } catch(error) {
      if (force && personId === state.currentPerson && $('personDialog').open) toast(error.message || I18n.t('לא ניתן לקרוא את הגלריה כרגע.'));
    } finally {galleryLoading = false;}
  }

  function editCaption(area) {
    const personId = area.dataset.owner, file = area.dataset.captionFile;
    const key = keyFor(personId, file);
    const draft = drafts.get(key) || {personId, file, saving:false};
    clearTimeout(draft.timer);
    draft.value = area.value;
    draft.dirty = true;
    draft.timer = setTimeout(() => saveCaption(key), 850);
    drafts.set(key, draft);
    draftStatus(personId, file, I18n.t('ממתין לשמירה…'));
  }

  async function saveCaption(key) {
    const draft = drafts.get(key);
    if (!draft || !draft.dirty || draft.saving || !apiEnabled) return;
    clearTimeout(draft.timer);
    draft.saving = true;
    const text = draft.value;
    draftStatus(draft.personId, draft.file, I18n.t('שומר…'));
    try {
      const response = await I18n.fetch('api/people/' + encodeURIComponent(draft.personId) + '/caption', {
        method:'POST', headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},
        body:JSON.stringify({file:draft.file,caption:text}), keepalive:true
      });
      const result = await response.json();
      if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('הכיתוב לא נשמר.'));
      if (draft.value === text) {draft.dirty = false;draftStatus(draft.personId,draft.file,I18n.t('נשמר ✓'));}
      else draft.timer = setTimeout(() => saveCaption(key), 150);
    } catch(error) {
      draftStatus(draft.personId,draft.file,I18n.t('לא נשמר · לחצו על שמירה'),true);
      toast(error.message || I18n.t('הכיתוב לא נשמר. נסו שוב.'));
    } finally {draft.saving = false;}
  }

  function flushDrafts() {
    for (const [key,draft] of drafts) {
      if (draft.dirty) {clearTimeout(draft.timer);saveCaption(key);}
    }
  }

  function openPhoto(index) {
    if (!state.gallery.length) return;
    if(window.FamilyMedia){window.FamilyMedia.open(state.gallery,index,'personal:'+state.currentPerson);return;}
    state.photoIndex = (index + state.gallery.length) % state.gallery.length;
    const photo = state.gallery[state.photoIndex];
    $('lightboxImage').src = photo.src;
    $('lightboxImage').alt = photo.caption || photo.name;
    $('lightboxImage').dataset.file = photo.file;
    $('lightboxCaption').textContent = photo.caption || '';
    $('lightboxCounter').textContent = `${state.photoIndex + 1} / ${state.gallery.length}`;
    $('previousPhoto').hidden = $('nextPhoto').hidden = state.gallery.length < 2;
    if (!$('lightbox').open) $('lightbox').showModal();
  }

  function fitSearchResults() {
    const results=$('searchResults');if(results.hidden)return;
    const viewport=window.visualViewport,bottom=(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight);
    results.style.maxHeight=Math.max(64,Math.min(420,bottom-results.getBoundingClientRect().top-10))+'px';
  }
  function showSearch() {
    const query=normalize(state.query);
    if(state.view==='person'){$('searchResults').hidden=true;window.FamilyPeople?.search(state.query);return;}
    if(!['tree','directory'].includes(state.view)){window.FamilyPortal?.search(state.query);window.FamilyMemories?.search(state.query);window.FamilyDocuments?.search(state.query);window.FamilyArchive?.search(state.query);window.FamilyCalendar?.search(state.query);window.FamilyTimeline?.search(state.query);window.FamilyNursery?.search(state.query);window.FamilyAI?.search(state.query);$('searchResults').hidden=true;return;}
    if(state.view==='directory')renderDirectory();
    if(!query&&state.view!=='directory'){$('searchResults').hidden=true;return;}
    const matches=state.view==='directory'?directoryMatches(query):people.filter(p=>!p.extended&&!p.extra&&normalize(I18n.searchNames({...p,...getMedia(p)})).includes(query)).sort(searchFamilyOrder);
    $('searchResults').innerHTML=matches.length?matches.slice(0,15).map(p=>`<button type="button" class="search-result" data-search-person="${p.id}">${portraitHTML(p)}<span class="search-result-text"><span class="person-name">${safe(nameOf(p))}${p.deceased?I18n.t(' ז״ל'):''}</span><small>${safe(branchTitle(p))}</small></span></button>`).join(''):I18n.t('<div class="search-empty">לא נמצא שם מתאים</div>');
    $('searchResults').hidden=false;
    fitSearchResults();
  }

  async function loadFamilyMedia(force=false) {
    if (!apiEnabled || mediaLoading) return;
    mediaLoading = true;
    try {
      const response = await I18n.fetch('api/media', {cache:'no-store',headers:!force&&mediaRevision?{'If-None-Match':'"'+mediaRevision+'"'}:{}});
      mediaLoadedAt=Date.now();
      if(response.status===304){$('runtimeNotice').hidden=true;return;}
      if (!response.ok) throw Error('connection');
      const result = await response.json();
      mediaRevision=result.revision;mediaDirty=false;
      Object.entries(result.people).forEach(([personId,item])=>updatePersonUI(personId,item));
      if(state.view==='directory')renderDirectory();
      window.dispatchEvent(new CustomEvent('family-people-loaded'));
      $('runtimeNotice').hidden = true;
    } catch(error) {
      $('runtimeNotice').textContent = I18n.t('החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.');
      $('runtimeNotice').hidden = false;
    } finally {mediaLoading = false;}
  }

  async function addUploads(files, fromClipboard=false) {
    if (!apiEnabled) {toast(I18n.t('ההעלאה אינה זמינה כרגע. נסו לרענן את הדף.'));return;}
    if (!state.currentPerson || !$('personDialog').open) return;
    const personId=state.currentPerson;
    let selected = Array.from(files).filter(file => /^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type) || imageTypes.test(file.name));
    if (!selected.length) {toast(I18n.t('בחרו תמונת JPG, PNG, WEBP, GIF או AVIF.'));return;}
    if (selected.length < files.length) toast(I18n.t('חלק מהקבצים אינם בפורמט נתמך. יתר התמונות יישמרו.'));
    try{selected=await window.FamilyPhotoEditor.prepare(selected,{scope:'personal:'+personId,onUpload:async(file)=>{const payload=window.FamilyPhotoEditor.upload(file),response=await I18n.fetch('api/people/'+encodeURIComponent(personId)+'/photos?filename='+encodeURIComponent(file.name),{method:'POST',headers:{...payload.headers,'Content-Type':file.type||'application/octet-stream','X-Family-Token':window.FAMILY_API_TOKEN},body:payload.body}),result=await response.json();if(!response.ok)throw Error(I18n.error(result.error));await window.FamilyPhotoThumbnails?.fromUpload?.(result,file);updatePersonUI(personId,result.person);if(state.currentPerson===personId&&$('personDialog').open)renderGallery(result.person);}});}catch{toast(I18n.isEnglish?'The photo editor could not open. Refresh the page and try again.':'מסך עריכת התמונות לא נטען. רעננו את הדף ונסו שוב.');return;}
    if(!selected?.length)return;
    uploads.push({personId,files:selected,clipboard:fromClipboard});
    runUploads();
  }

  async function runUploads() {
    if (uploadRunning) return;
    uploadRunning = true;
    while (uploads.length) {
      const batch = uploads.shift();
      let saved = 0;
      for (let i=0;i<batch.files.length;i++) {
        const file = batch.files[i];
        if (state.currentPerson === batch.personId && $('personDialog').open) {
          $('uploadState').textContent = I18n.html`מעלה תמונה ${i+1} מתוך ${batch.files.length}…`;
          $('photoDropzone').classList.add('uploading');
        }
        try {
          if (file.size > 50*1024*1024) throw Error(I18n.t('אפשר להעלות עד 50MB לתמונה.'));
          const date = new Date().toISOString().replace(/[:.]/g,'-');
          const filename = batch.clipboard ? I18n.t('צילום_מסך_') + date + (file.name.match(/\.[^.]+$/)?.[0]||'.png') : file.name;
          const payload=window.FamilyPhotoEditor?.upload?.(file)||{body:file};
          const response = await I18n.fetch('api/people/' + encodeURIComponent(batch.personId) + '/photos?filename=' + encodeURIComponent(filename), {
            method:'POST',headers:{...payload.headers,'Content-Type':file.type || 'application/octet-stream','X-Family-Token':window.FAMILY_API_TOKEN},body:payload.body
          });
          const result = await response.json();
          if (!response.ok) throw Error(I18n.error(result.error) || I18n.t('התמונה לא נשמרה.'));
          await window.FamilyPhotoThumbnails?.fromUpload?.(result,file);
          saved++;
          updatePersonUI(batch.personId,result.person);
          if (state.currentPerson === batch.personId && $('personDialog').open) renderGallery(result.person);
        } catch(error) {toast((file.name ? file.name + ': ' : '') + (error.message || I18n.t('התמונה לא נשמרה.')));}
      }
      if (state.currentPerson === batch.personId && $('personDialog').open) {
        $('photoDropzone').classList.remove('uploading');
        $('uploadState').textContent = saved === 1 ? I18n.t('התמונה נוספה לאלבום ✓') : saved ? I18n.html`${saved} תמונות נוספו לאלבום ✓` : I18n.t('לא נשמרו תמונות. אפשר לנסות שוב.');
      }
    }
    uploadRunning = false;
  }

  document.addEventListener('click',event=>{
    const filter=event.target.closest('[data-person-media-filter]');if(filter){state.galleryFilter=filter.dataset.personMediaFilter;renderGallery(getMedia(data.people[state.currentPerson]));return;}
    const person=event.target.closest('[data-person]');if(person){openPerson(person.dataset.person);return;}
    const branch=event.target.closest('[data-branch]');if(branch){selectBranch(branch.dataset.branch);return;}
    const openBranch=event.target.closest('[data-open-branch]');if(openBranch){selectBranch(openBranch.dataset.openBranch);return;}
    const group=event.target.closest('[data-directory-group]');if(group){$('searchResults').hidden=true;state.directoryGroup=group.dataset.directoryGroup;state.query='';$('searchInput').value='';renderDirectory();return;}
    const view=event.target.closest('[data-view]');if(view){setView(view.dataset.view);return;}
    const search=event.target.closest('[data-search-person]');if(search){$('searchResults').hidden=true;$('searchInput').blur();openPerson(search.dataset.searchPerson);return;}
    const photo=event.target.closest('[data-open-photo]');if(photo){openPhoto(state.gallery.findIndex(p=>p.file===photo.dataset.openPhoto));return;}
    const save=event.target.closest('[data-save-caption]');if(save){saveCaption(keyFor(save.dataset.owner,save.dataset.saveCaption));return;}
    if(event.target.closest('#uploadPhotos')){$('photoUploadInput').value='';$('photoUploadInput').click();return;}
    if(!event.target.closest('.search-wrap'))$('searchResults').hidden=true;
  });
  document.addEventListener('input',event=>{if(event.target.matches('textarea[data-caption-file]'))editCaption(event.target);});
  document.addEventListener('keydown',event=>{if(event.target.matches('textarea[data-caption-file]'))window.FamilyPhotoKeyboard?.saveDescription(event,()=>saveCaption(keyFor(event.target.dataset.owner,event.target.dataset.captionFile)));});
  document.addEventListener('focusout',event=>{if(event.target.matches('textarea[data-caption-file]'))saveCaption(keyFor(event.target.dataset.owner,event.target.dataset.captionFile));});
  document.addEventListener('paste',event=>{
    if (!$('personDialog').open) {if(!window.FamilyArchive?.acceptPaste(event))window.FamilyPortal?.acceptPaste(event);return;}
    if ($('lightbox').open) return;
    const files=Array.from(event.clipboardData?.items || []).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(files.length){event.preventDefault();addUploads(files,true);}
  });
  document.addEventListener('dragover',event=>{
    if(Array.from(event.dataTransfer?.types || []).includes('Files')){
      event.preventDefault();
      if($('personDialog').open&&!$('lightbox').open)$('photoDropzone').classList.add('drag-over');
      else {window.FamilyPortal?.dragOver(event);window.FamilyArchive?.dragOver(event);}
    }
  });
  $('personDialog').addEventListener('dragleave',event=>{if(!event.relatedTarget||!$('personDialog').contains(event.relatedTarget))$('photoDropzone')?.classList.remove('drag-over');});
  document.addEventListener('drop',event=>{
    if(!event.dataTransfer?.files.length)return;
    event.preventDefault();
    if($('personDialog').open&&!$('lightbox').open){$('photoDropzone').classList.remove('drag-over');addUploads(event.dataTransfer.files);}
    else if (!window.FamilyArchive?.acceptDrop(event)&&!window.FamilyPortal?.acceptDrop(event)) toast(I18n.t('פתחו גלריה שאליה תרצו להוסיף את התמונות.'));
  });
  $('photoUploadInput').addEventListener('change',()=>{if($('photoUploadInput').files.length)addUploads($('photoUploadInput').files);});
  $('personCameraInput').addEventListener('change',()=>{if($('personCameraInput').files.length)addUploads($('personCameraInput').files);});
  document.addEventListener('click',event=>{if(event.target.closest('#capturePersonPhoto')){$('personCameraInput').value='';$('personCameraInput').click();}});
  document.addEventListener('error',event=>{if(event.target.matches('img.profile-photo'))event.target.hidden=true;},true);
  $('closePerson').addEventListener('click',()=>$('personDialog').close());
  $('personDialog').addEventListener('close',flushDrafts);
  $('closeLightbox').addEventListener('click',()=>$('lightbox').close());
  $('previousPhoto').addEventListener('click',()=>openPhoto(state.photoIndex-1));
  $('nextPhoto').addEventListener('click',()=>openPhoto(state.photoIndex+1));
  $('searchInput').addEventListener('input',()=>{state.query=$('searchInput').value;showSearch();});
  $('searchInput').addEventListener('focus',()=>{if(state.query||state.view==='directory')showSearch();});
  $('searchInput').addEventListener('click',()=>{if(state.query||state.view==='directory')showSearch();});
  window.visualViewport?.addEventListener('resize',fitSearchResults);
  window.visualViewport?.addEventListener('scroll',fitSearchResults);
  window.addEventListener('resize',fitSearchResults);
  $('searchInput').addEventListener('keydown',e=>{if(e.key==='Escape')$('searchResults').hidden=true;if(e.key==='Enter'){const first=$('searchResults').querySelector('[data-search-person]');if(first&&!$('searchResults').hidden)first.click();}});
  $('homeLink').addEventListener('click',e=>{e.preventDefault();state.branch='all';state.mode='overview';state.query='';$('searchInput').value='';renderBranches();setView('home');});
  $('overviewButton').addEventListener('click',()=>{state.branch='all';state.mode='overview';renderBranches();renderTree();});
  $('fullTreeButton').addEventListener('click',()=>{state.mode=state.branch==='all'?'full':'branch';renderTree();});
  $('zoomIn').addEventListener('click',()=>zoom(1.2));$('zoomOut').addEventListener('click',()=>zoom(1/1.2));$('fitButton').addEventListener('click',fitTree);
  document.addEventListener('keydown',e=>{if($('lightbox').open){if(e.key==='ArrowRight')openPhoto(state.photoIndex+1);if(e.key==='ArrowLeft')openPhoto(state.photoIndex-1);}});
  $('personDialog').addEventListener('click',e=>{if(e.target===$('personDialog')){const r=$('personDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('personDialog').close();}});
  window.addEventListener('pagehide',flushDrafts);

  const viewport=$('treeViewport');let drag=null,pinch=null;
  const touches=new Map();
  viewport.addEventListener('selectstart',event=>event.preventDefault());
  viewport.addEventListener('dragstart',event=>event.preventDefault());
  viewport.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  viewport.addEventListener('pointerdown',event=>{
    stopTreeMotion();if(event.button>0)return;
    if(event.pointerType==='touch'){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(touches.size===2){const [a,b]=[...touches.values()],rect=viewport.getBoundingClientRect();pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale,x:(a.x+b.x)/2-rect.left,y:(a.y+b.y)/2-rect.top,cameraX:camera.x,cameraY:camera.y};drag=null;for(const id of touches.keys())viewport.setPointerCapture(id);suppressClickUntil=performance.now()+500;return;}
    }else if(event.target.closest('button,a'))return;
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:camera.x,y:camera.y,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,vx:0,vy:0,started:false,touch:event.pointerType==='touch',nativeScroll:event.pointerType==='touch'&&isPhone()&&viewport.dataset.overview==='true'};
  });
  viewport.addEventListener('pointermove',event=>{
    if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&touches.size===2){const [a,b]=[...touches.values()],rect=viewport.getBoundingClientRect(),scale=Math.max(.035,Math.min(3.5,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));camera.x=(a.x+b.x)/2-rect.left-(pinch.x-pinch.cameraX)*scale/pinch.scale;camera.y=(a.y+b.y)/2-rect.top-(pinch.y-pinch.cameraY)*scale/pinch.scale;camera.scale=scale;clampCamera();applyCamera();suppressClickUntil=performance.now()+500;return;}
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.started&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){
      if(drag.nativeScroll&&Math.abs(event.clientY-drag.startY)>=Math.abs(event.clientX-drag.startX))return;
      drag.started=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');
      if(!drag.touch){const selection=window.getSelection?.();if(selection&&(viewport.contains(selection.anchorNode)||viewport.contains(selection.focusNode)))selection.removeAllRanges();}
    }
    if(!drag.started)return;
    const dt=Math.max(1,event.timeStamp-drag.time);drag.vx=.4*drag.vx+.6*(event.clientX-drag.lastX)/dt;drag.vy=.4*drag.vy+.6*(event.clientY-drag.lastY)/dt;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;
    camera.x=drag.x+event.clientX-drag.startX;camera.y=drag.y+(drag.nativeScroll?0:event.clientY-drag.startY);clampCamera();applyCamera();suppressClickUntil=performance.now()+400;
  });
  function momentum(vx,vy){
    if(!isPhone()||reducedMotion()||Math.hypot(vx,vy)<.08)return;let previous=performance.now();
    const step=now=>{if(reducedMotion()){stopTreeMotion();return;}const dt=Math.min(32,now-previous);previous=now;camera.x+=vx*dt;camera.y+=vy*dt;vx*=Math.pow(.91,dt/16);vy*=Math.pow(.91,dt/16);clampCamera();applyCamera();if(Math.hypot(vx,vy)>.025)motionFrame=requestAnimationFrame(step);else motionFrame=0;};motionFrame=requestAnimationFrame(step);
  }
  function endDrag(event){
    const ended=drag;touches.delete(event.pointerId);pinch=null;drag=null;viewport.classList.remove('dragging');
    if(touches.size===1){const [id,point]=[...touches][0];drag={id,startX:point.x,startY:point.y,x:camera.x,y:camera.y,lastX:point.x,lastY:point.y,time:event.timeStamp,vx:0,vy:0,started:true,touch:true,nativeScroll:isPhone()&&viewport.dataset.overview==='true'};}
    else if(ended?.started&&ended.touch){suppressClickUntil=performance.now()+400;if(event.timeStamp-ended.time<90)momentum(Math.max(-3,Math.min(3,ended.vx)),ended.nativeScroll?0:Math.max(-3,Math.min(3,ended.vy)));}
  }
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',event=>{touches.clear();pinch=null;drag=null;viewport.classList.remove('dragging');stopTreeMotion();});
  viewport.addEventListener('wheel',event=>{if(event.ctrlKey||event.metaKey){event.preventDefault();const rect=viewport.getBoundingClientRect();zoom(event.deltaY<0?1.1:1/1.1,event.clientX-rect.left,event.clientY-rect.top);}}, {passive:false});
  viewport.addEventListener('keydown',e=>{
    if(e.target!==viewport)return;
    if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}else if(e.key==='-'){e.preventDefault();zoom(1/1.2);}else if(e.key==='0'){e.preventDefault();fitTree();}
    else if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')camera.x+=50;if(e.key==='ArrowRight')camera.x-=50;if(e.key==='ArrowUp')camera.y+=50;if(e.key==='ArrowDown')camera.y-=50;applyCamera();}
  });
  let resizeTimer,lastWidth=innerWidth,lastHeight=innerHeight;window.addEventListener('resize',()=>{if(innerWidth===lastWidth&&innerHeight===lastHeight)return;lastWidth=innerWidth;lastHeight=innerHeight;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.view==='tree')renderTree();},120);});
  window.addEventListener('family-media-changed',event=>{
    const result=event.detail,affected=result.people|| (result.person?{[result.person.id]:result.person}:{});
    if(result.affectedPersonIds){mediaDirty=true;for(const person of result.taggedPeople||[])if(person.extra&&!data.people[person.id])updatePersonUI(person.id,{...person,birthday:'1.1.1111'});}
    for(const [personId,item]of Object.entries(affected)){
      if(['delete','untag'].includes(result.operation)){const key=keyFor(personId,result.item.file);clearTimeout(drafts.get(key)?.timer);drafts.delete(key);}
      updatePersonUI(personId,item);
      if(state.currentPerson===personId&&$('personDialog').open)renderGallery(item);
    }
  });
  window.FamilyApp={setView,getView:()=>state.view,getPerson:id=>data.people[id],getPersonSummary:id=>({...data.people[id],...media.get(id)}),getPeople:()=>people.filter(person=>!person.extended&&!person.extra).map(person=>({...person,name:nameOf(person)})),nameOf:id=>data.people[id]?nameOf(data.people[id]):id,birthdayOf:id=>birthdayOf(data.people[id]),openPerson,birthdayHTML:id=>birthdayHTML(data.people[id]),updatePerson:updatePersonUI,toast,apiEnabled,openSharedGallery:(items,index)=>window.FamilyMedia?.open(items,index)};
  function simpleRoute(){const view=location.hash.slice(1).split('/')[0];if(['weddings','nostalgia'].includes(view))return;const target=validViews.has(view)?view:(!view?(isPhone()?'home':'tree'):null);if(target&&target!==state.view)setView(target,false);}
  window.addEventListener('hashchange',simpleRoute);window.addEventListener('popstate',simpleRoute);
  const routedBranch=()=>scopedViews&&location.hash.startsWith('#tree/')?location.hash.split('/')[1]:null;
  const activateRoutedBranch=()=>{const branch=routedBranch();if(branchFor(branch)&&state.branch!==branch)selectBranch(branch);};
  renderBranches();renderView();activateRoutedBranch();
  if(scopedViews){window.addEventListener('hashchange',activateRoutedBranch);window.addEventListener('popstate',activateRoutedBranch);}
  if(apiEnabled){
    loadFamilyMedia();
    setInterval(()=>{if(document.visibilityState!=='hidden')refreshOpenGallery();},10000);
    setInterval(()=>{if(document.visibilityState!=='hidden'&&!document.querySelector('dialog[open]'))loadFamilyMedia();},300000);
    const refreshAfterTags=()=>{if(mediaDirty&&!document.querySelector('dialog[open]'))loadFamilyMedia();};
    $('mediaViewer').addEventListener('close',refreshAfterTags);$('tagPeopleDialog').addEventListener('close',refreshAfterTags);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(Date.now()-mediaLoadedAt>60000||mediaDirty)loadFamilyMedia();refreshOpenGallery(true);}});
  }else{
    $('runtimeNotice').textContent=I18n.t('החיבור לשמירה אינו זמין כרגע. נסו לרענן את הדף.');
    $('runtimeNotice').hidden=false;
  }
})();
