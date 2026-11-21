'use strict';
const form=document.querySelector('#story-form'),nameInput=document.querySelector('#name'),storyInput=document.querySelector('#story'),send=document.querySelector('#send'),error=document.querySelector('#error'),success=document.querySelector('#success');
const draftKey='keha-grandparents-story-draft-v1';
let pending=null;
const getPerson=()=>form.querySelector('[name="person"]:checked').value;
function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify({name:nameInput.value,person:getPerson(),story:storyInput.value,pending}));}catch{}}
try{
  const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
  if(draft){
    if(typeof draft.name==='string')nameInput.value=draft.name.slice(0,100);
    if(typeof draft.story==='string')storyInput.value=draft.story.slice(0,50000);
    if(['shlomo','yona','both'].includes(draft.person))form.querySelector(`[value="${draft.person}"]`).checked=true;
    if(draft.pending&&/^[a-f0-9]{32}$/.test(draft.pending.id)&&typeof draft.pending.content==='string')pending=draft.pending;
  }
}catch{}
form.addEventListener('input',saveDraft);
form.addEventListener('change',saveDraft);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!form.hidden)saveDraft();});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(send.disabled)return;
  error.hidden=true;
  if(nameInput.value.trim().split(/\s+/).filter(part=>/\p{L}/u.test(part)).length<2){error.textContent='יש לכתוב שם פרטי ושם משפחה.';error.hidden=false;nameInput.focus();return;}
  const value={name:nameInput.value,person:getPerson(),story:storyInput.value},content=JSON.stringify(value);
  if(!pending||pending.content!==content)pending={id:crypto.randomUUID().replaceAll('-',''),content};
  saveDraft();send.disabled=true;send.textContent='שולח…';form.setAttribute('aria-busy','true');
  for(const control of form.elements)control.disabled=true;
  try{
    const response=await fetch('/api/story-submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,requestId:pending.id,website:document.querySelector('#website').value}),signal:AbortSignal.timeout(45000)});
    let result;try{result=await response.json();}catch{}
    if(!response.ok||result?.sent!==true)throw new Error(result?.error||'השליחה לא הושלמה. הסיפור נשאר כאן; אפשר לנסות שוב.');
    storyInput.value='';pending=null;saveDraft();form.hidden=true;success.hidden=false;success.focus();
  }catch(failure){
    error.textContent=failure.name==='TimeoutError'||failure instanceof TypeError?'השליחה לא הושלמה. בדקו את החיבור לאינטרנט ונסו שוב — הסיפור נשאר כאן.':failure.message;
    error.hidden=false;error.scrollIntoView({block:'nearest'});
  }finally{
    for(const control of form.elements)control.disabled=false;
    send.textContent='שלח';form.removeAttribute('aria-busy');
  }
});
document.querySelector('#another').addEventListener('click',()=>{success.hidden=true;form.hidden=false;error.hidden=true;storyInput.focus();});
