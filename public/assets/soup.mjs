export const BOIL_MS=5000;
export const INGREDIENTS=Object.freeze([
  {id:'potato',he:'תפוחי אדמה',en:'Potatoes',step:1,unit:'piece'},
  {id:'neck',he:'גרונות',en:'Necks',step:1,unit:'piece'},
  {id:'carrot',he:'גזרים',en:'Carrots',step:1,unit:'piece'},
  {id:'hawaij',he:'חוואיג׳',en:'Hawaij',step:.25,unit:'cup'},
  {id:'onion',he:'בצל',en:'Onion',step:1,unit:'piece'},
  {id:'tomato',he:'עגבניות',en:'Tomatoes',step:1,unit:'piece'},
  {id:'garlic',he:'שום',en:'Garlic',step:1,unit:'clove'},
  {id:'celery',he:'סלרי',en:'Celery',step:1,unit:'stalk'},
  {id:'zucchini',he:'קישואים',en:'Zucchini',step:1,unit:'piece'},
  {id:'rice',he:'אורז',en:'Rice',step:.25,unit:'cup'},
  {id:'lentils',he:'עדשים',en:'Lentils',step:.25,unit:'cup'},
  {id:'paprika',he:'פפריקה',en:'Paprika',step:.25,unit:'cup'}
].map(Object.freeze));
// One fixed solution. Ingredient order is not part of the puzzle.
export const SECRET_RECIPE=Object.freeze({potato:2,neck:3,carrot:3,hawaij:.25});
export function createSoup({random=Math.random,attempts=0}={}){
  const order=INGREDIENTS.map(ingredient=>ingredient.id);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.max(0,Math.min(.999999,random()))*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return {phase:'intro',contents:{},water:false,heat:false,boiled:false,boilAt:null,attempts,feedback:null,order};
}
export function addIngredient(state,id){
  const ingredient=INGREDIENTS.find(item=>item.id===id);
  if(state.phase!=='playing'||!ingredient||!state.water)return state;
  const count=state.contents[id]||0,max=ingredient.unit==='cup'?3:12;
  if(count+ingredient.step>max)return state;
  return {...state,contents:{...state.contents,[id]:count+ingredient.step},feedback:null};
}
export function removeIngredient(state,id){
  const ingredient=INGREDIENTS.find(item=>item.id===id);
  if(state.phase!=='playing'||!ingredient||!state.contents[id])return state;
  const contents={...state.contents},amount=contents[id]-ingredient.step;
  if(amount>0)contents[id]=amount;else delete contents[id];
  return {...state,contents,feedback:null};
}
export function fillSoupWater(state){
  if(state.phase!=='playing'||state.water)return state;
  return {...state,water:true,feedback:null};
}
export function heatSoup(state,now=Date.now()){
  if(state.phase!=='playing'||!state.water||state.heat)return state;
  return {...state,heat:true,boilAt:now+BOIL_MS,feedback:null};
}
export function updateSoup(state,now=Date.now()){
  if(state.phase!=='playing'||state.boiled||!state.water||!state.heat||now<state.boilAt)return state;
  return {...state,boiled:true,feedback:null};
}
export function recipeMatches(contents){
  return INGREDIENTS.every(ingredient=>(contents[ingredient.id]||0)===(SECRET_RECIPE[ingredient.id]||0))&&Object.keys(contents).every(id=>INGREDIENTS.some(ingredient=>ingredient.id===id));
}
export function tasteSoup(state,now=Date.now()){
  if(state.phase!=='playing')return state;
  const current=updateSoup(state,now),attempts=current.attempts+1;
  if(!current.water)return {...current,attempts,feedback:'water'};
  if(!current.boiled)return {...current,attempts,feedback:'boil'};
  if(!recipeMatches(current.contents))return {...current,attempts,feedback:'recipe'};
  return {...current,attempts,phase:'success',feedback:null};
}
export function cupAmount(amount){
  const whole=Math.floor(amount),part=Math.round((amount-whole)*4),fraction=['','¼','½','¾'][part]||'';
  return (whole?String(whole):'')+fraction||'0';
}
