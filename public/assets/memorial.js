(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lit=new Set();let ready=false,view='tree';
  try{const saved=JSON.parse(localStorage.getItem('keha-memorial-candles')||'[]');if(Array.isArray(saved))saved.filter(id=>typeof id==='string').forEach(id=>lit.add(id));}catch{}
  function date(value){return value&&value!=='1.1.1111'?I.date(value):tr('טרם הוזן','Not yet recorded');}
  function card(person){
    const p=app().getPersonSummary(person.id),name=I.personName(p),initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join(''),isLit=lit.has(p.id);
    return `<article class="remembrance-card${isLit?' candle-is-lit':''}" data-remembrance="${safe(p.id)}"><a class="remembrance-portrait" href="#person/${encodeURIComponent(p.id)}" aria-label="${tr('לעמוד הזיכרונות של','Memories of')} ${safe(name)}">${p.profile?`<img src="${safe(p.profile)}" alt="${safe(name)}" loading="lazy">`:`<span class="remembrance-initials">${safe(initials)}</span>`}</a><div class="remembrance-card-body"><span class="remembrance-blessing">${tr('זכרם לברכה','In loving memory')}</span><h3><a href="#person/${encodeURIComponent(p.id)}">${safe(name)}</a></h3><dl class="remembrance-dates"><div><dt>${tr('לידה','Born')}</dt><dd><bdi>${safe(date(p.birthday))}</bdi></dd></div><span aria-hidden="true">—</span><div><dt>${tr('פטירה','Died')}</dt><dd><bdi>${safe(date(p.deathDate))}</bdi></dd></div></dl><div class="remembrance-candle" aria-hidden="true"><span class="candle-halo"></span><span class="candle-flame"></span><span class="candle-wick"></span><span class="candle-wax"></span><span class="candle-base"></span></div><button class="remembrance-light" type="button" data-light-candle="${safe(p.id)}" aria-pressed="${isLit}">${isLit?tr('הנר שלך דולק לזכרם','Your candle is lit in their memory'):tr('הדלקת נר לזכרם','Light a candle in their memory')}</button><a class="remembrance-memories-link" href="#person/${encodeURIComponent(p.id)}">${tr('אל הזיכרונות והתמונות','Visit their memories and photos')} <span aria-hidden="true">${I.isEnglish?'→':'←'}</span></a></div></article>`;
  }
  function render(){
    if(!ready||view!=='memorial')return;
    const people=app().getPeople().filter(person=>app().getPersonSummary(person.id).deceased);
    $('memorialContent').innerHTML=`<header class="remembrance-intro"><span class="remembrance-flower" aria-hidden="true">❖</span><p class="small-eyebrow">${tr('בלב המשפחה, תמיד','Always in the heart of the family')}</p><h2>${tr('מדליקים נר לזכרם','Lighting a candle in their memory')}</h2><p>${tr('האנשים שלימדו אותנו אהבה, והזיכרונות שממשיכים איתנו.','The people who taught us love, and the memories we carry with us.')}</p><span class="remembrance-intro-line" aria-hidden="true"></span></header><div class="remembrance-grid">${people.map(card).join('')}</div><p class="remembrance-closing">${tr('מה שהשאירו בלבנו, ממשיך לחיות בינינו.','What they left in our hearts lives on among us.')}</p><p class="visually-hidden" id="memorialCandleStatus" role="status" aria-live="polite"></p>`;
  }
  function activate(next){view=next;$('memorialView').hidden=next!=='memorial';render();}
  function init(){
    ready=true;activate(app().getView());
    $('memorialContent').addEventListener('click',event=>{
      const button=event.target.closest('[data-light-candle]');if(!button)return;
      const id=button.dataset.lightCandle;if(lit.has(id))return;
      lit.add(id);try{localStorage.setItem('keha-memorial-candles',JSON.stringify([...lit]));}catch{}
      button.closest('[data-remembrance]').classList.add('candle-is-lit');button.setAttribute('aria-pressed','true');button.textContent=tr('הנר שלך דולק לזכרם','Your candle is lit in their memory');
      $('memorialCandleStatus').textContent=tr('הודלק נר לזכר ','A candle was lit in memory of ')+app().nameOf(id);
    });
    window.addEventListener('family-people-loaded',render);window.addEventListener('family-person-changed',render);
  }
  window.FamilyMemorial={activate};document.addEventListener('DOMContentLoaded',init);
})();
