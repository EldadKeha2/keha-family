(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp,tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let visitor;try{visitor=localStorage.getItem('keha-candle-visitor');}catch{}
  if(!/^[a-f0-9]{32}$/.test(visitor||'')){visitor=crypto.randomUUID().replaceAll('-','');try{localStorage.setItem('keha-candle-visitor',visitor);}catch{}}
  let ready=false,view='tree',candles={},loaded=false,loading=false,error='',lastLoaded=0,day='';const pending=new Set();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=value=>value&&value!=='1.1.1111'?I.date(value):tr('טרם הוזן','Not yet recorded');
  function card(person){
    const p=app().getPersonSummary(person.id),name=I.personName(p),initials=name.split(/\s+/).filter(Boolean).map(p=>p[0]).slice(0,2).join(''),c=candles[p.id],isLit=Boolean(c?.lit);
    return `<article class="remembrance-card${isLit?' candle-is-lit':''}" data-remembrance="${safe(p.id)}"><a class="remembrance-portrait" href="#person/${encodeURIComponent(p.id)}" aria-label="${tr('לעמוד הזיכרונות של','Memories of')} ${safe(name)}">${p.profile?`<img src="${safe(p.profile)}" alt="${safe(name)}" loading="lazy">`:`<span class="remembrance-initials">${safe(initials)}</span>`}</a><div class="remembrance-card-body"><span class="remembrance-blessing">${tr('זכרם לברכה','In loving memory')}</span><h3><a href="#person/${encodeURIComponent(p.id)}">${safe(name)}</a></h3><dl class="remembrance-dates"><div><dt>${tr('לידה','Born')}</dt><dd><bdi>${safe(date(p.birthday))}</bdi></dd></div><span aria-hidden="true">—</span><div><dt>${tr('פטירה','Died')}</dt><dd><bdi>${safe(date(p.deathDate))}</bdi></dd></div></dl><div class="remembrance-candle" aria-hidden="true"><span class="candle-halo"></span><span class="candle-flame"></span><span class="candle-wick"></span><span class="candle-wax"></span><span class="candle-base"></span></div><p class="remembrance-count" aria-live="polite"><strong>${c?c.count.toLocaleString(I.locale):'—'}</strong> ${tr('נרות הודלקו לזכרם','candles lit in their memory')}</p><button class="remembrance-light" type="button" data-light-candle="${safe(p.id)}" aria-pressed="${isLit}" ${!loaded||pending.has(p.id)||isLit?'disabled':''}>${pending.has(p.id)?tr('מדליק…','Lighting…'):isLit?tr('הנר שלך דולק לזכרם','Your candle is lit in their memory'):tr('הדלקת נר לזכרם','Light a candle in their memory')}</button><small class="remembrance-reset">${c?.resetsOn?tr('הספירה מתחדשת ביום הפטירה','The count renews on the death anniversary'):tr('ספירת נרות משותפת לכל המשפחה','A candle count shared by the whole family')}</small><a class="remembrance-memories-link" href="#person/${encodeURIComponent(p.id)}">${tr('אל הזיכרונות והתמונות','Visit their memories and photos')} <span aria-hidden="true">${I.isEnglish?'→':'←'}</span></a></div></article>`;
  }
  function render(){
    if(!ready||view!=='memorial')return;
    const people=app().getPeople().filter(p=>app().getPersonSummary(p.id).deceased);
    $('memorialContent').innerHTML=`<header class="remembrance-intro"><span class="remembrance-flower" aria-hidden="true">❖</span><p class="small-eyebrow">${tr('בלב המשפחה, תמיד','Always in the heart of the family')}</p><h2>${tr('מדליקים נר לזכרם','Lighting a candle in their memory')}</h2><p>${tr('האנשים שלימדו אותנו אהבה, והזיכרונות שממשיכים איתנו.','The people who taught us love, and the memories we carry with us.')}</p><span class="remembrance-intro-line" aria-hidden="true"></span></header><p class="remembrance-status" role="status">${safe(error||(!loaded?tr('טוען את ספירת הנרות…','Loading candle counts…'):''))}${error?` <button type="button" data-candle-retry>${tr('ניסיון נוסף','Try again')}</button>`:''}</p><div class="remembrance-grid">${people.map(card).join('')}</div><p class="remembrance-closing">${tr('מה שהשאירו בלבנו, ממשיך לחיות בינינו.','What they left in our hearts lives on among us.')}</p><p class="visually-hidden" id="memorialCandleStatus" role="status" aria-live="polite"></p>`;
  }
  async function load(){
    if(loading)return;loading=true;
    try{const response=await I.fetch('api/memorial',{cache:'no-store',headers:{'X-Candle-Visitor':visitor}}),result=await response.json();if(!response.ok)throw Error(I.error(result.error));candles=result.candles;loaded=true;error='';lastLoaded=Date.now();day=today();}
    catch(e){error=e.message||tr('לא ניתן לטעון את ספירת הנרות כרגע.','Candle counts are currently unavailable.');}finally{loading=false;render();}
  }
  function activate(next){view=next;$('memorialView').hidden=next!=='memorial';render();if(ready&&next==='memorial'&&Date.now()-lastLoaded>30000)load();}
  function init(){
    ready=true;activate(app().getView());
    $('memorialContent').addEventListener('click',async event=>{
      if(event.target.closest('[data-candle-retry]')){load();return;}
      const button=event.target.closest('[data-light-candle]');if(!button||button.disabled)return;
      const id=button.dataset.lightCandle;if(pending.has(id)||candles[id]?.lit)return;pending.add(id);render();
      try{const response=await I.fetch('api/memorial/'+encodeURIComponent(id)+'/candles',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN},body:JSON.stringify({visitorId:visitor})}),result=await response.json();if(!response.ok)throw Error(I.error(result.error));candles[id]=result.candle;error='';}
      catch(e){error=e.message;}finally{pending.delete(id);render();}
      if(!error&&$('memorialCandleStatus'))$('memorialCandleStatus').textContent=tr('הודלק נר לזכר ','A candle was lit in memory of ')+app().nameOf(id);
    });
    window.addEventListener('family-people-loaded',render);window.addEventListener('family-person-changed',render);
    document.addEventListener('visibilitychange',()=>{if(view==='memorial'&&document.visibilityState==='visible'&&Date.now()-lastLoaded>30000)load();});
    setInterval(()=>{if(view==='memorial'&&document.visibilityState==='visible'&&day&&today()!==day)load();},60000);
  }
  window.FamilyMemorial={activate};document.addEventListener('DOMContentLoaded',init);
})();
