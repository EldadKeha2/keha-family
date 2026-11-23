import {WIDTH, HEIGHT, frame, zoomAt, clamp, locatorBox, airDistance, groups, escapeText as esc, marker, baseMarker, symbol} from './cartography.mjs?v=3';
import {walkingControls} from './walking.mjs?v=3';

const root = document.getElementById('familyMapView');
const edition=new URL(import.meta.url).searchParams.get('v');
function asset(name) {
  const url=new URL(name,import.meta.url);
  if(edition)url.searchParams.set('v',edition);
  return url.href;
}
const firstPlace = {base:'saada',north:'saada', haydan:'khawlan', yemen:'aden', israel:'shaar'};
const option = (key,label) => `<option value="${esc(key)}">${esc(label)}</option>`;
let loading;

async function openAtlas() {
  if (root.dataset.ready || loading) return;
  loading = Promise.all(['places.json','regions.json','locators.json','people.json','regional-guide.json'].map(loadJson));
  try {
    const [evidence, regions, locators, people, guide] = await loading;
    mount(evidence, regions, locators, people, guide);
    root.dataset.ready = 'true';
  } catch {
    root.innerHTML = '<p role="status">טעינת המפה נקטעה. <button type="button">ניסיון נוסף</button></p>';
    root.querySelector('button').onclick = openAtlas;
  } finally { loading = null; }
}

async function loadJson(name) {
  const response=await fetch(asset(name));
  if(!response.ok) throw new Error(name);
  return response.json();
}

function mount({places, sources, scans}, regions, locators, people, guide) {
  let region='base', selected='', filter='all', camera=frame(), hoverTimer, walkRoute=null;
  let personId='', lastHash='';
  const q = selector => root.querySelector(selector);
  const coords = Object.fromEntries(Object.values(regions).flatMap(r=>r.markers.filter(m=>m.pos).map(m=>[m.id,m.pos])));
  const walkPlaces=new Set(regions.base.markers.filter(m=>m.pos).map(m=>m.to));
  const narrow = matchMedia('(max-width: 820px)');
  const phone = matchMedia('(max-width: 500px)');
  const help = 'במחשב אפשר לעמוד על שם או סמל כדי לקרוא את העדויות. בטלפון מקישים על מקום.';
  root.innerHTML = `
    <nav class="atlas-regions" aria-label="בחירת אזור במפה">${Object.entries(regions).filter(([id])=>id!=='base').map(([id,r])=>`<button type="button" data-region="${id}">${id==='north'?'צעדה והכפרים':esc(r.title)}</button>`).join('')}</nav>
    <div class="atlas-layout">
      <section class="atlas-map-card" aria-label="מפה אינטראקטיבית">
        <div class="atlas-heading">
          <div><h2 id="atlasRegion"></h2><p class="atlas-wide-hint">עמדו על שם במפה כדי לקרוא את העדויות.</p><p class="atlas-touch-hint">הקישו על מקום כדי לקרוא את העדויות מתחת למפה.</p></div>
          <button type="button" class="atlas-locator" aria-haspopup="dialog" aria-label="הגדלת מפת ההתמצאות"><span class="atlas-mini"></span><span class="atlas-locator-caption"></span></button>
        </div>
        <div class="atlas-tools">
          <label>מקום במפה<select id="atlasPlace"></select></label>
          <label>סוג האזכור<select id="atlasFilter">${option('all','כל האזכורים')+Object.entries(groups).map(([k,v])=>option(k,v)).join('')}</select></label>
        </div>
        <div class="atlas-north-tools" aria-label="תצוגות של מחוז צעדה">
          <button type="button" data-layer="base">מפת הבסיס</button><button type="button" data-layer="north">הקהילות ההיסטוריות</button><button type="button" data-districts>15 נפות המחוז</button><button type="button" data-open-walk>מרחקי הליכה</button>
        </div>
        <div class="atlas-stage">
          <svg class="atlas-plot" viewBox="0 0 920 550" dir="ltr" direction="ltr" tabindex="0" role="group" aria-label="${help} מקשי החצים מזיזים את המפה אחרי הגדלה."></svg>
          <div class="atlas-zoom" role="group" aria-label="הגדלת המפה"><button type="button" data-zoom="in" aria-label="הגדלה" title="הגדלה">+</button><button type="button" data-zoom="out" aria-label="הקטנה" title="הקטנה">−</button><button type="button" data-zoom="fit" aria-label="הצגת האזור כולו" title="הצגת האזור כולו"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/></svg></button></div>
          <span class="atlas-compass" aria-hidden="true"><svg viewBox="0 0 20 26"><path fill="#385c70" d="M10 1 3 23l7-5Z"/><path fill="#a97549" d="m10 1 7 22-7-5Z"/></svg>צפון</span>
          <span class="atlas-scale" dir="ltr"></span>
        </div>
        <div class="atlas-letter-key" aria-label="האזורים המסומנים באותיות על מפת הבסיס">
          <button type="button" data-place="saada"><b>א</b> צעדה וסביבתה</button><button type="button" data-place="sharmat"><b>ב</b> שרמאת שבסחר</button><button type="button" data-place="khawlan"><b>ג</b> כ׳ולאן וחיידאן</button>
        </div>
      </section>
      <aside class="atlas-evidence" aria-labelledby="atlasPlaceTitle" tabindex="-1">
        <div class="atlas-evidence-modes" aria-label="עיון בעדויות"><button type="button" data-evidence-mode="place" aria-pressed="true">לפי מקום</button><button type="button" data-evidence-mode="person" aria-pressed="false">לפי בני המשפחה</button></div>
        <header><label class="atlas-person-select" hidden>בחירת דמות במשפחה<select id="atlasPerson">${Object.entries(people).map(([id,p])=>option(id,p.name)).join('')}</select></label><h2 id="atlasPlaceTitle"></h2><p id="atlasArea"></p></header>
        <div class="atlas-detail"></div>
        <button class="atlas-back" type="button">חזרה למפה ↑</button>
      </aside>
      <section class="atlas-notes" aria-label="מקרא ומפתח המקומות">
        <div class="atlas-legend">${Object.entries(groups).map(([id,name])=>`<span>${symbol(id)}${esc(name)}</span>`).join('')}</div>
        <p class="atlas-footnote"></p>
        <details class="atlas-walk"><summary>אומדני הליכה בין 22 יישובים</summary><div class="atlas-walk-body"></div></details>
        <details><summary>מפתח המקומות באזור</summary><div class="atlas-index"></div></details>
        <details class="atlas-air"><summary>מרחקים בקו אווירי</summary><div class="atlas-distances"></div></details>
        <details class="atlas-uncertain-places"><summary>חבלים היסטוריים ומקומות שזיהוים פתוח</summary><div class="atlas-area-list"></div></details>
        <details><summary>מקורות גאוגרפיים</summary><p>יישובים מתוך <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>. גבולות בני ימינו © <a href="https://data.humdata.org/dataset/cod-ab-yem" target="_blank" rel="noopener">CSO / OCHA</a>. תבליט <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>. דרכים © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. קווי חוף <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>.</p></details>
        <div class="atlas-downloads"><a href="${asset('saada-family-atlas.pdf')}" target="_blank" rel="noopener">פתיחת האטלס להדפסה (PDF)</a><a href="${asset('saada-family-map.jpg')}" download>הורדת מפת הבסיס עם המפתח המשפחתי</a></div>
      </section>
    </div>
    <dialog class="atlas-overview"><div><h2></h2><button type="button" aria-label="סגירה">×</button></div><div class="atlas-big-locator"></div><p>המסגרת והחץ מסמנים את השטח שמוצג כרגע במפה המפורטת.</p></dialog>
    <dialog class="atlas-district-dialog" aria-labelledby="districtTitle"><header><h2 id="districtTitle">15 הנפות של מחוז צעדה</h2><button type="button" aria-label="סגירה">×</button></header><img src="${asset('saada-districts.svg')}" alt="מחוז צעדה והנפות הממוספרות לפי המפתח" loading="lazy"><ol>${guide.districts.map(d=>'<li>'+esc(d)+'</li>').join('')}</ol><p>המספרים במפה מציינים נפות בנות ימינו. המסגרת המקווקוות מציינת את תחום מפת הבסיס.</p></dialog>
    <span class="visually-hidden" role="status" aria-live="polite" id="atlasStatus"></span>`;
  const plot=q('.atlas-plot'), panel=q('.atlas-evidence'), placeSelect=q('#atlasPlace'), overview=q('.atlas-overview');
  const canvas=document.createElement('canvas').getContext('2d');
  const measure=(text,size)=>{canvas.font='bold '+size+'px Arial';return canvas.measureText(text).width;};
  const source = key => {
    const s=sources[key];
    return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : `<span>${esc(s.label)}</span>`;
  };
  const personLink=(id,label)=>`<a href="#family-map/person/${esc(id)}" data-person="${esc(id)}">${esc(label)}</a>`;
  const placeLink=(key,id,label)=>`<a href="#family-map/${esc(key)}/${esc(id)}" data-map-region="${esc(key)}" data-map-place="${esc(id)}">${esc(label)}</a>`;
  q('.atlas-area-list').innerHTML=guide.areas.map(item=>`<article><h3>${esc(item.name)}</h3><p>${esc(item.note)}</p><div class="atlas-sources">${item.sources.map(source).join('')}</div></article>`).join('');
  const walk=walkingControls(q('.atlas-walk'),()=>loadJson('walking.json'),value=>{walkRoute=value;paintWalk();});
  const districtDialog=q('.atlas-district-dialog');
  q('[data-districts]').onclick=()=>districtDialog.showModal();
  districtDialog.querySelector('button').onclick=()=>districtDialog.close();
  function paintWalk() {
    const layer=q('.atlas-route-path');
    if(!layer)return;
    layer.replaceChildren();
    if(region!=='base'||!walkRoute||!q('.atlas-walk').open)return;
    const ns='http://www.w3.org/2000/svg';
    for(const type of ['shadow',walkRoute.mode]) {
      const path=document.createElementNS(ns,'path');
      path.setAttribute('d',walkRoute.path);path.setAttribute('class','route-'+type);layer.append(path);
    }
    for(const id of [walkRoute.from,walkRoute.to]){
      const m=regions.base.markers.find(p=>p.id===id);
      const circle=document.createElementNS(ns,'circle');
      circle.setAttribute('cx',m.x);circle.setAttribute('cy',m.y);circle.setAttribute('r',9);layer.append(circle);
    }
  }
  function syncHash(hash) {
    if(window.FamilyNavigation)window.FamilyNavigation.go(hash,{replace:true});
    else history.replaceState(history.state,'',hash);
    lastHash=location.hash;
  }
  function panelMode(person) {
    q('.atlas-person-select').hidden=!person;
    for(const button of panel.querySelectorAll('[data-evidence-mode]'))button.setAttribute('aria-pressed',String((button.dataset.evidenceMode==='person')===person));
  }
  function renderPerson(id, write=true) {
    const p=people[id];if(!p)return;
    clearTimeout(hoverTimer);personId=id;panelMode(true);
    q('#atlasPerson').value=id;placeSelect.selectedIndex=-1;
    const stops=new Set(p.places.map(row=>row[1]));
    for(const marker of root.querySelectorAll('[data-place]'))marker.setAttribute('aria-pressed',String(stops.has(marker.dataset.place)));
    q('#atlasPlaceTitle').textContent=p.name;q('#atlasArea').textContent=p.branch;
    const cards=p.places.map(([key,place,kind,note])=>`<article class="atlas-person-stop"><h4>${placeLink(key,place,places[place].title)}</h4><span class="atlas-kind">${esc(kind)}</span><p>${esc(note)}</p></article>`).join('');
    const relatives=(p.related||[]).map(key=>personLink(key,people[key].name)).join(' · ');
    const treeHome=p.tree&&document.documentElement.getAttribute('data-keha-'+p.tree+'-home');
    q('.atlas-detail').innerHTML=`<p class="atlas-person-intro">${esc(p.note)}</p>${cards}${relatives?`<section class="atlas-linked-people"><h3>קשרים במשפחה</h3><div>${relatives}</div></section>`:''}<section class="atlas-person-sources"><h3>מקורות</h3><div class="atlas-sources">${p.sources.map(source).join('')}</div></section>${treeHome?`<a class="atlas-tree-link" href="${esc(treeHome)}#tree">האילן המשפחתי של הענף</a>`:''}`;
    panel.scrollTop=0;q('#atlasStatus').textContent=p.name+' · '+p.branch;
    if(write)syncHash('#family-map/person/'+id);
  }
  function record(row) {
    return `<article class="atlas-record" data-group="${row.group}"><div>${row.kind?`<span class="atlas-kind">${esc(row.kind)}</span>`:''}<h4>${esc(row.period)}</h4></div><p>${esc(row.body)}</p><div class="atlas-sources">${row.sources.map(source).join('')}</div></article>`;
  }
  function renderEvidence(id) {
    const r=places[id];
    panelMode(false);
    q('#atlasPlaceTitle').textContent=r?.title||'אין מקומות בסינון הזה';
    q('#atlasArea').textContent=r?r.area+' · '+r.level:'אפשר לבחור סוג אזכור אחר.';
    const detail=q('.atlas-detail');
    if (!r) {detail.replaceChildren();return;}
    const rows = key=>r.items.filter(item=>item.group===key).map(record).join('');
    const family=rows('family');
    const remaining=['maybe','other','context'].map(key=>{
      const content=rows(key);
      return content?`<section class="atlas-other" data-group="${key}"><h3>${symbol(key)}${esc(groups[key])}</h3>${content}</section>`:'';
    }).join('');
    const images=(r.scans||[]).map(key=>{
      const image=scans[key];
      return `<figure><a href="${asset(key+'.webp')}" target="_blank" rel="noopener"><img loading="lazy" src="${asset(key+'.webp')}" alt="${esc(image.caption)}"></a><figcaption>${esc(image.caption)} ${source(image.source)}</figcaption></figure>`;
    }).join('');
    const relatedPeople=Object.entries(people).filter(([,p])=>p.places.some(row=>row[1]===id));
    const personLinks=relatedPeople.length?`<section class="atlas-linked-people"><h3>בני המשפחה שנזכרים כאן</h3><div>${relatedPeople.map(([key,p])=>personLink(key,p.name)).join('')}</div></section>`:'';
    const related=(r.related||[]).map(([key,place,title])=>placeLink(key,place,title)).join('');
    detail.innerHTML=`${personLinks}<section class="atlas-ours"><h3>${symbol('family')}משפחת קהא שלנו</h3>${family||'<p class="atlas-no-evidence">במקורות שנאספו עד כה אין עדות הקושרת בן משפחה מסוים למקום הזה.</p>'}</section>${remaining}${images?`<details class="atlas-facsimiles"><summary>תצלומי התעודות (${r.scans.length})</summary>${images}</details>`:''}${r.georef?`<div class="atlas-georef">${source(r.georef)}</div>`:''}<div class="atlas-related">${related}${walkPlaces.has(id)?'<button type="button" data-walk-from="'+esc(id)+'">חישוב מרחק הליכה מכאן</button>':''}</div>`;
    panel.scrollTop=0;
  }
  function show(id) {
    selected=id||'';
    placeSelect.value=selected;
    for (const node of root.querySelectorAll('[data-place]')) node.setAttribute('aria-pressed',String(node.dataset.place===selected));
    renderEvidence(selected);
    q('#atlasStatus').textContent = selected ? 'העדויות המוצגות כעת · '+places[selected].title : 'אין מקומות בסינון הזה';
  }
  function scrollTo(el) {
    el.focus({preventScroll:true});
    el.scrollIntoView({block:'start',behavior:'instant'});
  }
  function choose(id, deliberate=false) {
    if (!id || !places[id]) return;
    clearTimeout(hoverTimer);
    if(personId&&!deliberate)return;
    if (selected!==id||personId) {personId='';show(id);}
    if (deliberate) {
      syncHash('#family-map/'+region+'/'+id);
      if (narrow.matches) scrollTo(panel);
    }
  }
  function drawLocator() {
    const country=region==='israel'?'israel':'yemen';
    const rect=locatorBox(camera,regions[region].projection,locators[country]);
    const edge=rect.x+rect.w, cy=rect.y+rect.h/2;
    const side=edge<247?1:-1, target=side===1?edge:rect.x;
    const start=clamp(target+side*50,7,293), sy=clamp(cy-25,8,154);
    const angle=Math.atan2(cy-sy,target-start)*180/Math.PI;
    const label=country==='israel'?'ארץ ישראל':'תימן';
    const fill=country==='israel'?'':`<text x="158" y="89" text-anchor="middle" direction="rtl">תימן</text><circle cx="267" cy="143" r="1.7"/><text class="atlas-island" x="267" y="156" text-anchor="middle" direction="rtl">סוקוטרה</text>`;
    const svg=`<svg viewBox="0 0 300 162" direction="ltr" aria-hidden="true"><image width="300" height="162" href="${asset('locator-'+country+'.svg')}"/>${fill}<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" class="atlas-locator-box"/><path d="M${start} ${sy}L${target} ${cy}" class="atlas-locator-arrow"/><path transform="translate(${target} ${cy}) rotate(${angle})" d="M0 0 -9 -4 -7 0 -9 4Z" fill="#993e27"/></svg>`;
    q('.atlas-mini').innerHTML=svg;
    q('.atlas-locator-caption').textContent='מפת '+label+'  ⤢';
    q('.atlas-locator').setAttribute('aria-label','הגדלת מפת '+label+' עם מסגרת סביב '+regions[region].title);
    q('.atlas-overview h2').textContent='המיקום במפת '+label;
    if (overview.open) q('.atlas-big-locator').innerHTML=svg;
  }
  function paintFrame() {
    plot.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].join(' '));
    plot.dataset.zoomed=String(camera.k>1.01);
    q('[data-zoom=out]').disabled=camera.k<=1;
    q('[data-zoom=in]').disabled=camera.k>=6;
    const scale=regions[region].pxkm*camera.k, goal=90/scale;
    const km=[.2,.5,1,2,5,10,20,50,100,200].reduce((a,b)=>Math.abs(Math.log(b/goal))<Math.abs(Math.log(a/goal))?b:a);
    const line=q('.atlas-scale');
    line.style.width=(100*km*scale/WIDTH)+'%';
    line.textContent=km+' ק״מ';
    drawLocator();
  }
  function redraw(preferred) {
    clearTimeout(hoverTimer);
    const r=regions[region];
    const isBase=region==='base', north=isBase||region==='north';
    root.dataset.atlasRegion=region;
    const visible=r.markers.filter(m=>filter==='all'||m.tags.includes(filter));
    const ids=r.ids.filter(id=>visible.some(m=>m.to===id));
    for (const el of root.querySelectorAll('[data-region]')) el.setAttribute('aria-pressed',String(el.dataset.region===(isBase?'north':region)));
    for (const el of root.querySelectorAll('[data-layer]')) el.setAttribute('aria-pressed',String(el.dataset.layer===region));
    q('.atlas-north-tools').hidden=!north;q('.atlas-letter-key').hidden=!isBase;
    q('.atlas-walk').hidden=!isBase;q('.atlas-air').hidden=isBase;
    q('.atlas-uncertain-places').hidden=region==='israel';
    q('.atlas-legend').innerHTML=isBase?
      '<span><i class="base-key city">★</i>צעדה</span><span><i class="base-key known">●</i>יישוב מזוהה</span><span><i class="base-key candidate">◇</i>זיהוי היסטורי מוצע</span><span><i class="base-key ref">□</i>מקום להשוואה</span>':
      Object.entries(groups).map(([id,name])=>`<span>${symbol(id)}${esc(name)}</span>`).join('');
    q('.atlas-footnote').textContent=isBase?'הצבעים ברקע מפרידים בין הנפות בימינו. האותיות א–ג מפנות לאזורים שנזכרים בעדויות המשפחה.':'מסגרת מקווקוות סביב שם מסמנת אזור. טבעת מקווקוות סביב נקודה מסמנת זיהוי גאוגרפי משוער.';
    q('#atlasRegion').textContent=r.title;
    placeSelect.innerHTML=ids.length?ids.map(id=>option(id,places[id].title)).join(''):option('','אין מקומות');
    placeSelect.disabled=!ids.length;
    plot.dataset.compact=String(phone.matches);
    const label=m=>isBase?baseMarker(m,places[m.to]):marker(m,places[m.to],filter==='all'?m.cls:filter,measure,phone.matches);
    plot.innerHTML=`<image width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="none" href="${asset(region+'.webp')}"/><image width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="none" href="${asset(region+'-boundaries.svg')}"/><g class="atlas-route-path" aria-hidden="true"></g>`+
      r.labels.map(([x,y,name,kind])=>`<text class="atlas-base ${esc(kind)}" x="${x}" y="${y}" direction="rtl" text-anchor="middle">${esc(name)}</text>`).join('')+
      visible.map(label).join('');
    q('.atlas-index').innerHTML=ids.map(id=>`<button type="button" data-place="${id}">${esc(places[id].title)}</button>`).join('');
    q('.atlas-distances').innerHTML='<p>מרחק בקו אווירי בין היישובים בני ימינו. אורך שבילי ההליכה ההיסטוריים אינו ידוע.</p><table><thead><tr><th>מוצא</th><th>יעד</th><th>ק״מ</th></tr></thead><tbody>'+
      r.distances.map(([a,b])=>`<tr><td>${esc(places[a].title)}</td><td>${esc(places[b].title)}</td><td>${airDistance(coords[a],coords[b]).toFixed(1)}</td></tr>`).join('')+'</tbody></table>';
    for(const chip of q('.atlas-letter-key').querySelectorAll('[data-place]'))chip.disabled=!ids.includes(chip.dataset.place);
    show([preferred,firstPlace[region],ids[0]].find(id=>ids.includes(id)));
    paintFrame();
    paintWalk();
  }
  function toPlace(key,id,scroll=false,write=true) {
    if(!Object.hasOwn(regions,key))return;
    const r=regions[key];personId='';
    if(region!==key){region=key;camera=frame();}
    if(id&&!r.markers.some(m=>m.to===id&&(filter==='all'||m.tags.includes(filter))))filter='all';
    q('#atlasFilter').value=filter;
    redraw(id);
    if(write)syncHash('#family-map/'+key+(selected?'/'+selected:''));
    if(scroll&&narrow.matches)scrollTo(panel);
  }
  function toPerson(id,write=true) {
    if(!Object.hasOwn(people,id))return;
    const stops=people[id].places;
    filter='all';q('#atlasFilter').value='all';
    if(stops.length&&!stops.some(([,place])=>regions[region].ids.includes(place))){
      region=stops[0][0];camera=frame();
    }
    redraw(selected);renderPerson(id,write);
  }
  function route() {
    const [view,key,id]=location.hash.slice(1).split('/');
    if(view!=='family-map'){lastHash='';return false;}
    if(lastHash===location.hash)return true;
    lastHash=location.hash;filter='all';q('#atlasFilter').value='all';camera=frame();
    if(key==='person'&&Object.hasOwn(people,id)){toPerson(id,false);return true;}
    const target=Object.hasOwn(regions,key)?key:'base';
    const knownPlace=regions[target].ids.includes(id);
    toPlace(target,knownPlace?id:undefined,false,!knownPlace&&!!key);
    return true;
  }
  root.addEventListener('click', e=>{
    const anchor=e.target.closest('[data-person],[data-map-place]');
    if(anchor){
      if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
      e.preventDefault();
      if(anchor.dataset.person)toPerson(anchor.dataset.person);
      else toPlace(anchor.dataset.mapRegion,anchor.dataset.mapPlace,true);
      return;
    }
    const mode=e.target.closest('[data-evidence-mode]')?.dataset.evidenceMode;
    if(e.target.closest('[data-walk-map]')){scrollTo(plot);return;}
    if(mode==='person'){
      const here=Object.keys(people).find(id=>people[id].places.some(stop=>stop[1]===selected));
      toPerson(personId||here||'shlomo-zechariah');return;
    }
    if(mode==='place'){toPlace(region,selected);return;}
    const start=e.target.closest('[data-walk-from]'), opener=e.target.closest('[data-open-walk]');
    if(start||opener){if(region!=='base')toPlace('base',start?.dataset.walkFrom||'saada');walk.openAt(start?.dataset.walkFrom);return;}
    const tab=e.target.closest('[data-region]'), area=e.target.closest('[data-layer]'), point=e.target.closest('[data-place]');
    if (tab) {
      filter='all';toPlace(tab.dataset.region==='north'?'base':tab.dataset.region);
    } else if(area){toPlace(area.dataset.layer,selected);}
    else if (point && performance.now()>suppressClick) choose(point.dataset.place,true);
  });
  q('#atlasPerson').addEventListener('change',e=>toPerson(e.target.value));
  q('#atlasFilter').addEventListener('change',e=>{personId='';filter=e.target.value;redraw(selected);syncHash('#family-map/'+region+(selected?'/'+selected:''));});
  placeSelect.addEventListener('change',e=>choose(e.target.value,true));
  root.addEventListener('pointerover',e=>{
    const n=e.target.closest('[data-place]');
    if (!n||n.contains(e.relatedTarget)||e.pointerType==='touch'||e.buttons||pointers.size) return;
    clearTimeout(hoverTimer);
    hoverTimer=setTimeout(()=>choose(n.dataset.place),95);
  });
  root.addEventListener('pointerout',e=>{const n=e.target.closest('[data-place]');if(n&&!n.contains(e.relatedTarget))clearTimeout(hoverTimer);});
  root.addEventListener('focusin',e=>{const n=e.target.closest('[data-place]');if(n&&n.matches(':focus-visible'))choose(n.dataset.place);});
  q('.atlas-back').onclick=()=>scrollTo(plot);
  q('.atlas-locator').onclick=()=>{overview.showModal();drawLocator();};
  overview.querySelector('button').onclick=()=>overview.close();
  const pointers=new Map();
  let drag, pinch, suppressClick=-1;
  const relative=(x,y)=>{const b=plot.getBoundingClientRect();return [(x-b.left)/b.width,(y-b.top)/b.height];};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function zoom(value,fx,fy) {camera=zoomAt(camera,value,fx,fy);paintFrame();}
  q('.atlas-zoom').onclick=e=>{
    const action=e.target.closest('button')?.dataset.zoom;
    if (action==='fit') {camera=frame();paintFrame();}
    if (action==='in'||action==='out') zoom(camera.k*(action==='in'?1.5:1/1.5));
  };
  plot.addEventListener('keydown',e=>{
    if (e.target.closest('[data-place]')&&['Enter',' '].includes(e.key)) {e.preventDefault();choose(e.target.closest('[data-place]').dataset.place,true);return;}
    if (!['+','=','-','Home','ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if (e.key==='Home') camera=frame();
    else if (['+','=','-'].includes(e.key)) camera=zoomAt(camera,camera.k*(e.key==='-'?1/1.5:1.5));
    else {
      const step=55/camera.k;
      camera=frame(camera.k,camera.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),camera.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));
    }
    paintFrame();
  });
  plot.addEventListener('wheel',e=>{
    e.preventDefault();clearTimeout(hoverTimer);
    zoom(camera.k*Math.exp(-clamp(e.deltaY,-100,100)*.004),...relative(e.clientX,e.clientY));
  },{passive:false});
  plot.addEventListener('pointerdown',e=>{
    if (e.button!==0) return;
    clearTimeout(hoverTimer);
    const at={x:e.clientX,y:e.clientY};
    pointers.set(e.pointerId,at);
    if (pointers.size===1) drag={start:at,last:at,moved:false};
    if (pointers.size===2) {
      const [a,b]=[...pointers.values()];
      pinch={camera,dist:Math.max(1,dist(a,b)),at:relative((a.x+b.x)/2,(a.y+b.y)/2)};
      drag=null;
      for (const id of pointers.keys()) plot.setPointerCapture(id);
    }
  });
  plot.addEventListener('pointermove',e=>{
    if (!pointers.has(e.pointerId)) return;
    const at={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,at);
    if (pinch && pointers.size===2) {
      const [a,b]=[...pointers.values()], [fx,fy]=relative((a.x+b.x)/2,(a.y+b.y)/2);
      const seed=pinch.camera, next=frame(seed.k*dist(a,b)/pinch.dist);
      camera=frame(next.k,seed.x+pinch.at[0]*seed.w-fx*next.w,seed.y+pinch.at[1]*seed.h-fy*next.h);
      paintFrame();return;
    }
    if (!drag) return;
    if (!drag.moved && dist(at,drag.start)>5) {drag.moved=true;plot.setPointerCapture(e.pointerId);}
    if (drag.moved) {
      const b=plot.getBoundingClientRect();
      camera=frame(camera.k,camera.x+(drag.last.x-at.x)*camera.w/b.width,camera.y+(drag.last.y-at.y)*camera.h/b.height);
      paintFrame();
    }
    drag.last=at;
  });
  function release(e) {
    if (!pointers.has(e.pointerId)) return;
    if (pinch||drag?.moved) suppressClick=performance.now()+360;
    pointers.delete(e.pointerId);pinch=null;drag=null;
    if (plot.hasPointerCapture(e.pointerId)) plot.releasePointerCapture(e.pointerId);
  }
  plot.addEventListener('pointerup',release);
  plot.addEventListener('pointercancel',release);
  plot.addEventListener('pointerleave',e=>{if(!plot.hasPointerCapture(e.pointerId))release(e);});
  phone.addEventListener?.('change',()=>{redraw(selected);if(personId)renderPerson(personId,false);});
  root.addEventListener('atlas-open',route);
  window.addEventListener('hashchange',route);
  window.addEventListener('popstate',route);
  if (!route()) redraw();
}
if (root) {
  root.addEventListener('atlas-open',openAtlas);
  if (!root.hidden) openAtlas();
}
