// Mix hue, saturation and lightness so a long tape has distinct marks.
const palette = [
  [181,62,58],[322,68,61],[88,65,50],[238,62,65],[16,78,61],
  [150,58,53],[283,56,61],[56,78,60],[202,71,55],[341,61,46],
  [116,48,43],[258,68,72],[33,70,48],[168,40,72],[301,62,46],
  [75,40,67],[219,70,44],[5,77,74],[138,57,32],[267,38,45],
  [43,90,58],[192,72,36],[332,70,77],[97,37,32],[229,82,81],
  [22,49,37],[158,74,67],[294,42,77],[59,49,36],[210,34,64]
];
const colorFor = number => palette[(number-1) % palette.length];
export const segmentHue = number => colorFor(number)[0];
export const segmentColor = number => {
  const [h,s,l] = colorFor(number);
  return `hsl(${h} ${s}% ${l}%)`;
};
const minLength = .1 - 1e-9;

export function markedRange(draft) {
  const {start,end,previousEnd = 0} = draft.segment;
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= draft.duration &&
    end >= previousEnd && end - start >= minLength ? {start,end} : null;
}

export function followPreviousEnd(previous,next) {
  if (!next || next.segment.pinned || next.saved || next.frozen || next.uploaded) return;
  const range = previous && markedRange(previous);
  next.segment.previousEnd = range?.end ?? 0;
  if (range && next.segment.followsPrevious) next.segment.start = range.end;
}

function minimumEnd(draft) {
  const {start,previousEnd = 0} = draft.segment;
  const validStart = Number.isFinite(start) && start <= draft.duration ? start : 0;
  return Math.min(draft.duration,Math.max(0,previousEnd,validStart));
}

export async function prepareSegmentFile(options, onProgress) {
  if (typeof Worker === 'undefined') {
    const {makeSegmentFile} = await import('./video-segment-file.mjs');
    return makeSegmentFile(options, onProgress);
  }
  const worker = new Worker(new URL('./video-segment-worker.mjs', import.meta.url), {type:'module'});
  try {
    return await new Promise((resolve,reject) => {
      worker.onmessage = ({data}) => {
        if ('progress' in data) onProgress(data.progress);
        else if (data.file) resolve(data.file);
        else reject(Object.assign(new Error(data.error), {code:data.code}));
      };
      worker.onerror = () => reject(new Error('Could not prepare segment'));
      worker.postMessage(options);
    });
  } finally {
    worker.terminate();
  }
}

export function segmentControlsHTML(tr) {
  const labels = [
    ['Start',tr('התחלה','Start'),tr('קביעת התחלת המקטע לפי מיקום הנגן','Set segment start to player time')],
    ['End',tr('סיום','End'),tr('קביעת סוף המקטע לפי מיקום הנגן','Set segment end to player time')]
  ];
  return `<section id="videoUploadSegments" class="upload-segments" hidden aria-label="${tr('סימון מקטעים','Segment selection')}">
    ${labels.map(([id,label,mark]) => `<div class="upload-segment-boundary">
      <label for="videoUpload${id}Slider">${label}</label>
      <input id="videoUpload${id}Slider" type="range" min="0" step=".01" dir="ltr" data-video-boundary>
      <input id="videoUpload${id}Time" type="text" dir="ltr" autocomplete="off" spellcheck="false" placeholder="00:00:00" aria-label="${label}" data-video-boundary>
      <button type="button" id="videoUpload${id}Here" class="secondary-button" title="${mark}" aria-label="${mark}" data-video-boundary>${tr('מהנגן','Use playhead')}</button>
    </div>`).join('')}
    <details id="videoUploadBatchOptions" class="upload-segment-batch" hidden>
      <summary>${tr('העלאה עד זמן מסוים','Upload up to a time')}</summary>
      <div><label for="videoUploadCutoffTime">${tr('מקטעים שמסתיימים עד','Segments ending by')}</label>
        <input type="text" id="videoUploadCutoffTime" dir="ltr" autocomplete="off" spellcheck="false" placeholder="00:00:00">
        <button type="button" class="secondary-button" id="videoUploadCutoffHere">${tr('מהנגן','Use playhead')}</button>
        <button type="button" class="secondary-button" id="videoUploadSaveThrough">${tr('העלאה עד כאן','Upload through here')}</button>
      </div>
    </details>
  </section>`;
}

export function bindSegmentTimeline({get, tr, editor, select, changed, saving, seekTo, playbackError, checkpoint, endGesture, reviewing}) {
  const player = get('Player'), track = get('Track'), playhead = get('Playhead');
  const clock = time => editor.clock(Math.round(time * 100) / 100);
  const axes = [['Start','start'], ['End','end']];
  const keySteps = new Map([['a',-1],['l',1],['KeyA',-1],['KeyL',1]]);
  for (const slider of [playhead,get('StartSlider'),get('EndSlider')]) {
    slider.setAttribute('aria-keyshortcuts','A L');
    slider.title = tr('A – שנייה אחורה · L – שנייה קדימה','A – back one second · L – forward one second');
  }
  let drafts = [], index = 0, preview = null, drag = null, dragged = false, pointerSlider = null, nativeFrom = null;
  const position = () => (reviewing() ? drafts[index]?.segment.start || 0 : 0) + (player.currentTime || 0);

  for (const slider of [playhead,get('StartSlider'),get('EndSlider')]) {
    slider.addEventListener('pointerdown',() => { endGesture(); pointerSlider = slider; });
    for (const event of ['pointerup','pointercancel','lostpointercapture','blur']) {
      slider.addEventListener(event,() => { pointerSlider = null; endGesture(); });
    }
  }

  function showPosition(time) {
    playhead.value = time;
    playhead.setAttribute('aria-valuetext',clock(time));
  }

  function seek(time, {pause = true} = {}) {
    if (!Number.isFinite(time)) return;
    const active = drafts[index];
    const target = reviewing() && active ? Math.max(active.segment.start,Math.min(active.segment.end,time)) :
      Math.max(0,Math.min(active?.duration ?? time,time));
    nativeFrom = null;
    if (pause || (preview && (target < preview.start || target > preview.end))) preview = null;
    if (pause) player.pause();
    if (reviewing()) player.currentTime = target - active.segment.start;
    else if (seekTo) seekTo(target); else player.currentTime = target;
    showPosition(target);
  }

  function updatePlayhead() {
    const draft = drafts[index];
    if (!draft) return;
    showPosition(Math.min(draft.duration,position()));
    if (preview && position() >= preview.end) seek(preview.end);
  }
  player.addEventListener('timeupdate',updatePlayhead);
  player.addEventListener('seeked',updatePlayhead);
  playhead.addEventListener('input',() => { if (!saving() && drafts[index]) userSeek(Number(playhead.value),pointerSlider); });
  player.addEventListener('pointerdown',() => { if (drafts[index]) nativeFrom = position(); });
  player.addEventListener('keydown',event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) nativeFrom = position();
  });
  player.addEventListener('seeking',() => {
    if (nativeFrom !== null && position() !== nativeFrom) { checkpoint(null,nativeFrom); nativeFrom = null; }
    if (preview && (position() < preview.start - .05 || position() > preview.end + .05)) preview = null;
  });

  function paintMarks() {
    const current = drafts[index];
    const intervals = drafts.map((draft,i) => ({draft, i, range:markedRange(draft)}))
      .filter(entry => entry.range).sort((a,b) => a.range.start - b.range.start);
    // Adjacent ranges share a track. Give overlapping selections their own row.
    const laneEnds = [];
    get('Marks').innerHTML = intervals.map(({draft,i,range}) => {
      let lane = laneEnds.findIndex(end => end <= range.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = range.end;
      const pinned = Boolean(draft.segment.pinned);
      const label = tr('מקטע ','Segment ') + draft.segment.number + (pinned ? tr(' · מקובע',' · Locked') : '');
      return `<button type="button" data-segment-index="${i}" data-pinned="${pinned}" aria-current="${i === index}" aria-label="${label}" title="${label} · ${clock(range.start)} – ${clock(range.end)}" style="background-color:${segmentColor(draft.segment.number)};left:${100*range.start/current.duration}%;width:${100*(range.end-range.start)/current.duration}%;top:${lane*14+3}px"></button>`;
    }).join('');
    track.style.setProperty('--track-height', Math.max(1,laneEnds.length) * 14 + 6 + 'px');
  }

  function sync(activeInput) {
    const draft = drafts[index];
    if (!draft) return;
    playhead.max = draft.duration;
    for (const [id,edge] of axes) {
      const value = draft.segment[edge];
      const slider = get(id+'Slider'), field = get(id+'Time');
      const isEnd = edge === 'end';
      const minimum = isEnd ? minimumEnd(draft) : 0;
      const belowMinimum = isEnd && Number.isFinite(value) && value < minimum;
      const hasValue = Number.isFinite(value) && !belowMinimum;
      const fallback = isEnd && index === 0 && minimum === 0 ? draft.duration : minimum;
      slider.min = minimum;
      slider.max = draft.duration;
      slider.value = hasValue ? value : fallback;
      slider.setAttribute('aria-valuetext',hasValue ? clock(value) : tr('טרם סומן','Unmarked')+' · '+clock(fallback));
      if (isEnd) field.placeholder = index > 0 || minimum > 0 ? clock(minimum) : '00:00:00';
      if (field !== activeInput) field.value = belowMinimum ? '' : draft.segment[edge+'Text'] ?? (hasValue ? clock(value) : '');
      field.setAttribute('aria-invalid',String(Boolean(field.value && !Number.isFinite(value)) ||
        (Number.isFinite(value) && (value < 0 || value > draft.duration || (edge === 'end' && !markedRange(draft))))));
    }
    paintMarks();
    updatePlayhead();
  }

  function setBoundary(id,edge,source,commit = false) {
    const draft = drafts[index];
    if (!draft || saving() || draft.saved || draft.frozen || draft.uploaded || draft.segment.pinned) return;
    const segment = draft.segment, field = get(id+'Time');
    checkpoint(source === 'field' ? field : source === 'slider' ? pointerSlider : null);
    let value = source === 'field' ? editor.seconds(field.value) :
      source === 'slider' ? Number(get(id+'Slider').value) : player.currentTime;
    const isEnd = edge === 'end';
    const minimum = isEnd ? minimumEnd(draft) : 0;
    const belowMinimum = isEnd && Number.isFinite(value) && value < minimum;
    const typing = source === 'field' && !commit;
    // Partial timestamps can be below the floor while typing a later time.
    if (belowMinimum) value = typing ? NaN : minimum;
    else if (Number.isFinite(value) && value !== minimum) {
      // A fractional minimum shifts the native slider's last .01-second step.
      const tolerance = isEnd && source === 'slider' ? .01 - 1e-9 : .0051;
      if (Math.abs(draft.duration - value) <= tolerance) value = draft.duration;
    }
    segment[edge] = Number.isFinite(value) ? value : null;
    segment[edge+'Text'] = typing ? field.value : null;
    if (edge === 'start') segment.followsPrevious = false;
    followPreviousEnd(draft,drafts[index+1]);
    if (Number.isFinite(value) && value >= 0 && value <= draft.duration && (source !== 'playhead' || belowMinimum)) seek(value);
    sync(typing ? field : null);
    changed();
  }
  for (const [id,edge] of axes) {
    const slider = get(id+'Slider');
    slider.addEventListener('input',() => setBoundary(id,edge,'slider'));
    // A click on the current thumb can select it without a native input event.
    const markDefault = () => {
      if (drafts[index] && drafts[index].segment[edge] === null) setBoundary(id,edge,'slider');
    };
    slider.addEventListener('click',markDefault);
    slider.addEventListener('keyup',event => {
      if (['End','Home','Enter','ArrowLeft','ArrowRight'].includes(event.key)) markDefault();
    });
    const field = get(id+'Time');
    field.addEventListener('input',() => setBoundary(id,edge,'field'));
    const commitField = () => {
      const draft = drafts[index];
      if (!draft || draft.segment[edge+'Text'] == null) return;
      if (edge === 'end' && editor.seconds(field.value) < minimumEnd(draft)) setBoundary(id,edge,'field',true);
      else if (Number.isFinite(draft.segment[edge])) { draft.segment[edge+'Text'] = null; field.value = clock(draft.segment[edge]); }
    };
    field.addEventListener('change',commitField);
    field.addEventListener('blur',() => { commitField(); endGesture(); });
    field.addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); field.blur(); } });
    get(id+'Here').addEventListener('click',() => setBoundary(id,edge,'playhead'));
  }
  function pick(event) {
    const button = event.target.closest('[data-segment-index]');
    if (!button || saving()) return false;
    const target = Number(button.dataset.segmentIndex);
    if (target === index) userSeek(drafts[index].segment.start || 0);
    else select(target);
    return true;
  }
  function userSeek(time,group = null,options) {
    if (time === position()) return;
    checkpoint(group);
    if (reviewing() && (time < drafts[index].segment.start || time > drafts[index].segment.end)) {
      const target = drafts.findIndex(d => d.segment.start <= time && time <= d.segment.end);
      if (target >= 0 && target !== index) select(target,false);
    }
    seek(time,options);
  }
  function seekAtX(x) {
    const rect = track.getBoundingClientRect();
    if (rect.width > 0) userSeek(drafts[index].duration * Math.max(0,Math.min(1,(x-rect.left)/rect.width)),drag);
  }
  // A tap selects a marked segment. Dragging anywhere scrubs the same rail.
  track.addEventListener('pointerdown',event => {
    if (saving() || !drafts[index] || !event.isPrimary || event.button !== 0) return;
    dragged = false;
    if (event.target === playhead) return;
    drag = {id:event.pointerId, x:event.clientX};
    event.target.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointermove',event => {
    if (drag?.id !== event.pointerId || saving() || !drafts[index]) return;
    if (!dragged && Math.abs(event.clientX-drag.x) < 4) return;
    dragged = true;
    seekAtX(event.clientX);
  });
  track.addEventListener('pointerup',event => {
    if (drag?.id !== event.pointerId) return;
    if (dragged && drafts[index] && !saving()) seekAtX(event.clientX);
    drag = null; endGesture();
  });
  track.addEventListener('lostpointercapture',() => { drag = null; });
  track.addEventListener('click',event => {
    if (event.target === playhead || (dragged && event.detail) || pick(event) || saving() || !drafts[index]) return;
    seekAtX(event.clientX);
  });

  return {
    seek,position,
    stepByKey(event) {
      if (!drafts[index] || saving() || event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
          event.ctrlKey || event.altKey || event.metaKey) return false;
      // Physical key codes keep the same shortcuts when the keyboard is set to Hebrew.
      const step = keySteps.get(event.key.toLowerCase()) ?? keySteps.get(event.code);
      if (!step) return false;
      const target = event.target;
      const boundary = axes.find(([id]) => target === get(id+'Slider'));
      if (boundary) {
        if (target.disabled) return false;
        const current = Number(target.value);
        const next = Math.max(Number(target.min),Math.min(Number(target.max),current + step));
        if (next !== current) {
          target.value = next;
          setBoundary(...boundary,'slider');
        }
      } else {
        if (target !== playhead && (target.isContentEditable || target.closest('input,textarea,select,[role="textbox"],[role="combobox"]'))) return false;
        userSeek(Math.max(0,Math.min(drafts[index].duration,position()+step)),null,{pause:false});
      }
      return true;
    },
    show(items, activeIndex) {
      if (drafts[index] !== items[activeIndex]) { preview = null; nativeFrom = null; }
      if (!items.length) { drag = null; pointerSlider = null; }
      drafts = items; index = activeIndex;
      track.hidden = get('Segments').hidden = !items.length;
      if (!items.length) return;
      sync();
    },
    seekStart() { const draft = drafts[index]; if (draft) seek(draft.segment.start || 0); },
    play() {
      const range = markedRange(drafts[index]);
      if (!range) return;
      if (position() !== range.start) checkpoint();
      seek(range.start); preview = range;
      player.play()?.catch(error => {
        if (preview !== range) return;
        preview = null; playbackError?.(error);
      });
    }
  };
}
