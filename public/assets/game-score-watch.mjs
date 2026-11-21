export function watchGameScores(refresh, signal) {
  if (signal?.aborted) return;
  let timer;
  function stop() {
    clearInterval(timer);
  }
  function resume() {
    stop();
    if (document.visibilityState !== 'hidden') {
      timer = setInterval(refreshVisible, 15000);
    }
  }
  function refreshVisible() {
    if (document.visibilityState !== 'hidden') refresh();
  }
  function visibilityChanged() {
    resume();
    refreshVisible();
  }
  window.addEventListener('focus', refreshVisible, {signal});
  document.addEventListener('visibilitychange', visibilityChanged, {signal});
  signal?.addEventListener('abort', stop, {once:true});
  resume();
}
