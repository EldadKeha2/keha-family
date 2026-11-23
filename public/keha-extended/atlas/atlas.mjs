import {WIDTH, HEIGHT, frame, zoomAt, clamp, locatorBox, airDistance, groups, escapeText as esc, marker, symbol} from './cartography.mjs';

const root = document.getElementById('familyMapView');
const asset = name => new URL(name, import.meta.url).href;
const firstPlace = {north:'saada', haydan:'khawlan', yemen:'aden', israel:'shaar'};
const option = (key,label) => `<option value="${esc(key)}">${esc(label)}</option>`;
let loading;

async function openAtlas() {
  if (root.dataset.ready || loading) return;
  loading = Promise.all(['places.json','regions.json','locators.json'].map(async name => {
    const response = await fetch(asset(name));
    if (!response.ok) throw new Error(name);
    return response.json();
  }));
  try {
    const [evidence, regions, locators] = await loading;
    mount(evidence, regions, locators);
    root.dataset.ready = 'true';
  } catch {
    root.innerHTML = '<p role="status">טעינת המפה נקטעה. <button type="button">ניסיון נוסף</button></p>';
    root.querySelector('button').onclick = openAtlas;
  } finally { loading = null; }
}

function mount({places, sources, scans}, regions, locators) {
  let region = 'north', selected = '', filter = 'all', camera = frame(), hoverTimer;
  const q = selector => root.querySelector(selector);
  const coords = Object.fromEntries(Object.values(regions).flatMap(r=>r.markers.filter(m=>m.pos).map(m=>[m.id,m.pos])));
  const narrow = matchMedia('(max-width: 820px)');
  const phone = matchMedia('(max-width: 500px)');
  const help = 'במחשב אפשר לעמוד על שם או סמל כדי לקרוא את העדויות. בטלפון מקישים על מקום.';
  root.innerHTML = `
    <nav class="atlas-regions" aria-label="בחירת אזור במפה">${Object.entries(regions).map(([id,r])=>`<button type="button" data-region="${id}">${esc(r.title)}</button>`).join('')}</nav>
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
        <div class="atlas-stage">
          <svg class="atlas-plot" viewBox="0 0 920 550" dir="ltr" direction="ltr" tabindex="0" role="group" aria-label="${help} מקשי החצים מזיזים את המפה אחרי הגדלה."></svg>
          <div class="atlas-zoom" role="group" aria-label="הגדלת המפה"><button type="button" data-zoom="in" aria-label="הגדלה" title="הגדלה">+</button><button type="button" data-zoom="out" aria-label="הקטנה" title="הקטנה">−</button><button type="button" data-zoom="fit" aria-label="הצגת האזור כולו" title="הצגת האזור כולו"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/></svg></button></div>
          <span class="atlas-compass" aria-hidden="true"><svg viewBox="0 0 20 26"><path fill="#385c70" d="M10 1 3 23l7-5Z"/><path fill="#a97549" d="m10 1 7 22-7-5Z"/></svg>צפון</span>
          <span class="atlas-scale" dir="ltr"></span>
        </div>
      </section>
      <aside class="atlas-evidence" aria-labelledby="atlasPlaceTitle" tabindex="-1">
        <header><span class="atlas-section-label">עדויות לפי מקום</span><h2 id="atlasPlaceTitle"></h2><p id="atlasArea"></p></header>
        <div class="atlas-detail"></div>
        <button class="atlas-back" type="button">חזרה למפה ↑</button>
      </aside>
      <section class="atlas-notes" aria-label="מקרא ומפתח המקומות">
        <div class="atlas-legend">${Object.entries(groups).map(([id,name])=>`<span>${symbol(id)}${esc(name)}</span>`).join('')}</div>
        <p class="atlas-footnote">מסגרת מקווקוות סביב שם מסמנת אזור. טבעת מקווקוות סביב נקודה מסמנת זיהוי גאוגרפי משוער.</p>
        <details><summary>מפתח המקומות באזור</summary><div class="atlas-index"></div></details>
        <details><summary>מרחקים בין המקומות</summary><div class="atlas-distances"></div></details>
        <details><summary>מקורות גאוגרפיים</summary><p>שמות היישובים ונקודות הציון לפי <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>. גבולות המחוזות והנפות בני ימינו לפי <a href="https://data.humdata.org/dataset/cod-ab-yem" target="_blank" rel="noopener">CSO / OCHA</a>. תבליט הקרקע לפי <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>, וקווי החוף לפי <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>.</p></details>
      </section>
    </div>
    <dialog class="atlas-overview"><div><h2></h2><button type="button" aria-label="סגירה">×</button></div><div class="atlas-big-locator"></div><p>המסגרת והחץ מסמנים את השטח שמוצג כרגע במפה המפורטת.</p></dialog>
    <span class="visually-hidden" role="status" aria-live="polite" id="atlasStatus"></span>`;
  const plot=q('.atlas-plot'), panel=q('.atlas-evidence'), placeSelect=q('#atlasPlace'), overview=q('dialog');
  const canvas=document.createElement('canvas').getContext('2d');
  const measure=(text,size)=>{canvas.font='bold '+size+'px Arial';return canvas.measureText(text).width;};
  const source = key => {
    const s=sources[key];
    return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>` : `<span>${esc(s.label)}</span>`;
  };
  function record(row) {
    return `<article class="atlas-record" data-group="${row.group}"><div>${row.kind?`<span class="atlas-kind">${esc(row.kind)}</span>`:''}<h4>${esc(row.period)}</h4></div><p>${esc(row.body)}</p><div class="atlas-sources">${row.sources.map(source).join('')}</div></article>`;
  }
  function renderEvidence(id) {
    const r=places[id];
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
    detail.innerHTML=`<section class="atlas-ours"><h3>${symbol('family')}משפחת קהא שלנו</h3>${family||'<p class="atlas-no-evidence">במקורות שנאספו עד כה אין עדות הקושרת בן משפחה מסוים למקום הזה.</p>'}</section>${remaining}${images?`<details class="atlas-facsimiles"><summary>תצלומי התעודות (${r.scans.length})</summary>${images}</details>`:''}${r.georef?`<div class="atlas-georef">${source(r.georef)}</div>`:''}`;
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
    if (selected!==id) show(id);
    if (deliberate) {
      window.FamilyNavigation?.go('#family-map/'+region+'/'+id,{replace:true});
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
    const visible=r.markers.filter(m=>filter==='all'||m.tags.includes(filter));
    const ids=r.ids.filter(id=>visible.some(m=>m.to===id));
    for (const el of root.querySelectorAll('[data-region]')) el.setAttribute('aria-pressed',String(el.dataset.region===region));
    q('#atlasRegion').textContent=r.title;
    placeSelect.innerHTML=ids.length?ids.map(id=>option(id,places[id].title)).join(''):option('','אין מקומות');
    placeSelect.disabled=!ids.length;
    plot.dataset.compact=String(phone.matches);
    const label=(m)=>marker(m,places[m.to],filter==='all'?m.cls:filter,measure,phone.matches);
    plot.innerHTML=`<image width="${WIDTH}" height="${HEIGHT}" href="${asset(region+'.webp')}"/><image width="${WIDTH}" height="${HEIGHT}" href="${asset(region+'-boundaries.svg')}"/>`+
      r.labels.map(([x,y,name,kind])=>`<text class="atlas-base ${esc(kind)}" x="${x}" y="${y}" direction="rtl" text-anchor="middle">${esc(name)}</text>`).join('')+
      visible.map(label).join('');
    q('.atlas-index').innerHTML=ids.map(id=>`<button type="button" data-place="${id}">${esc(places[id].title)}</button>`).join('');
    q('.atlas-distances').innerHTML='<p>מרחק בקו אווירי בין היישובים בני ימינו. אורך שבילי ההליכה ההיסטוריים אינו ידוע.</p><table><thead><tr><th>מוצא</th><th>יעד</th><th>ק״מ</th></tr></thead><tbody>'+
      r.distances.map(([a,b])=>`<tr><td>${esc(places[a].title)}</td><td>${esc(places[b].title)}</td><td>${airDistance(coords[a],coords[b]).toFixed(1)}</td></tr>`).join('')+'</tbody></table>';
    show([preferred,firstPlace[region],ids[0]].find(id=>ids.includes(id)));
    paintFrame();
  }
  function route() {
    const [view,key,id]=location.hash.slice(1).split('/');
    if (view!=='family-map'||!Object.hasOwn(regions,key)) return false;
    region=key;filter='all';q('#atlasFilter').value=filter;camera=frame();
    const knownPlace=regions[key].ids.includes(id);
    redraw(knownPlace?id:undefined);
    if (!knownPlace) window.FamilyNavigation?.go('#family-map/'+key+'/'+selected,{replace:true});
    return true;
  }
  root.addEventListener('click', e=>{
    const tab=e.target.closest('[data-region]'), point=e.target.closest('[data-place]');
    if (tab) {
      region=tab.dataset.region;camera=frame();redraw();
      window.FamilyNavigation?.go('#family-map/'+region+(selected?'/'+selected:''),{replace:true});
    } else if (point && performance.now()>suppressClick) choose(point.dataset.place,true);
  });
  q('#atlasFilter').addEventListener('change',e=>{filter=e.target.value;redraw(selected);});
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
  phone.addEventListener?.('change',()=>redraw(selected));
  window.addEventListener('hashchange',route);
  window.addEventListener('popstate',route);
  if (!route()) redraw();
}
if (root) {
  root.addEventListener('atlas-open',openAtlas);
  if (!root.hidden) openAtlas();
}
