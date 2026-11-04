(() => {
  'use strict';
  const I=window.FamilyI18n,$=id=>document.getElementById(id),app=()=>window.FamilyApp;
  const tr=(he,en)=>I.isEnglish?en:he;
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fresh=()=>Object.fromEntries(['birthdays','anniversaries','memorials'].map(key=>[key,{enabled:true,ids:null}]));
  const state={view:'tree',ready:false,loaded:false,loading:false,loadId:0,enabled:false,prefs:fresh(),mode:'register',token:null,revision:null,email:'',formEmail:'',linkEmail:'',consent:false,verified:false,confirmRemoval:false,language:I.language,busy:false,feedbackForm:'updatesForm',message:'',error:'',catalog:{}};
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
    const link=state.feedbackForm==='updatesLinkForm';
    if($('updatesError'))$('updatesError').textContent=link?'':state.error;
    if($('updatesMessage'))$('updatesMessage').textContent=link?'':state.message;
    if($('updatesLinkError'))$('updatesLinkError').textContent=link?state.error:'';
    if($('updatesLinkMessage'))$('updatesLinkMessage').textContent=link?state.message:'';
  }
  function linkRequestForm(){
    return `<form id="updatesLinkForm" class="updates-link-form"><h4>${tr('כבר רשומים? עדכון או הסרה','Already subscribed? Update or unsubscribe')}</h4><p>${tr('הזינו את כתובת המייל שאיתה נרשמתם. נשלח אליה קישור אישי לעדכון ההעדפות או להסרה מרשימת התפוצה.','Enter the email address you subscribed with. We will email a private link to update your preferences or unsubscribe.')}</p><label>${tr('כתובת מייל','Email address')}<input type="email" id="updatesLinkEmail" autocomplete="email" inputmode="email" value="${safe(state.linkEmail)}" placeholder="name@example.com" required maxlength="254"></label><p class="form-error" id="updatesLinkError" role="alert"></p><p class="updates-success" id="updatesLinkMessage" role="status"></p><button class="secondary-button" type="submit" ${state.enabled&&!state.busy?'':'disabled'}>${tr('שלחו לי קישור לניהול ההרשמה','Email my subscription link')}</button></form>`;
  }
  function removalPanel(){
    return `<section class="updates-removal" aria-label="${tr('הסרה מרשימת התפוצה','Unsubscribe')}"><h5>${tr('הסרה מרשימת התפוצה','Unsubscribe')}</h5><p>${tr('הסרה תפסיק את כל התזכורות במייל. אפשר גם להשאיר את ההרשמה פעילה ולשנות רק את הבחירה למעלה.','Unsubscribing stops all email reminders. You can also keep your subscription and change your selections above.')}</p>${state.confirmRemoval?`<p class="updates-removal-question" role="status">${tr('להסיר את ההרשמה ולהפסיק את כל העדכונים?','Unsubscribe and stop all updates?')}</p><div class="updates-removal-actions"><button class="secondary-button updates-remove-confirm" type="button" data-updates-action="unsubscribe" ${state.busy?'disabled':''}>${tr('כן, הסירו אותי מרשימת התפוצה','Yes, unsubscribe me')}</button><button class="quiet-button" type="button" data-updates-cancel-removal ${state.busy?'disabled':''}>${tr('ביטול, להישאר ברשימה','Cancel, stay subscribed')}</button></div>`:`<button class="quiet-button updates-unsubscribe" type="button" data-updates-unsubscribe ${state.busy?'disabled':''}>${tr('הסרה מרשימת התפוצה','Unsubscribe')}</button>`}</section>`;
  }
  function render(){
    if(!state.ready)return;
    const manage=state.mode==='manage',confirm=state.mode==='confirm';
    const heading=`<header class="updates-intro"><span class="updates-envelope" aria-hidden="true">✉</span><div><span class="small-eyebrow">${tr('לא מפספסים את הרגעים שלנו','Remembering our shared moments')}</span><h3>${tr('קרובים, גם דרך המייל','A little closer, by email')}</h3><p>${tr('שמחות קטנות, תאריכים חשובים וזיכרונות שנשארים איתנו.','Little celebrations, important dates and memories we carry with us.')}</p></div></header>`;
    const notice=!state.enabled?`<p class="updates-setup-notice" role="status">${state.loading?tr('בודק את חיבור המייל…','Checking email delivery…'):tr('שליחת העדכונים עדיין בהגדרה. אפשר לעיין באפשרויות ובדוגמאות; ההרשמה תיפתח אחרי חיבור כתובת השולח.','Email delivery is being set up. Explore the options and previews; registration will open once the sender is connected.')}</p>`:'';
    const messages='<p class="form-error" id="updatesError" role="alert"></p><p class="updates-success" id="updatesMessage" role="status"></p>';
    if(state.mode==='unsubscribed'){
      $('updatesContent').innerHTML=heading+`<div class="updates-action-card"><h4>${tr('ההסרה הושלמה','You have been unsubscribed')}</h4>${messages}<p>${tr('אפשר להירשם מחדש בכל עת דרך עמוד זה.','You can subscribe again at any time from this page.')}</p><button class="secondary-button" type="button" data-updates-register>${tr('הרשמה מחדש','Subscribe again')}</button></div>`;feedback();return;
    }
    if(confirm){
      $('updatesContent').innerHTML=heading+notice+`<div class="updates-action-card"><h4>${tr('אישור הרשמה לעדכונים','Confirm your subscription')}</h4><p>${tr('לחצו לאישור כתובת המייל ולהפעלת התזכורות שבחרתם.','Confirm your email to activate the reminders you selected.')}</p>${messages}<button class="primary-button" data-updates-action="confirm" ${!state.enabled||state.busy?'disabled':''}>${tr('אישור ההרשמה','Confirm subscription')}</button></div>`;feedback();return;
    }
    if(manage&&!state.verified){
      $('updatesContent').innerHTML=heading+notice+`<div class="updates-action-card"><h4>${tr('ניהול ההרשמה','Manage your subscription')}</h4>${state.loading?`<p role="status">${tr('טוען את ההעדפות שלכם…','Loading your preferences…')}</p>`:''}${messages}${state.loading?'':`<button class="secondary-button" type="button" data-updates-register>${tr('בקשת קישור אישי חדש','Request a new private link')}</button>`}</div>`;feedback();return;
    }
    $('updatesContent').innerHTML=heading+notice+`<div class="updates-layout"><form id="updatesForm" class="updates-form">
      <h4>${manage?tr('עדכון ההעדפות שלי','Update my preferences'):tr('על מה תרצו לשמוע?','What would you like to hear about?')}</h4>
      ${manage?`<div class="updates-account"><span>${tr('הרשמה פעילה עבור','Active subscription for')}</span><bdi dir="ltr">${safe(state.email)}</bdi></div>`:`<label class="updates-email-label">${tr('כתובת המייל שלכם','Your email address')}<input id="updatesEmail" type="email" autocomplete="email" inputmode="email" maxlength="254" value="${safe(state.formEmail)}" placeholder="name@example.com" aria-describedby="updatesEmailHelp" required></label><p class="updates-email-help" id="updatesEmailHelp">${tr('כבר נרשמתם עם הכתובת הזו? תקבלו קישור לעדכון או להסרה של ההרשמה הקיימת.','Already subscribed with this address? You will receive a link to update or remove your existing subscription.')}</p>`}
      ${preferenceForm()}<p class="updates-timing">${tr('התזכורות נשלחות ביום האירוע, החל מ־09:00 שעון ישראל, לפי התאריכים הלועזיים שנשמרו באתר. עדכון תאריך באתר יעדכן גם את התזכורת.','Reminders are sent on the event day, starting at 9:00 a.m. Israel time, using the Gregorian dates saved on the site. Date changes also update future reminders.')}</p>
      ${manage?'':`<label class="updates-check updates-consent"><input type="checkbox" id="updatesConsent" ${state.consent?'checked':''} required><span>${tr('אני מסכים/ה לקבל את העדכונים שבחרתי. אפשר להסיר את ההרשמה בכל עת.','I agree to receive the selected updates. I can unsubscribe at any time.')}</span></label>`}
      ${messages}<button class="primary-button updates-submit" type="submit" ${!state.enabled||state.busy?'disabled':''}>${manage?tr('שמירת ההעדפות','Save preferences'):tr('שלחו לי קישור למייל','Email me a private link')}</button>${manage?removalPanel():''}
      </form><aside class="updates-aside">${manage?'':linkRequestForm()}<div class="updates-privacy"><span aria-hidden="true">♧</span><h4>${tr('המייל שלכם נשאר פרטי','Your email stays private')}</h4><p>${tr('הכתובת נשמרת מוצפנת, אינה מוצגת למבקרי האתר ואינה נכללת בגיבוי הציבורי. ההרשמה מופעלת רק אחרי אישור במייל.','Your address is stored encrypted, is hidden from site visitors and is excluded from public backups. Your subscription starts only after email confirmation.')}</p><p>${tr('הכתובת והעדכונים מועברים לספק המייל לצורך השליחה. בכל מייל יש קישור אישי לניהול ולהסרה; שמרו את הקישור לעצמכם.','Your address and reminders are shared with the email provider for delivery. Each email includes private preference and unsubscribe links; please keep these links to yourself.')}</p></div><div class="updates-previews"><h4>${tr('כך ייראו העדכונים','A look inside your inbox')}</h4>${kinds.map(([key,icon,he,en])=>`<button class="updates-preview-button" type="button" data-email-preview="${key}"><span aria-hidden="true">${icon}</span><span>${I.isEnglish?en:he}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></aside></div>`;
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
    const loadId=++state.loadId,mode=state.mode,raw=state.token;state.loading=true;render();
    try{const config=await api('config');if(loadId!==state.loadId)return;state.enabled=config.enabled;state.loaded=true;
      if(mode==='manage'&&state.enabled){const result=await api('preferences',{token:raw});if(loadId!==state.loadId)return;state.prefs=result.preferences;state.revision=result.revision;state.language=result.language;state.email=result.email;state.verified=true;}
    }catch(error){if(loadId===state.loadId)state.error=error.message;}finally{if(loadId===state.loadId){state.loading=false;render();}}
  }
  function route(){
    if(!location.hash.startsWith('#updates'))return;
    const match=/^#updates\/(confirm|manage|unsubscribe)\/([a-f0-9]{64})$/.exec(location.hash);
    state.loadId++;state.loading=false;state.mode=match?(match[1]==='confirm'?'confirm':'manage'):'register';state.token=match?.[2]||null;state.error='';state.message='';state.feedbackForm='updatesForm';state.verified=false;state.revision=null;state.email='';state.prefs=fresh();state.confirmRemoval=match?.[1]==='unsubscribe';
    if(state.confirmRemoval)history.replaceState(null,'','#updates/manage/'+state.token);
    if(state.ready){catalog();if(match||!state.loaded)load();else render();}
  }
  function activate(view){state.view=view;$('updatesView').hidden=view!=='updates';if(!state.ready||view!=='updates')return;catalog();if(!state.loaded&&!state.loading)load();else render();}
  async function action(name){
    if(state.busy||!state.enabled||name==='unsubscribe'&&!state.verified)return;const raw=state.token;state.busy=true;state.error='';render();
    try{
      const result=await api(name,{token:state.token});
      if(raw!==state.token)return;
      if(name==='confirm'){
        state.mode='manage';state.token=result.token;state.prefs=result.preferences;state.revision=result.revision;state.language=result.language;state.email=result.email;state.verified=true;state.confirmRemoval=false;history.replaceState(null,'','#updates/manage/'+state.token);state.message=tr('✓ ההרשמה אושרה. התזכורות שלכם פעילות.','✓ Subscription confirmed. Your reminders are active.');
      }else{state.mode='unsubscribed';state.token=null;state.revision=null;state.email='';state.verified=false;state.confirmRemoval=false;state.prefs=fresh();history.replaceState(null,'','#updates');state.message=tr('✓ ההרשמה הוסרה. לא יישלחו עוד עדכונים.','✓ Unsubscribed. No more updates will be sent.');}
    }catch(error){if(raw===state.token)state.error=error.message;}finally{state.busy=false;render();}
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
      if(input.id==='updatesConsent')state.consent=input.checked;
    });
    $('updatesContent').addEventListener('input',event=>{
      if(event.target.id==='updatesEmail')state.formEmail=event.target.value;
      if(event.target.id==='updatesLinkEmail')state.linkEmail=event.target.value;
      if(!event.target.hasAttribute('data-updates-search'))return;const query=event.target.value.normalize('NFKD').toLowerCase().trim();
      for(const label of event.target.closest('.updates-people-options').querySelectorAll('[data-updates-option]'))label.hidden=!label.dataset.updatesOption.normalize('NFKD').toLowerCase().includes(query);
    });
    $('updatesContent').addEventListener('click',event=>{
      const none=event.target.closest('[data-updates-none]');if(none){state.prefs[none.dataset.updatesNone].ids=[];updateSelection();return;}
      const preview=event.target.closest('[data-email-preview]');if(preview){$('emailPreviewFrame').src='api/updates/preview?'+new URLSearchParams({type:preview.dataset.emailPreview,lang:state.language});$('emailPreviewDialog').showModal();return;}
      const go=event.target.closest('[data-updates-action]');if(go){action(go.dataset.updatesAction);return;}
      if(event.target.closest('[data-updates-unsubscribe]')){state.confirmRemoval=true;render();}
      if(event.target.closest('[data-updates-cancel-removal]')){state.confirmRemoval=false;render();}
      if(event.target.closest('[data-updates-register]')){history.replaceState(null,'','#updates');route();}
    });
    $('updatesContent').addEventListener('submit',async event=>{
      event.preventDefault();if(state.busy||!state.enabled)return;state.busy=true;state.error='';state.message='';
      const form=event.target,raw=state.token,controls=[...form.querySelectorAll('button,input,select')],disabled=controls.map(control=>control.disabled);state.feedbackForm=form.id;controls.forEach(control=>control.disabled=true);feedback();
      try{
        if(form.id==='updatesLinkForm'){await api('request-link',{email:$('updatesLinkEmail').value});if(raw!==state.token)return;state.message=tr('אם הכתובת רשומה, נשלח אליה קישור אישי לעדכון ההעדפות או להסרה. בדקו גם בתיקיית הספאם.','If this address is subscribed, we have sent a private link to update your preferences or unsubscribe. Please also check your spam folder.');}
        else if(state.mode==='manage'){const result=await api('save',{token:state.token,preferences:state.prefs,language:state.language,revision:state.revision});if(raw!==state.token)return;state.revision=result.revision;state.message=tr('✓ ההעדפות נשמרו.','✓ Preferences saved.');}
        else{await api('register',{email:$('updatesEmail').value,consent:$('updatesConsent').checked,preferences:state.prefs,language:state.language});if(raw!==state.token)return;state.message=tr('בדקו את המייל: בהרשמה חדשה יישלח קישור לאישור; לכתובת שכבר רשומה יישלח קישור לעדכון ההעדפות או להסרה, בלי לשנות את הבחירה הקיימת. בדקו גם בספאם.','Check your inbox: new subscriptions receive a confirmation link; existing subscribers receive a link to update preferences or unsubscribe, with their current choices preserved. Please also check spam.');}
      }catch(error){if(raw===state.token)state.error=error.message;}finally{state.busy=false;controls.forEach((control,index)=>control.disabled=disabled[index]);if(raw!==state.token)render();else feedback();}
    });
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    window.addEventListener('family-person-changed',()=>{if(state.view==='updates'){catalog();render();}});
  }
  window.FamilyUpdates={activate};document.addEventListener('DOMContentLoaded',init);
})();
