import {escapeText as esc} from './cartography.mjs';

export function walkEstimate(data, from, to, preference='auto') {
  const pair=data.pairs[[from,to].sort().join('|')];
  if (!pair) return null;
  const mode=preference==='terrain'||!pair.road?'terrain':'road';
  const route=pair[mode], up=pair.from===from?route.up:route.down;
  const low=route.km/4+up/600, high=route.km/3+up/600;
  const unit=high<2.5?.25:high<7?.5:1;
  return {mode,route,up,air:pair.air,hasRoad:!!pair.road,
    lo:Math.floor(low/unit+1e-4)*unit,hi:Math.ceil(high/unit-1e-4)*unit};
}

const km = n => n<10 ? Number(n.toFixed(1)) : Math.round(n);
const number = value => `<bdi dir="ltr">${value}</bdi>`;

export function walkingControls(details, loadData, draw) {
  const container=details.querySelector('.atlas-walk-body');
  let request, data, from='saada', to='haydan', preference='auto';
  function update() {
    const result=walkEstimate(data,from,to,preference);
    const box=container.querySelector('.atlas-walk-result');
    if (!result) {box.textContent='בחרו שני יישובים שונים.';draw(null);return;}
    const {mode,route,up,air,lo,hi,hasRoad}=result;
    const method=mode==='road'?'לפי רשת הדרכים הממופה':'לפי מודל התבליט';
    const detail=mode==='road'?
      `המרחק מנקודת היישוב לדרך הממופה הוא כ־${number(Math.round(data.snap[from]*1000/10)*10)} מ׳ במוצא וכ־${number(Math.round(data.snap[to]*1000/10)*10)} מ׳ ביעד.`:
      (hasRoad?'':'כיסוי הדרכים ליד אחד מקצות המסלול חלקי. ')+'הקו המקווקו מחושב לפי השיפוע. קיומו של שביל בתוואי הזה טרם אומת.';
    box.innerHTML=`<strong>${number(km(route.km))} ק״מ · ${number(lo+'–'+hi)} שעות הליכה</strong><p>${method} · ${number(km(air))} ק״מ בקו אווירי · כ־${number(Math.round(up/10)*10)} מטר טיפוס.</p><p>${detail}</p><button type="button" data-walk-map>הצגת המסלול במפה</button>`;
    draw(details.open?{path:route.path,mode,from,to}:null);
  }
  function render() {
    const options=Object.entries(data.places).sort((a,b)=>a[1].localeCompare(b[1],'he')).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('');
    container.innerHTML=`<div class="atlas-walk-fields"><label>מוצא<select name="from">${options}</select></label><button type="button" data-swap>החלפת כיוון</button><label>יעד<select name="to">${options}</select></label><label>שיטת החישוב<select name="method"><option value="auto">דרך ממופה כשיש כיסוי</option><option value="terrain">מודל תבליט</option></select></label></div>
      <div class="atlas-walk-result" aria-live="polite"></div><p class="atlas-walk-method">האומדן מניח 3–4 קמ״ש ושעה נוספת לכל 600 מטר טיפוס. הוא מתאר זמן הליכה נטו. הדרכים והגובה מבוססים על נתונים בני ימינו.</p>`;
    const a=container.querySelector('[name=from]'), b=container.querySelector('[name=to]'), method=container.querySelector('[name=method]');
    a.value=from;b.value=to;method.value=preference;
    a.onchange=()=>{from=a.value;update();};b.onchange=()=>{to=b.value;update();};
    method.onchange=()=>{preference=method.value;update();};
    container.querySelector('[data-swap]').onclick=()=>{[from,to]=[to,from];a.value=from;b.value=to;update();};
    update();
  }
  async function open() {
    if (data) {if(container.querySelector('[name=from]')){container.querySelector('[name=from]').value=from;container.querySelector('[name=to]').value=to;update();}return;}
    if(request) return request;
    container.textContent='נתוני ההליכה נטענים…';
    request=loadData().then(value=>{data=value;render();}).catch(()=>{
      container.innerHTML='<p>טעינת נתוני ההליכה נקטעה. <button type="button">ניסיון נוסף</button></p>';
      container.querySelector('button').onclick=open;
    }).finally(()=>{request=null;});
    return request;
  }
  details.addEventListener('toggle',()=>{if(details.open)open();else draw(null);});
  return {
    openAt(id) {
      if(id){if(id===to)to=from;from=id;}
      details.open=true;open();
      details.querySelector('summary').focus({preventScroll:true});
      details.scrollIntoView({block:'nearest'});
    }
  };
}
