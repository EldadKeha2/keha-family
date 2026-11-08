// Shared by the game, completion bonuses and the score validator.
export const HOUSE_STAGE_GOALS=Object.freeze([
 ...Array(12).fill(30),40,40,50,50,50,60,60,60
]);
export const houseTasksThroughLevel=level=>HOUSE_STAGE_GOALS.slice(0,level).reduce((sum,goal)=>sum+goal,0);
