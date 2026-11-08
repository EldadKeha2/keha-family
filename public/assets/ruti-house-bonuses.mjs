export const HOUSE_STAGE_BONUSES=Object.freeze({dust:500,plants:1000,all:2000});

// A category must actually occur in the stage to earn its completion bonus.
export function houseStageBonuses(result){
  const dust=result?.dust>0&&result.missedDust===0?HOUSE_STAGE_BONUSES.dust:0;
  const plants=result?.plants>0&&result.missedPlants===0?HOUSE_STAGE_BONUSES.plants:0;
  const all=result?.completed===30?HOUSE_STAGE_BONUSES.all:0;
  return {dust,plants,all,total:dust+plants+all};
}
