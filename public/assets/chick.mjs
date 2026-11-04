import {shuffled} from './quiz.mjs';

export const chickScenes=[
  {id:'shlomo-market',person:{id:'shlomo',name:'שלמה קהא',nameEn:'Shlomo Keha'},title:'יום בשוק',titleEn:'A day at the market',target:{x:.751,y:.425,w:.082,h:.168}},
  {id:'rachel-seaside',person:{id:'rachel-katan',name:'רחל קטן',nameEn:'Rachel Katan'},title:'חופשה ליד הים',titleEn:'A day by the sea',target:{x:.241,y:.628,w:.112,h:.208}},
  {id:'ruti-garden',person:{id:'ruti',name:'רותי חריזי',nameEn:'Ruth Harizi'},title:'חגיגה בגינה',titleEn:'A garden celebration',target:{x:.544,y:.643,w:.100,h:.170}},
  {id:'avigail-station',person:{id:'avigail',name:'אביגיל נובל',nameEn:'Avigail Noble'},title:'נפגשים בתחנה',titleEn:'A station reunion',target:{x:.335,y:.391,w:.111,h:.218}},
  {id:'ora-festival',person:{id:'ora',name:'אורה פיש',nameEn:'Ora Fish'},title:'חגיגה תימנית',titleEn:'A Yemenite festival',target:{x:.823,y:.711,w:.131,h:.212}}
].map(scene=>({...scene,src:'assets/games/chick/'+scene.id+'.webp',width:1536,height:1024}));

export function makeChickQuiz(random=Math.random){
  return shuffled(chickScenes,random).map(scene=>({...scene,kind:'chick',subject:{...scene.person},correctId:scene.person.id,options:[{...scene.person}]}));
}
export function withinChickTarget(target,x,y){
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1&&Math.abs(x-target.x)<=target.w/2&&Math.abs(y-target.y)<=target.h/2;
}
