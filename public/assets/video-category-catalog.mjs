export const DEFAULT_VIDEO_CATEGORIES=[
 {id:'special-birthdays',name:'ימי הולדת עגולים',nameEn:'Milestone birthdays'},
 {id:'family',name:'סרטונים משפחתיים',nameEn:'Family videos'}
];
export function videoCategoryId(value){
 if(typeof value!=='string'||!DEFAULT_VIDEO_CATEGORIES.some(category=>category.id===value)&&!/^[a-f0-9]{32}$/.test(value))throw new RangeError('Invalid video category');
 return value;
}
