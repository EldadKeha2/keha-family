import {countryCodes} from './countries.mjs';
import {resolveLanguage,languageKey,languageLabel,searchLanguages} from './languages.mjs';

const I=()=>window.FamilyI18n,tr=(he,en)=>I().isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults={residences:[],languages:[],occupation:'',jobs:[]},sections=Object.keys(defaults);
const pencil='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/></svg>';
let editor=null,controller=null,root=null;
const copy=value=>JSON.parse(JSON.stringify(value));
const titles=()=>({residences:tr('מדינות בהן התגוררתי','Countries I have lived in'),languages:tr('שפות','Languages'),occupation:tr('מקצוע','Profession'),jobs:tr('עבודות שבהן עבדתי','Work history')});
const countryName=code=>new Intl.DisplayNames([I().locale],{type:'region'}).of(code)||code;
const flagSVG=code=>countryCodes.includes(code)?`<svg viewBox="0 0 640 480" width="32" height="24" focusable="false" aria-hidden="true"><use href="assets/country-flags.svg#${code}"></use></svg>`:'';
function flagHTML(code){return `<span class="biography-flag" aria-hidden="true">${flagSVG(code)}</span>`;}
const languageGlobe='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z"/></svg>';
function languageFlag(value){const language=resolveLanguage(value);return `<span class="biography-language-flag" aria-hidden="true">${language?.country?flagSVG(language.country):languageGlobe}</span>`;}
function languageOptions(){
  const query=editor.languageQuery||'',options=searchLanguages(query,editor.draft,I().isEnglish).map(language=>({value:language.en,label:I().isEnglish?language.en:language.he}));
  if(query.trim()&&!resolveLanguage(query)&&!editor.draft.some(value=>languageKey(value)===languageKey(query)))options.push({value:query.trim(),label:tr('הוספת שפה: ','Add language: ')+query.trim()});
  return options;
}
function languageOptionHTML(options){return options.length?options.map((option,index)=>`<button id="biographyLanguageOption-${index}" role="option" aria-selected="${index===editor.languageIndex}" tabindex="-1" type="button" data-bio-language-add="${index}">${languageFlag(option.value)}<span dir="auto">${safe(option.label)}</span><span class="biography-language-plus" aria-hidden="true">＋</span></button>`).join(''):`<p>${tr('לא נמצאו שפות נוספות','No more matching languages')}</p>`;}
function languageFields(){
  const options=languageOptions();editor.languageIndex=Math.max(0,Math.min(editor.languageIndex||0,options.length-1));
  return `<ul class="biography-languages biography-language-selection">${editor.draft.map((value,index)=>`<li>${languageFlag(value)}<span dir="auto">${safe(languageLabel(value,I().isEnglish))}</span><button type="button" data-bio-language-remove="${index}" aria-label="${safe(tr('הסרת השפה ','Remove language ')+languageLabel(value,I().isEnglish))}">×</button></li>`).join('')}</ul><div class="biography-language-combobox"><label for="biographyLanguageSearch">${tr('הוספת שפה','Add a language')}</label><div class="biography-language-search"><input id="biographyLanguageSearch" data-bio-language-search type="text" role="combobox" aria-autocomplete="list" aria-controls="biographyLanguageOptions" aria-expanded="${Boolean(editor.languageOpen)}" ${editor.languageOpen&&options.length?`aria-activedescendant="biographyLanguageOption-${editor.languageIndex}"`:''} autocomplete="off" dir="auto" maxlength="80" placeholder="${tr('הקלידו בעברית או באנגלית…','Search in Hebrew or English…')}" value="${safe(editor.languageQuery||'')}"><span aria-hidden="true">⌄</span></div><div id="biographyLanguageOptions" class="biography-language-options" role="listbox" aria-label="${tr('שפות לבחירה','Available languages')}" ${editor.languageOpen?'':'hidden'}>${languageOptionHTML(options)}</div></div>`;
}
function updateLanguageOptions(){
  const input=root.querySelector('[data-bio-language-search]'),list=root.querySelector('#biographyLanguageOptions');if(!input||!list||!editor||editor.section!=='languages')return;
  const options=languageOptions();editor.languageIndex=Math.max(0,Math.min(editor.languageIndex||0,options.length-1));
  list.innerHTML=languageOptionHTML(options);list.hidden=!editor.languageOpen;input.setAttribute('aria-expanded',String(Boolean(editor.languageOpen)));
  if(editor.languageOpen&&options.length)input.setAttribute('aria-activedescendant','biographyLanguageOption-'+editor.languageIndex);else input.removeAttribute('aria-activedescendant');
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
}
function chooseLanguage(index){
  if(!editor||editor.section!=='languages'||editor.saving||editor.draft.length>=30)return;
  const option=languageOptions()[index];if(!option||editor.draft.some(value=>languageKey(value)===languageKey(option.value)))return;
  editor.draft.push(option.value);editor.languageQuery='';editor.languageIndex=0;closeLanguageSelection();
}
function closeLanguageSelection(){editor.languageOpen=false;rerender(true);editor.languageOpen=false;updateLanguageOptions();}
function period(item){
  const start=item.fromYear,end=item.toYear;
  if(item.current)return start?`<bdi>${start} – ${tr('היום','present')}</bdi>`:tr('כיום','Present');
  if(start&&end)return `<bdi>${start} – ${end}</bdi>`;
  if(start)return tr('משנת ','Since ')+`<bdi>${start}</bdi>`;
  if(end)return tr('עד שנת ','Until ')+`<bdi>${end}</bdi>`;
  return tr('השנים טרם צוינו','Years not yet recorded');
}
function display(section,value){
  if(section==='occupation')return value?`<p class="biography-profession" dir="auto">${safe(value)}</p>`:'';
  if(section==='languages')return value.length?`<ul class="biography-languages">${value.map(value=>`<li>${languageFlag(value)}<span dir="auto">${safe(languageLabel(value,I().isEnglish))}</span></li>`).join('')}</ul>`:'';
  if(!value.length)return '';
  return `<ol class="biography-timeline">${value.map(item=>`<li>${section==='residences'?flagHTML(item.country):'<span class="biography-work-dot" aria-hidden="true">◆</span>'}<div>${section==='residences'?`<strong>${safe(countryName(item.country))}</strong>`:`<strong dir="auto">${safe(item.employer||item.role)}</strong>${item.employer&&item.role?`<span class="biography-role" dir="auto">${safe(item.role)}</span>`:''}`}<span class="biography-years">${period(item)}</span></div></li>`).join('')}</ol>`;
}
function periodFields(item,index,section){
  return `<div class="biography-year-fields"><label>${tr('משנת','From year')}<input type="number" inputmode="numeric" min="1000" max="${new Date().getFullYear()}" data-bio-index="${index}" data-bio-field="fromYear" value="${item.fromYear??''}"></label><label>${tr('עד שנת','To year')}<input type="number" inputmode="numeric" min="1000" max="${new Date().getFullYear()}" data-bio-index="${index}" data-bio-field="toYear" value="${item.toYear??''}" ${item.current?'disabled':''}></label><label class="biography-current"><input type="checkbox" data-bio-index="${index}" data-bio-field="current" ${item.current?'checked':''}>${section==='residences'?tr('עד היום','Still living here'):tr('עובד/ת כאן כיום','Currently working here')}</label></div>`;
}
function form(){
  const {section,draft,error,saving}=editor;
  let fields='';
  if(section==='occupation')fields=`<label>${tr('המקצוע שלי','My profession')}<input data-bio-value type="text" dir="auto" maxlength="200" value="${safe(draft)}"></label>`;
  else if(section==='languages')fields=languageFields();
  else{
    const countries=section==='residences'?countryCodes.map(code=>({code,name:countryName(code)})).sort((a,b)=>a.name.localeCompare(b.name,I().locale)):[];
    fields=`<div class="biography-rows">${draft.map((item,index)=>`<fieldset class="biography-entry"><legend>${section==='residences'?tr('מגורים','Residence'):tr('מקום עבודה','Workplace')} ${index+1}</legend><button class="biography-remove" type="button" data-bio-remove="${index}" aria-label="${tr('הסרת רשומה','Remove entry')} ${index+1}" ${saving?'disabled':''}>×</button>${section==='residences'?`<label>${tr('מדינה','Country')}<span class="biography-country-select">${flagHTML(item.country)}<select data-bio-index="${index}" data-bio-field="country" required><option value="">${tr('בחירת מדינה','Choose a country')}</option>${countries.map(({code,name})=>`<option value="${code}" ${code===item.country?'selected':''}>${safe(name)}</option>`).join('')}</select></span></label>`:`<div class="biography-job-fields"><label>${tr('מקום עבודה','Workplace')}<input dir="auto" maxlength="200" data-bio-index="${index}" data-bio-field="employer" value="${safe(item.employer)}"></label><label>${tr('תפקיד','Role')}<input dir="auto" maxlength="200" data-bio-index="${index}" data-bio-field="role" value="${safe(item.role)}"></label></div>`}${periodFields(item,index,section)}</fieldset>`).join('')}</div><button class="secondary-button biography-add" data-bio-add type="button" ${draft.length>=40||saving?'disabled':''}>＋ ${section==='residences'?tr('הוספת מדינה','Add country'):tr('הוספת מקום עבודה','Add workplace')}</button>`;
  }
  return `<form data-bio-form="${section}" class="biography-editor"><fieldset class="biography-form-fields" ${saving?'disabled':''}>${fields}</fieldset><p class="form-error" data-bio-error role="alert">${safe(error)}</p><div class="form-actions"><button class="primary-button" type="submit" ${saving?'disabled':''}>${saving?tr('שומר…','Saving…'):tr('שמירה','Save')}</button><button class="secondary-button" type="button" data-bio-cancel ${saving?'disabled':''}>${tr('ביטול','Cancel')}</button></div></form>`;
}
function render(person,available=true){
  return `<div class="person-biography">${sections.map(section=>{
    const active=editor?.id===person.id&&editor.section===section,value=person[section]??defaults[section],title=titles()[section];
    const content=available?display(section,value):'';
    return `<section class="biography-section" data-bio-section="${section}"><header><h4>${title}</h4><button class="biography-pencil" type="button" data-bio-edit="${section}" aria-label="${tr('עריכת ','Edit ')+title}" title="${tr('עריכת ','Edit ')+title}" ${!available||editor?'disabled':''}>${pencil}</button></header>${active?form():content||`<p class="biography-empty">${available?tr('טרם נוספו פרטים','No details added yet'):tr('הפרטים אינם זמינים כרגע','Details are currently unavailable')}</p>`}</section>`;
  }).join('')}</div>`;
}
function rerender(focus=false){controller.render();if(focus)root.querySelector('[data-bio-form] input:not([type=checkbox]),[data-bio-form] textarea,[data-bio-form] select,[data-bio-add]')?.focus();}
function updateDraft(target){
  if(!editor||editor.saving)return;
  if(target.matches('[data-bio-value]')){editor.draft=editor.section==='languages'?target.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean):target.value;return;}
  const field=target.dataset.bioField,index=Number(target.dataset.bioIndex),item=editor.draft[index];if(!item||!field)return;
  item[field]=field==='current'?target.checked:['fromYear','toYear'].includes(field)?target.value===''?null:Number(target.value):target.value;
  if(field==='current'&&item.current)item.toYear=null;
}
function attach(host,handlers){
  root=host;controller=handlers;
  root.addEventListener('click',event=>{
    if(event.target.matches('[data-bio-language-search]')&&editor?.section==='languages'){editor.languageOpen=true;updateLanguageOptions();return;}
    const language=event.target.closest('[data-bio-language-add]');if(language){chooseLanguage(Number(language.dataset.bioLanguageAdd));return;}
    const removeLanguage=event.target.closest('[data-bio-language-remove]');if(removeLanguage&&editor?.section==='languages'&&!editor.saving){editor.draft.splice(Number(removeLanguage.dataset.bioLanguageRemove),1);closeLanguageSelection();return;}
    const edit=event.target.closest('[data-bio-edit]');
    if(edit&&!edit.disabled){
      if(controller.isBlocked())return;
      const person=controller.person(),section=edit.dataset.bioEdit;if(!person||!sections.includes(section))return;
      const value=copy(person[section]??defaults[section]);editor={id:person.id,section,expected:copy(value),draft:value,saving:false,error:'',languageQuery:'',languageOpen:section==='languages',languageIndex:0};
      if((section==='residences'||section==='jobs')&&!editor.draft.length)add();else rerender(true);return;
    }
    if(event.target.closest('[data-bio-cancel]')&&editor&&!editor.saving){editor=null;rerender();controller.finished();return;}
    if(event.target.closest('[data-bio-add]')&&editor&&!editor.saving){add();return;}
    const remove=event.target.closest('[data-bio-remove]');if(remove&&editor&&!editor.saving){editor.draft.splice(Number(remove.dataset.bioRemove),1);rerender(true);}
  });
  root.addEventListener('input',event=>{
    if(event.target.matches('[data-bio-language-search]')&&editor?.section==='languages'&&!editor.saving){editor.languageQuery=event.target.value;editor.languageOpen=true;editor.languageIndex=0;updateLanguageOptions();return;}
    if(event.target.closest('[data-bio-form]'))updateDraft(event.target);
  });
  root.addEventListener('pointerdown',event=>{if(event.target.closest('[data-bio-language-add]'))event.preventDefault();});
  root.addEventListener('focusin',event=>{if(event.target.matches('[data-bio-language-search]')&&editor?.section==='languages'){editor.languageOpen=true;updateLanguageOptions();}});
  root.addEventListener('focusout',event=>{if(event.target.matches('[data-bio-language-search]')&&editor?.section==='languages'){editor.languageOpen=false;updateLanguageOptions();}});
  root.addEventListener('keydown',event=>{
    if(!event.target.matches('[data-bio-language-search]')||editor?.section!=='languages'||editor.saving)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();editor.languageOpen=false;updateLanguageOptions();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();editor.languageOpen=true;const count=languageOptions().length;editor.languageIndex=Math.max(0,Math.min(count-1,(editor.languageIndex||0)+(event.key==='ArrowDown'?1:-1)));updateLanguageOptions();return;}
    if(event.key==='Enter'){event.preventDefault();chooseLanguage(editor.languageIndex||0);}
  });
  root.addEventListener('change',event=>{
    if(!event.target.closest('[data-bio-form]'))return;updateDraft(event.target);
    if(event.target.dataset.bioField==='current')rerender();
    if(event.target.dataset.bioField==='country'){const node=event.target.parentElement.querySelector('.biography-flag');if(node)node.innerHTML=flagSVG(event.target.value);}
  });
  root.addEventListener('submit',async event=>{
    if(!event.target.matches('[data-bio-form]'))return;event.preventDefault();if(!editor||editor.saving)return;
    // Capture the person and editor before the asynchronous save. Navigation must never retarget it.
    const active=editor,{id,section,draft,expected}=active;active.saving=true;active.error='';rerender();
    try{
      const result=await controller.save(id,{section,value:copy(draft),expectedValue:copy(expected)});
      controller.saved(id,result.person);
      if(editor===active){editor=null;rerender();controller.finished();}
    }catch(error){if(editor===active){active.saving=false;active.error=error.message;rerender();}}
  });
}
function add(){
  if(!editor||editor.draft.length>=40)return;
  editor.draft.push({...editor.section==='residences'?{country:''}:{employer:'',role:''},fromYear:null,toYear:null,current:false});rerender(true);
}
window.FamilyBiography={render,attach,isEditing:()=>Boolean(editor),isDirty:()=>Boolean(editor&&JSON.stringify(editor.expected)!==JSON.stringify(editor.draft)),reset:()=>{editor=null;}};
