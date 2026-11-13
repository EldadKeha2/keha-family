(() => {
  'use strict';
  let current=null,options={showNames:false,showAges:false};
  const tr=(he,en)=>window.FamilyI18n.isEnglish?en:he;
  const live=c=>current===c&&!c.abort.signal.aborted;
  function hide(c){clearTimeout(c.timer);c.timer=null;c.bubble.hidden=c.outline.hidden=true;c.point=null;}
  function clear(){if(!current)return;const c=current;current=null;c.abort.abort();clearTimeout(c.timer);for(const off of c.off)off();c.bubble.remove();c.outline.remove();for(const node of c.overlays)node.remove();}
  function faceText(c,face,persistent=false){
    const age=options.showAges?window.FamilyPhotoDate?.ageFor(face.person,c.item):null;
    return [!persistent||options.showNames?face.name:'',age?tr('גיל ','Age ')+age.text:''].filter(Boolean).join(' · ');
  }
  function render(c){
    for(const node of c.overlays)node.remove();c.overlays=[];
    if(!live(c)||(!options.showNames&&!options.showAges))return;
    const image=imageRect(c.image),stage=c.stage.getBoundingClientRect();if(!image)return;
    const placed=[],overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    const faces=c.faces.map(face=>({...face,x:image.left+face.rect.x*image.width-stage.left,y:image.top+face.rect.y*image.height-stage.top,w:face.rect.width*image.width,h:face.rect.height*image.height}));
    for(const face of faces){
      const text=faceText(c,face,true);if(!text)continue;
      const label=document.createElement('div');label.className='photo-fullscreen-face-label photo-fullscreen-person-label';label.dir='auto';label.textContent=text;c.stage.append(label);c.overlays.push(label);
      const size=label.getBoundingClientRect(),w=Math.min(size.width||160,Math.max(40,stage.width-16)),h=size.height||32,cx=face.x+face.w/2;
      const x=Math.max(8,Math.min(stage.width-w-8,cx-w/2)),above=face.y-h-10,below=face.y+face.h+10;
      const candidates=[above,below,above-h-8,below+h+8,above-2*(h+8),below+2*(h+8)].map(y=>({x,y:Math.max(8,Math.min(stage.height-h-8,y)),w,h}));
      const score=box=>placed.reduce((sum,other)=>sum+overlap(box,other)*5,0)+faces.reduce((sum,other)=>sum+overlap(box,other)*2,0)+(box.y<70?1000:0);
      const box=candidates.reduce((best,next)=>score(next)<score(best)?next:best);placed.push(box);
      Object.assign(label.style,{left:box.x+'px',top:box.y+'px'});
      const belowFace=box.y>=face.y+face.h,x1=cx,y1=belowFace?face.y+face.h:face.y,x2=box.x+box.w/2,y2=belowFace?box.y:box.y+box.h;
      const link=document.createElement('div');link.className='photo-fullscreen-name-link';link.setAttribute('aria-hidden','true');Object.assign(link.style,{left:x1+'px',top:y1+'px',width:Math.hypot(x2-x1,y2-y1)+'px',transform:'rotate('+Math.atan2(y2-y1,x2-x1)+'rad)'});c.stage.append(link);c.overlays.push(link);
    }
  }
  function configure(value){options={...options,...value};if(current){hide(current);render(current);}}
  function imageRect(image){
    const r=image.getBoundingClientRect(),width=image.naturalWidth,height=image.naturalHeight;if(!width||!height||!r.width||!r.height)return null;
    const scale=Math.min(r.width/width,r.height/height),w=width*scale,h=height*scale;return {left:r.left+(r.width-w)/2,top:r.top+(r.height-h)/2,width:w,height:h};
  }
  function show(c,point,touch=false){
    if(!live(c))return;c.point={...point,touch,time:Date.now()};
    if(window.FamilyMedia?.photoState?.().busy||c.stage.classList.contains('photo-slide-running')||c.stage.querySelector('.photo-queued-drag')){hide(c);return;}
    const image=imageRect(c.image);if(!image)return;const x=(point.x-image.left)/image.width,y=(point.y-image.top)/image.height;
    if(x<0||x>1||y<0||y>1){hide(c);return;}
    const pad=touch?12:0,candidates=c.faces.filter(face=>{const r=face.rect;return x>=r.x-pad/image.width&&x<=r.x+r.width+pad/image.width&&y>=r.y-pad/image.height&&y<=r.y+r.height+pad/image.height;});
    const face=candidates.sort((a,b)=>{const distance=f=>Math.hypot((x-f.rect.x-f.rect.width/2)*image.width,(y-f.rect.y-f.rect.height/2)*image.height);return distance(a)-distance(b);})[0];
    if(!face){c.bubble.hidden=c.outline.hidden=true;return;}
    clearTimeout(c.timer);c.timer=null;const r=face.rect,stage=c.stage.getBoundingClientRect(),left=image.left+r.x*image.width-stage.left,top=image.top+r.y*image.height-stage.top,width=r.width*image.width,height=r.height*image.height;
    const text=faceText(c,face);if(c.bubble.textContent!==text)c.bubble.textContent=text;c.bubble.hidden=false;c.outline.hidden=false;
    Object.assign(c.outline.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
    const size=c.bubble.getBoundingClientRect(),half=(size.width||160)/2+8,below=top<Math.max(88,(size.height||32)+12);
    c.bubble.dataset.below=String(below);c.bubble.style.left=Math.max(half,Math.min(stage.width-half,left+width/2))+'px';c.bubble.style.top=(below?top+height+8:top-8)+'px';
    if(touch)c.timer=setTimeout(()=>{if(live(c))hide(c);},2000);
  }
  function mount(stage,image,item){
    clear();if(!stage||!image||!item?.id)return;
    const bubble=document.createElement('div'),outline=document.createElement('div');bubble.className='photo-fullscreen-face-label';bubble.dir='auto';bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');outline.className='photo-fullscreen-face-outline';outline.setAttribute('aria-hidden','true');bubble.hidden=outline.hidden=true;stage.append(outline,bubble);
    const c=current={stage,image,item,bubble,outline,faces:[],overlays:[],off:[],abort:new AbortController(),timer:null,press:null,point:null};
    const on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);c.off.push(()=>target.removeEventListener(type,fn,options));};
    on(stage,'pointermove',event=>{
      if(event.pointerType==='touch'||event.pointerType==='pen'){if(c.press&&Math.hypot(event.clientX-c.press.x,event.clientY-c.press.y)>10){c.press=null;hide(c);}return;}
      if(event.buttons){hide(c);return;}show(c,{x:event.clientX,y:event.clientY});
    },{passive:true});
    on(stage,'pointerdown',event=>{hide(c);c.press=event.isPrimary===false||event.button>0?null:{id:event.pointerId,x:event.clientX,y:event.clientY};},{passive:true});
    on(stage,'pointerup',event=>{const p=c.press;c.press=null;if(p&&p.id===event.pointerId&&Math.hypot(event.clientX-p.x,event.clientY-p.y)<=10)show(c,{x:event.clientX,y:event.clientY},event.pointerType==='touch'||event.pointerType==='pen');},{passive:true});
    on(stage,'pointercancel',()=>{c.press=null;hide(c);},{passive:true});on(stage,'pointerleave',event=>{c.press=null;if(event.pointerType!=='touch'&&event.pointerType!=='pen')hide(c);},{passive:true});
    on(stage,'scroll',()=>hide(c),{capture:true,passive:true});on(window,'resize',()=>{hide(c);render(c);},{passive:true});on(window,'blur',()=>hide(c));
    on(image,'load',()=>{render(c);if(c.point)show(c,c.point,c.point.touch);});
    if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>render(c));observer.observe(image);c.off.push(()=>observer.disconnect());}
    on(document,'visibilitychange',()=>{if(document.hidden)hide(c);});
    const normalize=faces=>faces.flatMap(face=>{
      const r=face.rect,person=face.person||window.FamilyApp?.getPerson?.(face.personId)||item.tags?.find(person=>person.id===face.personId),name=person?window.FamilyI18n.personName(person):'';
      return name&&r&&[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0?[{rect:r,name,person}]:[];
    });
    const read=window.FamilyFaces?.saved?.(item,{signal:c.abort.signal});
    Promise.resolve(read||[]).then(faces=>{if(!live(c))return;c.faces=normalize(faces);render(c);if(c.point&&(!c.point.touch||Date.now()-c.point.time<2000))show(c,c.point,c.point.touch);}).catch(()=>{});
  }
  window.FamilyFullscreenFaces={mount,clear,configure};
})();
