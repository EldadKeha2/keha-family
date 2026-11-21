import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {nakashHTML} from '../src/nakash-shell.mjs';
import {extendedKehaHTML,shlomoKehaHTML,branchPortalHTML} from '../src/extended-keha.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base='https://keha-family.eldadkeha.workers.dev/share-story/';

test('each questionnaire presents the right people and the global form leaves its final people field optional',()=>{
  const cases=[['','grandparents',['shlomo','yona','margalit','yahia']],['yehuda/','yehuda',['zehor','yehuda']],['haim/','haim',['haim','shoshana']],['medina/','medina',['ruma','yosef']]];
  for(const [path,scope,people] of cases){
    const {document}=parseHTML(read('public/share-story/'+path+'index.html')),form=document.querySelector('#story-form');
    assert.equal(form.dataset.scope,scope);assert.deepEqual([...form.querySelectorAll('[name="person"]')].map(input=>input.value),people);assert.equal(form.querySelectorAll('[type="checkbox"]').length,people.length);
    assert.ok(form.querySelector('#name').hasAttribute('required'));assert.ok(form.querySelector('#story').hasAttribute('required'));assert.ok(document.querySelector('#another'));
  }
  const {document}=parseHTML(read('public/share-story/extended/index.html')),form=document.querySelector('#story-form');
  assert.equal(form.dataset.scope,'extended');assert.equal(form.querySelectorAll('[name="person"]').length,0);assert.equal(form.querySelector('#people').hasAttribute('required'),false);
  assert.ok([...form.querySelectorAll('input,textarea')].indexOf(form.querySelector('#people'))>[...form.querySelectorAll('input,textarea')].indexOf(form.querySelector('#story')));
  const personal=read('public/share-story/index.html');assert.match(personal,/סבתא מרגלית/);assert.match(personal,/סבא יחיא<small>אבא של מרגלית/);
});

test('the original and every family portal place the matching questionnaire link inside the stories page',()=>{
  const template=read('public/index.html');
  const cases=[['original',template,base],['keha',nakashHTML(template,'keha'),base],['yehuda',nakashHTML(template,'yehuda'),base+'yehuda/'],['haim',nakashHTML(template,'haim'),base+'haim/'],['medina',nakashHTML(template,'medina'),base+'medina/'],['extended',extendedKehaHTML(template),base+'extended/'],['shlomo',shlomoKehaHTML(template),base],...['zechariah','zechariah-tzadok','kehat'].map(id=>[id,branchPortalHTML(template,id),base+'extended/'])];
  for(const [id,html,url] of cases){
    const {document}=parseHTML(html),links=document.querySelectorAll('#storyQuestionnaireLink');assert.equal(links.length,1,id);assert.ok(document.querySelector('#storiesView').contains(links[0]),id);assert.equal(links[0].getAttribute('href'),url,id);assert.equal(links[0].getAttribute('target'),'_blank',id);assert.equal(links[0].textContent,'כתיבת סיפור ושליחה לאלדד');
  }
});
