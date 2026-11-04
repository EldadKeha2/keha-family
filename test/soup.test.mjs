import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INGREDIENTS,SECRET_RECIPE,BOIL_MS,createSoup,addIngredient,removeIngredient,fillSoupWater,heatSoup,updateSoup,tasteSoup,recipeMatches,cupAmount} from '../public/assets/soup.mjs';

const playing=()=>({...createSoup({random:()=>.5}),phase:'playing'});
function exactSoup(order=Object.keys(SECRET_RECIPE)){
  let state=fillSoupWater(playing());
  for(const id of order){const item=INGREDIENTS.find(item=>item.id===id);for(let n=0;n<SECRET_RECIPE[id]/item.step;n++)state=addIngredient(state,id);}
  return state;
}
test('the pantry contains the specified ingredients, eight decoys and stable quarter-cup portions',()=>{
  assert.deepEqual(SECRET_RECIPE,{potato:2,neck:3,carrot:3,hawaij:.25});assert.equal(INGREDIENTS.length,12);
  assert.equal(INGREDIENTS.find(item=>item.id==='hawaij').step,.25);assert.equal(INGREDIENTS.filter(item=>!(item.id in SECRET_RECIPE)).length,8);
  const a=createSoup({random:()=>.1}),b=createSoup({random:()=>.9});assert.notDeepEqual(a.order,b.order);assert.deepEqual([...a.order].sort(),INGREDIENTS.map(item=>item.id).sort());
});
test('there is exactly one solution across all plausible counts and quarter-cup amounts',()=>{
  let matches=0;
  for(let potato=0;potato<=5;potato++)for(let neck=0;neck<=5;neck++)for(let carrot=0;carrot<=5;carrot++)for(let spice=0;spice<=8;spice++)if(recipeMatches({potato,neck,carrot,hawaij:spice/4}))matches++;
  assert.equal(matches,1);
  for(const decoy of INGREDIENTS.filter(item=>!(item.id in SECRET_RECIPE)))assert.equal(recipeMatches({...SECRET_RECIPE,[decoy.id]:decoy.step}),false,decoy.id);
  assert.equal(recipeMatches({...SECRET_RECIPE,unknown:1}),false);
});
test('ingredients require water; heating an empty pot does nothing and boiling takes the full interval',()=>{
  let state=playing();assert.equal(addIngredient(state,'potato'),state);assert.equal(heatSoup(state,0),state);
  state=fillSoupWater(state);assert.equal(fillSoupWater(state),state);state=heatSoup(state,1000);assert.equal(state.boilAt,1000+BOIL_MS);assert.equal(heatSoup(state,2000),state);
  assert.equal(updateSoup(state,1000+BOIL_MS-1).boiled,false);assert.equal(updateSoup(state,1000+BOIL_MS).boiled,true);
});
test('the precise ingredients alone cannot win until the water boils and the player submits',()=>{
  let state=exactSoup();assert.equal(state.phase,'playing');state=tasteSoup(state,100);assert.equal(state.phase,'playing');assert.equal(state.feedback,'boil');assert.equal(state.attempts,1);
  state=heatSoup(state,100);state=updateSoup(state,100+BOIL_MS);assert.equal(state.phase,'playing');state=tasteSoup(state,100+BOIL_MS);assert.equal(state.phase,'success');assert.equal(state.attempts,2);
});
test('the same recipe succeeds in any ingredient order without accepting extras, substitutions or incorrect quantities',()=>{
  for(const order of [Object.keys(SECRET_RECIPE),Object.keys(SECRET_RECIPE).reverse(),['hawaij','potato','carrot','neck']]){
    let state=heatSoup(exactSoup(order),0);state=tasteSoup(state,BOIL_MS);assert.equal(state.phase,'success');assert.deepEqual(state.contents,SECRET_RECIPE);assert.equal(addIngredient(state,'onion'),state);assert.equal(removeIngredient(state,'potato'),state);
  }
  for(const contents of [{...SECRET_RECIPE,potato:1},{...SECRET_RECIPE,neck:2},{...SECRET_RECIPE,carrot:4},{...SECRET_RECIPE,hawaij:.5},{...SECRET_RECIPE,onion:1}]){
    const state=tasteSoup({...heatSoup(playing(),0),water:true,heat:true,boilAt:0,contents},BOIL_MS);assert.equal(state.phase,'playing');assert.equal(state.feedback,'recipe');
  }
});
test('failed tasting allows measured corrections and retains the boiling water',()=>{
  let state=heatSoup(exactSoup(),0);state=addIngredient(state,'onion');state=tasteSoup(state,BOIL_MS);assert.equal(state.feedback,'recipe');assert.equal(state.boiled,true);
  state=removeIngredient(state,'onion');assert.equal('onion' in state.contents,false);state=tasteSoup(state,BOIL_MS+1);assert.equal(state.phase,'success');assert.equal(state.attempts,2);
  const empty=playing();assert.equal(removeIngredient(empty,'potato'),empty);assert.equal(addIngredient(empty,'unknown'),empty);
});
test('quarter cups display exactly; each removal undoes one portion and amounts are bounded',()=>{
  assert.deepEqual([.25,.5,.75,1,1.25,2.5,3].map(cupAmount),['¼','½','¾','1','1¼','2½','3']);
  let state=fillSoupWater(playing());for(let i=0;i<40;i++){state=addIngredient(state,'potato');state=addIngredient(state,'hawaij');}
  assert.equal(state.contents.potato,12);assert.equal(state.contents.hawaij,3);state=removeIngredient(state,'hawaij');assert.equal(state.contents.hawaij,2.75);
  for(let i=0;i<40;i++)state=removeIngredient(state,'hawaij');assert.equal(state.contents.hawaij,undefined);
});
