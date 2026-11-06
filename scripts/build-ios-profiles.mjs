import {readFile,writeFile,mkdir} from 'node:fs/promises';

// Stable IDs allow the device to replace this shortcut when the language changes.
const profileID='dev.workers.eldadkeha.keha-family.home-screen';
const profileUUID='DCEDE4B6-F37D-4A10-B552-E7A4AA69FD76';
const shortcutUUID='42B62E05-7319-4FC2-B5A2-54253B6842AF';
const publicRoot=new URL('../public/',import.meta.url),folder=new URL('install/',publicRoot);
const icon=await readFile(new URL('assets/app-icons/apple-touch-icon.png',publicRoot));
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const string=(key,value)=>'    <key>'+key+'</key><string>'+xml(value)+'</string>\n';
await mkdir(folder,{recursive:true});
for(const language of ['he','en-US','en-GB']){
  const he=language==='he',label=he?'משפחת קהא':'Keha Family',name=he?'בית משפחת קהא — קיצור דרך':'Keha Family Home — Shortcut';
  const description=he?'מוסיף קיצור דרך אחד שניתן להסיר לאתר בית משפחת קהא. ללא ניהול מכשיר, תעודות או שינויי רשת.':'Adds one removable Home Screen shortcut to Keha Family Home. No device management, certificates, or network changes.';
  const url=new URL('https://keha-family.eldadkeha.workers.dev/');url.searchParams.set('lang',language);url.searchParams.set('source','ios-profile');url.hash='home';
  const profile='<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n'
    +string('PayloadType','Configuration')+'    <key>PayloadVersion</key><integer>1</integer>\n'+string('PayloadIdentifier',profileID)+string('PayloadUUID',profileUUID)+string('PayloadDisplayName',name)+string('PayloadOrganization',he?'משפחת קהא':'Keha Family')+string('PayloadDescription',description)+'    <key>PayloadRemovalDisallowed</key><false/>\n    <key>PayloadContent</key>\n    <array>\n      <dict>\n'
    +string('PayloadType','com.apple.webClip.managed')+'    <key>PayloadVersion</key><integer>1</integer>\n'+string('PayloadIdentifier',profileID+'.shortcut')+string('PayloadUUID',shortcutUUID)+string('PayloadDisplayName',name)+string('Label',label)+string('URL',url.href)+'    <key>IsRemovable</key><true/>\n    <key>FullScreen</key><true/>\n    <key>IgnoreManifestScope</key><false/>\n    <key>Precomposed</key><true/>\n    <key>Icon</key>\n    <data>\n'+icon.toString('base64').match(/.{1,68}/g).map(line=>'      '+line).join('\n')+'\n    </data>\n      </dict>\n    </array>\n</dict>\n</plist>\n';
  await writeFile(new URL('keha-family-'+language+'.mobileconfig',folder),profile);
}
console.log('Generated 3 unsigned profiles, each containing one removable Web Clip.');
