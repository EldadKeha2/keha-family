(() => {
  'use strict';
  const I18n=window.FamilyI18n;
  const $=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=value=>String(value).normalize('NFKD').replace(/[\u0591-\u05c7'"׳״]/g,'').toLowerCase().trim();
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const state={view:'tree',mode:'gregorian',anchor:today(),data:null,ready:false,serial:0,query:'',loadedAt:0};
  function holidayIcon(item){const name=item.name+' '+(item.title||'');if(/חנוכה|Chanukah|Hanukkah/i.test(name))return '🕎';if(/פורים|Purim/i.test(name))return '🎭';if(/פסח|Pesach/i.test(name))return '🍷';if(/סוכות|הושענא|Sukkot|Hoshana/i.test(name))return '🌿';if(/שבועות|Shavuot/i.test(name))return '🌾';if(/ראש השנה|Rosh Hashana/i.test(name))return '🍯';if(/שואה|זכרון|כיפור|צום|תענית|תשעה|Shoah|Zikaron|Kippur|Tzom|Taanit|Tisha/i.test(name))return '🕯';return '✦';}
  function birthdayHTML(person){return `<button class="calendar-birthday" data-calendar-person="${safe(person.id)}" title="${safe(person.leapDayObserved?I18n.t('יום ההולדת ב־29.2; מצוין השנה ב־28.2'):person.name)}"><span aria-hidden="true">${person.deceased?'🕯':'🎈'}</span><span><strong>${safe(person.name)}${person.deceased?I18n.t(' ז״ל'):''}</strong>${person.age!==null?I18n.html`<small>יום הולדת ${person.age}</small>`:I18n.t('<small>יום הולדת</small>')}</span></button>`;}
  const holidayHTML=item=>`<div class="calendar-holiday"><span aria-hidden="true">${holidayIcon(item)}</span><span>${safe(item.name)}</span></div>`;
  const matches=day=>!state.query||normalize(day.birthdays.map(person=>I18n.searchNames(person)).join(' ')+' '+day.holidays.map(item=>item.name).join(' ')).includes(normalize(state.query));
  function render(){
    const data=state.data;if(!data)return;
    $('calendarMonthTitle').textContent=data.label;$('calendarMonthTitle').dir=I18n.isEnglish||state.mode==='gregorian'?'ltr':'rtl';
    $('calendarMonthSubtitle').textContent=state.mode==='gregorian'?data.hebrewLabel:data.gregorianLabel;$('calendarJump').value=data.anchor.slice(0,7);
    document.querySelectorAll('[data-calendar-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarMode===state.mode)));
    $('calendarGrid').innerHTML=data.days.map(day=>{
      const count=day.birthdays.length+day.holidays.length,description=`${day.day}.${Number(day.date.slice(5,7))} · ${day.hebrew.dayLabel} ${day.hebrew.month}${count?' · '+count+I18n.t(' אירועים'):''}`;
      return `<article class="calendar-day${day.inMonth?'':' outside-month'}${day.today?' is-today':''}${state.query&&!matches(day)?' calendar-no-match':''}"><button class="calendar-day-date" data-calendar-day="${day.date}" aria-label="${safe(description)}"><bdi>${day.day}</bdi><span>${safe(day.hebrew.dayLabel)}<small>${safe(day.hebrew.month)}</small></span></button><div class="calendar-cell-events">${day.birthdays.map(birthdayHTML).join('')}${day.holidays.map(holidayHTML).join('')}</div>${count?I18n.html`<button class="calendar-mobile-events" data-calendar-day="${day.date}" aria-label="אירועים ביום ${safe(description)}"><span aria-hidden="true">${day.birthdays.length?'🎂':holidayIcon(day.holidays[0])}</span>${count>1?`<small>${count}</small>`:''}</button>`:''}</article>`;
    }).join('');
    const events=data.days.filter(day=>day.inMonth&&(day.birthdays.length||day.holidays.length)&&matches(day));
    $('calendarAgenda').innerHTML=events.map(day=>`<article class="calendar-agenda-day"><button class="calendar-agenda-date" data-calendar-day="${day.date}"><bdi>${day.day}</bdi><span>${safe(day.hebrew.dayLabel+' '+day.hebrew.month)}</span></button><div>${day.birthdays.map(birthdayHTML).join('')}${day.holidays.map(holidayHTML).join('')}</div></article>`).join('')||`<p class="calendar-empty">${state.query?I18n.t('לא נמצאו אירועים בחיפוש הזה.'):I18n.t('חודש של רגעים חדשים. ימי הולדת וחגים יופיעו כאן לפי התאריכים בלוח.')}</p>`;
    $('calendarBirthdayCount').textContent=data.birthdayCount===1?I18n.t('יום הולדת אחד'):data.birthdayCount+I18n.t(' ימי הולדת');
    $('calendarMissing').innerHTML=data.unknownBirthdays?I18n.html`${data.unknownBirthdays} תאריכי לידה עדיין לא הוזנו. <button data-view="directory">לעדכון בבני המשפחה ↗</button>`:'';
    $('calendarWarning').hidden=data.holidaysAvailable;$('calendarPrevious').disabled=data.previous<'1900-01-01';$('calendarNext').disabled=data.next>'2200-12-31';
  }
  async function load(){
    const serial=++state.serial;$('calendarStatus').textContent=I18n.t('פותח את לוח השנה…');
    try{
      const response=await I18n.fetch('api/calendar?'+new URLSearchParams({date:state.anchor,mode:state.mode}),{cache:'no-store'}),data=await response.json();
      if(!response.ok)throw Error(data.error||I18n.t('לוח השנה לא נטען.'));if(serial!==state.serial)return;
      state.data=data;state.anchor=data.anchor;state.loadedAt=Date.now();$('calendarStatus').textContent='';render();
    }catch(error){if(serial===state.serial){$('calendarStatus').textContent=error.message;$('calendarWarning').hidden=false;}}
  }
  function activate(view){state.view=view;$('calendarView').hidden=view!=='calendar';if(!state.ready||view!=='calendar')return;if(state.data)render();if(!state.data||Date.now()-state.loadedAt>30000)load();}
  function search(query){state.query=query;if(state.view==='calendar')render();}
  function dayDetails(value){const day=state.data?.days.find(day=>day.date===value);if(!day)return;$('calendarDayTitle').textContent=I18n.date(`${day.day}.${Number(day.date.slice(5,7))}.${day.date.slice(0,4)}`);$('calendarDaySubtitle').textContent=day.hebrew.dayLabel+' '+day.hebrew.month+' '+day.hebrew.year;$('calendarDayEvents').innerHTML=day.birthdays.map(birthdayHTML).join('')+day.holidays.map(holidayHTML).join('')||I18n.t('<p class="calendar-empty">יום פנוי לרגע משפחתי.</p>');$('calendarDayDialog').showModal();}
  function init(){
    state.ready=true;document.addEventListener('click',event=>{
      const mode=event.target.closest('[data-calendar-mode]');if(mode&&state.mode!==mode.dataset.calendarMode){state.mode=mode.dataset.calendarMode;load();return;}
      const day=event.target.closest('[data-calendar-day]');if(day){dayDetails(day.dataset.calendarDay);return;}
      const person=event.target.closest('[data-calendar-person]');if(person){if($('calendarDayDialog').open)$('calendarDayDialog').close();app().openPerson(person.dataset.calendarPerson);}
    });
    $('calendarPrevious').addEventListener('click',()=>{if(state.data){state.anchor=state.data.previous;load();}});$('calendarNext').addEventListener('click',()=>{if(state.data){state.anchor=state.data.next;load();}});
    $('calendarToday').addEventListener('click',()=>{state.anchor=today();load();});$('calendarRetry').addEventListener('click',load);$('calendarJump').addEventListener('change',()=>{if($('calendarJump').value){state.anchor=$('calendarJump').value+'-15';load();}});
    $('closeCalendarDay').addEventListener('click',()=>$('calendarDayDialog').close());
    let personTimer;window.addEventListener('family-person-changed',()=>{state.loadedAt=0;clearTimeout(personTimer);if(state.view==='calendar')personTimer=setTimeout(load,150);});
    setInterval(()=>{if(state.view==='calendar'&&document.visibilityState==='visible')load();},60000);activate(app().getView());
  }
  window.FamilyCalendar={activate,search};document.addEventListener('DOMContentLoaded',init);
})();
