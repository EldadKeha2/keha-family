import {BACKGROUNDS,HEADS,PROPS,EMOJIS,funDefaults,normalizeFun,hitSticker,placedSticker,drawBackground,drawSticker,paintMask} from './photo-fun-core.mjs?v=3';
import {separatePerson} from './photo-fun-segment.mjs?v=3';
const sections=[['background','רקעים','Scenes',BACKGROUNDS],['head','ראשים','Heads',HEADS],['prop','אביזרים','Props',PROPS],['sticker','מדבקות','Stickers',EMOJIS]];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class PhotoFunEditor {
  constructor(host,stage,canvas,{tr,changed,paint,busy}){
    Object.assign(this,{host,stage,canvas,tr,changed,paint,onBusy:busy,data:funDefaults(),selected:null,section:'background',page:0,mode:'move',brush:.08,parameter:'size'});
    host.innerHTML=`<div class="pe-fun-tabs" role="tablist" aria-label="${tr('כלים מצחיקים','Fun tools')}">${sections.map(([id,he,en])=>`<button type="button" role="tab" data-fun-tab="${id}" aria-selected="${id==='background'}">${tr(he,en)}</button>`).join('')}</div><div class="pe-fun-strip"><button type="button" data-fun-page="-1" class="pe-fun-page" aria-label="${tr('הקודמים','Previous')}">‹</button><div class="pe-fun-choices"></div><button type="button" data-fun-page="1" class="pe-fun-page" aria-label="${tr('הבאים','Next')}">›</button></div><div class="pe-fun-tools"><div class="pe-fun-mask-tools"><button type="button" data-fun-auto>${tr('הפרדה אוטומטית','Auto cutout')}</button><button type="button" data-fun-brush="erase">${tr('מחק רקע','Erase')}</button><button type="button" data-fun-brush="restore">${tr('החזר דמות','Restore')}</button><button type="button" data-fun-brush="move">${tr('סיום','Done')}</button></div><div class="pe-fun-sticker-tools"><button type="button" data-fun-parameter="size">${tr('גודל','Size')}</button><button type="button" data-fun-parameter="rotation">${tr('סיבוב','Rotate')}</button><button type="button" data-fun-remove>${tr('הסר תוספת','Remove')}</button><button type="button" data-fun-all>${tr('על כל הפנים','All faces')}</button></div><label class="pe-fun-range"><span></span><input type="range" min="4" max="130" value="24"><output></output></label></div>`;
    this.selection=document.createElement('div');this.selection.className='pe-sticker-selection';this.selection.hidden=true;this.selection.tabIndex=0;this.selection.setAttribute('role','group');this.selection.setAttribute('aria-label',tr('מדבקה נבחרה. גררו להזזה, מקשי החצים לכוונון ומחק להסרה.','Selected sticker. Drag to move, use arrow keys to nudge and Delete to remove.'));this.selection.innerHTML=`<button type="button" data-fun-delete aria-label="${tr('הסרת התוספת','Remove sticker')}">×</button><button type="button" data-fun-resize aria-label="${tr('גרירה לשינוי גודל','Drag to resize')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 9v9H9"/></svg></button>`;stage.append(this.selection);
    this.tip=document.createElement('span');this.tip.className='pe-fun-tip';this.tip.hidden=true;this.tip.setAttribute('role','status');stage.append(this.tip);
    this.text=document.createElement('input');this.text.type='text';this.text.className='pe-fun-text';this.text.maxLength=72;this.text.dir='auto';this.text.hidden=true;this.text.setAttribute('aria-label',tr('הטקסט בבועת הדיבור','Speech bubble text'));stage.append(this.text);
    host.addEventListener('click',event=>{
      if(this.locked)return;const target=event.target.closest('button');if(!target)return;
      if(target.dataset.funTab){this.section=target.dataset.funTab;this.page=0;this.mode='move';this.render();return;}
      if(target.dataset.funPage){this.page=clamp(this.page+Number(target.dataset.funPage),0,Math.ceil(this.entries().length/8)-1);this.render();return;}
      if(target.dataset.funChoice){this.choose(target.dataset.funChoice);return;}
      if(target.hasAttribute('data-fun-auto')){this.auto(true);return;}
      if(target.dataset.funBrush){this.mode=target.dataset.funBrush;this.renderTools();return;}
      if(target.dataset.funParameter){this.parameter=target.dataset.funParameter;this.renderTools();return;}
      if(target.hasAttribute('data-fun-remove'))this.remove();
      if(target.hasAttribute('data-fun-all'))this.allFaces();
    });
    host.querySelector('.pe-fun-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||this.locked)return;event.preventDefault();const index=sections.findIndex(([id])=>id===this.section),direction=(event.key==='ArrowRight'?1:-1)*(host.closest('dialog')?.dir==='rtl'?-1:1),next=event.key==='Home'?0:event.key==='End'?sections.length-1:(index+direction+sections.length)%sections.length;this.section=sections[next][0];this.page=0;this.mode='move';this.render();host.querySelector('[data-fun-tab="'+this.section+'"]').focus();});
    this.range=host.querySelector('input[type=range]');this.range.addEventListener('input',()=>{if(this.locked)return;const sticker=this.current();if(this.section==='background')this.brush=Number(this.range.value)/100;else if(sticker)sticker[this.parameter]=Number(this.range.value)/(this.parameter==='size'?100:1);this.renderTools();this.paint();});this.range.addEventListener('change',()=>{if(this.section!=='background')this.changed();});
    this.text.addEventListener('input',()=>{if(this.current()?.kind!=='text'||this.locked)return;this.current().text=this.text.value;this.paint();});this.text.addEventListener('change',()=>this.changed());this.text.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();this.changed();this.text.blur();}event.stopPropagation();});
    stage.addEventListener('pointerdown',event=>this.pointerStart(event));stage.addEventListener('pointermove',event=>this.pointerMove(event));stage.addEventListener('pointerup',event=>this.pointerEnd(event));stage.addEventListener('pointercancel',event=>this.pointerEnd(event));
    this.selection.addEventListener('keydown',event=>{if(this.locked||!this.current())return;if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();this.remove();return;}const offset={ArrowLeft:[-.005,0],ArrowRight:[.005,0],ArrowUp:[0,-.005],ArrowDown:[0,.005]}[event.key];if(offset){event.preventDefault();event.stopPropagation();this.current().x=clamp(this.current().x+offset[0]*(event.shiftKey?5:1),0,1);this.current().y=clamp(this.current().y+offset[1]*(event.shiftKey?5:1),0,1);this.changed();}});
  }
  entries(){return sections.find(([id])=>id===this.section)[3];}
  current(){return this.data.stickers.find(s=>s.id===this.selected);}
  get busy(){return Boolean(this.job&&this.data.background!=='none');}
  snapshot(){return normalizeFun(this.data);}
  restore(value){this.data=normalizeFun(value);if(!this.current())this.selected=null;this.render();}
  reset(){this.data=funDefaults();this.selected=null;this.mode='move';this.render();}
  start(source,item,signal){Object.assign(this,{source,item,signal,mask:null,maskFailed:false,faces:null,facesJob:null,job:null});this.reset();}
  close(){this.source=null;this.mask=null;this.data=funDefaults();this.selected=null;this.drag=null;this.visible=false;this.host.hidden=true;this.selection.hidden=this.tip.hidden=this.text.hidden=true;this.stage.classList.remove('pe-fun-editing','pe-brush-mode');}
  lock(value){this.locked=value;for(const button of this.host.querySelectorAll('button'))button.disabled=value;for(const b of this.host.querySelectorAll('[data-fun-page]'))b.disabled=value||Number(b.dataset.funPage)<0&&this.page===0||Number(b.dataset.funPage)>0&&this.page>=Math.ceil(this.entries().length/8)-1;this.range.disabled=value;this.text.disabled=value;this.renderTools();}
  setVisible(value,compare=false){this.visible=value;this.compare=compare;this.host.hidden=!value;this.stage.classList.toggle('pe-fun-editing',value&&!compare);this.renderTools();this.layout();}
  hasContent(){return this.data.background!=='none'||this.data.stickers.length>0;}
  render(){
    for(const button of this.host.querySelectorAll('[data-fun-tab]')){const active=button.dataset.funTab===this.section;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    const grid=this.host.querySelector('.pe-fun-choices');grid.replaceChildren();
    for(const [id,he,en,glyph]of this.entries().slice(this.page*8,this.page*8+8)){
      const button=document.createElement('button');button.type='button';button.dataset.funChoice=id;button.setAttribute('aria-label',this.tr(he,en));
      const selected=this.section==='background'&&id===this.data.background;button.setAttribute('aria-pressed',String(selected));
      if(this.section==='background'){const c=document.createElement('canvas');c.width=112;c.height=66;c.setAttribute('aria-hidden','true');drawBackground(c.getContext('2d'),112,66,id);button.append(c);}else{const icon=document.createElement('span');icon.className='pe-fun-glyph';icon.textContent=glyph;button.append(icon);}
      const label=document.createElement('span');label.textContent=this.tr(he,en);button.append(label);grid.append(button);
    }
    const pages=Math.ceil(this.entries().length/8);for(const b of this.host.querySelectorAll('[data-fun-page]')){b.hidden=pages===1;b.disabled=this.locked||Number(b.dataset.funPage)<0&&this.page===0||Number(b.dataset.funPage)>0&&this.page>=pages-1;}
    this.renderTools();this.layout();
  }
  renderTools(){
    const background=this.section==='background',sticker=this.current();this.host.querySelector('.pe-fun-mask-tools').hidden=!background;this.host.querySelector('.pe-fun-sticker-tools').hidden=background;
    for(const b of this.host.querySelectorAll('[data-fun-brush]')){b.setAttribute('aria-pressed',String(b.dataset.funBrush===this.mode));b.disabled=this.locked||this.data.background==='none'||this.busy;}
    const auto=this.host.querySelector('[data-fun-auto]');auto.disabled=this.locked||this.busy||this.data.background==='none';auto.textContent=this.busy?this.tr('מפריד דמות…','Separating…'):this.tr('הפרדה אוטומטית','Auto cutout');
    for(const b of this.host.querySelectorAll('[data-fun-parameter]')){b.setAttribute('aria-pressed',String(b.dataset.funParameter===this.parameter));b.disabled=this.locked||!sticker;}
    this.host.querySelector('[data-fun-remove]').disabled=this.locked||!sticker;this.host.querySelector('[data-fun-all]').disabled=this.locked||!sticker||this.section==='sticker'||!(this.faces?.length>1);
    const label=this.range.parentNode.querySelector('span'),output=this.range.parentNode.querySelector('output');label.textContent=background?this.tr('גודל מברשת','Brush size'):this.parameter==='size'?this.tr('גודל התוספת','Sticker size'):this.tr('זווית','Angle');
    this.range.min=background?'2':this.parameter==='size'?'4':'-180';this.range.max=background?'28':this.parameter==='size'?'130':'180';this.range.value=background?Math.round(this.brush*100):Math.round((sticker?.[this.parameter]||0)*(this.parameter==='size'?100:1));this.range.disabled=this.locked||(background?this.mode==='move'||this.data.background==='none':!sticker);output.value=this.range.value+(background||this.parameter==='size'?'%':'°');
    this.tip.hidden=!this.visible||this.compare;this.tip.textContent=this.busy?this.tr('מפרידים את הדמות מהרקע…','Separating the person from the background…'):background?(this.maskFailed?this.tr('אפשר לתקן במברשת: מחקו רקע והחזירו דמות','Use Erase and Restore to refine the cutout'):this.mode==='move'?this.tr('בחרו נוף · אפשר לתקן את החיתוך במברשת','Choose a scene · refine the cutout with the brush'):this.tr('ציירו על התמונה לתיקון החיתוך','Paint over the photo to refine the cutout')):this.tr('גררו תוספות · הידית משנה גודל · החצים מכווננים','Drag stickers · resize with the corner · nudge with arrows');
    this.stage.classList.toggle('pe-brush-mode',this.visible&&background&&this.mode!=='move'&&this.data.background!=='none');this.text.hidden=!this.visible||this.compare||sticker?.kind!=='text';if(!this.text.hidden&&document.activeElement!==this.text)this.text.value=sticker.text;
  }
  async getFaces(){
    if(this.faces)return this.faces;if(this.facesJob)return this.facesJob;
    const source=this.source;this.facesJob=(async()=>{try{const response=await window.FamilyI18n.fetch('api/media/'+this.item.id+'/faces',{signal:this.signal,cache:'no-store'});if(!response.ok)return [];const result=await response.json(),list=[...(result.faces||[]),...(result.unassignedFaces||[]),...(result.detectedFaces||[])],faces=[];for(const face of list){const r=face.rect;if(r?.width>0&&r?.height>0&&!faces.some(f=>Math.abs(f.rect.x-r.x)<Math.min(f.rect.width,r.width)*.4&&Math.abs(f.rect.y-r.y)<Math.min(f.rect.height,r.height)*.4))faces.push(face);}return faces.sort((a,b)=>b.rect.width*b.rect.height-a.rect.width*a.rect.height);}catch{return [];}})();
    const faces=await this.facesJob;if(this.source===source)this.faces=faces;return faces;
  }
  async choose(id){
    if(!this.source||this.locked)return;
    if(this.section==='background'){this.data.background=id;this.mode='move';this.changed();this.render();if(id!=='none'&&!this.mask&&!this.job)void this.auto();return;}
    if(this.data.stickers.length>=40)return;
    const kind=this.section,preset=this.entries().find(([key])=>key===id),source=this.source,faces=kind==='sticker'?[]:await this.getFaces();if(this.source!==source||this.locked)return;
    const n=this.data.stickers.filter(s=>kind==='head'?s.kind==='emoji':s.kind==='prop'&&s.prop===id).length,face=faces.length?faces[n%faces.length]:null,s=placedSticker(preset,kind,face,source.naturalWidth||source.width,source.naturalHeight||source.height,crypto.randomUUID());
    if(s.kind==='text')s.text=this.tr('איזה קטע!','What a moment!');
    if(kind==='sticker'){s.x=.3+(this.data.stickers.length%3)*.18;s.y=.3+(Math.floor(this.data.stickers.length/3)%3)*.15;}
    this.data.stickers.push(s);this.selected=s.id;this.parameter='size';this.changed();this.renderTools();this.layout();
  }
  async allFaces(){
    const s=this.current(),source=this.source;if(!s||!source)return;const faces=await this.getFaces();if(this.source!==source||!faces.length)return;
    const kind=s.kind==='emoji'?'head':'prop',list=kind==='head'?HEADS:PROPS,preset=list.find(p=>kind==='head'?p[3]===s.glyph:p[0]===s.prop);if(!preset)return;
    this.data.stickers=this.data.stickers.filter(other=>other.id!==s.id);for(const face of faces.slice(0,40-this.data.stickers.length))this.data.stickers.push(placedSticker(preset,kind,face,source.naturalWidth||source.width,source.naturalHeight||source.height,crypto.randomUUID()));this.selected=this.data.stickers.at(-1)?.id;this.changed();this.renderTools();
  }
  async auto(reset=false){
    if(!this.source||this.job||this.data.background==='none')return;const source=this.source;if(this.mask&&!reset){this.paint();return;}
    if(reset&&this.mask){this.data.strokes=[];this.changed();this.renderTools();return;}
    this.job=separatePerson(source,this.signal);this.onBusy();this.renderTools();
    try{const mask=await this.job;if(this.source!==source)return;this.mask=mask;this.maskFailed=false;}
    catch(error){if(this.source===source&&error.name!=='AbortError'){this.maskFailed=true;console.warn('Photo cutout: '+error.message);}}
    finally{if(this.source===source){this.job=null;this.onBusy();this.renderTools();this.paint();}}
  }
  remove(){if(this.locked||!this.current())return;this.data.stickers=this.data.stickers.filter(s=>s.id!==this.selected);this.selected=null;this.changed();this.renderTools();this.layout();}
  point(event){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;return {x:clamp((event.clientX-r.left)/r.width,0,1),y:clamp((event.clientY-r.top)/r.height,0,1),inside:event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom};}
  pointerStart(event){
    if(!this.visible||this.compare||this.locked||this.busy||!this.source||event.button>0||event.target===this.text)return;
    if(event.target.closest('[data-fun-delete]')){event.preventDefault();this.remove();return;}
    const point=this.point(event);if(!point)return;
    const resize=Boolean(event.target.closest('[data-fun-resize]'));
    if(this.section==='background'&&this.mode!=='move'&&this.data.background!=='none'&&point.inside){if(this.data.strokes.length>=160)return;const stroke={mode:this.mode,size:this.brush,points:[{x:point.x,y:point.y}]};this.data.strokes.push(stroke);this.drag={pointer:event.pointerId,stroke};}
    else{const s=resize?this.current():point.inside?hitSticker(this.data.stickers,point,this.canvas.width,this.canvas.height):null;this.selected=s?.id||null;if(!s){this.layout();this.renderTools();return;}this.drag={pointer:event.pointerId,id:s.id,start:point,original:{...s},resize};this.selection.focus({preventScroll:true});}
    event.preventDefault();this.stage.setPointerCapture(event.pointerId);this.renderTools();this.paint();
  }
  pointerMove(event){
    if(!this.drag||this.drag.pointer!==event.pointerId)return;const point=this.point(event);if(!point)return;event.preventDefault();
    if(this.drag.stroke){const list=this.drag.stroke.points;if(list.length<600)list.push({x:point.x,y:point.y});}
    else{const s=this.current(),d=this.drag;if(!s)return;if(d.resize){const aspect=this.canvas.width/this.canvas.height,dx=(point.x-s.x)*aspect,dy=point.y-s.y;s.size=clamp(Math.hypot(dx,dy)*1.42/Math.min(1,aspect),.04,1.3);}else{s.x=clamp(d.original.x+point.x-d.start.x,0,1);s.y=clamp(d.original.y+point.y-d.start.y,0,1);}}
    this.paint();this.renderTools();this.layout();
  }
  pointerEnd(event){if(!this.drag||event.pointerId!==this.drag.pointer)return;this.drag=null;try{this.stage.releasePointerCapture(event.pointerId);}catch{}this.changed();}
  layout(){
    const s=this.current(),show=this.visible&&!this.compare&&s&&this.section!=='background';this.selection.hidden=!show;if(!show)return;
    const r=this.canvas.getBoundingClientRect(),p=this.stage.getBoundingClientRect(),size=Math.min(r.width,r.height)*s.size;Object.assign(this.selection.style,{left:(r.left-p.left+s.x*r.width)+'px',top:(r.top-p.top+s.y*r.height)+'px',width:size+'px',height:size*(s.kind==='text'?.65:1)+'px',transform:'translate(-50%,-50%) rotate('+s.rotation+'deg)'});
  }
  compose(source,maxEdge){
    const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height,scale=Math.min(1,maxEdge/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
    if(this.data.background==='none')ctx.drawImage(source,0,0,w,h);
    else{
      drawBackground(ctx,w,h,this.data.background);const person=document.createElement('canvas');person.width=w;person.height=h;const pc=person.getContext('2d');pc.filter='blur('+(Math.min(w,h)*this.data.feather/2000)+'px)';paintMask(pc,w,h,this.mask,this.data.strokes);pc.filter='none';pc.globalCompositeOperation='source-in';pc.drawImage(source,0,0,w,h);ctx.drawImage(person,0,0);person.width=person.height=1;
    }
    for(const s of this.data.stickers)drawSticker(ctx,s,w,h);return canvas;
  }
}
