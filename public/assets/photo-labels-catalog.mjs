export const PHOTO_LABELS=[
  {id:'birthdays',name:'ימי הולדת',nameEn:'Birthdays'},
  {id:'bar-bat-mitzvah',name:'בר/בת מצווה',nameEn:'Bar/Bat Mitzvah'},
  {id:'purim',name:'פורים',nameEn:'Purim'},
  {id:'abroad',name:'חו״ל',nameEn:'Abroad'},
  {id:'black-and-white',name:'שחור לבן',nameEn:'Black and white'},
  {id:'holidays',name:'חגים',nameEn:'Holidays'}
];
export const photoLabels=value=>PHOTO_LABELS.filter(label=>Array.isArray(value)&&value.includes(label.id)).map(label=>label.id);
export const photoLabelName=(label,english=false)=>english?label.nameEn:label.name;
