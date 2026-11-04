import {shuffled} from './quiz.mjs';

const settings=[
  ['yemen-souk-v4','השוק בצנעא','The Sana’a souk',[['ruti','רותי חריזי','Ruth Harizi',.252,.55,.051,.18],['eldad','אלדד קהא','Eldad Keha',.722,.417,.046,.162]]],
  ['morocco-medina-v4','סמטאות מרוקו','A Moroccan medina',[['elinor','אלינור נובל','Elinor Noble',.691,.546,.049,.184],['ariel-f','אריאל פיש','Ariel Fish',.304,.496,.047,.18]]],
  ['jerusalem-market-v4','השוק בירושלים','The Jerusalem market',[['ora','אורה פיש','Ora Fish',.312,.572,.054,.187],['eddie','אדי פיש','Adi Fish',.75,.47,.044,.16]]],
  ['desert-oasis-v4','שוק בנווה המדבר','An oasis market',[['avigail','אביגיל נובל','Avigail Noble',.68,.551,.05,.20],['raya','רעיה בלום','Raia Bloom',.275,.477,.049,.18]]],
  ['greek-harbor-v4','נמל באי יווני','A Greek island harbor',[['ariel-n','אריאל נובל','Ariele Noble',.289,.565,.055,.225],['yarden','ירדן גנדלמן','Yarden Gandelman',.703,.438,.05,.185]]]
];

export const chickScenes=settings.flatMap(([sceneId,title,titleEn,subjects])=>subjects.map(([id,name,nameEn,x,y,w,h])=>({
  id:sceneId+'-'+id,sceneId,person:{id,name,nameEn},title,titleEn,
  src:'assets/games/chick/'+sceneId+'.webp',portrait:'assets/games/portraits/'+id+'.webp',
  width:1536,height:1024,target:{x,y,w,h}
})));

export function makeChickQuiz(random=Math.random){
  // One target per illustration; all ten portraits can appear across repeated games.
  const groups=settings.map(([sceneId])=>chickScenes.filter(scene=>scene.sceneId===sceneId));
  return shuffled(groups,random).map(group=>{
    const scene=group[Math.min(group.length-1,Math.floor(random()*group.length))];
    return {...scene,kind:'chick',subject:{...scene.person},correctId:scene.person.id,options:[{...scene.person}]};
  });
}
export function withinChickTarget(target,x,y){
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1&&Math.abs(x-target.x)<=target.w/2&&Math.abs(y-target.y)<=target.h/2;
}
