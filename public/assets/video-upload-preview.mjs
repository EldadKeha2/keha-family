const validDuration = value => Number.isFinite(value) && value > 0;
const createWorker = () => new Worker(new URL('./video-preview-worker.mjs', import.meta.url), {type: 'module'});
const readDuration = async file => (await import('./video-segment-file.mjs')).segmentSourceDuration(file);

export function bindUploadPreview({get, tr, onDuration, createProbe, canResume = () => true, urls = URL, worker = createWorker, sourceDuration = readDuration}) {
  const player = get('Player'), mode = get('PreviewMode'), pick = get('PreviewFile'), message = get('PreviewStatus');
  let records = new WeakMap(), record = null, url = null, ownedUrl = null, job = null, pendingTime = null, watchdog = null, stalled = false, resumePending = false;

  function note(text = '') {
    message.textContent = text;
    message.hidden = !text;
  }
  function button() {
    mode.textContent = job ? tr('ביטול הכנה', 'Cancel preparation') :
      record?.useLight ? tr('חזרה לתצוגת המקור', 'View original') : tr('תצוגה קלה', 'Lightweight preview');
    mode.setAttribute('aria-pressed', String(Boolean(record?.useLight)));
  }
  function playLabel() {
    get('PreviewPlay').textContent = stalled ? tr('ניסיון ניגון נוסף','Retry playback') :
      player.paused || player.ended ? tr('▶ ניגון','▶ Play') : tr('השהיה','Pause');
  }
  function clearWatch() {
    clearTimeout(watchdog);
    watchdog = null;
  }
  function watch() {
    if (watchdog || !record || player.paused || player.ended) return;
    const from = player.currentTime;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (!record || player.paused || player.ended) return;
      if (Math.abs(player.currentTime - from) < .1) playbackError();
      else if (stalled) { stalled = false; playLabel(); if (!job) note(); }
      watch();
    }, 4500);
  }
  function playbackError(error) {
    if (!record || job || error?.name === 'AbortError' || player.error?.code === 1) return;
    if (error?.name === 'NotAllowedError') {
      note(tr('לחצו על ▶ כדי להתחיל בניגון.', 'Press ▶ to start playback.'));
      return;
    }
    stalled = true; playLabel();
    if (player.error?.code === 3 || player.error?.code === 4) {
      note(record.useLight ? tr('הדפדפן לא הצליח לפענח את העותק הקל. אפשר לבחור ״ניגון מהאתר״ כשהמקור מוכן, או לבחור עותק אחר מהמכשיר.', 'The browser could not decode this preview. Play the uploaded original when ready, or choose another copy.') :
        tr('הדפדפן לא הצליח לפענח את קובץ המקור. אפשר להכין תצוגה קלה או לבחור עותק קל מהמכשיר.', 'The browser could not decode the original. Prepare a lightweight preview or choose a lighter copy.'));
      return;
    }
    if (record.remoteUrl && record.useLight) {
      note(tr('העותק הקל מתקשה להתנגן. אפשר ללחוץ על ״ניגון מהאתר״ כדי לפתוח את המקור שהתקבל.', 'This copy is having trouble playing. Choose Play from site to open the uploaded original.'));
      return;
    }
    note(record.useLight ? tr('העותק הקל מתקשה להתנגן. אפשר לבחור עותק אחר של אותו סרטון.', 'This preview is having trouble playing. Choose another copy of the same video.') :
      tr('הניגון לא מתקדם. לחצו על ״תצוגה קלה״ או בחרו עותק קל של אותו סרטון.', 'Playback is stuck. Use Lightweight preview or choose a lighter copy of this video.'));
  }
  player.addEventListener('play', () => { playLabel(); watch(); });
  player.addEventListener('waiting', watch);
  player.addEventListener('pause', () => { clearWatch(); playLabel(); });
  player.addEventListener('ended', () => { clearWatch(); playLabel(); });
  player.addEventListener('error', () => playbackError());
  player.addEventListener('playing', () => {
    if (stalled && !job) note();
    stalled = false; playLabel();
    watch();
  });

  function cancelJob() {
    const previous = job;
    job = null;
    previous?.worker?.terminate();
    previous?.abort.abort();
    get('PreviewProgress').hidden = true;
    button();
  }
  function durationOf(owner) {
    if (validDuration(owner.duration)) return Promise.resolve(owner.duration);
    owner.reading ??= sourceDuration(owner.file).then(value => {
      if (!validDuration(value)) throw Error('Unknown source duration');
      if (!validDuration(owner.duration)) owner.duration = value;
      return owner.duration;
    }).catch(error => { owner.reading = null; throw error; });
    return owner.reading;
  }
  function displayFile() {
    return record?.useLight ? record.light : record?.file;
  }
  function load(time = 0, resume = false) {
    clearWatch();
    const owner = record, oldUrl = ownedUrl;
    ownedUrl = !owner.useLight && owner.remoteUrl ? null : urls.createObjectURL(displayFile());
    const nextUrl = ownedUrl || owner.remoteUrl;
    url = nextUrl;
    pendingTime = time;
    resumePending = resume;
    stalled = false; playLabel();
    player.onloadedmetadata = async () => {
      if (record !== owner || url !== nextUrl || (player.currentSrc && player.currentSrc !== nextUrl)) return;
      if (pendingTime !== null) {
        if (pendingTime > 0) player.currentTime = Math.min(pendingTime, validDuration(player.duration) ? player.duration : pendingTime);
        pendingTime = null;
        if (resumePending && canResume()) player.play()?.catch(playbackError);
        resumePending = false;
      }
      if (!owner.useLight && validDuration(player.duration)) owner.duration = player.duration;
      let duration = owner.duration;
      if (!validDuration(duration)) {
        try { duration = await durationOf(owner); } catch { return; }
      }
      if (record === owner && url === nextUrl) onDuration(owner.file, duration);
    };
    player.src = nextUrl;
    if (oldUrl) urls.revokeObjectURL(oldUrl);
  }
  function switchView(useLight) {
    const time = pendingTime ?? player.currentTime, resume = !player.paused && !player.ended;
    record.useLight = useLight;
    load(time, resume);
    button();
    note(useLight ? tr('העותק הקל מוכן לניגון. השמירה משתמשת בקובץ המקור.', 'The lightweight preview is ready to play. Saving uses the original file.') : '');
  }

  function inspect(file, signal) {
    const probe = createProbe(), probeUrl = urls.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const abort = () => finish(false);
      function finish(ok) {
        const duration = probe.duration;
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        probe.onloadedmetadata = probe.onerror = null;
        probe.removeAttribute('src'); probe.load();
        urls.revokeObjectURL(probeUrl);
        if (ok) resolve(duration); else reject(Error('Unreadable preview'));
      }
      const timeout = setTimeout(abort, 15000);
      signal.addEventListener('abort', abort, {once: true});
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => finish(validDuration(probe.duration) && probe.videoWidth > 0);
      probe.onerror = abort;
      probe.src = probeUrl;
    });
  }
  function failed(task) {
    if (job !== task) return;
    cancelJob();
    note(tr('הדפדפן לא הצליח להכין תצוגה לסרטון הזה. אפשר לבחור עותק קל באותו אורך מהמכשיר.', 'This browser could not prepare a preview. Choose a lighter copy of the same length from your device.'));
  }
  async function useCopy(file, task) {
    try {
      const [duration, copyDuration] = await Promise.all([durationOf(record), inspect(file, task.abort.signal)]);
      if (job !== task) return;
      if (Math.abs(duration - copyDuration) > .25) {
        cancelJob();
        note(tr('משך העותק שונה ממשך המקור. בחרו עותק של הסרטון המלא כדי לשמור על דיוק הסימונים.', 'The durations differ. Choose a copy of the entire video to keep segment times accurate.'));
        return;
      }
      record.light = file;
      cancelJob();
      switchView(true);
    } catch { failed(task); }
  }

  function playOnClick(reload) {
    if (reload) load(pendingTime ?? player.currentTime);
    // Keep play() in the user gesture, including after changing the source.
    // Waiting for loadedmetadata can lose playback permission on mobile.
    player.play()?.catch(playbackError);
  }
  get('PreviewPlay').addEventListener('click', () => {
    if (!record) return;
    if (stalled || player.error) {
      if (record.remoteUrl) record.useLight = false;
      button(); playOnClick(true);
    } else if (!player.paused && !player.ended) player.pause();
    else playOnClick(false);
  });
  mode.addEventListener('click', () => {
    if (!record) return;
    if (job) { cancelJob(); note(); return; }
    if (record.light) { switchView(!record.useLight); return; }
    const task = job = {abort: new AbortController()};
    button();
    note(tr('מכין עותק קל במכשיר… אפשר להמשיך לסמן מקטעים.', 'Preparing a lightweight copy on this device… You can keep marking segments.'));
    try {
      const formats = [];
      if (player.canPlayType('video/webm; codecs="vp8"')) formats.push('webm');
      if (player.canPlayType('video/mp4; codecs="avc1.42E01E"')) formats.push('mp4');
      if (player.canPlayType('video/mp4; codecs="vp09.00.10.08"')) formats.push('mp4-vp9');
      task.worker = worker();
      task.worker.onerror = () => failed(task);
      task.worker.onmessage = ({data}) => {
        if (job !== task) return;
        if (data.error) return failed(task);
        if (data.file) {
          task.worker.terminate(); task.worker = null;
          void useCopy(data.file, task);
        } else if (Number.isFinite(data.percent)) {
          get('PreviewProgress').value = data.percent;
          get('PreviewProgress').hidden = false;
        }
      };
      task.worker.postMessage({file: record.file, formats});
    } catch { failed(task); }
  });
  get('PreviewPick').addEventListener('click', () => { pick.value = ''; pick.click(); });
  pick.addEventListener('change', () => {
    const file = pick.files?.[0];
    if (!record || !file) return;
    pick.value = '';
    cancelJob();
    const task = job = {abort: new AbortController()};
    button();
    note(tr('בודק את משך העותק…', 'Checking the preview duration…'));
    void useCopy(file, task);
  });

  function suspend() {
    cancelJob(); clearWatch();
    record = null; pendingTime = null;
    player.onloadedmetadata = null; player.pause(); player.removeAttribute('src'); player.load();
    if (ownedUrl) urls.revokeObjectURL(ownedUrl);
    ownedUrl = null; url = null; pick.value = ''; note();
  }
  return {
    displayFile, playbackError,
    displayUrl() { return record && !record.useLight ? record.remoteUrl : null; },
    provideRemote(file, remoteUrl) {
      const owner = records.get(file);
      if (!owner || owner.remoteUrl === remoteUrl) return;
      owner.remoteUrl = remoteUrl;
      if (record === owner && ((!owner.useLight && player.paused) || stalled)) switchView(false);
    },
    playRemote() {
      if (!record?.remoteUrl) return;
      const reload = record.useLight || url !== record.remoteUrl || player.error || stalled;
      record.useLight = false; button(); note(); playOnClick(reload);
    },
    seek(time) {
      resumePending = false;
      if (pendingTime !== null) pendingTime = time;
      player.currentTime = time;
    },
    open(file, duration) {
      if (record?.file === file) return false;
      cancelJob(); note();
      record = records.get(file) || {file, duration, light: null, useLight: false};
      records.set(file, record);
      button(); load();
      return true;
    },
    suspend,
    clear() {
      suspend();
      records = new WeakMap();
    }
  };
}
