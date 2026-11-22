export const segmentHue = number => Math.round((181 + (number - 1) * 137.508) % 360);

export function markedRange(draft) {
  const {start,end} = draft.segment;
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= draft.duration &&
    end - start >= .1 - 1e-9 ? {start,end} : null;
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
    <div id="videoUploadTrack" class="upload-segment-track" dir="ltr" aria-label="${tr('המקטעים על ציר הזמן','Segments on the timeline')}">
      <div id="videoUploadMarks"></div><span id="videoUploadPlayhead" aria-hidden="true"></span>
    </div>
    ${labels.map(([id,label,mark]) => `<div class="upload-segment-boundary">
      <label for="videoUpload${id}Slider">${label}</label>
      <input id="videoUpload${id}Slider" type="range" min="0" step=".01" dir="ltr" data-video-boundary>
      <input id="videoUpload${id}Time" type="text" dir="ltr" autocomplete="off" spellcheck="false" placeholder="00:00:00" aria-label="${label}" data-video-boundary>
      <button type="button" id="videoUpload${id}Here" class="secondary-button" title="${mark}" aria-label="${mark}" data-video-boundary>${tr('מהנגן','Use playhead')}</button>
    </div>`).join('')}
    <div class="upload-segment-list" id="videoUploadSegmentList" aria-label="${tr('מעבר בין מקטעים','Go to a segment')}"></div>
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

export function bindSegmentTimeline({get, tr, editor, select, changed, saving}) {
  const player = get('Player');
  const clock = time => editor.clock(Math.round(time * 100) / 100);
  const axes = [['Start','start'], ['End','end']];
  let drafts = [], index = 0, preview = null;

  function seek(time) {
    if (!Number.isFinite(time)) return;
    preview = null;
    player.pause();
    player.currentTime = Math.max(0,Math.min(drafts[index]?.duration ?? time,time));
  }

  function updatePlayhead() {
    const draft = drafts[index];
    if (!draft) return;
    get('Playhead').style.left = Math.min(100, (player.currentTime || 0) / draft.duration * 100) + '%';
    if (preview && player.currentTime >= preview.end) seek(preview.end);
  }
  player.addEventListener('timeupdate',updatePlayhead);
  player.addEventListener('play',() => {
    if (preview && Math.abs(player.currentTime - preview.start) > .12) preview = null;
  });
  player.addEventListener('seeking',() => {
    if (preview && (player.currentTime < preview.start - .05 || player.currentTime > preview.end + .05)) preview = null;
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
      const label = tr('מקטע ','Segment ') + draft.segment.number;
      return `<button type="button" data-segment-index="${i}" aria-current="${i === index}" aria-label="${label}" title="${label} · ${clock(range.start)} – ${clock(range.end)}" style="--mark-hue:${segmentHue(draft.segment.number)};left:${100*range.start/current.duration}%;width:${100*(range.end-range.start)/current.duration}%;top:${lane*9+4}px"></button>`;
    }).join('');
    get('Track').style.setProperty('--track-height', Math.max(1,laneEnds.length) * 9 + 8 + 'px');
  }

  function sync(activeInput) {
    const draft = drafts[index];
    if (!draft) return;
    for (const [id,edge] of axes) {
      const value = draft.segment[edge];
      const fallback = edge === 'start' ? 0 : draft.duration;
      const slider = get(id+'Slider'), field = get(id+'Time');
      slider.max = draft.duration;
      slider.value = Number.isFinite(value) ? value : fallback;
      slider.setAttribute('aria-valuetext', Number.isFinite(value) ? clock(value) : tr('טרם סומן','Unmarked'));
      if (field !== activeInput) field.value = draft.segment[edge+'Text'] ?? (Number.isFinite(value) ? clock(value) : '');
      field.setAttribute('aria-invalid',String(Boolean(field.value && !Number.isFinite(value)) ||
        (Number.isFinite(value) && (value < 0 || value > draft.duration || (edge === 'end' && !markedRange(draft))))));
    }
    paintMarks();
    updatePlayhead();
  }

  function setBoundary(id,edge,source) {
    const draft = drafts[index];
    if (!draft || saving() || draft.saved || draft.frozen || draft.uploaded) return;
    const segment = draft.segment, field = get(id+'Time');
    let value = source === 'field' ? editor.seconds(field.value) :
      source === 'slider' ? Number(get(id+'Slider').value) : player.currentTime;
    if (Number.isFinite(value) && Math.abs(draft.duration - value) <= .0051) value = draft.duration;
    segment[edge] = Number.isFinite(value) ? value : null;
    segment[edge+'Text'] = source === 'field' ? field.value : null;
    if (Number.isFinite(value) && value >= 0 && value <= draft.duration && source !== 'playhead') seek(value);
    sync(source === 'field' ? field : null);
    changed();
  }
  for (const [id,edge] of axes) {
    const slider = get(id+'Slider');
    slider.addEventListener('input',() => setBoundary(id,edge,'slider'));
    // Choosing the pre-positioned end thumb must also mark the exact film end.
    const markDefault = () => {
      if (drafts[index] && drafts[index].segment[edge] === null) setBoundary(id,edge,'slider');
    };
    slider.addEventListener('click',markDefault);
    slider.addEventListener('keyup',event => {
      if (['End','Home','Enter','ArrowLeft','ArrowRight'].includes(event.key)) markDefault();
    });
    const field = get(id+'Time');
    field.addEventListener('input',() => setBoundary(id,edge,'field'));
    field.addEventListener('change',() => {
      const segment = drafts[index]?.segment;
      if (segment && Number.isFinite(segment[edge])) { segment[edge+'Text'] = null; field.value = clock(segment[edge]); }
    });
    field.addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); field.blur(); } });
    get(id+'Here').addEventListener('click',() => setBoundary(id,edge,'playhead'));
  }
  function pick(event) {
    const button = event.target.closest('[data-segment-index]');
    if (!button || saving()) return false;
    const target = Number(button.dataset.segmentIndex);
    if (target === index) seek(drafts[index].segment.start || 0);
    else select(target);
    return true;
  }
  get('SegmentList').addEventListener('click',pick);
  get('Track').addEventListener('click',event => {
    if (pick(event) || saving() || !drafts[index]) return;
    const rect = get('Track').getBoundingClientRect();
    if (rect.width > 0) seek(drafts[index].duration * Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)));
  });

  return {
    show(items, activeIndex) {
      drafts = items; index = activeIndex; preview = null;
      get('Segments').hidden = !items.length;
      if (!items.length) return;
      get('SegmentList').innerHTML = items.map((draft,i) =>
        `<button type="button" data-segment-index="${i}" aria-current="${i === index}" style="--mark-hue:${segmentHue(draft.segment.number)}">${tr('מקטע ','Segment ')}${draft.segment.number}${draft.saved ? ' ✓' : ''}</button>`).join('');
      sync();
    },
    seekStart() { const draft = drafts[index]; if (draft) seek(draft.segment.start || 0); },
    play() {
      const range = markedRange(drafts[index]);
      if (!range) return;
      seek(range.start); preview = range;
      player.play()?.catch(() => { preview = null; });
    }
  };
}
