(() => {
  'use strict';
  // Retire the profile trial without adding a click for previously shared links.
  const language=new URLSearchParams(location.search).get('lang');
  const next=new URL('/',location.origin);
  next.searchParams.set('lang',['he','en-US','en-GB'].includes(language)?language:'he');
  next.searchParams.set('install','1');
  next.hash='home';
  document.querySelector('a').href=next.href;
  location.replace(next.href);
})();
