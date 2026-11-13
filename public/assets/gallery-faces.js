(() => {
  'use strict';
  const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
  let active=false,viewer=false,job=null,timer=null,idleTimer=null,idleUntil=0,after=0,finished=false,failed=0;
  const eligible=()=>active&&!viewer&&Date.now()>=idleUntil&&document.visibilityState!=='hidden'&&window.FamilyApp?.apiEnabled;
  async function request(path,options={}){
    const response=await I.fetch(path,{cache:'no-store',...options,headers:{...(options.body?{'Content-Type':'application/json','X-Family-Token':window.FAMILY_API_TOKEN}:{}),...options.headers}});
    const result=await response.json();if(!response.ok)throw Error(I.error(result.error));return result;
  }
  function status(){
    const host=document.getElementById('galleryFaceScanStatus');if(!host)return;
    const retryable=finished&&failed>0;
    host.textContent=retryable?tr('חלק מהתמונות לא נסרקו.','Some photos could not be scanned.'):'';
    host.parentElement.hidden=!retryable;
    const retry=document.getElementById('retryGalleryFaceScan');if(retry)retry.hidden=!retryable;
  }
  function pause(){clearTimeout(timer);timer=null;job?.abort();}
  function start(){if(!eligible()||job||timer||finished)return;timer=setTimeout(()=>{timer=null;run();},250);}
  async function save(item,faces,signal){
    if(faces.complete===false||!Array.isArray(faces.galleryFaces))return null;
    const {FACE_SCAN_VERSION}=await import('./face-coverage.mjs?v=6');
    const result=await request('api/media/'+item.id+'/faces/detection',{method:'POST',signal,body:JSON.stringify({photoRevision:item.photoRevision||'original',version:FACE_SCAN_VERSION,faces:faces.galleryFaces.map(({rect,score})=>({rect,score}))})});
    window.dispatchEvent(new CustomEvent('family-media-changed',{detail:result}));return result;
  }
  function imageFor(item,signal){
    return new Promise((resolve,reject)=>{
      const image=new Image(),done=(error)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);image.onload=image.onerror=null;if(error){image.src='';reject(error);}else resolve(image);},abort=()=>done(new DOMException('Cancelled','AbortError'));
      image.decoding='async';image.fetchPriority='low';
      const timeout=setTimeout(()=>done(Error('Photo loading timed out')),30000);
      image.onload=()=>done();image.onerror=()=>done(Error('Photo unavailable'));signal.addEventListener('abort',abort,{once:true});image.src=item.src;
    });
  }
  async function run(){
    if(!eligible()||job||finished)return;const controller=new AbortController();job=controller;status();
    try{
      const batch=await request('api/gallery/face-scan?after='+after,{signal:controller.signal});
      if(!batch.items.length){finished=true;status();return;}
      const {detectFaces}=await import('./face-detector.mjs?v=13');
      for(const item of batch.items){
        if(!eligible()||controller.signal.aborted)break;
        try{
          const image=await imageFor(item,controller.signal),faces=await detectFaces(item.id+':'+(item.photoRevision||'original'),image,controller.signal);
          if(faces.complete===false||!Array.isArray(faces.galleryFaces))throw Error('Face scan incomplete');
          await save(item,faces,controller.signal);
        }catch(error){if(controller.signal.aborted)break;failed++;}
        after=item.cursor;status();
      }
    }catch(error){if(!controller.signal.aborted){failed++;finished=true;status();}}
    finally{if(job===controller)job=null;start();}
  }
  function setActive(value){if(value&&!active){finished=false;after=0;}active=value;if(!value)pause();else{status();start();}}
  function changed(){finished=false;after=0;start();}
  function check(){finished=false;start();}
  window.FamilyGalleryFaces={setActive,save,changed,check};
  document.addEventListener('DOMContentLoaded',()=>{
    const defer=()=>{if(!active)return;idleUntil=Date.now()+3000;pause();clearTimeout(idleTimer);idleTimer=setTimeout(start,3050);};
    document.addEventListener('pointerdown',defer,{capture:true,passive:true});document.addEventListener('scroll',defer,{capture:true,passive:true});
    document.getElementById('retryGalleryFaceScan')?.addEventListener('click',()=>{failed=0;changed();status();});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')pause();else start();});
    window.addEventListener('family-face-viewer',event=>{viewer=event.detail.active;if(viewer)pause();else start();status();});
    window.addEventListener('family-media-changed',event=>{if(event.detail.operation==='photo-edit'||event.detail.operation==='restore')changed();});
    window.addEventListener('pagehide',pause);
  });
})();
