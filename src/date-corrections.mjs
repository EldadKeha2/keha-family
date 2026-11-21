// Explicit owner corrections applied once; later site edits survive redeploys.
export const birthdayCorrections=[['avishai','17.8.1933'],['shosh','27.6.1951'],['mark','20.1.1951'],['camille','20.10.1993'],['sam','18.10.1992']];
export const correctionKey='birthdays-2026-11-02-owner-v1';
export const grandparentCorrectionKey='grandparents-2026-11-03-owner-v1';
export const grandparentCorrections={
  yona:{birthday:'16.10.1921',aliyahYear:1934,aliyahMonth:12},
  shlomo:{birthday:'1.1.1907',deathDate:'12.11.1996',deceased:true,aliyahYear:1932}
};
// Keep the year already entered on the live site; no year was supplied for this correction.
export const birthdayMonthDayCorrections=[{id:'mila',day:9,month:7,key:'birthday-mila-2026-11-03-owner-v1'}];
export const memorialCorrectionKey='elisheva-memorial-2026-11-03-owner-v1';
export const memorialCorrections={
  'becker-parent':{birthday:'23.3.1942',deathDate:'8.5.1998',deceased:true}
};
export const rootWeddingCorrectionKey='root-wedding-year-1938-owner-2026-11-11-v1';
// The obituary establishes the year; its publication date is not the death date.
export const avishaiObituaryCorrection={
  id:'avishai',key:'avishai-obituary-2011-2026-11-21-v1',
  fields:{deceased:true,deathYear:2011,
    deathYearSource:'מודעת אבל של אגד באתר אבלים · פורסמה ב־26.9.2011',
    deathYearSourceEn:'Egged obituary on Avelim · published 26 September 2011',
    researchSources:[{label:'מודעת אבל של אגד · אבישי חריזי · 26.9.2011',labelEn:'Egged obituary · Avishai Harizi · 26 September 2011',url:'https://avelim.co.il/%D7%90%D7%91%D7%99%D7%A9%D7%99-%D7%97%D7%A8%D7%99%D7%96%D7%99-%D7%96%D7%9C/'}]
  }
};
