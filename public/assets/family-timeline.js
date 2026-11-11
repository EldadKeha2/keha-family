import {familyTimeline,timelineTracks,nearestTimelineYear,annualBirthYears} from './family-timeline-data.mjs?v=annual-board-v7';
import {mountTimelineOverview} from './family-timeline-overview.mjs?v=annual-board-v7';
import {bindTimelinePan} from './family-timeline-pan.mjs?v=touch-drag-v3';
import {enchantedTreeLayout,enchantedCohortLayout,treeBoughPaths} from './family-timeline-tree.mjs?v=enchanted-v4';

const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
const tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
const STEP=64;
const state={view:'tree',ready:false,mode:'rails',mobileGeneration:1,query:'',wedding:null,weddingLoaded:false,loading:false,error:false,signature:'',frame:0,model:null,tracks:[],years:new Map(),treeDecade:'all'};
let unmountOverview=null;const overviewView={zoom:1,offset:0};
const generationNames=[null,['דור ראשון','First generation'],['דור שני','Second generation'],['דור שלישי','Third generation'],['דור רביעי','Fourth generation']];
const generationSubtitles=[null,['סבא וסבתא · יונה ושלמה','Grandma and Grandpa · Yona and Shlomo'],['הילדים ובני הזוג','Children and their partners'],['הנכדים ובני הזוג','Grandchildren and their partners'],['הנינים ובני הנינים · מ־1988','Great-grandchildren and beyond · from 1988']];
const generationTitle=g=>tr(...generationNames[g]);
const birthdayWord=n=>tr(n===1?'יום הולדת':'ימי הולדת',n===1?'birthday':'birthdays');
const decadeTitle=c=>c.start===null?tr('לפני שנות ה־30','Before the 1930s'):I.isEnglish?`${c.start}s`:c.start<2000?`שנות ה־${String(c.start).slice(-2)}`:`שנות ה־${c.start}`;
const arrow=direction=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction>0?'m9 5 7 7-7 7':'m15 5-7 7 7 7'}"/></svg>`;
const name=p=>I.personName(p);
const reduced=()=>window.FamilyAccessibility?.isReducedMotion?.()||matchMedia('(prefers-reduced-motion: reduce)').matches;
function dateLabel(event){
  const options={year:'numeric',timeZone:'UTC'};
  if(event.month)options.month='long';if(event.day)options.day='numeric';
  return new Intl.DateTimeFormat(I.locale,options).format(new Date(Date.UTC(event.year,(event.month||1)-1,event.day||1)));
}
function portrait(person,{mini=false}={}){
  const initials=name(person).split(/\s+/).filter(Boolean).map(s=>s[0]).slice(0,2).join('');
  return `<span class="ft-face${mini?' ft-face-mini':''}" aria-hidden="true"><span>${safe(initials)}</span>${person.profile?`<img src="${safe(person.profile)}" alt="" loading="lazy" decoding="async">`:''}</span>`;
}
function weddingPhoto(){
  const record=state.wedding,items=record?.collection?.items||[];
  const photo=items.find(p=>p.kind==='photo'&&(p.src===record.cover||p.src===record.collection?.cover))||items.find(p=>p.kind==='photo');
  return photo?.previewSrc||photo?.thumbnailSrc||photo?.src||record?.cover||'';
}
function weddingHTML({compact=false}={}){
  const src=weddingPhoto(),date=state.model?.marriage;
  return `<a class="ft-wedding${compact?' ft-wedding-compact':''}" href="#weddings/u-root"><span class="ft-wedding-image">${src?`<img src="${safe(src)}" alt="${tr('החתונה של יונה ושלמה','Yona and Shlomo’s wedding')}" decoding="async">`:'<span aria-hidden="true">♡</span>'}</span><span><strong>${tr('החתונה של יונה ושלמה','Yona and Shlomo’s wedding')}</strong><small>${date?safe(dateLabel(date)):tr('שנת הנישואים טרם הוזנה','Wedding year not yet recorded')}</small></span></a>`;
}
function eventLabel(event){return tr(event.person.gender==='f'?'נולדה':'נולד','Born');}
function focusHTML(events){
  return events.map(event=>event.kind==='wedding'?`<li class="ft-focus-event ft-focus-wedding">${weddingHTML()}</li>`:`<li class="ft-focus-event"><a href="#person/${encodeURIComponent(event.person.id)}" aria-label="${safe(name(event.person)+' · '+eventLabel(event)+' · '+dateLabel(event))}">${portrait(event.person)}<strong>${safe(name(event.person))}</strong><small>${safe(eventLabel(event))} · <bdi>${safe(dateLabel(event))}</bdi></small></a></li>`).join('');
}
function matches(event,query){
  if(!query)return true;
  return normalize([event.year,dateLabel(event),event.person?I.searchNames(event.person):tr('חתונה נישואים יונה שלמה','wedding marriage Yona Shlomo')].join(' ')).includes(query);
}
function activeYear(track){
  const year=nearestTimelineYear(track.years,state.years.get(track.generation)??track.years[0]);
  if(year!==null)state.years.set(track.generation,year);return year;
}
function railHTML(track){
  const g=track.generation,year=activeYear(track),index=track.years.indexOf(year);
  const byYear=new Map(track.years.map(y=>[y,track.events.filter(e=>e.year===y)]));
  const ticks=[];
  for(let y=track.start;y<=track.end;y++){
    const events=byYear.get(y)||[],showLabel=y%5===0||events.length||y===track.start;
    ticks.push(`<span class="ft-axis-tick${y%5===0?' ft-axis-major':''}${y===year?' ft-axis-current':''}" style="left:${(y-track.start)*STEP}px" data-axis-year="${y}">${showLabel?`<bdi>${y}</bdi>`:''}</span>`);
  }
  const dots=track.years.map(y=>{
    const events=byYear.get(y),people=events.filter(e=>e.person);
    return `<button type="button" class="ft-axis-dot${y===year?' is-current':''}" data-rail-year="${y}" data-generation="${g}" style="left:${(y-track.start)*STEP}px" aria-label="${safe(y+' · '+events.map(e=>e.person?name(e.person):tr('החתונה','The wedding')).join(', '))}">${people.length?portrait(people[0].person,{mini:true}):'<span aria-hidden="true">♡</span>'}${events.length>1?`<span class="ft-dot-count">${events.length}</span>`:''}</button>`;
  }).join('');
  return `<section class="ft-rail ft-generation-${g}${state.mobileGeneration===g?' is-mobile-generation':''}" data-rail="${g}" aria-labelledby="ft-generation-${g}"><header class="ft-rail-header"><div class="ft-generation-title"><span class="ft-generation-number" aria-hidden="true">${g}</span><div><h3 id="ft-generation-${g}">${generationTitle(g)}</h3><p>${tr(...generationSubtitles[g])}</p></div></div><div class="ft-rail-meta"><span>${track.birthCount} ${birthdayWord(track.birthCount)}</span>${track.years.length?`<label class="ft-year-jump"><span class="visually-hidden">${safe(tr('בחירת שנה · ','Choose a year · ')+generationTitle(g))}</span><select data-rail-jump="${g}">${track.years.map(y=>`<option value="${y}"${y===year?' selected':''}>${y}</option>`).join('')}</select><span aria-hidden="true">↗</span></label>`:''}</div></header>${track.years.length?`<div class="ft-rail-viewport" tabindex="0" role="group" aria-label="${safe(generationTitle(g)+' · '+tr('אפשר לנוע עם חיצי ימין ושמאל','Use the left and right arrow keys'))}"><div class="ft-axis-line" aria-hidden="true"></div><div class="ft-axis-world" style="transform:translateX(${-(year-track.start)*STEP}px)">${ticks.join('')}${dots}</div><div class="ft-rail-needle" aria-hidden="true"></div><ul class="ft-focus-events" data-rail-focus>${focusHTML(byYear.get(year)||[])}</ul><output class="ft-selected-year" data-rail-output aria-live="polite">${year}</output><button type="button" class="ft-rail-arrow ft-rail-previous" data-rail-step="-1" data-generation="${g}" aria-label="${safe(tr('לשנה הקודמת · ','Previous year · ')+generationTitle(g))}"${index<=0?' disabled':''}>${arrow(-1)}</button><button type="button" class="ft-rail-arrow ft-rail-next" data-rail-step="1" data-generation="${g}" aria-label="${safe(tr('לשנה הבאה · ','Next year · ')+generationTitle(g))}"${index>=track.years.length-1?' disabled':''}>${arrow(1)}</button></div><div class="ft-rail-scrubber"><bdi>${track.start}</bdi><label><span class="visually-hidden">${safe(tr('מעבר בין שנות הלידה · ','Move between birth years · ')+generationTitle(g))}</span><input type="range" data-rail-range="${g}" min="0" max="${track.years.length-1}" step="1" value="${index}" aria-valuetext="${year}"${track.years.length===1?' disabled':''}></label><bdi>${track.end}</bdi></div>`:`<p class="ft-rail-empty">${tr('עוד מקום לשנות הלידה של הדור הזה','A little space for this generation’s birth years')}</p>`}</section>`;
}
function railsHTML(){
  return `<div class="ft-desktop-overview" data-timeline-overview></div><div class="ft-mobile-rails"><p class="ft-rail-help">${tr('גוררים את הציר במגע או בעכבר, או נעים עם החיצים.','Drag the timeline with your finger or mouse, or use the arrows.')}</p><div class="ft-generation-tabs" role="group" aria-label="${tr('בחירת דור','Choose a generation')}">${[1,2,3,4].map(g=>`<button type="button" data-mobile-generation="${g}" aria-pressed="${state.mobileGeneration===g}">${generationTitle(g)}</button>`).join('')}</div><div class="ft-rails">${state.tracks.map(railHTML).join('')}</div></div>`;
}
function overviewPreview(events){
  const people=[...new Map(events.filter(e=>e.person).map(e=>[e.person.id,e.person])).values()],wedding=events.some(e=>e.kind==='wedding'),src=wedding?weddingPhoto():'';
  return (wedding?`<span class="ft-overview-wedding">${src?`<img src="${safe(src)}" alt="" decoding="async">`:'♡'}</span>`:'')+people.slice(0,wedding?2:3).map(p=>portrait(p,{mini:events.length>1})).join('');
}
function annualSparksHTML(){
  return `<div class="ft-annual-sparks" aria-hidden="true">${Array.from({length:26},(_,i)=>`<i style="--annual-sx:${i<12?9+i*19%83:1.8+(i%5)*24.1}%;--annual-sy:${i<12?3+i*7%13:24+i*17%69}%;--annual-delay:${-(i*.79)}s;--annual-time:${6+i%6}s"></i>`).join('')}</div>`;
}
function annualHTML(){
  const years=annualBirthYears(state.model),count=years.reduce((sum,row)=>sum+row.events.length,0);
  const weights=years.map(row=>1+Math.max(0,Math.ceil(row.events.reduce((sum,event)=>sum+name(event.person).length+3,0)/34)-1)*.65),columns=[];
  let column=[],weight=0,remaining=weights.reduce((sum,value)=>sum+value,0);
  years.forEach((row,index)=>{
    const target=remaining/(4-columns.length);
    if(column.length&&columns.length<3&&weight+weights[index]/2>target){columns.push(column);remaining-=weight;column=[];weight=0;}
    column.push(row);weight+=weights[index];
  });
  if(column.length)columns.push(column);
  const flourish=`<svg viewBox="0 0 260 30" aria-hidden="true"><path d="M2 18q42 12 75-4t53 0q24-16 53 0t75 4M36 20q-9-20-20-13q3 15 20 13m31-3q9-22 20-16q-2 15-20 16m126 0q-9-22-20-16q2 15 20 16m31 3q9-20 20-13q-3 15-20 13"/><path d="m130 4 9 9-9 9-9-9Z"/><circle cx="109" cy="13" r="2"/><circle cx="151" cy="13" r="2"/></svg>`;
  return `<section class="ft-annual-board" aria-labelledby="ft-annual-title">${annualSparksHTML()}<header class="ft-annual-heading">${flourish}<h3 id="ft-annual-title">${tr('לוח משפחתי שנתי','Family year register')}</h3><p>${tr('שנות הלידה שלנו, מהשורשים ועד הענפים הצעירים','Our birth years, from our roots to the youngest branches')}</p>${years.length?`<div class="ft-annual-summary"><span>${count} ${tr('בני משפחה','family members')}</span><i aria-hidden="true">❖</i><span>${years.length} ${tr('שנות לידה','birth years')}</span><i aria-hidden="true">❖</i><bdi>${years[0].year}–${years.at(-1).year}</bdi></div><button type="button" class="ft-annual-print" data-annual-print aria-label="${tr('הדפסת הלוח בעמוד אחד','Print the register on one page')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7ZM17 11h.01"/></svg><span>${tr('הדפסה','Print')}</span></button>`:''}</header>${columns.length?`<div class="ft-annual-tables">${columns.map(column=>`<table class="ft-annual-table"><caption class="visually-hidden">${tr('שנות לידה','Birth years')} ${column[0].year}–${column.at(-1).year}</caption><thead><tr><th scope="col">${tr('שנה','Year')}</th><th scope="col">${tr('בני המשפחה','Family members')}</th></tr></thead><tbody>${column.map(row=>`<tr data-annual-year="${row.year}"><th scope="row"><time datetime="${row.year}">${row.year}</time></th><td>${row.events.map(event=>`<a class="ft-annual-member" href="#person/${encodeURIComponent(event.person.id)}" data-annual-person="${safe(event.person.id)}" aria-label="${safe(name(event.person)+' · '+tr('שנת לידה','Birth year')+' '+row.year)}">${portrait(event.person,{mini:true})}<span class="ft-annual-person-name">${safe(name(event.person))}</span></a>`).join('')}</td></tr>`).join('')}</tbody></table>`).join('')}</div>`:`<p class="ft-annual-empty">${tr('לא נמצאו שנות לידה להצגה.','No birth years to display.')}</p>`}<div class="ft-annual-ending" aria-hidden="true">${flourish}</div></section>`;
}
function magicPeopleHTML(layout){
  return `<ol class="ft-magic-people">${layout.people.map((p,index)=>`<li class="ft-magic-person${state.treeDecade==='all'||state.treeDecade===p.decade?' is-lit':''}" data-tree-person-decade="${p.decade}" style="--person-x:${p.x/layout.width*100}%;--person-y:${p.y/layout.height*100}%;--person-order:${index}"><a href="#person/${encodeURIComponent(p.event.person.id)}" aria-label="${safe(name(p.event.person)+' · '+dateLabel(p.event))}" title="${safe(name(p.event.person)+' · '+dateLabel(p.event))}">${portrait(p.event.person)}<strong>${safe(name(p.event.person))}</strong><time>${p.event.year}</time></a></li>`).join('')}</ol>`;
}
function magicSparksHTML(){
  return `<div class="ft-magic-sparks" aria-hidden="true">${Array.from({length:34},(_,i)=>`<i style="--spark-x:${i<15?44+(i*7%14):9+(i*23%83)}%;--spark-y:${i<15?38+(i*13%54):8+(i*17%68)}%;--spark-delay:${-(i*.83)}s;--spark-time:${5+i%5}s;--spark-drift:${i%2?-16:19}px"></i>`).join('')}</div>`;
}
function magicSceneHTML(layout,{mobile=false,chapters=[]}={}){
  const active=state.treeDecade!=='all',prefix=mobile?'ft-magic-small':'ft-magic-wide';
  return `<div class="ft-magic-scene${active?' is-filtered':''}" style="aspect-ratio:${layout.width}/${layout.height}"><img class="ft-magic-art" src="assets/enchanted-family-tree-v1.webp" alt="" aria-hidden="true" decoding="async">${treeBoughPaths(layout,prefix,state.treeDecade)}${magicPeopleHTML(layout)}${!mobile?layout.decades.map(d=>`<button type="button" class="ft-magic-decade" data-tree-decade="${d.id}" aria-pressed="${state.treeDecade===d.id}" style="left:${d.x/layout.width*100}%;top:${d.y/layout.height*100}%"><span>${decadeTitle(chapters.find(c=>c.id===d.id))}</span><small>${d.count}</small></button>`).join(''):''}${magicSparksHTML()}<div class="ft-magic-root-word" aria-hidden="true">${tr('שורשים משותפים. סיפור שצומח.','Shared roots. A story that grows.')}</div></div>`;
}
function treeHTML(chapters){
  const selected=chapters.find(c=>c.id===state.treeDecade)||chapters[0];
  if(state.treeDecade!=='all'&&!chapters.some(c=>c.id===state.treeDecade))state.treeDecade=selected?.id||'all';
  const layout=enchantedTreeLayout(chapters),cohort=enchantedCohortLayout(selected),births=selected?.events.filter(e=>e.kind==='birth')||[],total=layout.people.length;
  return `<div class="ft-magic-heading"><span aria-hidden="true">✦</span><h3>${tr('העץ שלנו ממשיך לצמוח','Our tree keeps growing')}</h3><p>${tr('כל פנים — עוד ניצוץ על ענפי המשפחה. בוחרים עשור ומאירים את ילידיו.','Every face, another spark in our family tree. Choose a decade to light up its people.')}</p></div><div class="ft-magic-controls"><button type="button" class="ft-magic-all" data-tree-decade="all" aria-pressed="${state.treeDecade==='all'}">${tr('כל העשורים','All decades')}</button><button type="button" class="ft-magic-step" data-tree-step="-1" aria-label="${tr('העשור הקודם','Previous decade')}">${arrow(-1)}</button><label class="ft-magic-select ft-magic-select-wide"><span class="visually-hidden">${tr('בחירת עשור בעץ','Choose a decade in the tree')}</span><select data-tree-jump><option value="all"${state.treeDecade==='all'?' selected':''}>${tr('כל העשורים','All decades')}</option>${chapters.map(c=>`<option value="${c.id}"${c.id===state.treeDecade?' selected':''}>${decadeTitle(c)}</option>`).join('')}</select></label><label class="ft-magic-select ft-magic-select-small"><span class="visually-hidden">${tr('בחירת עשור בעץ','Choose a decade in the tree')}</span><select data-tree-jump>${chapters.map(c=>`<option value="${c.id}"${c.id===selected?.id?' selected':''}>${decadeTitle(c)}</option>`).join('')}</select></label><button type="button" class="ft-magic-step" data-tree-step="1" aria-label="${tr('העשור הבא','Next decade')}">${arrow(1)}</button></div><p class="ft-magic-count" aria-live="polite"><span class="ft-magic-wide-count" id="ft-magic-wide-count">${state.treeDecade==='all'?total:births.length} ${tr('ימי הולדת מאירים את העץ','birthdays light up the tree')}</span><span class="ft-magic-small-count" id="ft-magic-small-count">${births.length} ${tr('בני משפחה על ענפי העשור','family members on this decade’s branches')}</span></p><div class="ft-magic-grove"><div class="ft-magic-wide">${magicSceneHTML(layout,{chapters})}</div><div class="ft-magic-small" id="ft-magic-small" data-shown-decade="${selected?.id||''}">${magicSceneHTML(cohort,{mobile:true})}</div></div><p class="ft-magic-hint">${tr('נוגעים בתמונת פרופיל כדי להכיר את הסיפור שמאחוריה.','Tap a portrait to meet the story behind it.')}</p>`;
}
function render(){
  if(!state.ready||state.view!=='timeline')return;
  const people=app().getPeople().map(p=>app().getPersonSummary(p.id));
  const signature=JSON.stringify([I.language,state.mode,state.mobileGeneration,state.query,state.wedding,state.loading,state.error,people.map(p=>[p.id,p.generation,p.name,p.nameEn,p.birthday,p.invalidBirthday,p.profile])]);
  if(signature===state.signature)return;state.signature=signature;
  const all=familyTimeline({people,wedding:state.wedding}),query=normalize(state.query),events=all.events.filter(e=>matches(e,query));
  state.model={...all,events,chapters:all.chapters.map(c=>({...c,events:c.events.filter(e=>matches(e,query))}))};
  state.tracks=timelineTracks(state.model);
  const chapters=state.model.chapters.filter(c=>!query||c.events.some(e=>e.kind==='birth'));
  $('timelineContent').dataset.timelineMode=state.mode;
  $('timelineContent').dataset.reducedMotion=String(Boolean(reduced()));
  unmountOverview?.();unmountOverview=null;
  $('timelineContent').innerHTML=`<div class="ft-mode-switch" role="group" aria-label="${tr('תצוגת ציר הזמן','Timeline display')}"><button type="button" data-timeline-mode="rails" aria-pressed="${state.mode==='rails'}"><span aria-hidden="true">↔</span>${tr('ציר לפי דורות','Generation timelines')}</button><button type="button" data-timeline-mode="tree" aria-pressed="${state.mode==='tree'}"><span aria-hidden="true">❧</span>${tr('עץ השנים','Tree of years')}</button><button type="button" data-timeline-mode="annual" aria-pressed="${state.mode==='annual'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3ZM3 9h18M9 9v11M3 14h18"/></svg>${tr('לוח משפחתי שנתי','Family year register')}</button></div>${state.mode==='rails'?railsHTML():state.mode==='annual'?annualHTML():treeHTML(chapters)}${query&&!events.length?`<p class="ft-no-match">${tr('לא נמצאו שמות או שנים שמתאימים לחיפוש.','No names or years match your search.')}</p>`:''}<footer class="ft-closing"><span aria-hidden="true">❧</span>${all.unknown.length?`<small>${all.unknown.length} ${tr('בני משפחה יתווספו כשיתועד תאריך הלידה שלהם.','family members will join when their birth dates are recorded.')}</small>`:''}${state.error&&state.mode!=='annual'?`<p role="status">${tr('אלבום החתונה לא נטען כרגע.','The wedding album could not be loaded.')} <button type="button" data-timeline-retry>${tr('ניסיון נוסף','Try again')}</button></p>`:''}</footer>`;
  if(state.mode==='rails')unmountOverview=mountTimelineOverview($('timelineContent').querySelector('[data-timeline-overview]'),{
    model:state.model,view:overviewView,tr,preview:overviewPreview,details:focusHTML,
    labels:[tr('סבא וסבתא','Grandparents'),tr('הילדים','Children'),tr('הנכדים','Grandchildren'),tr('הנינים ובני הנינים','Great-grandchildren & beyond')],
    eventLabel:events=>safe(events.map(e=>(e.person?name(e.person)+' · '+eventLabel(e):tr('החתונה של יונה ושלמה','Yona and Shlomo’s wedding'))+' · '+dateLabel(e)).join('; ')),
    href:event=>event.kind==='wedding'?'#weddings/u-root':'#person/'+encodeURIComponent(event.person.id)
  });
}
function moveYear(generation,target,{scrubbing=false}={}){
  const track=state.tracks.find(t=>t.generation===generation),lane=$('timelineContent').querySelector(`[data-rail="${generation}"]`);
  if(!track||!lane||!track.years.length)return;
  const year=nearestTimelineYear(track.years,target),index=track.years.indexOf(year),changed=state.years.get(generation)!==year;
  state.years.set(generation,year);lane.classList.toggle('is-scrubbing',scrubbing);
  lane.querySelector('.ft-axis-world').style.transform=`translateX(${-(year-track.start)*STEP}px)`;
  if(changed)lane.querySelector('[data-rail-focus]').innerHTML=focusHTML(track.events.filter(event=>event.year===year));
  lane.querySelector('[data-rail-output]').textContent=year;
  lane.querySelector('[data-rail-jump]').value=year;
  const range=lane.querySelector('[data-rail-range]');range.value=index;range.setAttribute('aria-valuetext',String(year));
  lane.querySelector('[data-rail-step="-1"]').disabled=index<=0;
  lane.querySelector('[data-rail-step="1"]').disabled=index>=track.years.length-1;
  for(const tick of lane.querySelectorAll('[data-axis-year]'))tick.classList.toggle('ft-axis-current',Number(tick.dataset.axisYear)===year);
  for(const dot of lane.querySelectorAll('[data-rail-year]'))dot.classList.toggle('is-current',Number(dot.dataset.railYear)===year);
}
function stepYear(generation,direction){
  const track=state.tracks.find(t=>t.generation===generation);if(!track?.years.length)return;
  const index=track.years.indexOf(state.years.get(generation)),next=track.years[index+direction];if(next!==undefined)moveYear(generation,next);
}
function selectDecade(id){
  if(state.treeDecade===id)return;
  const chapter=state.model.chapters.find(c=>c.id===id);if(id!=='all'&&!chapter)return;
  state.treeDecade=id;const content=$('timelineContent'),all=id==='all';
  for(const scene of content.querySelectorAll('.ft-magic-scene'))scene.classList.toggle('is-filtered',!all);
  for(const element of content.querySelectorAll('[data-tree-person-decade],[data-tree-bough]'))element.classList.toggle('is-lit',all||(element.dataset.treePersonDecade||element.dataset.treeBough)===id);
  for(const button of content.querySelectorAll('[data-tree-decade]'))button.setAttribute('aria-pressed',String(button.dataset.treeDecade===id));
  const chapters=state.model.chapters.filter(c=>!state.query||c.events.some(e=>e.kind==='birth')),selected=chapter||chapters[0],births=selected?.events.filter(e=>e.kind==='birth')||[];
  for(const select of content.querySelectorAll('[data-tree-jump]'))select.value=select.closest('.ft-magic-select-small')?selected?.id||'':id;
  $('ft-magic-wide-count').textContent=(all?chapters.flatMap(c=>c.events.filter(e=>e.kind==='birth')).length:births.length)+' '+tr('ימי הולדת מאירים את העץ','birthdays light up the tree');
  $('ft-magic-small-count').textContent=births.length+' '+tr('בני משפחה על ענפי העשור','family members on this decade’s branches');
  const small=$('ft-magic-small');if(small.dataset.shownDecade!==selected?.id){small.dataset.shownDecade=selected?.id||'';small.innerHTML=magicSceneHTML(enchantedCohortLayout(selected),{mobile:true});}
}
function revealDecade(id){
  if(!matchMedia('(min-width:901px)').matches)return;
  const target=id==='all'?$('timelineContent').querySelector('.ft-magic-grove'):$('timelineContent').querySelector(`.ft-magic-wide [data-tree-person-decade="${id}"]`);
  target?.scrollIntoView({block:id==='all'?'start':'center',behavior:reduced()?'auto':'smooth'});
}
function scheduleRender(){if(state.frame||state.view!=='timeline')return;state.frame=requestAnimationFrame(()=>{state.frame=0;render();});}
async function loadWedding(){
  if(state.loading)return;state.loading=true;state.error=false;render();
  try{const response=await I.fetch('api/weddings/u-root',{cache:'no-store'});if(!response.ok)throw Error();state.wedding=await response.json();state.weddingLoaded=true;}
  catch{state.error=true;}finally{state.loading=false;render();}
}
function activate(view){
  const entering=view==='timeline'&&state.view!==view;state.view=view;
  if(entering)state.query=$('searchInput').value;
  $('timelineView').hidden=view!=='timeline';$('timelineView').setAttribute('aria-label',tr('ציר זמן משפחתי','Family Timeline'));
  if(!state.ready||view!=='timeline')return;
  render();if(entering||!state.weddingLoaded)loadWedding();
}
function init(){
  state.ready=true;const content=$('timelineContent');
  bindTimelinePan(content,{getTrack:g=>state.tracks.find(t=>t.generation===g),getYear:g=>state.years.get(g),moveYear,pixelsPerYear:STEP});
  content.addEventListener('click',event=>{
    const target=event.target.closest('[data-timeline-mode],[data-mobile-generation],[data-rail-step],[data-rail-year],[data-tree-decade],[data-tree-step],[data-timeline-retry],[data-annual-print]');if(!target)return;
    if(target.hasAttribute('data-annual-print')){window.print();return;}
    if(target.dataset.timelineMode){state.mode=target.dataset.timelineMode;render();return;}
    if(target.dataset.mobileGeneration){state.mobileGeneration=Number(target.dataset.mobileGeneration);render();return;}
    if(target.hasAttribute('data-timeline-retry')){loadWedding();return;}
    if(target.dataset.treeDecade){selectDecade(target.dataset.treeDecade);return;}
    if(target.dataset.treeStep){const chapters=state.model.chapters.filter(c=>!state.query||c.events.some(e=>e.kind==='birth')),index=Math.max(0,chapters.findIndex(c=>c.id===state.treeDecade)),next=chapters[index+Number(target.dataset.treeStep)];if(next){selectDecade(next.id);revealDecade(next.id);}return;}
    if(target.dataset.railYear){moveYear(Number(target.dataset.generation),Number(target.dataset.railYear));return;}
    stepYear(Number(target.dataset.generation),Number(target.dataset.railStep));
  });
  content.addEventListener('change',event=>{
    const target=event.target;
    if(target.hasAttribute('data-tree-jump')){selectDecade(target.value);revealDecade(target.value);}
    if(target.dataset.railJump)moveYear(Number(target.dataset.railJump),Number(target.value));
    if(target.dataset.railRange){const track=state.tracks.find(t=>t.generation===Number(target.dataset.railRange));if(track)moveYear(track.generation,track.years[Number(target.value)]);}
  });
  content.addEventListener('input',event=>{
    const target=event.target;if(!target.dataset.railRange)return;
    const track=state.tracks.find(t=>t.generation===Number(target.dataset.railRange));if(track)moveYear(track.generation,track.years[Number(target.value)],{scrubbing:true});
  });
  content.addEventListener('keydown',event=>{
    if(!event.target.classList.contains('ft-rail-viewport'))return;
    const generation=Number(event.target.closest('[data-rail]').dataset.rail);
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();stepYear(generation,event.key==='ArrowRight'?1:-1);}
  });
  content.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const branch=event.target.closest('[data-tree-decade],[data-tree-person-decade]');if(branch)selectDecade(branch.dataset.treeDecade||branch.dataset.treePersonDecade);});
  content.addEventListener('focusin',event=>{const branch=event.target.closest('[data-tree-decade],[data-tree-person-decade]');if(branch)selectDecade(branch.dataset.treeDecade||branch.dataset.treePersonDecade);});
  for(const event of ['family-people-loaded','family-person-changed','family-profile-changed'])window.addEventListener(event,scheduleRender);
  window.addEventListener('family-accessibility-changed',()=>{content.dataset.reducedMotion=String(Boolean(reduced()));});
  activate(app().getView());
}
window.FamilyTimeline={activate,search(query){state.query=query;render();}};
if(!app())document.addEventListener('DOMContentLoaded',init,{once:true});else init();
