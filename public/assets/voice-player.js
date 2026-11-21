(() => {
  'use strict';
  const players=new Map();
  let context;
  const t=(he,en)=>window.FamilyI18n?.isEnglish?en:he;
  const clock=value=>{
    if(!Number.isFinite(value)||value<0)return '0:00';
    const seconds=Math.floor(value),minutes=Math.floor(seconds/60);
    return `${minutes}:${String(seconds%60).padStart(2,'0')}`;
  };
  const icon=name=>({play:'<path d="m9 5 11 7-11 7Z"/>',pause:'<path d="M8 5h3v14H8Zm7 0h3v14h-3Z"/>',back:'<path d="M4 9a9 9 0 1 1 0 7M4 3v6h6"/>',forward:'<path d="M20 9a9 9 0 1 0 0 7m0-13v6h-6"/>',sliders:'<path d="M5 3v7m0 4v7M12 3v11m0 4v3M19 3v3m0 4v11M2 10h6m1 4h6m1-8h6"/>'})[name];
  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icon(name)}</svg>`;
  function mount(root){
    for(const audio of root.querySelectorAll('audio')){
      if(players.has(audio))continue;
      const shell=document.createElement('div');shell.className='heirloom-player';
      shell.innerHTML=`<div class="voice-player-art" aria-hidden="true"><span class="voice-player-rosette">✧</span><span class="voice-player-wave">${Array.from({length:33},(_,i)=>`<i style="--bar:${8+(i*19+i*i*7)%36}px;--delay:${-(i%9)*.13}s"></i>`).join('')}</span><span class="voice-player-rosette">✧</span></div>
        <div class="voice-player-progress"><label class="voice-seek-label"><span class="voice-sr-only">${t('מיקום בהקלטה','Recording position')}</span><input class="voice-seek" type="range" min="0" max="0" value="0" step="0.1" dir="ltr" disabled></label><div class="voice-player-times" dir="ltr"><output data-voice-elapsed>0:00</output><output data-voice-duration>–:––</output></div></div>
        <div class="voice-player-controls" dir="ltr"><button type="button" class="voice-skip" data-skip="-15" aria-label="${t('15 שניות אחורה','Back 15 seconds')}">${svg('back')}<span>15</span></button><button type="button" class="voice-play" aria-label="${t('נגינה','Play')}" aria-pressed="false">${svg('play')}</button><button type="button" class="voice-skip" data-skip="15" aria-label="${t('15 שניות קדימה','Forward 15 seconds')}">${svg('forward')}<span>15</span></button></div>
        <div class="voice-player-tools"><button type="button" class="voice-tone-toggle" aria-expanded="false">${svg('sliders')}<span>${t('כיוון הצליל','Sound settings')}</span></button><label class="voice-speed"><span>${t('מהירות','Speed')}</span><select aria-label="${t('מהירות ההשמעה','Playback speed')}"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label></div>
        <div class="voice-tone-panel" hidden><p class="voice-tone-title">${t('איך תרצו לשמוע?','How would you like to listen?')}</p><div class="voice-presets"><button type="button" data-preset="balanced" aria-pressed="true">${t('מאוזן','Balanced')}</button><button type="button" data-preset="speech" aria-pressed="false">${t('דיבור ברור','Clear speech')}</button><button type="button" data-preset="warm" aria-pressed="false">${t('צליל חם','Warm')}</button></div><div class="voice-equalizer">${[['bass','נמוכים','Bass'],['mid','קול','Voice'],['treble','גבוהים','Treble']].map(([band,he,en])=>`<label><span>${t(he,en)}</span><input type="range" data-band="${band}" min="-12" max="12" step="1" value="0" aria-label="${t(he,en)}"><output>0 dB</output></label>`).join('')}</div><label class="voice-rumble"><input type="checkbox" data-rumble> ${t('סינון רחש נמוך','Reduce low rumble')}</label><label class="voice-volume"><span>${t('עוצמה','Volume')}</span><input type="range" min="0" max="1" step="0.05" value="1" aria-label="${t('עוצמת השמע','Volume')}"></label><p class="voice-tone-note" hidden></p></div><p class="voice-player-status" role="status" hidden></p>`;
      audio.after(shell);audio.classList.add('voice-native-fallback');
      const get=s=>shell.querySelector(s),play=get('.voice-play'),seek=get('.voice-seek'),elapsed=get('[data-voice-elapsed]'),duration=get('[data-voice-duration]'),status=get('.voice-player-status');
      let graph=null;
      const note=message=>{status.textContent=message;status.hidden=!message;};
      function update(){
        const length=Number.isFinite(audio.duration)?audio.duration:0,position=Number.isFinite(audio.currentTime)?audio.currentTime:0;
        seek.disabled=!length;seek.max=String(length);seek.value=String(position);
        seek.style.setProperty('--voice-progress',`${length?Math.min(100,position/length*100):0}%`);
        seek.setAttribute('aria-valuetext',`${clock(position)} ${t('מתוך','of')} ${clock(length)}`);
        elapsed.textContent=clock(position);duration.textContent=length?clock(length):'–:––';
      }
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
        if(!graph){
          const AudioContext=window.AudioContext||window.webkitAudioContext;
          if(!AudioContext)throw Error('unsupported');
          context ||= new AudioContext();
          const rumble=context.createBiquadFilter(),bass=context.createBiquadFilter(),mid=context.createBiquadFilter(),treble=context.createBiquadFilter(),gain=context.createGain();
          rumble.type='highpass';bass.type='lowshelf';bass.frequency.value=180;mid.type='peaking';mid.frequency.value=1800;mid.Q.value=.7;treble.type='highshelf';treble.frequency.value=4500;
          gain.gain.value=Number(get('.voice-volume input').value);
          const source=context.createMediaElementSource(audio);
          source.connect(rumble);rumble.connect(bass);bass.connect(mid);mid.connect(treble);treble.connect(gain);gain.connect(context.destination);
          graph={source,rumble,bass,mid,treble,gain};audio.volume=1;applyTone();
        }
        if(context.state==='suspended')await context.resume();
      }
      function unavailable(){
        const message=get('.voice-tone-note');message.hidden=false;message.textContent=t('כיוון התדרים אינו זמין בדפדפן הזה. אפשר להמשיך להאזין ולשנות את העוצמה.','Equalizer controls are unavailable in this browser. Playback and volume still work.');
        for(const input of shell.querySelectorAll('[data-band],[data-rumble],[data-preset]'))input.disabled=true;
      }
      play.addEventListener('click',async()=>{
        if(!audio.paused){audio.pause();return;}
        for(const other of players.keys())if(other!==audio)other.pause();
        note(t('פותחים את ההקלטה…','Loading recording…'));
        try{if(graph&&context.state==='suspended')await context.resume();await audio.play();note('');}
        catch{note(t('לא ניתן להתחיל כרגע. לחצו שוב כדי לנסות.','Playback could not start. Press play to try again.'));reflect();}
      });
      for(const button of shell.querySelectorAll('[data-skip]'))button.addEventListener('click',()=>{
        if(!Number.isFinite(audio.duration))return;
        audio.currentTime=Math.min(audio.duration,Math.max(0,(audio.currentTime||0)+Number(button.dataset.skip)));update();
      });
      seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,Math.max(0,Number(seek.value)));update();});
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
      get('.voice-volume input').addEventListener('input',event=>{const value=Number(event.target.value);if(graph)graph.gain.gain.setTargetAtTime(value,context.currentTime,.04);else audio.volume=value;});
      for(const name of ['timeupdate','loadedmetadata','durationchange','seeked'])audio.addEventListener(name,update);
      for(const name of ['play','pause','ended'])audio.addEventListener(name,reflect);
      audio.addEventListener('waiting',()=>{if(!audio.paused)note(t('טוען עוד מההקלטה…','Buffering…'));});
      audio.addEventListener('playing',()=>note(''));
      audio.addEventListener('error',()=>{note(t('ההקלטה לא נטענה. בדקו את החיבור ונסו שוב.','The recording could not load. Check your connection and try again.'));reflect();});
      audio.addEventListener('play',()=>{for(const other of players.keys())if(other!==audio)other.pause();});
      players.set(audio,{destroy(){audio.pause();if(graph)for(const node of Object.values(graph))node.disconnect();shell.remove();audio.classList.remove('voice-native-fallback');}});
      update();reflect();
    }
  }
  function destroy(root){for(const audio of root.querySelectorAll('audio')){players.get(audio)?.destroy();players.delete(audio);}}
  window.FamilyVoicePlayer={mount,destroy};
})();
