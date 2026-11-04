import {test} from 'node:test';
import assert from 'node:assert/strict';
import {languageCatalog,resolveLanguage,languageKey,languageLabel,searchLanguages} from '../public/assets/languages.mjs';
import {countryCodes} from '../public/assets/countries.mjs';

test('language names and native spellings resolve to one selection without replacing unknown authored text',()=>{
 for(const value of ['עברית','Hebrew','he'])assert.equal(resolveLanguage(value).code,'he');
 for(const value of ['צרפתית','French','français'])assert.equal(resolveLanguage(value).country,'FR');
 assert.equal(languageKey('English'),'en');assert.equal(languageLabel('French',false),'צרפתית');assert.equal(languageLabel('עברית',true),'Hebrew');
 assert.equal(languageLabel('A family dialect',true),'A family dialect');assert.equal(resolveLanguage('A family dialect'),null);
 assert.ok(!searchLanguages('Hebrew',['עברית']).some(language=>language.code==='he'));
 assert.ok(searchLanguages('צרפת').some(language=>language.code==='fr'));assert.ok(searchLanguages('français').some(language=>language.code==='fr'));
});
test('language flags use local supported country symbols and retain English and Portuguese variants',()=>{
 for(const language of languageCatalog)if(language.country)assert.ok(countryCodes.includes(language.country),language.code);
 assert.equal(resolveLanguage('English').country,'GB');assert.equal(resolveLanguage('English (US)').country,'US');
 assert.equal(resolveLanguage('Portuguese').country,'PT');assert.equal(resolveLanguage('Brazilian Portuguese').country,'BR');
 assert.equal(resolveLanguage('Yiddish').country,null,'Languages without a selected country use a globe');
});
