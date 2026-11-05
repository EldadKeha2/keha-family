(() => {
  'use strict';
  const root=document.documentElement,key='keha-accessibility-v1',sizes=[100,115,130,150,175,200];
  const defaults={text:100,contrast:false,links:false,spacing:false,motion:false,focus:false,clean:false};
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const normalize=value=>Object.fromEntries(Object.entries(defaults).map(([name,fallback])=>[name,name==='text'?(sizes.includes(value?.text)?value.text:100):typeof value?.[name]==='boolean'?value[name]:fallback]));
  let settings;try{settings=normalize(JSON.parse(localStorage.getItem(key)));}catch{settings={...defaults};}
  const english=window.FamilyI18n?.isEnglish,tr=(he,en)=>english?en:he;
  const reduced=()=>settings.motion||motionQuery.matches;
  const icon='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="4" r="2"/><path d="M4 8h16M12 7v7m0 0-5 7m5-7 5 7"/></svg>';
  let panel,button,status;
  function apply(persist=false){
    root.style.setProperty('--a11y-text-scale',String(settings.text/100));
    root.toggleAttribute('data-a11y-text',settings.text!==100);
    for(const name of ['contrast','links','spacing','focus','clean'])root.toggleAttribute('data-a11y-'+name,settings[name]);
    root.toggleAttribute('data-a11y-motion',reduced());
    root.toggleAttribute('data-a11y-active',Object.keys(defaults).some(name=>settings[name]!==defaults[name]));
    if(persist)try{localStorage.setItem(key,JSON.stringify(settings));}catch{}
    if(panel){
      panel.querySelector('[data-a11y-size]').value=String(settings.text);
      for(const control of panel.querySelectorAll('[data-a11y-option]'))control.setAttribute('aria-pressed',String(settings[control.dataset.a11yOption]));
      panel.querySelector('[data-a11y-os-motion]').hidden=!motionQuery.matches;
      button.setAttribute('aria-label',tr('נגישות','Accessibility')+(root.hasAttribute('data-a11y-active')?tr(', התאמות פעילות',', adjustments active'):''));
    }
    window.dispatchEvent(new CustomEvent('family-accessibility-changed',{detail:{...settings,reduceMotion:reduced()}}));
    window.dispatchEvent(new Event('resize'));
  }
  window.FamilyAccessibility={isReducedMotion:reduced,getSettings:()=>({...settings})};
  apply();
  motionQuery.addEventListener('change',()=>apply());
  window.addEventListener('storage',event=>{if(event.key!==key&&event.key!==null)return;try{settings=normalize(event.key===null?null:JSON.parse(event.newValue));apply();}catch{}});
  function init(){
    button=document.getElementById('accessibilityButton');
    button.innerHTML=icon+'<span>'+tr('נגישות','Accessibility')+'</span><span class="a11y-active-dot" aria-hidden="true"></span>';
    const skip=document.getElementById('skipToContent');skip.textContent=tr('דילוג לתוכן הראשי','Skip to main content');
    skip.addEventListener('click',event=>{event.preventDefault();const main=document.getElementById('mainContent');main.focus();main.scrollIntoView({block:'start',behavior:'instant'});});
    panel=document.createElement('dialog');panel.id='accessibilityPanel';panel.className='a11y-panel';panel.setAttribute('data-i18n-skip','');panel.setAttribute('aria-labelledby','a11yTitle');panel.setAttribute('aria-describedby','a11yIntro');
    const options=[
      ['contrast','◐',tr('ניגודיות גבוהה','High contrast'),tr('טקסט כהה ורקע בהיר, בלי שינוי צבעי התמונות.','Dark text on light surfaces, with original photo colors.')],
      ['links','↗',tr('הדגשת קישורים','Highlight links'),tr('קו תחתון לקישורים ולשמות שאפשר לפתוח.','Underline links and names you can open.')],
      ['spacing','↕',tr('ריווח לקריאה','Reading spacing'),tr('יותר מרווח בין השורות ובין המילים.','More room between lines and words.')],
      ['motion','Ⅱ',tr('הפחתת תנועה','Reduce motion'),tr('עצירת קישוטים מונפשים והחלפת תמונות אוטומטית.','Pause decorative animation and automatic photo changes.')],
      ['focus','⌖',tr('מיקוד בולט','Strong focus'),tr('מסגרת ברורה סביב הרכיב שבו משתמשים במקלדת.','A clear outline around the current keyboard control.')],
      ['clean','◇',tr('פחות קישוטים','Fewer decorations'),tr('הסתרת עיטורי הרקע לעיון שקט יותר.','Hide background ornaments for a quieter view.')]
    ];
    panel.innerHTML='<div class="a11y-heading"><div>'+icon+'<h2 id="a11yTitle">'+tr('אפשרויות נגישות','Accessibility options')+'</h2></div><button type="button" class="a11y-close" aria-label="'+tr('סגירת אפשרויות הנגישות','Close accessibility options')+'">×</button></div><p id="a11yIntro">'+tr('בחרו את ההתאמות שמתאימות לכם. הבחירה נשמרת במכשיר הזה.','Choose the adjustments that help you. Your choices are saved on this device.')+'</p><label class="a11y-size-label" for="a11yTextSize">'+tr('גודל הטקסט','Text size')+'</label><select id="a11yTextSize" data-a11y-size>'+sizes.map(n=>'<option value="'+n+'">'+n+'%'+(n===100?tr(' · גודל רגיל',' · Original size'):'')+'</option>').join('')+'</select><div class="a11y-options">'+options.map(([name,symbol,title,help])=>'<button type="button" class="a11y-option" data-a11y-option="'+name+'" aria-pressed="false"><span class="a11y-option-icon" aria-hidden="true">'+symbol+'</span><span><strong>'+title+'</strong><small>'+help+'</small></span><span class="a11y-check" aria-hidden="true">✓</span></button>').join('')+'</div><p class="a11y-os-motion" data-a11y-os-motion hidden>'+tr('הפחתת תנועה פעילה גם לפי הגדרת המכשיר שלכם.','Your device preference also has reduced motion enabled.')+'</p><p class="a11y-hint">'+tr('מקלדת: Tab למעבר בין רכיבים, Enter לבחירה ו־Esc לסגירה. בעץ המשפחה אפשר להשתמש בחצים להזזה וב־+ ו־− להגדלה ולהקטנה.','Keyboard: Tab moves between controls, Enter selects, and Esc closes. In the family tree, use arrow keys to pan and + or − to zoom.')+'</p><a class="a11y-directory" href="#directory">'+tr('לרשימת בני המשפחה בתצוגה נוחה לקריאה ←','Browse family members in a readable list →')+'</a><button type="button" class="a11y-reset">'+tr('איפוס ההתאמות','Reset adjustments')+'</button><p class="a11y-status" role="status" aria-live="polite" aria-atomic="true"></p>';
    document.body.append(panel);status=panel.querySelector('.a11y-status');
    button.addEventListener('click',()=>{if(panel.open)return;panel.showModal();button.setAttribute('aria-expanded','true');panel.querySelector('.a11y-close').focus();});
    const close=()=>panel.close();panel.querySelector('.a11y-close').addEventListener('click',close);
    panel.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const controls=[...panel.querySelectorAll('button,select,a[href]')].filter(node=>!node.disabled&&!node.hidden),first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    panel.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus();});
    panel.addEventListener('click',event=>{
      const option=event.target.closest('[data-a11y-option]');if(!option)return;
      const name=option.dataset.a11yOption;settings[name]=!settings[name];apply(true);
      status.textContent=option.querySelector('strong').textContent+': '+(settings[name]?tr('פעיל','On'):tr('כבוי','Off'));
    });
    panel.querySelector('[data-a11y-size]').addEventListener('change',event=>{settings.text=Number(event.target.value);apply(true);status.textContent=tr('גודל הטקסט עודכן ל־','Text size changed to ')+settings.text+'%';});
    panel.querySelector('.a11y-reset').addEventListener('click',()=>{settings={...defaults};apply(true);status.textContent=tr('ההתאמות אופסו. הגדרות המכשיר ממשיכות לחול.','Adjustments reset. Device preferences still apply.');});
    panel.querySelector('.a11y-directory').addEventListener('click',close);apply();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
