(() => {
  'use strict';
  const players=new Map();
  let context, lastAudio;
  const t=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const clock=value=>{
    if(!Number.isFinite(value)||value<0)return '0:00';
    const seconds=Math.floor(value),minutes=Math.floor(seconds/60);
    return `${minutes}:${String(seconds%60).padStart(2,'0')}`;
  };
  const icon=name=>({play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M8 5h3v14H8Zm7 0h3v14h-3Z"/>',back:'<path d="M4 9a9 9 0 1 1 0 7M4 3v6h6"/>',forward:'<path d="M20 9a9 9 0 1 0 0 7m0-13v6h-6"/>',speaker:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',sliders:'<path d="M5 3v7m0 4v7M12 3v11m0 4v3M19 3v3m0 4v11M2 10h6m1 4h6m1-8h6"/>'})[name];
  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icon(name)}</svg>`;
  const boostOptions=Array.from({length:21},(_,index)=>{
    const percent=100+index*25;
    return `<option value="${percent}"${index===0?' selected':''}>${percent}%</option>`;
  }).join('');

  function mountTimeline(shell,audio){
    const rail=shell.querySelector('.voice-seek-rail'),seek=rail.querySelector('.voice-seek');
    const elapsed=shell.querySelector('[data-voice-elapsed]'),duration=shell.querySelector('[data-voice-duration]');
    const readout=rail.querySelector('.voice-seek-readout');
    let drag=null;

    function update(){
      const length=Number.isFinite(audio.duration)?audio.duration:0;
      const lastSecond=Math.ceil(length);
      const preview=length>0 && drag?.target!=null;
      const time=clamp(preview?drag.target:(audio.currentTime||0),0,length);
      const second=time===length?lastSecond:Math.floor(time);
      // While dragging, show the seconds around the pointer on the same rail.
      const span=preview?Math.min(drag.span,lastSecond):lastSecond;
      const start=preview?clamp(drag.start,Math.max(0,second-span),Math.min(second,lastSecond-span)):0;
      seek.min=String(start);seek.max=String(start+span);seek.value=String(second);seek.disabled=!length;
      rail.style.setProperty('--voice-progress',`${span?(second-start)/span*100:0}%`);
      seek.setAttribute('aria-valuetext',`${clock(time)} ${t('מתוך','of')} ${clock(length)}`);
      elapsed.textContent=clock(time);duration.textContent=length?clock(length):'–:––';
      readout.hidden=!preview;
      if(preview)readout.textContent=clock(time);
    }
    function seekTo(time){
      if(Number.isFinite(time)&&Number.isFinite(audio.duration)&&audio.duration>0){
        lastAudio=audio;
        audio.currentTime=clamp(time,0,audio.duration);
      }
      update();
    }
    function onArrow(event){
      if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||seek.disabled||drag)return;
      if(event.key!=='ArrowRight'&&event.key!=='ArrowLeft')return;
      if(event.target!==seek&&event.target.closest?.('input,select,textarea,[contenteditable]'))return;
      event.preventDefault();
      seekTo(audio.currentTime+(event.key==='ArrowRight'?1:-1));
    }
    shell.addEventListener('keydown',onArrow);
    shell.addEventListener('focusin',()=>{lastAudio=audio;});
    seek.addEventListener('input',()=>seekTo(Number(seek.value)));
    for(const button of shell.querySelectorAll('[data-skip]')){
      button.addEventListener('click',()=>seekTo(audio.currentTime+Number(button.dataset.skip)));
    }

    if(window.PointerEvent){
      // The native range still handles keyboard and assistive input. Pointer
      // gestures use a fixed fine scale independent of the recording length.
      rail.classList.add('voice-pointer-seek');
      const thumbRadius=8, pixelsPerSecond=10;
      rail.addEventListener('pointerdown',event=>{
        if(drag||seek.disabled||!event.isPrimary||event.button!==0)return;
        const rect=rail.getBoundingClientRect(),travel=Math.max(1,rect.width-2*thumbRadius);
        const fraction=clamp((event.clientX-rect.left-thumbRadius)/travel,0,1);
        const length=Math.ceil(audio.duration),second=Math.floor(audio.currentTime);
        const span=Math.min(length,Math.max(1,Math.round(travel/pixelsPerSecond)));
        const thumbX=rect.left+thumbRadius+travel*Number(seek.value)/length;
        drag={id:event.pointerId,x:event.clientX,travel,second,span,
          start:clamp(second-Math.round(fraction*span),0,length-span),
          tap:Math.abs(event.clientX-thumbX)<=(event.pointerType==='touch'?22:thumbRadius+2)?null:Math.round(fraction*length),
          target:null};
        event.preventDefault();
        seek.focus({preventScroll:true});
        rail.setPointerCapture(event.pointerId);
      });
      function previewDrag(event){
        const distance=event.clientX-drag.x;
        if(drag.target===null&&Math.abs(distance)<5)return;
        const seconds=Math.sign(distance)*Math.round(Math.abs(distance)*drag.span/drag.travel);
        drag.target=clamp(drag.second+seconds,0,audio.duration);
      }
      rail.addEventListener('pointermove',event=>{
        if(drag?.id!==event.pointerId)return;
        previewDrag(event);update();
      });
      rail.addEventListener('pointerup',event=>{
        if(drag?.id!==event.pointerId)return;
        previewDrag(event);
        const time=drag.target??drag.tap;
        drag=null;
        if(time!==null)seekTo(time);else update();
      });
      function cancelDrag(event){
        if(drag?.id===event.pointerId){drag=null;update();}
      }
      rail.addEventListener('pointercancel',cancelDrag);
      rail.addEventListener('lostpointercapture',cancelDrag);
    }
    for(const name of ['timeupdate','loadedmetadata','durationchange','seeked'])audio.addEventListener(name,update);
    update();
    return onArrow;
  }

  document.addEventListener('keydown',event=>{
    if(event.target!==document.body&&event.target!==document.documentElement&&event.target!==document)return;
    const player=players.get(lastAudio);
    if(player?.shell.isConnected&&!player.shell.closest('[hidden],[inert]')&&!document.querySelector('dialog[open]'))player.onArrow(event);
  });

  function mount(root){
    for(const audio of root.querySelectorAll('audio')){
      if(players.has(audio))continue;
      const shell=document.createElement('div');shell.className='heirloom-player';
      shell.innerHTML=`<div class="voice-player-art" aria-hidden="true"><span class="voice-player-rosette">✧</span><span class="voice-player-wave">${Array.from({length:33},(_,i)=>`<i style="--bar:${8+(i*19+i*i*7)%36}px;--delay:${-(i%9)*.13}s"></i>`).join('')}</span><span class="voice-player-rosette">✧</span></div>
        <div class="voice-player-progress"><div class="voice-seek-rail" dir="ltr"><input class="voice-seek" type="range" min="0" max="0" value="0" step="1" dir="ltr" aria-label="${t('מיקום בהקלטה','Recording position')}" aria-keyshortcuts="ArrowRight ArrowLeft" disabled><span class="voice-seek-readout" aria-hidden="true" hidden></span></div><div class="voice-player-times" dir="ltr"><output data-voice-elapsed>0:00</output><span class="voice-seek-hint" dir="auto">${t('גררו לפי שניות · לחצו כדי לדלג','Drag by seconds · Tap to jump')}</span><output data-voice-duration>–:––</output></div></div>
        <div class="voice-player-controls" dir="ltr"><button type="button" class="voice-skip" data-skip="-15" aria-label="${t('15 שניות אחורה','Back 15 seconds')}">${svg('back')}<span>15</span></button><button type="button" class="voice-play" aria-label="${t('נגינה','Play')}" aria-pressed="false">${svg('play')}</button><button type="button" class="voice-skip" data-skip="15" aria-label="${t('15 שניות קדימה','Forward 15 seconds')}">${svg('forward')}<span>15</span></button></div>
        <label class="voice-boost"><span>${svg('speaker')}${t('מגביר קול','Volume boost')}</span><select dir="ltr" aria-label="${t('מגביר קול','Volume boost')}">${boostOptions}</select></label>
        <div class="voice-player-tools"><button type="button" class="voice-tone-toggle" aria-expanded="false">${svg('sliders')}<span>${t('כיוון הצליל','Sound settings')}</span></button><label class="voice-speed"><span>${t('מהירות','Speed')}</span><select aria-label="${t('מהירות ההשמעה','Playback speed')}"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label></div>
        <div class="voice-tone-panel" hidden><p class="voice-tone-title">${t('איך תרצו לשמוע?','How would you like to listen?')}</p><div class="voice-presets"><button type="button" data-preset="balanced" aria-pressed="true">${t('מאוזן','Balanced')}</button><button type="button" data-preset="speech" aria-pressed="false">${t('דיבור ברור','Clear speech')}</button><button type="button" data-preset="warm" aria-pressed="false">${t('צליל חם','Warm')}</button></div><div class="voice-equalizer">${[['bass','נמוכים','Bass'],['mid','קול','Voice'],['treble','גבוהים','Treble']].map(([band,he,en])=>`<label><span>${t(he,en)}</span><input type="range" data-band="${band}" min="-12" max="12" step="1" value="0" aria-label="${t(he,en)}"><output>0 dB</output></label>`).join('')}</div><label class="voice-rumble"><input type="checkbox" data-rumble> ${t('סינון רחש נמוך','Reduce low rumble')}</label><label class="voice-volume"><span>${t('עוצמה','Volume')}</span><input type="range" min="0" max="1" step="0.05" value="1" aria-label="${t('עוצמת השמע','Volume')}"></label></div><p class="voice-tone-note" hidden></p><p class="voice-player-status" role="status" hidden></p>`;
      audio.after(shell);audio.classList.add('voice-native-fallback');
      const get=s=>shell.querySelector(s),play=get('.voice-play'),status=get('.voice-player-status');
      const volume=get('.voice-volume input'),boost=get('.voice-boost select');
      const toneNote=get('.voice-tone-note');
      const onArrow=mountTimeline(shell,audio);
      let graph=null;
      const note=message=>{status.textContent=message;status.hidden=!message;};
      function reflect(){
        const active=!audio.paused&&!audio.ended;
        shell.classList.toggle('is-playing',active);play.innerHTML=svg(active?'pause':'play');play.setAttribute('aria-label',active?t('השהיה','Pause'):t('נגינה','Play'));play.setAttribute('aria-pressed',String(active));
      }
      function applyTone(){
        if(!graph)return;
        for(const band of ['bass','mid','treble'])graph[band].gain.setTargetAtTime(Number(get(`[data-band="${band}"]`).value),context.currentTime,.04);
        graph.rumble.frequency.setTargetAtTime(get('[data-rumble]').checked?95:10,context.currentTime,.04);
      }
      async function soundGraph(){
        const AudioContext=window.AudioContext||window.webkitAudioContext;
        if(!AudioContext)throw Error('unsupported');
        context ||= new AudioContext();
        // Resume from the user's gesture before taking over native audio output.
        if(context.state!=='running')await context.resume();
        if(!shell.isConnected)return;
        if(!graph){
          const rumble=context.createBiquadFilter(),bass=context.createBiquadFilter(),mid=context.createBiquadFilter(),treble=context.createBiquadFilter(),gain=context.createGain();
          rumble.type='highpass';bass.type='lowshelf';bass.frequency.value=180;mid.type='peaking';mid.frequency.value=1800;mid.Q.value=.7;treble.type='highshelf';treble.frequency.value=4500;
          const limiter=context.createDynamicsCompressor();
          limiter.threshold.value=-2;limiter.knee.value=1;limiter.attack.value=.003;limiter.release.value=.15;
          limiter.ratio.value=Number(boost.value)>100?20:1;
          gain.gain.value=Number(volume.value)*Number(boost.value)/100;
          rumble.connect(bass);bass.connect(mid);mid.connect(treble);treble.connect(gain);gain.connect(limiter);limiter.connect(context.destination);
          const source=context.createMediaElementSource(audio);
          source.connect(rumble);
          graph={source,rumble,bass,mid,treble,gain,limiter};audio.volume=1;applyTone();
        }
      }
      function applyLevel(){
        if(!graph){audio.volume=Number(volume.value);return;}
        const multiplier=Number(boost.value)/100;
        graph.limiter.ratio.value=multiplier>1?20:1;
        graph.gain.gain.setTargetAtTime(Number(volume.value)*multiplier,context.currentTime,.025);
      }
      async function changeBoost(){
        try{await soundGraph();applyLevel();}catch{unavailable();}
      }
      function unavailable(){
        toneNote.hidden=false;toneNote.textContent=t('הדפדפן הזה תומך בהשמעה בעוצמה הרגילה בלבד.','This browser supports playback at normal volume only.');
        boost.selectedIndex=0;boost.disabled=true;applyLevel();
        for(const input of shell.querySelectorAll('[data-band],[data-rumble],[data-preset]'))input.disabled=true;
      }
      if(!window.AudioContext&&!window.webkitAudioContext)unavailable();
      boost.addEventListener('change',changeBoost);
      play.addEventListener('click',async()=>{
        if(!audio.paused){audio.pause();return;}
        for(const other of players.keys())if(other!==audio)other.pause();
        note(t('פותחים את ההקלטה…','Loading recording…'));
        try{const resume=graph||Number(boost.value)>100?soundGraph().catch(unavailable):undefined;await Promise.all([audio.play(),resume]);note('');}
        catch{note(t('לא ניתן להתחיל כרגע. לחצו שוב כדי לנסות.','Playback could not start. Press play to try again.'));reflect();}
      });
      get('.voice-speed select').addEventListener('change',event=>{audio.playbackRate=Number(event.target.value);});
      const toggle=get('.voice-tone-toggle'),panel=get('.voice-tone-panel');
      toggle.setAttribute('aria-controls','voice-tone-'+Math.random().toString(36).slice(2));panel.id=toggle.getAttribute('aria-controls');
      toggle.addEventListener('click',async()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)try{await soundGraph();}catch{unavailable();}});
      for(const slider of shell.querySelectorAll('[data-band]'))slider.addEventListener('input',()=>{
        slider.nextElementSibling.textContent=`${Number(slider.value)>0?'+':''}${slider.value} dB`;
        for(const button of shell.querySelectorAll('[data-preset]'))button.setAttribute('aria-pressed','false');applyTone();
      });
      for(const button of shell.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{
        const values={balanced:[0,0,0],speech:[-4,4,-1],warm:[3,1,-2]}[button.dataset.preset];
        ['bass','mid','treble'].forEach((band,i)=>{const slider=get(`[data-band="${band}"]`);slider.value=String(values[i]);slider.nextElementSibling.textContent=`${values[i]>0?'+':''}${values[i]} dB`;});
        for(const other of shell.querySelectorAll('[data-preset]'))other.setAttribute('aria-pressed',String(other===button));applyTone();
      });
      get('[data-rumble]').addEventListener('change',applyTone);
      volume.addEventListener('input',applyLevel);
      for(const name of ['play','pause','ended'])audio.addEventListener(name,reflect);
      audio.addEventListener('waiting',()=>{if(!audio.paused)note(t('טוען עוד מההקלטה…','Buffering…'));});
      audio.addEventListener('playing',()=>note(''));
      audio.addEventListener('error',()=>{note(t('ההקלטה לא נטענה. בדקו את החיבור ונסו שוב.','The recording could not load. Check your connection and try again.'));reflect();});
      audio.addEventListener('play',()=>{lastAudio=audio;for(const other of players.keys())if(other!==audio)other.pause();});
      players.set(audio,{shell,onArrow,destroy(){if(lastAudio===audio)lastAudio=null;audio.pause();if(graph)for(const node of Object.values(graph))node.disconnect();shell.remove();audio.classList.remove('voice-native-fallback');}});
      reflect();
    }
  }
  function destroy(root){for(const audio of root.querySelectorAll('audio')){players.get(audio)?.destroy();players.delete(audio);}}
  window.FamilyVoicePlayer={mount,destroy};
})();
