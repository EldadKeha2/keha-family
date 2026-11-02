(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fresh=()=>Object.fromEntries(['birthdays','anniversaries','memorials'].map(key=>[key,{enabled:true,ids:null}]));
  const state={view:'tree',ready:false,loaded:false,loading:false,enabled:false,prefs:fresh(),mode:'register',token:null,revision:null,language:I.language,busy:false,message:'',error:'',catalog:{}};
  const kinds=[['birthdays','🎈','ימי הולדת','Birthdays'],['anniversaries','💐','ימי נישואים','Wedding anniversaries'],['memorials','🕯','ימי זיכרון','Memorial days']];
  async function api(action,body){
    const response=await I.fetch('api/updates/'+action,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{},...(body?{body:JSON.stringify(body)}:{})});
    let data;try{data=await response.json();}catch{throw Error(tr('לא התקבלה תשובה מהשרת. נסו שוב.','The server did not respond. Please try again.'));}
    if(!response.ok)throw Error(I.error(data.error));return data;
  }
  function catalog(){
    const people=app().getPeople().filter(p=>!p.extra&&!p.placeholder);
    state.catalog.birthdays=people.filter(p=>!p.deceased).map(p=>({id:p.id,name:app().nameOf(p.id),search:I.searchNames(p)}));
    state.catalog.memorials=people.filter(p=>p.deceased).map(p=>({id:p.id,name:app().nameOf(p.id),search:I.searchNames(p)}));
    state.catalog.anniversaries=Object.values(window.FAMILY_DATA.units).filter(unit=>unit.people.length===2&&unit.people.every(id=>!app().getPerson(id)?.deceased)).map(unit=>({id:unit.id,name:unit.people.map(id=>app().nameOf(id)).join(tr(' ו',' & ')),search:unit.people.map(id=>I.searchNames(app().getPerson(id))).join(' ')}));
    for(const items of Object.values(state.catalog))items.sort((a,b)=>a.name.localeCompare(b.name,I.locale));
  }
  function selection(key){
    const pref=state.prefs[key],items=state.catalog[key]||[];
    return `<div class="updates-people-options" ${pref.enabled?'':'hidden'}><label class="updates-check include-future"><input type="checkbox" data-updates-all="${key}" ${pref.ids===null?'checked':''}><span>${tr('כולם, כולל בני משפחה שיתווספו בהמשך','Everyone, including future family additions')}</span></label><div class="updates-people-toolbar"><input type="search" data-updates-search="${key}" placeholder="${tr('חיפוש שם בעברית או באנגלית','Search a Hebrew or English name')}" aria-label="${tr('חיפוש ברשימה','Search this list')}"><button type="button" class="quiet-button" data-updates-none="${key}">${tr('ניקוי הבחירה','Clear selection')}</button></div><div class="updates-people-list">${items.map(item=>`<label class="updates-check" data-updates-option="${safe(item.search)}"><input type="checkbox" data-updates-person="${key}" value="${safe(item.id)}" ${pref.ids===null||pref.ids.includes(item.id)?'checked':''}><span>${safe(item.name)}</span></label>`).join('')||`<p>${tr('אין עדיין שמות בקטגוריה הזו.','No names in this category yet.')}</p>`}</div></div>`;
  }
  function preferenceForm(){
    const all=Object.values(state.prefs).every(p=>p.enabled&&p.ids===null);
    return `<label class="updates-check updates-select-all"><input type="checkbox" id="updatesAll" ${all?'checked':''}><span><strong>${tr('כל העדכונים','All updates')}</strong><small>${tr('ימי הולדת, ימי נישואים וימי זיכרון של כולם','Birthdays, wedding anniversaries and memorial days for everyone')}</small></span></label><div class="updates-categories">${kinds.map(([key,icon,he,en])=>`<details class="updates-category"><summary><span class="updates-category-icon" aria-hidden="true">${icon}</span><strong>${I.isEnglish?en:he}</strong><label class="updates-category-toggle"><input type="checkbox" data-updates-category="${key}" aria-label="${safe(I.isEnglish?en:he)}" ${state.prefs[key].enabled?'checked':''}><span>${tr('קבלת עדכונים','Receive updates')}</span></label></summary>${selection(key)}</details>`).join('')}</div><label class="updates-language">${tr('שפת המיילים','Email language')}<select id="updatesLanguage"><option value="he" ${state.language==='he'?'selected':''}>עברית</option><option value="en-US" ${state.language==='en-US'?'selected':''}>English (US)</option><option value="en-GB" ${state.language==='en-GB'?'selected':''}>English (UK)</option></select></label>`;
  }
  function feedback(){
    if($('updatesError'))$('updatesError').textContent=state.error;
    if($('updatesMessage'))$('updatesMessage').textContent=state.message;
  }
  function render(){
    if(!state.ready)return;
    const manage=state.mode==='manage',confirm=state.mode==='confirm',unsubscribe=state.mode==='unsubscribe';
    const heading=`<header class="updates-intro"><span class="updates-envelope" aria-hidden="true">✉</span><div><span class="small-eyebrow">${tr('לא מפספסים את הרגעים שלנו','Remembering our shared moments')}</span><h3>${tr('קרובים, גם דרך המייל','A little closer, by email')}</h3><p>${tr('שמחות קטנות, תאריכים חשובים וזיכרונות שנשארים איתנו.','Little celebrations, important dates and memories we carry with us.')}</p></div></header>`;
    const notice=!state.enabled?`<p class="updates-setup-notice" role="status">${state.loading?tr('בודק את חיבור המייל…','Checking email delivery…'):tr('שליחת העדכונים עדיין בהגדרה. אפשר לעיין באפשרויות ובדוגמאות; ההרשמה תיפתח אחרי חיבור כתובת השולח.','Email delivery is being set up. Explore the options and previews; registration will open once the sender is connected.')}</p>`:'';
    const messages='<p class="form-error" id="updatesError" role="alert"></p><p class="updates-success" id="updatesMessage" role="status"></p>';
    if(confirm||unsubscribe){
      $('updatesContent').innerHTML=heading+notice+`<div class="updates-action-card"><h4>${confirm?tr('אישור הרשמה לעדכונים','Confirm your subscription'):tr('הסרה מעדכוני המשפחה','Unsubscribe from family updates')}</h4><p>${confirm?tr('לחצו לאישור כתובת המייל ולהפעלת התזכורות שבחרתם.','Confirm your email to activate the reminders you selected.'):tr('לחצו למטה כדי להפסיק את כל עדכוני המייל.','Use the button below to stop all email updates.')}</p>${messages}<button class="primary-button" data-updates-action="${confirm?'confirm':'unsubscribe'}" ${!state.enabled||state.busy?'disabled':''}>${confirm?tr('אישור ההרשמה','Confirm subscription'):tr('הסרה מכל העדכונים','Unsubscribe from all updates')}</button></div>`;feedback();return;
    }
    $('updatesContent').innerHTML=heading+notice+`<div class="updates-layout"><form id="updatesForm" class="updates-form"><h4>${manage?tr('העדכונים שלי','My updates'):tr('על מה תרצו לשמוע?','What would you like to hear about?')}</h4>${manage?'':`<label class="updates-email-label">${tr('כתובת המייל שלכם','Your email address')}<input id="updatesEmail" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="name@example.com" required></label>`}${preferenceForm()}<p class="updates-timing">${tr('התזכורות נשלחות ביום האירוע, החל מ־09:00 שעון ישראל, לפי התאריכים הלועזיים שנשמרו באתר. עדכון תאריך באתר יעדכן גם את התזכורת.','Reminders are sent on the event day, starting at 9:00 a.m. Israel time, using the Gregorian dates saved on the site. Date changes also update future reminders.')}</p>${manage?'':`<label class="updates-check updates-consent"><input type="checkbox" id="updatesConsent" required><span>${tr('אני מסכים/ה לקבל את העדכונים שבחרתי. אפשר להסיר את ההרשמה בכל עת.','I agree to receive the selected updates. I can unsubscribe at any time.')}</span></label>`}${messages}<button class="primary-button updates-submit" type="submit" ${!state.enabled||state.busy?'disabled':''}>${manage?tr('שמירת ההעדפות','Save preferences'):tr('שלחו לי מייל לאישור ההרשמה','Email me a confirmation link')}</button>${manage?`<button class="quiet-button updates-unsubscribe" type="button" data-updates-unsubscribe>${tr('הסרה מכל העדכונים','Unsubscribe from all updates')}</button>`:''}</form><aside class="updates-aside"><div class="updates-privacy"><span aria-hidden="true">♧</span><h4>${tr('המייל שלכם נשאר פרטי','Your email stays private')}</h4><p>${tr('הכתובת נשמרת מוצפנת, אינה מוצגת למבקרי האתר ואינה נכללת בגיבוי הציבורי. ההרשמה מופעלת רק אחרי אישור במייל.','Your address is stored encrypted, is hidden from site visitors and is excluded from public backups. Your subscription starts only after email confirmation.')}</p><p>${tr('הכתובת והעדכונים מועברים לספק המייל לצורך השליחה. בכל מייל יש קישור אישי לניהול ולהסרה; שמרו את הקישור לעצמכם.','Your address and reminders are shared with the email provider for delivery. Each email includes private preference and unsubscribe links; please keep these links to yourself.')}</p></div><div class="updates-previews"><h4>${tr('כך ייראו העדכונים','A look inside your inbox')}</h4>${kinds.map(([key,icon,he,en])=>`<button class="updates-preview-button" type="button" data-email-preview="${key}"><span aria-hidden="true">${icon}</span><span>${I.isEnglish?en:he}</span><span aria-hidden="true">↗</span></button>`).join('')}</div>${manage?'':`<form id="updatesLinkForm" class="updates-link-form"><h4>${tr('כבר נרשמתם?','Already subscribed?')}</h4><p>${tr('קבלו קישור אישי לניהול ההעדפות או להסרה.','Get a private link to manage your preferences or unsubscribe.')}</p><label>${tr('כתובת מייל','Email address')}<input type="email" id="updatesLinkEmail" autocomplete="email" inputmode="email" placeholder="name@example.com" required maxlength="254"></label><button class="secondary-button" type="submit" ${state.enabled?'':'disabled'}>${tr('שליחת קישור אישי','Send my private link')}</button></form>`}</aside></div>`;
    feedback();
  }
  function updateSelection(){
    for(const [key] of kinds){
      const pref=state.prefs[key],category=document.querySelector(`[data-updates-category="${key}"]`);if(category)category.checked=pref.enabled;
      const list=document.querySelector(`[data-updates-all="${key}"]`);if(list){list.checked=pref.ids===null;list.closest('.updates-people-options').hidden=!pref.enabled;}
      for(const input of document.querySelectorAll(`[data-updates-person="${key}"]`))input.checked=pref.ids===null||pref.ids.includes(input.value);
    }
    if($('updatesAll'))$('updatesAll').checked=Object.values(state.prefs).every(p=>p.enabled&&p.ids===null);
  }
  async function load(){
    if(state.loading)return;state.loading=true;render();
    try{const config=await api('config');state.enabled=config.enabled;state.loaded=true;
      if(state.mode==='manage'&&state.enabled){const result=await api('preferences',{token:state.token});state.prefs=result.preferences;state.revision=result.revision;state.language=result.language;}
    }catch(error){state.error=error.message;}finally{state.loading=false;render();}
  }
  function route(){
    if(!location.hash.startsWith('#updates'))return;
    const match=/^#updates\/(confirm|manage|unsubscribe)\/([a-f0-9]{64})$/.exec(location.hash);
    state.mode=match?.[1]||'register';state.token=match?.[2]||null;state.error='';state.message='';
    if(state.ready){catalog();if(match)load();else render();}
  }
  function activate(view){state.view=view;$('updatesView').hidden=view!=='updates';if(!state.ready||view!=='updates')return;catalog();if(!state.loaded)load();else render();}
  async function action(name){
    if(state.busy)return;state.busy=true;state.error='';render();
    try{
      const result=await api(name,{token:state.token});
      if(name==='confirm'){
        state.mode='manage';state.token=result.token;state.prefs=result.preferences;state.revision=result.revision;state.language=result.language;history.replaceState(null,'','#updates/manage/'+state.token);state.message=tr('✓ ההרשמה אושרה. התזכורות שלכם פעילות.','✓ Subscription confirmed. Your reminders are active.');
      }else{state.mode='register';state.token=null;state.prefs=fresh();history.replaceState(null,'','#updates');state.message=tr('✓ ההרשמה הוסרה. לא יישלחו עוד עדכונים.','✓ Unsubscribed. No more updates will be sent.');}
    }catch(error){state.error=error.message;}finally{state.busy=false;render();}
  }
  function init(){
    state.ready=true;catalog();route();activate(app().getView());
    $('updatesContent').addEventListener('change',event=>{
      const input=event.target,key=input.dataset.updatesCategory||input.dataset.updatesAll||input.dataset.updatesPerson;
      if(input.id==='updatesAll'){for(const p of Object.values(state.prefs)){p.enabled=input.checked;p.ids=null;}}
      else if(input.hasAttribute('data-updates-category'))state.prefs[key].enabled=input.checked;
      else if(input.hasAttribute('data-updates-all'))state.prefs[key].ids=input.checked?null:(state.catalog[key]||[]).map(p=>p.id);
      else if(input.hasAttribute('data-updates-person')){const p=state.prefs[key],ids=new Set(p.ids===null?state.catalog[key].map(p=>p.id):p.ids);if(input.checked)ids.add(input.value);else ids.delete(input.value);p.ids=[...ids];}
      else if(input.id==='updatesLanguage')state.language=input.value;updateSelection();
    });
    $('updatesContent').addEventListener('input',event=>{
      if(!event.target.hasAttribute('data-updates-search'))return;const query=event.target.value.normalize('NFKD').toLowerCase().trim();
      for(const label of event.target.closest('.updates-people-options').querySelectorAll('[data-updates-option]'))label.hidden=!label.dataset.updatesOption.normalize('NFKD').toLowerCase().includes(query);
    });
    $('updatesContent').addEventListener('click',event=>{
      const none=event.target.closest('[data-updates-none]');if(none){state.prefs[none.dataset.updatesNone].ids=[];updateSelection();return;}
      const preview=event.target.closest('[data-email-preview]');if(preview){$('emailPreviewFrame').src='api/updates/preview?'+new URLSearchParams({type:preview.dataset.emailPreview,lang:state.language});$('emailPreviewDialog').showModal();return;}
      const go=event.target.closest('[data-updates-action]');if(go){action(go.dataset.updatesAction);return;}
      if(event.target.closest('[data-updates-unsubscribe]')){state.mode='unsubscribe';render();}
    });
    $('updatesContent').addEventListener('submit',async event=>{
      event.preventDefault();if(state.busy||!state.enabled)return;state.busy=true;state.error='';state.message='';
      const form=event.target,buttons=[...form.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
      try{
        if(form.id==='updatesLinkForm'){await api('request-link',{email:$('updatesLinkEmail').value});state.message=tr('אם הכתובת רשומה, נשלח אליה קישור אישי. בדקו גם בתיקיית הספאם.','If this address is subscribed, we have sent a private link. Please also check your spam folder.');}
        else if(state.mode==='manage'){const result=await api('save',{token:state.token,preferences:state.prefs,language:state.language,revision:state.revision});state.revision=result.revision;state.message=tr('✓ ההעדפות נשמרו.','✓ Preferences saved.');}
        else{await api('register',{email:$('updatesEmail').value,consent:$('updatesConsent').checked,preferences:state.prefs,language:state.language});state.message=tr('בדקו את תיבת המייל ולחצו על קישור האישור. אם ההודעה אינה מופיעה, בדקו גם בספאם. לפני האישור לא יישלחו תזכורות.','Check your inbox and confirm using the email link. If it is missing, check your spam folder. No reminders will be sent before confirmation.');}
      }catch(error){state.error=error.message;}finally{state.busy=false;buttons.forEach(button=>button.disabled=false);feedback();}
    });
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    window.addEventListener('family-person-changed',()=>{if(state.view==='updates'){catalog();render();}});
  }
  window.FamilyUpdates={activate};document.addEventListener('DOMContentLoaded',init);
})();
