// Stable IDs also let a removed video stay removed after a deployment.
export const featuredVideos = [
  ['39dfd9ecbc3b4be9a5938b6b2d534e01','LTTdcZUSF7A','יחיאל בן 70 - חלק 1'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e02','bbsWuwVwHks','יחיאל בן 70 - חלק 2'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e03','CqkreY-_mSs','אורה בת 60'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e04','KUP1WtKCtec','רותי בת 60'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e05','UerqNt1Hhc0','יונתן בר מצווה'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e06','pws4Fk1jSFo','יחיאל 60'],
].map(([id,youtubeId,name])=>({id,youtubeId,name,filename:name,file:id,category:'videos',
  videoCategory:'special-birthdays',provider:'youtube',kind:'video',mime:'video/youtube',
  size:0,caption:'',createdAt:'2026-11-01T00:00:00.000Z'}));
