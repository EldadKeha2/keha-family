(() => {
  'use strict';
  // Enable only after Microsoft certifies the unlisted product and its link works.
  const distribution=Object.freeze({storeAvailable:false,storeURL:'https://apps.microsoft.com/detail/9MTDJ73268RR'});
  function classify(browser,hints={},settings=distribution){
    const ua=browser.userAgent||'',platform=hints.platform||browser.userAgentData?.platform||'';
    const windows=platform?platform==='Windows':/Windows NT/i.test(ua);
    if(!windows||browser.userAgentData?.mobile===true||/Windows Phone|Android|iPhone|iPad/i.test(ua))return {windows:false,route:'none'};
    const nt=/Windows NT (\d+)\.(\d+)/i.exec(ua);
    const version=typeof hints.platformVersion==='string'&&/^\d+\.\d+\.\d+$/.test(hints.platformVersion)?Number(hints.platformVersion.split('.')[0]):null;
    const architecture=String(hints.architecture||(/ARM|aarch64/i.test(ua)?'arm':'')).toLowerCase();
    const bitness=/^(32|64)$/.test(String(hints.bitness||''))?Number(hints.bitness):/Win64|WOW64|x86_64|AMD64|arm64|aarch64/i.test(ua)?64:null;
    if((nt&&Number(nt[1])<10)||version===0||bitness===32||architecture==='arm')return {windows:true,route:'shortcut',bitness,version};
    // UA-CH reports the Windows API contract, not the OS build: 5 = 1709,
    // 10 = 2004 (our MSIX minimum), and 13+ = Windows 11.
    if(version!==null&&version<5)return {windows:true,route:'shortcut',bitness,version};
    if(version===null||bitness!==64)return {windows:true,route:'options',bitness,version};
    return {windows:true,route:settings.storeAvailable&&version>=10?'store':'native',bitness,version};
  }
  let current=classify(navigator);
  const ready=Promise.resolve().then(async()=>{
    if(current.windows&&typeof navigator.userAgentData?.getHighEntropyValues==='function'){
      try { current=classify(navigator,await navigator.userAgentData.getHighEntropyValues(['platform','platformVersion','architecture','bitness'])); } catch { /* Keep a useful choice when browser privacy settings hide the details. */ }
    }
    return current;
  });
  window.FamilyWindowsInstall=Object.freeze({classify,get current(){return current;},ready,distribution});
})();
