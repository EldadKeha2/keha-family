import {INGREDIENTS,SECRET_RECIPE,BOIL_MS,createSoup,addIngredient,removeIngredient,fillSoupWater,heatSoup,updateSoup,tasteSoup,cupAmount} from './soup.mjs?v=1';
import {ingredientIcon,portionIcon} from './soup-icons.mjs?v=portions-v2';

const I=window.FamilyI18n,tr=(he,en)=>I.isEnglish?en:he;
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=()=>tr('המתכון הסודי','The Secret Recipe');
const ADD_DURATION=2800,STIR_DURATION=3600;
const ingredient=id=>INGREDIENTS.find(item=>item.id===id);
const name=item=>I.isEnglish?item.en:item.he;
let game=createSoup(),host=null,back=null,events=null,clock=null,pending=null,flight=null,serial=0;
const animationTimers=new Set();
const $=selector=>host?.querySelector(selector);
const busy=()=>Boolean(pending);
const later=(fn,delay)=>{const id=setTimeout(()=>{animationTimers.delete(id);fn();},delay);animationTimers.add(id);};
function cancelAnimation(){for(const id of animationTimers)clearTimeout(id);animationTimers.clear();flight?.remove();flight=null;const chef=$('[data-soup-chef]');if(chef)chef.dataset.pose='idle';const scene=$('[data-soup-kitchen]');if(scene)scene.dataset.stirring='false';for(const source of host?.querySelectorAll('[data-picked]')||[])delete source.dataset.picked;}
function commitPending(){if(!pending||pending.applied||pending.kind==='stir')return;if(pending.id==='water'){game=heatSoup(fillSoupWater(game),Date.now());startClock();}else game=addIngredient(game,pending.id);pending.applied=true;}
function settleAnimation(){commitPending();cancelAnimation();pending=null;serial++;}
function stopClock(){if(clock!==null)clearInterval(clock);clock=null;}
export function pauseSoup(){settleAnimation();stopClock();events?.abort();events=null;host?.classList.remove('has-family-soup','soup-screen-active');host=null;}
export function mountSoup(root,onBack){
  pauseSoup();host=root;back=onBack;host.classList.add('has-family-soup');events=new AbortController();
  const on=(node,type,fn)=>node.addEventListener(type,fn,{signal:events.signal});
  on(host,'click',click);
  on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'){settleAnimation();stopClock();sync();}else{game=updateSoup(game,Date.now());sync();startClock();}});
  game=updateSoup(game,Date.now());render();startClock();$('.soup-heading')?.scrollIntoView({block:'start'});
}
function amountText(item,amount){
  if(item.unit==='cup')return cupAmount(amount)+' '+tr(amount>1?'כוסות':'כוס',amount<=1?'cup':'cups');
  return String(amount)+' '+tr(item.unit==='clove'?(amount===1?'שן שום':'שיני שום'):item.unit==='stalk'?(amount===1?'גבעול':'גבעולים'):'יח׳',item.unit==='clove'?(amount===1?'clove':'cloves'):item.unit==='stalk'?(amount===1?'stalk':'stalks'):(amount===1?'piece':'pieces'));
}
function chef(){return `<div class="soup-chef" data-soup-chef data-pose="idle"><img src="assets/games/soup/yona-chef.webp" alt="${tr('סבתא יונה במטבח, עם סינר ומטפחת','Grandma Yona in the kitchen, wearing an apron and headscarf')}" width="1881" height="836" decoding="async"></div>`;}
function kitchenArt(){return `<svg class="soup-kitchen-art" viewBox="0 0 640 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
 <linearGradient id="soupWall" x2="0" y2="1"><stop stop-color="#e5cba0"/><stop offset="1" stop-color="#c99d70"/></linearGradient>
 <linearGradient id="soupCopper"><stop stop-color="#8b5034"/><stop offset=".4" stop-color="#d7a069"/><stop offset=".7" stop-color="#bb7851"/><stop offset="1" stop-color="#80503a"/></linearGradient>
 <pattern id="soupTiles" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M0 0h48v48H0Z" fill="#e8d0a9" stroke="#d5b58a"/><path d="m24 5 19 19-19 19L5 24Z" fill="#a56345"/><path d="m24 12 12 12-12 12-12-12Z" fill="#eee1bf"/><path d="m24 18 6 6-6 6-6-6Z" fill="#6d8070"/></pattern>
 <pattern id="soupFrieze" width="48" height="27" patternUnits="userSpaceOnUse"><path d="M0 0h48v27H0Z" fill="#965c3e"/><path d="m0 22 12-17 12 17L36 5l12 17M0 26h48" fill="none" stroke="#f2e3c2" stroke-width="3"/><circle cx="24" cy="7" r="2" fill="#f2e3c2"/></pattern>
</defs>
<path d="M0 0h640v560H0Z" fill="url(#soupWall)"/>
<path d="M0 8h640v27H0Z" fill="url(#soupFrieze)"/><path d="M0 39h640" stroke="#f4e4c5" stroke-width="6"/>
<path d="M219 219V117q0-67 101-79 101 12 101 79v102Z" fill="#f4e7c8" stroke="#b4865f" stroke-width="3"/>
<path d="M231 207v-90q0-55 89-66 89 11 89 66v90Z" fill="#9fb6ac" stroke="#d4b58b" stroke-width="3"/>
<path d="M235 116q5-49 85-59 80 10 85 59Z" fill="#d0b165"/>
<g fill="none" stroke="#f8ebca" stroke-width="5"><path d="M233 119h174M320 53v152m-85-43h171m-134-57 48-48 48 48-48 45Z"/><path d="m243 91 28 28 49-47 49 47 28-28"/></g>
<path d="m320 79 20 20-20 20-20-20Z" fill="#a36952" stroke="#f3e3bf" stroke-width="3"/><path d="m264 101 12-10 12 12-12 12Zm88 2 12-12 12 10-12 14Z" fill="#608c8d"/>
<path d="M216 218h208" stroke="#8b6444" stroke-width="9" stroke-linecap="round"/>
<g fill="#986d4d" stroke="#f4e5c7" stroke-width="8" stroke-linejoin="round"><path d="M23 277V142q0-49 77-79 77 30 77 79v135Z"/><path d="M463 277V142q0-49 77-79 77 30 77 79v135Z"/></g>
<g fill="none" stroke="#dfc094" stroke-width="2"><path d="M35 264V145q0-40 65-68 65 28 65 68v119Z"/><path d="M475 264V145q0-40 65-68 65 28 65 68v119Z"/></g>
<g fill="url(#soupCopper)" stroke="#704a35" stroke-width="2"><circle cx="100" cy="150" r="38"/><circle cx="100" cy="150" r="29"/><circle cx="540" cy="151" r="35"/><circle cx="540" cy="151" r="26"/></g>
<g fill="none" stroke="#ecd0a0" stroke-width="2"><path d="m100 128 20 22-20 22-20-22Z"/><circle cx="100" cy="150" r="7"/><path d="m540 132 18 19-18 19-18-19Z"/><circle cx="540" cy="151" r="6"/></g>
<path d="M18 272h164m276 0h164" stroke="#6e4e36" stroke-width="12" stroke-linecap="round"/>
<g fill="url(#soupCopper)" stroke="#714f36" stroke-width="2"><path d="M47 254v-32q-5-22 9-24h14q13 1 8 24v32q-15 12-31 0Z"/><path d="M79 218q25-5 17 17l-17 8" fill="none" stroke-width="5"/><path d="m54 199 4-15h10l4 15"/><path d="M114 226h32l-3 34h-27Z"/><ellipse cx="130" cy="226" rx="16" ry="5"/><path d="M496 223h30l4 32q-18 12-38 0Z"/><path d="m499 222 5-18h14l5 18"/><path d="M553 239q-12-17 2-24h30q14 7 2 24v19q-17 9-34 0Z"/></g>
<path d="M0 296h640v146H0Z" fill="url(#soupTiles)"/>
<path d="M0 287h640m0 151H0" stroke="#f1dfbd" stroke-width="7"/>
<g fill="#a76441" stroke="#704b35" stroke-width="2"><path d="M28 388q-12-19 5-33h34q17 14 5 33l-7 33H35Z"/><path d="M38 354v-15h23v15"/></g>
<path d="M47 341q-14-34 1-46m6 44q25-28 27-14m-30 3q-28-7-26-22" fill="none" stroke="#687c4b" stroke-width="6" stroke-linecap="round"/>
<path d="M506 375h91l-12 41h-67Z" fill="#c69f62" stroke="#8b673e" stroke-width="3"/>
<path d="m512 384 79 0m-76 9h73m-70 9h67m-60-25 9 38m7-38 7 38m7-38 5 38m7-38 2 38m8-38-1 38" stroke="#a47948" stroke-width="2"/>
<path d="M517 375q36-62 70 0" fill="none" stroke="#93693e" stroke-width="5"/>
<path d="M0 443h640v117H0Z" fill="#926e4e"/><path d="M0 438h640v17H0Z" fill="#e5c79d"/>
</svg>`;}
function pot(){return `<div class="soup-pot" data-soup-pot><svg class="soup-pot-art" viewBox="0 0 240 170" aria-hidden="true"><path d="M24 78H8v28h21m182-28h21v28h-25" fill="none" stroke="#596d72" stroke-width="9" stroke-linejoin="round"/><ellipse cx="120" cy="62" rx="92" ry="35" fill="#6c8185"/><path d="M28 62v75q92 46 184 0V62Z" fill="#8a9b9d" stroke="#5e747a" stroke-width="3"/><path d="M42 80v51q12 8 21 10V85Z" fill="#bdc8c4" opacity=".6"/><ellipse cx="120" cy="62" rx="89" ry="31" fill="#bec6bd"/><ellipse cx="120" cy="62" rx="79" ry="26" fill="#819294" class="soup-water-surface"/><path d="M38 84q82 29 164 0" fill="none" stroke="#d6dcd2" stroke-width="3"/></svg><div class="soup-floating-food" data-soup-floating></div><div class="soup-stir-spoon" aria-hidden="true">${spoonIcon(true)}</div><span class="soup-stir-ripple" aria-hidden="true"></span><div class="soup-bubbles" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i style="--bubble:${i}"></i>`).join('')}</div><svg class="soup-steam" viewBox="0 0 150 100" aria-hidden="true"><path d="M30 96c-24-27 23-38 0-67m45 63c-25-32 25-48 0-80m45 84c-24-27 23-38 0-67"/></svg><div class="soup-burner" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>`;}
function scene(demo=false){return `<div class="soup-kitchen${demo?' is-demo':''}" data-soup-kitchen>${kitchenArt()}${chef()}<div class="soup-counter-front" aria-hidden="true"><i></i><i></i><i></i></div>${pot()}<p class="soup-kitchen-caption">${tr('המטבח של סבתא יונה','Grandma Yona’s kitchen')}</p><span class="soup-drop-splash" data-soup-splash aria-hidden="true">✦</span></div>`;}
function intro(){return `<header class="soup-heading" tabindex="-1"><span class="small-eyebrow">${tr('המתכון הסודי של סבתא יונה','Grandma Yona’s secret recipe')}</span><h3>${title()}</h3><p>${tr('פצחו את סוד המרק התימני של סבתא יונה','Crack the secret of Grandma Yona’s Yemeni soup.')}</p></header><section class="soup-intro"><div class="soup-intro-story"><span class="soup-story-icon" aria-hidden="true">${ingredientIcon('pot')}</span><h4>${tr('מה היה הסוד שלה?','What was her secret?')}</h4><p>${tr('לסבתא יונה היה מתכון סודי למרק תימני בטעם גן עדן, כזה שממלא את הבית בריח משגע, ושטעמו נשאר בזיכרון הרבה אחרי שהסיר התרוקן. אף אחד לא הצליח לגלות את השילוב המדויק.','Grandma Yona had a secret recipe for Yemeni soup that tasted like heaven. Its wonderful aroma filled the house, and its taste stayed with you long after the pot was empty. No one ever discovered the exact combination.')}</p><p>${tr('עכשיו המטבח שלה פתוח בפניכם: בחרו את המצרכים, דייקו בכמויות ואל תשכחו להרתיח את המים. בין המצרכים מסתתרות גם הטעיות, ורק שילוב מדויק אחד ייתן את הטעם של סבתא.','Now her kitchen is yours to explore. Choose the ingredients, get the amounts right, and remember to boil the water. Some ingredients are there to mislead you. Only one exact combination will recreate Grandma’s taste.')}</p><strong class="soup-challenge">${tr('האם תצליחו לפענח את המתכון הסודי?','Can you crack her secret recipe?')}</strong><button type="button" class="primary-button soup-start" data-soup-start>${tr('נכנסים למטבח של סבתא','Step into Grandma’s kitchen')}</button><small>${tr('ללא הגבלת זמן. אפשר לתקן ולנסות שוב.','No time limit. Adjust your ingredients and try again.')}</small></div>${scene(true)}</section>`;}
function pantry(ids){
  const product=id=>{const item=ingredient(id);return `<button type="button" class="soup-ingredient" data-soup-add="${id}" aria-label="${safe(tr('הוספת ','Add ')+name(item)+' · '+amountText(item,item.step))}"><span class="soup-ingredient-icon">${ingredientIcon(id)}</span><strong>${name(item)}</strong><small>${amountText(item,item.step)}</small><span class="soup-ingredient-count" data-soup-count="${id}" hidden></span><span class="soup-add-sign" aria-hidden="true">＋</span></button>`;};
  return `<div class="soup-pantry">${ids.map(product).join('')}</div>`;
}
function spoonIcon(stirring=false){if(stirring)return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="m110 12-88 58" fill="none" stroke="#98724d" stroke-width="7" stroke-linecap="round"/><ellipse cx="20" cy="79" rx="9" ry="15" transform="rotate(43 20 79)" fill="#bd9866" stroke="#98724d" stroke-width="2"/></svg>';return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m44 9-20 31" fill="none" stroke="#98724d" stroke-width="7" stroke-linecap="round"/><ellipse cx="21" cy="46" rx="8" ry="13" transform="rotate(32 21 46)" fill="#bd9866" stroke="#98724d" stroke-width="2"/></svg>';}
function controls(){return `<div class="soup-water-controls"><button type="button" class="soup-water-button" data-soup-water>${ingredientIcon('water')}<span data-soup-water-label>${tr('מים ואש','Water & flame')}</span></button><button type="button" class="soup-heat-button" data-soup-heat>${ingredientIcon('flame')}<span data-soup-heat-label>${tr('מדליקים את הכיריים','Turn on the stove')}</span></button><button type="button" class="soup-stir-button" data-soup-stir>${spoonIcon()}<span>${tr('מערבבים בסיר','Stir the pot')}</span><small>${tr('רק בשביל הכיף','Just for fun')}</small></button></div><p class="soup-water-status" data-soup-water-status role="status"></p><div class="soup-boil-progress" data-soup-boil-progress hidden><span data-soup-boil-bar></span></div>`;}
function contents(){const ids=Object.keys(game.contents).filter(id=>game.contents[id]>0);return `${game.water?`<span class="soup-water-chip">${ingredientIcon('water')}<span>${game.boiled?tr('מים רותחים','Boiling water'):tr('מים מתחממים','Water heating')}</span></span>`:''}${ids.length?`<ul>${ids.map(id=>{const item=ingredient(id);return `<li><span>${ingredientIcon(id)}</span><strong>${name(item)}</strong><bdi>${amountText(item,game.contents[id])}</bdi><button type="button" class="soup-remove" data-soup-remove="${id}" aria-label="${safe(tr('הסרת מנה אחת של ','Remove one portion of ')+name(item))}" ${busy()?'disabled':''}>−</button></li>`;}).join('')}</ul>`:`<p class="soup-empty-pot">${tr('עדיין אין מצרכים בסיר.','No ingredients in the pot yet.')}</p>`}`;}
function floatingFood(){
  const units=INGREDIENTS.flatMap(item=>Array.from({length:Math.min(3,Math.round((game.contents[item.id]||0)/item.step))},(_,i)=>({id:item.id,portion:i+1})));
  if(!units.length)return '';
  const rows=units.length<=3?1:units.length<=12?2:units.length<=24?3:4;
  const size=units.length<=3?54:units.length<=8?44:units.length<=12?36:units.length<=24?28:21;
  let offset=0;
  const icons=Array.from({length:rows},(_,row)=>{
    const count=Math.floor(units.length/rows)+(row<units.length%rows?1:0),y=(row+.5)*80/rows;
    const radius=Math.sqrt(1-Math.pow((y-40)/48,2))*120-size*.45;
    return Array.from({length:count},(_,col)=>{const unit=units[offset++],x=120+((col+.5)/count-.5)*2*radius;return portionIcon(unit.id).replace('<svg ',`<svg class="soup-food-unit" data-soup-product="${unit.id}" data-soup-portion="${unit.portion}" x="${(x-size/2).toFixed(2)}" y="${(y-size/2).toFixed(2)}" width="${size}" height="${size}" `);}).join('');
  }).join('');
  return `<svg viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden="true">${icons}</svg>`;
}
function brothColour(){
  if(!game.water&&game.phase!=='intro')return '#819294';
  let rgb=Object.keys(game.contents).length?[199,193,153]:[163,190,192];
  for(const [id,target] of [['hawaij',[207,150,35]],['paprika',[170,82,39]]]){
    const portions=(game.contents[id]||0)/ingredient(id).step,t=1-Math.exp(-portions/3.5);
    rgb=rgb.map((value,i)=>value+(target[i]-value)*t);
  }
  return `rgb(${rgb.map(Math.round).join(',')})`;
}
function feedback(){return game.feedback==='water'?tr('לפני שמבשלים, צריך למלא מים בסיר.','Before cooking, fill the pot with water.'):game.feedback==='boil'?tr('המים צריכים לרתוח. הפעילו את הכיריים וחכו לבעבוע.','The water needs to boil. Turn on the stove and wait for the bubbles.'):game.feedback==='recipe'?tr('סבתא טועמת ומחייכת: ״עוד לא… זה עדיין לא הטעם הסודי שלי.״ שנו את המצרכים או את הכמויות ונסו שוב.','Grandma tastes and smiles: “Not quite… that isn’t my secret flavour yet.” Adjust the ingredients or amounts and try again.'):'';}
function kitchen(backButton){return `<header class="soup-play-toolbar soup-play-heading" tabindex="-1">${backButton}<h3>${title()}</h3></header><section class="soup-pot-summary" aria-label="${tr('תכולת הסיר','Pot contents')}"><h4>${tr('כבר בסיר','In the pot')}</h4><div data-soup-contents>${contents()}</div></section><section class="soup-fixed-stage" aria-label="${tr('המטבח של סבתא יונה','Grandma Yona’s kitchen')}">${scene()}${controls()}</section><section class="soup-products-panel"><header><strong>${tr('מדף המצרכים','Ingredient shelf')}</strong><small>${tr('גללו בתוך המדף לעוד מצרכים','Scroll the shelf for more ingredients')}</small></header><div class="soup-products-scroll" data-soup-products tabindex="0" role="region" aria-label="${tr('מדף מצרכים נגלל — כל לחיצה מוסיפה את הכמות הרשומה','Scrollable ingredients — each tap adds the amount shown')}">${pantry(game.order)}</div></section><footer class="soup-play-footer"><div class="soup-live-message" data-soup-live role="status"></div><p class="soup-feedback" data-soup-feedback role="alert">${safe(feedback())}</p><div class="soup-action-buttons"><button type="button" class="primary-button soup-finish" data-soup-finish>${tr('סיימתי את המתכון','My recipe is ready')}</button><button type="button" class="quiet-button soup-new-pot" data-soup-reset aria-label="${tr('מתחילים עם סיר חדש','Start with a fresh pot')}">${tr('סיר חדש','New pot')}</button></div></footer>`;}
function success(){return `<section class="soup-success" tabindex="-1"><div class="soup-success-sparkles" aria-hidden="true">✧ <span>✦</span> ✧</div><span class="small-eyebrow">${tr('הסוד המשפחתי התגלה','The family secret is out')}</span><h3>${tr('הצלחת!!!','You did it!!!')}</h3><h4>${tr('פענחתם את המתכון הסודי של סבתא יונה','You cracked Grandma Yona’s secret recipe')}</h4><p>${tr('זה בדיוק הטעם שממלא את הבית בזיכרונות. סבתא יונה הייתה גאה בכם!','That’s the taste that fills a home with memories. Grandma Yona would be proud!')}</p><div class="soup-success-scene">${scene()}</div><div class="soup-revealed-recipe"><h4>${tr('הסוד שבסיר','The secret in the pot')}</h4><ul>${Object.entries(SECRET_RECIPE).map(([id,amount])=>`<li>${ingredientIcon(id)}<strong>${name(ingredient(id))}</strong><bdi>${amountText(ingredient(id),amount)}</bdi></li>`).join('')}<li>${ingredientIcon('water')}<strong>${tr('מים רותחים','Boiling water')}</strong><span>✓</span></li></ul></div><p class="soup-attempts">${game.attempts===1?tr('פענחתם בניסיון הראשון!','You solved it on your first try!'):tr('פענחתם אחרי ','Solved in ')+game.attempts+tr(' ניסיונות טעימה.',' tasting attempts.')}</p><div class="soup-success-actions"><button type="button" class="primary-button" data-soup-reset>${tr('מבשלים שוב','Cook again')}</button><button type="button" class="secondary-button" data-soup-back>${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button></div></section>`;}
function render(){
  if(!host)return;
  const playing=game.phase==='playing',backButton=`<button type="button" class="game-lobby-button" data-soup-back>${I.isEnglish?'←':'→'} ${tr('חזרה ללוח בחירת המשחקים','Back to game selection')}</button>`;
  if(playing)host.classList.add('soup-screen-active');else host.classList.remove('soup-screen-active');
  host.innerHTML=`<section class="family-soup${playing?' soup-play':''}">${playing?kitchen(backButton):backButton+(game.phase==='intro'?intro():success())}</section>`;
  sync();
}
function sync(){
  if(!host)return;
  for(const button of host.querySelectorAll('[data-soup-add]')){const id=button.dataset.soupAdd,item=ingredient(id),amount=game.contents[id]||0;button.disabled=busy()||amount>=(item.unit==='cup'?3:12);button.dataset.chosen=String(amount>0);const count=button.querySelector('[data-soup-count]');if(count){count.hidden=!amount;count.textContent=(item.unit==='cup'?cupAmount(amount):amount)+' '+tr('בסיר','in pot');}}
  for(const button of host.querySelectorAll('[data-soup-remove],[data-soup-finish],[data-soup-reset]'))button.disabled=busy();
  const water=$('[data-soup-water]'),heat=$('[data-soup-heat]'),stir=$('[data-soup-stir]');if(water){water.disabled=busy()||game.water;water.dataset.done=String(game.water);}if(heat){heat.disabled=busy()||game.heat;heat.dataset.done=String(game.boiled);}if(stir)stir.disabled=busy()||!game.water;
  const waterLabel=$('[data-soup-water-label]'),heatLabel=$('[data-soup-heat-label]');if(waterLabel)waterLabel.textContent=game.water?tr('מים בסיר ✓','Water added ✓'):tr('מים ואש','Water & flame');if(heatLabel)heatLabel.textContent=game.boiled?tr('המים רותחים ✓','Water is boiling ✓'):game.heat?tr('מחממים את המים…','Heating the water…'):tr('מדליקים את הכיריים','Turn on the stove');
  const status=$('[data-soup-water-status]');if(status)status.textContent=game.boiled?tr('מבעבע! המים רותחים וסבתא מוכנה לבשל.','Bubbling! The water is boiling and Grandma is ready to cook.'):game.heat?tr('האש דולקת. עוד רגע המים יבעבעו…','The stove is on. The water will bubble in a moment…'):game.water?tr('המים בסיר. עכשיו מדליקים את הכיריים.','Water is in the pot. Now turn on the stove.'):tr('מתחילים במים — גם למתכון סודי צריך בסיס.','Start with water — even a secret recipe needs a base.');
  const progress=$('[data-soup-boil-progress]'),bar=$('[data-soup-boil-bar]');if(progress)progress.hidden=!game.heat||game.boiled;if(bar&&game.boilAt)bar.style.width=Math.min(100,Math.max(0,100*(1-(game.boilAt-Date.now())/BOIL_MS)))+'%';
  const scene=$('[data-soup-kitchen]');if(scene){scene.dataset.water=String(game.water||game.phase==='intro');scene.dataset.heat=String(game.heat);scene.dataset.heating=String(game.heat&&!game.boiled);scene.dataset.boiled=String(game.boiled);scene.style.setProperty('--soup-broth',brothColour());}
  const potContents=$('[data-soup-contents]');if(potContents){const markup=contents();if(potContents.innerHTML!==markup)potContents.innerHTML=markup;}
  const floating=$('[data-soup-floating]');if(floating){const markup=floatingFood();if(floating.innerHTML!==markup)floating.innerHTML=markup;}
  const note=$('[data-soup-feedback]');if(note)note.textContent=feedback();
}
function startClock(){stopClock();if(host&&game.phase==='playing'&&game.heat&&!game.boiled&&document.visibilityState!=='hidden')clock=setInterval(()=>{game=updateSoup(game,Date.now());sync();if(game.boiled)stopClock();},150);}
function finishAnimation(){commitPending();const action=pending;cancelAnimation();pending=null;sync();const message=$('[data-soup-live]');if(!message)return;if(action?.kind==='stir'){message.textContent=tr('ערבוב עדין. הכמויות נשארו בדיוק כפי שהיו.','Gently stirred. Ingredients and amounts are unchanged.');return;}const id=action?.id;if(id)message.textContent=id==='water'?tr('סבתא הדליקה אש. המים מתחממים…','Grandma lit the flame. The water is heating…'):tr('סבתא הכניסה לסיר: ','Grandma added: ')+name(ingredient(id))+' · '+amountText(ingredient(id),ingredient(id).step);}
function animateAdd(id,button){
  if(game.phase!=='playing'||busy())return;
  if(id!=='water'&&!game.water){game={...game,feedback:'water'};sync();return;}
  const next=id==='water'?fillSoupWater(game):addIngredient(game,id);if(next===game)return;
  pending={kind:'add',id,applied:false};if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){finishAnimation();return;}const token=++serial,chefNode=$('[data-soup-chef]'),potNode=$('[data-soup-pot]');
  const source=button.querySelector('.soup-ingredient-icon')||button.querySelector('svg')||button,buttonBox=source.getBoundingClientRect(),chefBox=chefNode?.getBoundingClientRect(),potBox=potNode?.getBoundingClientRect();
  button.dataset.picked='true';
  if(chefNode)chefNode.dataset.pose='pick';sync();const message=$('[data-soup-live]');if(message)message.textContent=tr('סבתא לוקחת ','Grandma is picking up ')+(id==='water'?tr('מים','water'):name(ingredient(id)))+'…';
  if(chefBox&&potBox){
    flight=document.createElement('div');flight.className='soup-flying-ingredient';flight.dataset.ingredient=id;flight.setAttribute('aria-hidden','true');flight.innerHTML=id==='water'?ingredientIcon(id):source.innerHTML||ingredientIcon(id);document.body.appendChild(flight);
    const point=(x,y,scale=1,rotation=0)=>({transform:`translate(${x-24}px,${y-24}px) scale(${scale}) rotate(${rotation}deg)`});
    const start=point(buttonBox.left+buttonBox.width/2,buttonBox.top+buttonBox.height/2,buttonBox.width/48),pick=point(chefBox.left+chefBox.width*.14,chefBox.top+chefBox.height*.44),carry=point(chefBox.left+chefBox.width*.88,chefBox.top+chefBox.height*.4),above=point(potBox.left+potBox.width*.5,potBox.top+potBox.height*.12,.9),lower=point(potBox.left+potBox.width*.5,potBox.top+potBox.height*.33,.7),end=point(potBox.left+potBox.width*.5,potBox.top+potBox.height*.38,.45);
    flight.animate?.([{...start,opacity:1,offset:0},{...pick,opacity:1,offset:.25},{...pick,opacity:1,offset:.38},{...carry,opacity:1,offset:.59},{...above,opacity:1,offset:.74},{...lower,opacity:1,offset:.92},{...end,opacity:0,offset:1}],{duration:ADD_DURATION-200,easing:'ease-in-out',fill:'forwards'});
  }
  later(()=>{if(token===serial&&host&&chefNode)chefNode.dataset.pose='place';},1050);
  later(()=>{if(token!==serial||!host)return;commitPending();sync();const splash=$('[data-soup-splash]');if(splash)splash.dataset.active='true';},2400);
  later(()=>{if(token!==serial||!host)return;const splash=$('[data-soup-splash]');if(splash)splash.dataset.active='false';finishAnimation();},ADD_DURATION);
}
function animateStir(){
  if(game.phase!=='playing'||busy()||!game.water)return;
  pending={kind:'stir',applied:true};sync();
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){finishAnimation();return;}
  const token=++serial,scene=$('[data-soup-kitchen]'),chefNode=$('[data-soup-chef]');
  if(scene)scene.dataset.stirring='true';if(chefNode)chefNode.dataset.pose='place';
  const message=$('[data-soup-live]');if(message)message.textContent=tr('סבתא מערבבת לאט…','Grandma is stirring slowly…');
  later(()=>{if(token===serial&&host)finishAnimation();},STIR_DURATION);
}
function click(event){
  if(event.target.closest('[data-soup-back]')){pauseSoup();back?.();return;}
  if(event.target.closest('[data-soup-start]')){game={...game,phase:'playing'};render();$('.soup-play-heading')?.focus({preventScroll:true});return;}
  const add=event.target.closest('[data-soup-add]');if(add){animateAdd(add.dataset.soupAdd,add);return;}
  const water=event.target.closest('[data-soup-water]');if(water){animateAdd('water',water);return;}
  if(event.target.closest('[data-soup-stir]')){animateStir();return;}
  if(event.target.closest('[data-soup-heat]')){if(busy())return;if(!game.water)game={...game,feedback:'water'};else game=heatSoup(game,Date.now());sync();startClock();return;}
  const remove=event.target.closest('[data-soup-remove]');if(remove&&!busy()){game=removeIngredient(game,remove.dataset.soupRemove);sync();return;}
  if(event.target.closest('[data-soup-finish]')&&!busy()){game=tasteSoup(game,Date.now());if(game.phase==='success'){stopClock();render();$('.soup-success')?.focus({preventScroll:true});$('.soup-success')?.scrollIntoView({block:'start'});}else sync();return;}
  if(event.target.closest('[data-soup-reset]')&&!busy()){stopClock();game={...createSoup(),phase:'playing'};render();$('.soup-play-heading')?.focus({preventScroll:true});}
}
