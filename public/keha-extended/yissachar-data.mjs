// Restored from the owner's family instructions: Yosef and Tzvia, followed by
// Dudi, Mami, Avihai, Drori and Uri. Their connection to other branches awaits
// the owner's instructions; these are not the Tri ten siblings.
const member=(id,name,englishName,gender='',unit='u-'+id)=>({id,name,englishName,nameEn:englishName,gender,unit,yissacharFamily:true});
export const YISSACHAR_CHILDREN=Object.freeze(['dudi','mami','avihai','drori','uri'].map(id=>'yissachar-'+id));
export const YISSACHAR_PEOPLE=Object.freeze([
  member('yissachar-yosef','יוסף יששכר','Yosef Yissachar','m','u-keha-yissachar'),
  member('yissachar-tzvia','צביה','Tzvia','f','u-keha-yissachar'),
  ...[['dudi','דודי','Dudi'],['mami','ממי','Mami'],['avihai','אביחי','Avihai'],['drori','דרורי','Drori'],['uri','אורי','Uri']].map(([id,name,en])=>member('yissachar-'+id,name,en)),
].map(Object.freeze));
export function applyYissacharUnits(units){
  units['u-keha-yissachar']={id:'u-keha-yissachar',people:['yissachar-yosef','yissachar-tzvia'],children:YISSACHAR_CHILDREN.map(id=>'u-'+id),parent:null,relationship:'spouse'};
  for(const id of YISSACHAR_CHILDREN)units['u-'+id]={id:'u-'+id,people:[id],children:[],parent:'u-keha-yissachar',relationship:'single'};
}
