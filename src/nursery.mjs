import family from './family.mjs';
import {HttpError} from './http.mjs';

// Album identities follow the canonical family roster, including future additions.
// Extended relatives and names introduced only through photo tags have no nursery album.
export function nurseryCollection(id){
  const person=family.people[id];
  if(!person||person.extended||person.extra)throw new HttpError(404,'אלבום התינוקייה לא נמצא במשפחה שלנו.');
  return 'nursery:'+person.id;
}
