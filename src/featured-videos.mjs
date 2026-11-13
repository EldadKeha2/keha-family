// Stable IDs also let a removed video stay removed after a deployment.
export const featuredVideos = [
  ['39dfd9ecbc3b4be9a5938b6b2d534e01','LTTdcZUSF7A','יחיאל בן 70 - חלק 1'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e02','bbsWuwVwHks','יחיאל בן 70 - חלק 2'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e03','CqkreY-_mSs','אורה בת 60'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e04','KUP1WtKCtec','רותי בת 60'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e05','UerqNt1Hhc0','יונתן בר מצווה'],
  ['39dfd9ecbc3b4be9a5938b6b2d534e06','pws4Fk1jSFo','יחיאל 60'],
].map(([id,youtubeId,name],index)=>({id,youtubeId,name,nameEn:['Yehiel turns 70 - Part 1','Yehiel turns 70 - Part 2','Ora turns 60','Ruth turns 60','Yonatan - Bar Mitzvah','Yehiel turns 60'][index],filename:name,file:id,category:'videos',
  videoCategory:'special-birthdays',provider:'youtube',kind:'video',mime:'video/youtube',
  size:0,caption:'',createdAt:'2026-11-01T00:00:00.000Z'}));

export const weddingVideos=[{
  id:'c4a2b35148764fea96ea4dbd8d29b901',youtubeId:'RrK53SZJJs8',
  name:'סרט החתונה של שני ותומר',nameEn:'Shani and Tomer — Wedding film',
  filename:'סרט החתונה של שני ותומר',file:'c4a2b35148764fea96ea4dbd8d29b901',
  category:'wedding:u-tomer',provider:'youtube',kind:'video',mime:'video/youtube',
  size:0,caption:'',createdAt:'2026-11-13T00:00:00.000Z'
}];
