import {test} from 'node:test';
import assert from 'node:assert/strict';
import {civilDate,hebrewDate,hebrewNumber,monthWindow,familyCalendar} from '../src/calendar.mjs';
test('Hebrew month boundaries include separate Adar I and Adar II and navigate accurately',()=>{
  const first=monthWindow('2024-02-20','hebrew'),second=monthWindow(first.next,'hebrew');
  assert.equal(first.start,'2024-02-10');assert.equal(first.end,'2024-03-10');assert.match(first.label,/אדר א/);
  assert.equal(second.start,'2024-03-11');assert.equal(second.end,'2024-04-08');assert.match(second.label,/אדר ב/);
  assert.equal(monthWindow(second.previous,'hebrew').anchor,first.anchor);
  assert.equal(new Date(first.dates[0]+'T12:00Z').getUTCDay(),0);assert.equal(first.dates.length%7,0);
  assert.equal(hebrewDate(civilDate('2026-09-12')).day,1);assert.match(hebrewDate(civilDate('2026-09-12')).month,/תשרי/);
  assert.equal(hebrewNumber(15),'ט״ו');assert.equal(hebrewNumber(16),'ט״ז');
});
test('birthday recurrence keeps full names, multiple people, leap dates and unknown dates distinct',()=>{
  const people={a:{id:'a',name:'שם מלא אחד',birthday:'28.2.1990'},b:{id:'b',name:'שם מלא שני',birthday:'29.2.2000'},c:{id:'c',name:'לא ידוע',birthday:'1.1.1111'},d:{id:'d',name:'זיכרון',birthday:'28.2.1950',deceased:true},e:{id:'e',name:'שם נוסף',birthday:'28.2.2000',extra:true}};
  let result=familyCalendar('2025-02-01','gregorian',people),day=result.days.find(day=>day.date==='2025-02-28');
  assert.equal(day.birthdays.length,3);assert.equal(result.knownBirthdays,3);assert.equal(result.unknownBirthdays,1);assert.equal(day.birthdays.find(p=>p.id==='b').age,25);assert.equal(day.birthdays.find(p=>p.id==='b').leapDayObserved,true);assert.equal(day.birthdays.find(p=>p.id==='d').age,null);
  result=familyCalendar('2024-02-01','gregorian',people);assert.equal(result.days.find(day=>day.date==='2024-02-28').birthdays.length,2);assert.equal(result.days.find(day=>day.date==='2024-02-29').birthdays[0].id,'b');
  assert.doesNotThrow(()=>familyCalendar('1900-01-01','gregorian',people));assert.doesNotThrow(()=>familyCalendar(monthWindow('1900-01-01','hebrew').anchor,'hebrew',people));assert.doesNotThrow(()=>familyCalendar('2200-12-31','gregorian',people));
  assert.equal(monthWindow('2026-12-31').next,'2027-01-01');
});
