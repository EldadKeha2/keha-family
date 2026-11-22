import {repairAvcRecording} from './video-upload-repair.mjs';

// Read actual video frames at the beginning, middle and end. Metadata alone
// succeeds even for capture files which stop on the second video packet.
export function verifyUploadPlayback(file, signal, createPlayer = () => document.createElement('video'), urls = URL) {
  signal.throwIfAborted();
  const player = createPlayer(), url = urls.createObjectURL(file);
  return new Promise((resolve, reject) => {
    let positions = [0], index = 0, firstFrames = 0, lastTime = -1, done = false, timer;
    const frames = () => player.getVideoPlaybackQuality?.().totalVideoFrames;
    function finish(verified, error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      player.onloadedmetadata = player.ontimeupdate = player.onended = player.onerror = null;
      player.pause(); player.removeAttribute('src'); player.load(); urls.revokeObjectURL(url);
      if (error) reject(error); else resolve(verified);
    }
    const abort = () => finish(false, signal.reason);
    function resetTimeout() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (player.ownerDocument?.hidden) finish(false);
        else finish(false, Object.assign(new Error('Playback did not advance'), {code:'VIDEO_STALL'}));
      }, 15000);
    }
    function sample() {
      if (player.currentTime !== lastTime) { lastTime = player.currentTime; resetTimeout(); }
      const duration = player.duration, start = positions[index];
      if (player.seeking || !Number.isFinite(duration) || !player.videoWidth ||
          player.readyState < 2 || (frames() ?? Infinity) <= firstFrames) return;
      const end = Math.max(start, Math.min(start + .8, duration - .04));
      if (player.currentTime < end && !player.ended) return;
      if (index === positions.length - 1) { finish(true); return; }
      firstFrames = frames() ?? 0;
      player.currentTime = positions[++index];
    }
    player.muted = true; player.playsInline = true; player.preload = 'auto';
    player.onloadedmetadata = () => {
      resetTimeout();
      if (Number.isFinite(player.duration) && player.duration >= 8)
        positions = [0, player.duration * .5, player.duration - 1.4];
    };
    player.ontimeupdate = player.onended = sample;
    player.onerror = () => {
      const code = player.error?.code;
      if (code === 3 || code === 4) {
        finish(false, Object.assign(new Error('Video cannot be decoded on this device'), {code:'VIDEO_DECODE'}));
      } else finish(false, Object.assign(new Error('Could not read video'), {code:'VIDEO_READ'}));
    };
    // Background throttling and autoplay restrictions are not evidence of corruption.
    resetTimeout();
    signal.addEventListener('abort', abort, {once:true});
    player.src = url;
    player.play().catch(error => {
      if (done) return;
      if (player.error?.code === 3 || player.error?.code === 4) player.onerror();
      else if (error.name === 'NotSupportedError') finish(false, Object.assign(new Error(error.message), {code:'VIDEO_DECODE'}));
      else finish(false);
    });
  });
}

export function startUploadCheck(input, changed, maxBytes = Infinity) {
  const controller = new AbortController();
  const state = {phase:'checking', percent:0, file:input, repaired:0, verified:false, error:null,
    discard:() => controller.abort()};
  const progress = percent => {
    if (percent === state.percent || controller.signal.aborted) return;
    state.percent = percent; changed(state);
  };
  state.ready = (async () => {
    try {
      await Promise.resolve();
      if (input.size > maxBytes) throw Object.assign(new Error('Original exceeds upload limit'), {code:'VIDEO_SOURCE_SIZE'});
      const result = await repairAvcRecording(input, {signal:controller.signal, progress});
      controller.signal.throwIfAborted();
      state.file = result.file; state.repaired = result.repaired;
      state.phase = 'verifying'; changed(state);
      state.verified = await verifyUploadPlayback(state.file, controller.signal);
      controller.signal.throwIfAborted();
      state.phase = 'ready';
    } catch (error) {
      if (controller.signal.aborted) throw error;
      state.phase = 'failed'; state.error = error;
    }
    changed(state);
    return state;
  })();
  // Cancellation can occur on close before a save has started waiting.
  state.ready.catch(() => {});
  return state;
}
