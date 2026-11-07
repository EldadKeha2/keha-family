// Original, code-native artwork for Ruti's House. All images are decorative;
// interactive targets and their accessible names live in the game UI.
export function houseArtwork(){return `<svg class="ruti-house-illustration" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" fill="none" aria-hidden="true" focusable="false">
<defs>
 <linearGradient id="rh-wall" x2="0" y2="1"><stop stop-color="#fff2d9"/><stop offset="1" stop-color="#ead8b9"/></linearGradient>
 <linearGradient id="rh-floor" x2="0" y2="1"><stop stop-color="#dba681"/><stop offset="1" stop-color="#b97857"/></linearGradient>
 <linearGradient id="rh-glass" x2="0" y2="1"><stop stop-color="#bee0d8"/><stop offset="1" stop-color="#e5edc9"/></linearGradient>
 <linearGradient id="rh-cabinet" x2="0" y2="1"><stop stop-color="#9ead83"/><stop offset="1" stop-color="#6d856b"/></linearGradient>
 <pattern id="rh-tiles" width="36" height="30" patternUnits="userSpaceOnUse"><rect width="36" height="30" fill="#efe5ce"/><path d="M0 0H36V30" stroke="#d7c8ac" stroke-width="2"/><path d="m16 14 2-2 2 2-2 2Z" fill="#91a288" opacity=".55"/></pattern>
 <pattern id="rh-floor-tiles" width="106" height="55" patternUnits="userSpaceOnUse"><path d="M0 0H106V55" stroke="#915e45" opacity=".23" stroke-width="2"/></pattern>
 <pattern id="rh-rug" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#c56d55"/><path d="m12 3 9 9-9 9-9-9Z" stroke="#eec990" stroke-width="2"/></pattern>
 <filter id="rh-soft-shadow" x="-25%" y="-25%" width="150%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#5c3a28" flood-opacity=".18"/></filter>
</defs>
<!-- The cutaway shell and sunny tile floor. -->
<rect width="1000" height="580" rx="24" fill="#f6e8cb"/>
<path d="M0 0H1000V337L0 370Z" fill="url(#rh-wall)"/>
<path d="M0 334H1000V580H0Z" fill="url(#rh-floor)"/>
<path d="M0 334H1000V580H0Z" fill="url(#rh-floor-tiles)"/>
<path d="M0 329H1000" stroke="#aa8061" stroke-width="9"/>
<path d="M414 0V333" stroke="#d6c0a0" stroke-width="13"/>
<path d="M422 0V332" stroke="#f6ecd7" stroke-width="7"/>
<!-- Kitchen backsplash, open shelves, dishes, and herb jars. -->
<path d="M0 167H411V298H0Z" fill="url(#rh-tiles)"/>
<g stroke="#6c5841" stroke-width="3" stroke-linejoin="round">
 <rect x="17" y="39" width="116" height="116" rx="5" fill="url(#rh-cabinet)"/>
 <rect x="142" y="39" width="115" height="116" rx="5" fill="url(#rh-cabinet)"/>
 <path d="M29 51H121V142H29ZM154 51H245V142H154Z" stroke="#bfccaa" stroke-width="2"/>
 <path d="M119 94V110M156 94V110" stroke="#dfc393" stroke-width="4" stroke-linecap="round"/>
 <path d="M279 69H398M283 130H401" stroke="#a5724b" stroke-width="10"/>
 <path d="M289 62v-27h13v27m5 0V26h12v36m7 0V36h12v26" fill="#de9b6a"/>
 <path d="M351 61V38h32v23" fill="#f8edd5"/><path d="M383 43h7q10 9 0 13h-7"/>
 <path d="M290 123h26l-3-22h-20Zm36 0h26l-2-28h-22Z" fill="#d7b378"/>
 <path d="M294 101h18m18-6h17" stroke="#8f5f44" stroke-width="6"/>
 <path d="M367 123V99q0-12 13-12t13 12v24" fill="#f2e2bd"/>
 <path d="M374 85v-11m8 11 8-12m-12 5-9-8" stroke="#6e8960" stroke-width="5"/>
</g>
<!-- Small kitchen window and its checked curtain. -->
<g stroke="#6b644c" stroke-width="3">
 <rect x="159" y="176" width="136" height="99" rx="3" fill="url(#rh-glass)"/>
 <path d="M227 176v99m-68-49h136" stroke="#f7efda" stroke-width="8"/>
 <path d="M150 171h154" stroke="#99704e" stroke-width="6" stroke-linecap="round"/>
 <path d="M156 176h39l-11 57-28 15Zm110 0h36v72l-27-15Z" fill="#d4a278" stroke="#b9835e"/>
 <path d="M164 178v61m11-61v54m113-54v54m9-54v63" stroke="#f4d4aa" stroke-width="3"/>
 <rect x="153" y="273" width="147" height="8" rx="3" fill="#b28a62"/>
</g>
<!-- Counters and proper little oven. -->
<g stroke="#685740" stroke-width="3" stroke-linejoin="round">
 <rect x="12" y="300" width="390" height="88" rx="6" fill="url(#rh-cabinet)"/>
 <path d="M23 312H107V376H23ZM117 312H201V376H117ZM310 312H390V376H310Z" stroke="#b6c49d" stroke-width="2"/>
 <path d="M36 321h27m69 0h27m166 0h27" stroke="#e1ca9f" stroke-width="5" stroke-linecap="round"/>
 <rect x="209" y="300" width="92" height="87" rx="4" fill="#f3e8cc"/>
 <rect x="221" y="328" width="68" height="47" rx="4" fill="#4f574b"/>
 <rect x="228" y="336" width="54" height="30" rx="2" fill="#7a7861"/>
 <path d="M228 323h54" stroke-width="5" stroke-linecap="round"/>
 <circle cx="227" cy="311" r="3" fill="#66523c"/><circle cx="246" cy="311" r="3" fill="#66523c"/><circle cx="266" cy="311" r="3" fill="#66523c"/><circle cx="285" cy="311" r="3" fill="#66523c"/>
 <rect x="5" y="286" width="404" height="18" rx="5" fill="#dfceb0"/>
 <ellipse cx="252" cy="288" rx="36" ry="5" fill="#6b735e"/>
 <ellipse cx="173" cy="289" rx="31" ry="7" fill="#b4b7a3"/><ellipse cx="173" cy="288" rx="23" ry="4" fill="#7f998f"/>
 <path d="M176 282v-17q0-15 14-15t14 15" stroke="#b5ae91" stroke-width="6"/>
 <rect x="35" y="277" width="68" height="9" rx="4" fill="#bc8557"/>
 <path d="M49 277v-20m13 20v-21m14 21v-15" stroke="#5b875e" stroke-width="6"/>
 <path d="M46 270q-14-15-15-5 1 9 17 9m17-8q13-17 18-9 0 10-18 13" fill="#75946a" stroke-width="2"/>
</g>
<!-- Friendly kitchen details and a warm hanging light. -->
<g stroke="#7c6248" stroke-width="3" stroke-linecap="round">
 <circle cx="360" cy="217" r="25" fill="#fbf0d4"/>
 <path d="M360 198v4m0 30v4m-19-19h4m30 0h4m-19-16v16l10 5"/>
 <path d="M353 263h31v23h-31Z" fill="#ce9072"/>
 <path d="M358 262v-17m8 17 4-22m5 22 7-18"/>
 <path d="M355 248h8m3-3h8m5 3h7"/>
 <path d="M562 0v51"/>
 <path d="M526 77q7-31 36-31t36 31Z" fill="#d8a55f"/>
 <ellipse cx="562" cy="77" rx="36" ry="6" fill="#fff0bf"/>
</g>
<!-- Family photographs and a bookshelf, without generated faces. -->
<g stroke="#8b6648" stroke-width="3">
 <rect x="451" y="65" width="55" height="66" rx="3" fill="#f4cf91"/><rect x="458" y="73" width="41" height="50" rx="1" fill="#f7efda"/>
 <path d="M464 113q14-23 29 0" fill="#96a58c" stroke="none"/><circle cx="480" cy="94" r="10" fill="#d2a17f" stroke="none"/>
 <rect x="523" y="99" width="67" height="52" rx="3" fill="#c38d61"/><path d="M531 108h51v35h-51Z" fill="#f3e1b9"/>
 <path d="m535 137 13-17 11 10 8-6 10 13Z" fill="#7e9c78" stroke="none"/><circle cx="570" cy="116" r="5" fill="#ddb565" stroke="none"/>
 <rect x="451" y="192" width="95" height="157" rx="4" fill="#be946b"/><path d="M455 241h87m-87 51h87"/>
 <path d="M462 234v-32h10v32m5 0v-26h11v26m5 0v-32h10v32m6 0-2-28 10-1 3 29" fill="#8f9e78"/>
 <path d="M464 284v-31h11v31m5 0v-25h10v25m6 0v-30h12v30m7 0 2-27 10 1-1 26" fill="#c57557"/>
 <path d="M469 340v-35h12v35m6 0v-28h12v28m6 0 1-32 12 1-1 31" fill="#d5b666"/>
</g>
<!-- Reading sofa, soft cushions, and a knitted throw. -->
<g stroke="#795e45" stroke-width="3" stroke-linejoin="round">
 <path d="M580 277v-39q0-18 20-18h127q20 0 20 18v39" fill="#d4a56f"/>
 <rect x="575" y="269" width="178" height="74" rx="20" fill="#d5aa7b"/>
 <path d="M600 287h128v42H600Z" fill="#e5bf8d"/>
 <rect x="563" y="264" width="28" height="78" rx="13" fill="#c99464"/>
 <rect x="737" y="264" width="28" height="78" rx="13" fill="#c99464"/>
 <path d="M583 343v15m162-15v15" stroke-width="7"/>
 <path d="m606 238 31 4-5 37-31-4Z" fill="#9da58a"/>
 <path d="m690 241 30-3 5 37-30 3Z" fill="#be7962"/>
 <path d="M651 241h25v82l-7-4-6 4-6-4-6 4Z" fill="#f2e6c5"/>
 <path d="M655 251h17m-17 12h17m-17 12h17m-17 12h17m-17 12h17" stroke="#c6ab80" stroke-width="2"/>
</g>
<!-- Sunlit balcony with layered leaves and terracotta pots. -->
<g stroke="#6f6c50" stroke-width="3" stroke-linejoin="round">
 <rect x="797" y="38" width="176" height="242" rx="11" fill="#d1dfb9"/>
 <path d="M808 49h154v220H808Z" fill="url(#rh-glass)"/>
 <path d="M886 48v221m-78-114h154" stroke="#f7e9c8" stroke-width="9"/>
 <path d="M800 37h171" stroke="#ac7952" stroke-width="9" stroke-linecap="round"/>
 <path d="M798 44h39l-14 106-25 34Zm137 0h38v141l-26-35Z" fill="#b1b796"/>
 <path d="M808 47v114m12-114-5 102m137-102 5 102m6-102v115" stroke="#d9d6b5" stroke-width="3"/>
 <path d="M817 247h138m-138-23h138" stroke="#8d9e86" stroke-width="4"/>
 <path d="M826 218v51m23-51v51m25-51v51m24-51v51m24-51v51m24-51v51" stroke="#a7b398"/>
</g>
<g stroke="#4f7450" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
 <path d="M823 300v-90m0 43-20-18m20 0 22-21m-22 55 26-16m-26 29-24-17"/>
 <path d="M804 239q-23 2-18-17 18-4 23 17m33-23q2-23 19-17 2 18-19 20m6 32q19-14 24 3-5 14-23 4m-49 6q-25-1-17-17 16-3 20 19m19-38q-15-24 2-30 12 11 4 29" fill="#75976a"/>
 <path d="M903 321v-94m0 39 20-17m-20 0-21-17m21 57-22-15"/>
 <path d="M921 251q-1-25 17-20 9 17-17 23m-38-22q-24 1-18-18 17-4 22 19m-6 43q-25 1-20-18 16-3 23 20m18-34q-14-26 5-30 12 14 0 30" fill="#668e65"/>
</g>
<g stroke="#936348" stroke-width="3">
 <path d="M802 296h44l-7 43h-30Z" fill="#c77b56"/><path d="M796 291h56v10h-56Z" fill="#dd9b6c"/>
 <path d="M883 313h43l-7 40h-29Z" fill="#d39161"/><path d="M878 309h53v10h-53Z" fill="#e8ad77"/>
 <path d="M951 292h35l-6 35h-24Z" fill="#b87a5a"/><path d="M946 289h45v9h-45Z" fill="#daa278"/>
 <path d="M968 286v-30m-2 17-13-10m15 6 14-11" stroke="#6e8e60"/>
 <circle cx="951" cy="260" r="9" fill="#cf8d95"/><circle cx="983" cy="255" r="9" fill="#d997a0"/>
</g>
<!-- The open entry: a welcome mat, coat pegs, umbrella and slippers. -->
<g stroke="#6e5943" stroke-width="3" stroke-linejoin="round">
 <path d="M849 580V394q0-9 9-9h124v195" fill="#c8a27b"/>
 <path d="M862 580V399h108v181" fill="#e1bf8e"/>
 <path d="m970 401-75 25v154h75Z" fill="#a87a57"/>
 <path d="m959 421-51 16v130h51Z" stroke="#c69b72"/>
 <circle cx="913" cy="496" r="5" fill="#e9cf99"/>
 <path d="M853 580h129" stroke="#785c43" stroke-width="9"/>
 <path d="M783 429h47" stroke="#ad7f56" stroke-width="9" stroke-linecap="round"/>
 <path d="M793 429v10m26-10v10" stroke-width="6" stroke-linecap="round"/>
 <path d="m793 442-14 15 8 11v42h27v-42l8-11-15-15-7 8Z" fill="#c28b6f"/>
 <path d="M765 518h36l-5 47h-25Z" fill="#82947a"/>
 <path d="M779 516v-59q0-15 12-15t12 12" stroke="#c6a06c" stroke-width="5"/>
 <path d="m823 548 17-4q11 8 4 16l-23 4q-7-5 2-16m-20 2 12-3q8 9 1 16l-21 3q-7-7 8-16" fill="#e3bd8e"/>
</g>
<!-- A patterned rug and set table: food is added by gameplay. -->
<path d="M425 403h302l48 134H391Z" fill="url(#rh-rug)" stroke="#edc392" stroke-width="7" opacity=".9"/>
<path d="m399 534-5 12m15-12-5 13m15-13-4 13m344-13 4 12m-15-12 4 13m-15-13 4 13" stroke="#ecd09d" stroke-width="3"/>
<g stroke="#75553b" stroke-width="4" stroke-linejoin="round" filter="url(#rh-soft-shadow)">
 <path d="M487 455v71m180-71v71" stroke-width="12"/>
 <ellipse cx="576" cy="427" rx="124" ry="51" fill="#bb8659"/>
 <ellipse cx="576" cy="419" rx="124" ry="47" fill="#d9ab77"/>
 <path d="M473 411q100-29 204 0m-204 15q100 29 204 0" stroke="#bf8d5d" stroke-width="2"/>
 <path d="M555 377h45v85h-45Z" fill="#eee0ba" stroke="#d6c29a" stroke-width="2"/>
 <ellipse cx="492" cy="418" rx="22" ry="12" fill="#f8edce" stroke="#a9ad8a" stroke-width="2"/>
 <ellipse cx="657" cy="419" rx="22" ry="12" fill="#f8edce" stroke="#a9ad8a" stroke-width="2"/>
 <path d="M511 398v16m6-17v16m-3-16v7m-3 0h6M631 398v17" stroke-width="2" stroke-linecap="round"/>
 <ellipse cx="544" cy="401" rx="9" ry="4" fill="#e5dcb7" stroke-width="2"/>
 <path d="M535 399v-17h18v17" fill="#f2e6c5" stroke-width="2"/>
 <path d="M571 421h14l4-22h-23Z" fill="#9cae8c" stroke-width="2"/>
 <path d="M577 398v-22m0 12-10-9m10 3 10-10" stroke="#73895c" stroke-width="2"/>
 <circle cx="565" cy="377" r="6" fill="#d59d90" stroke-width="1.5"/><circle cx="588" cy="370" r="6" fill="#dcad72" stroke-width="1.5"/><circle cx="577" cy="374" r="6" fill="#d59d90" stroke-width="1.5"/>
</g>
<!-- Low foreground shelf, a basket and a trailing houseplant. -->
<g stroke="#876446" stroke-width="3" stroke-linejoin="round">
 <rect x="29" y="448" width="296" height="105" rx="8" fill="#bd9166"/>
 <rect x="42" y="461" width="127" height="77" rx="3" fill="#a47c56"/><rect x="183" y="461" width="128" height="77" rx="3" fill="#a47c56"/>
 <path d="M54 529v-54h14v54m6 0v-44h18v44m7 0v-51h13v51m8 0-3-42 14-1 4 43" fill="#b1b599"/>
 <path d="M201 482h91l-9 47h-72Z" fill="#d6b586"/>
 <path d="M210 492h70m-67 10h65m-63 10h59m-49-25 6 40m10-40 4 40m10-40 1 40m11-40-2 40" stroke="#b68d60" stroke-width="2"/>
 <path d="M189 449h43l-6-34h-31Z" fill="#d0a072"/>
 <path d="M209 414v-29m0 20-23-10m24 4 20-17m-24 16q-28-17-30 6t-24 25q-17 1-17 18" stroke="#6e8c60"/>
 <path d="M186 396q-23 2-18-13 14-5 19 13m41-12q-1-19 13-15 7 14-12 18m-55 13q-14-10-19 4 2 10 15 2m-25 25q-14-9-19 4 3 11 16 2" fill="#83a074" stroke="#69865b" stroke-width="2"/>
 <path d="M70 441v-24h26v24" fill="#ead7ad"/><path d="M76 414v-17m7 17 3-24m3 24 8-17" stroke="#799467"/>
 <circle cx="76" cy="395" r="6" fill="#d5a065"/><circle cx="87" cy="390" r="6" fill="#c88c7a"/><circle cx="98" cy="396" r="6" fill="#d5a065"/>
</g>
<!-- Gentle window light and paper-like grain retain clear target contrast. -->
<path d="m850 281 111 0 39 130v63L813 333Z" fill="#fff2bf" opacity=".12"/>
<path d="M0 3H1000M3 0V580" stroke="#fff9e9" stroke-width="6" opacity=".7"/>
</svg>`;}

const shapes={
 bowl:`<path d="M8 29h48q-3 25-24 27Q11 54 8 29Z" fill="#a3b9a1"/><ellipse cx="32" cy="29" rx="24" ry="7" fill="#f4e4b8"/><path d="m35 27 14-17q3-3 5 0l-14 20" fill="#c89766"/><path d="M17 39q4 9 11 10" stroke="#d8e0c3"/><path d="M21 12q-5 5 0 9m9-12q-5 5 0 9" stroke="#b69e7a"/>`,
 knife:`<path d="m9 43 16-17 15 15-16 16q-6 5-12-1t-3-13Z" fill="#af7853"/><path d="M25 26 49 5q7 18-9 36Z" fill="#d4ded7"/><path d="m31 27 14-13" stroke="#f8fcf2"/><circle cx="17" cy="47" r="2" fill="#e8c38d" stroke="none"/><path d="m15 56 9-9" stroke="#d5a779"/>`,
 oven:`<rect x="9" y="10" width="46" height="47" rx="5" fill="#e9d9b5"/><path d="M9 22h46"/><rect x="16" y="30" width="32" height="21" rx="3" fill="#657366"/><path d="M21 35h22v11H21Z" fill="#a1a78c" stroke="none"/><path d="M18 26h28"/><circle cx="19" cy="16" r="2" fill="#c78856"/><circle cx="32" cy="16" r="2" fill="#c78856"/><circle cx="45" cy="16" r="2" fill="#c78856"/>`,
 water:`<path d="M16 28h29l-3 27H19Z" fill="#8cac9b"/><path d="M42 32 55 20l4 5-15 22" fill="#9bb9a6"/><path d="m53 18 8 8" stroke-width="5"/><path d="M19 30C-1 6 37 5 40 27" stroke="#7d9d8c" stroke-width="6"/><ellipse cx="31" cy="29" rx="15" ry="5" fill="#b8cbb3"/><path d="M55 36v2m5 1v2m-8 4v2" stroke="#79b4be" stroke-width="3"/><path d="M25 38v10" stroke="#d4ddc5"/>`,
 broom:`<path d="m39 5 5 2-15 34-5-2Z" fill="#b77e50"/><path d="m20 34 17 7 3 17q-19 1-31-12Z" fill="#ddba68"/><path d="m18 39 17 7" stroke="#aa7750" stroke-width="5"/><path d="m17 44-4 8m12-5-3 10m11-8-2 10" stroke="#b28c45"/><path d="m47 43 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#f7df9b" stroke="#d5ac59"/>`,
 hand:`<path d="M18 35V17q0-7 6-5l1 18V10q0-7 6-4l1 23V9q1-6 6-3l1 23 1-15q2-6 6-2v25l5-7q4-4 7 1 1 2-2 8L46 54q-4 6-16 5-9-1-12-9L8 36q-3-6 2-7 4-1 8 6Z" fill="#e5b18a"/><path d="M25 39q8-4 16 1m-9-3v11" stroke="#c18c69"/><path d="M5 21Q0 16 5 10m51 4q6 6 2 14M8 7 5 3" stroke="#ba7c55"/><path d="m3 12 2-4 3 3m48 13 3 5 3-4" stroke="#ba7c55"/>`,
 argue:`<path d="M7 58v-9q0-12 14-12 13 0 13 12v9" fill="#607f8c"/><path d="M13 14q2-10 13-7 8 2 8 12l6 5-7 4v7H19q-8-4-6-21Z" fill="#efbb90" stroke="#5e4033" stroke-width="3"/><path d="M12 16q-1-14 13-13 11 0 11 14l-9-6-7 6Z" fill="#563a31"/><path d="m34 11 9-5h16v20H48l-8 9v-9h-3" fill="#fff0a9" stroke="#a94d30" stroke-width="3"/><path d="m48 10-4 8h6l-3 6M28 24h5" stroke="#b5472d" stroke-width="3"/><path d="m29 43 13-9 4 4-10 13" fill="#efbb90" stroke-width="3"/>`,
 serve:`<ellipse cx="32" cy="46" rx="28" ry="8" fill="#d1c49c"/><path d="M9 41q0-25 23-25t23 25Z" fill="#d9b67c"/><ellipse cx="32" cy="41" rx="24" ry="5" fill="#f1d39a"/><path d="M28 15v-3q4-5 8 0v3" fill="#ab8058"/><path d="M18 32q2-8 8-10" stroke="#fae5b9" stroke-width="4"/><path d="M9 52h46" stroke="#b29b70"/>`,
 peanuts:`<path d="M7 35h50q-2 21-25 23Q10 56 7 35Z" fill="#ba7955"/><ellipse cx="32" cy="35" rx="25" ry="8" fill="#e8bc77"/><path d="M17 34q-8-3-6-10t9-3q7-5 10 1t-5 12q-4 5-8 0Zm18-3q-5-5-1-10t10 0q8-2 9 5t-8 8q-7 2-10-3Zm-10-7q-6-2-4-8t8-2q6-4 10 1t-5 9q-5 5-9 0Z" fill="#dcb171"/><path d="m17 23 6 8m-5-3 7-5m13 0 8 8m-7-3 7-4m-18-8 5 5" stroke="#b58b54" stroke-width="1.5"/>`,
 plant:`<path d="M20 40h25l-4 19H24Z" fill="#c78257"/><path d="M17 36h31v7H17Z" fill="#dea06c"/><path d="M33 37V10m-1 18-14-9m15 1 14-9" stroke="#597a4f"/><path d="M18 21Q3 19 8 8q15-1 15 16m23-10q-2-16 12-12 6 13-17 19M32 14Q20 2 31 1q10 2 3 16m-1 18q8-17 19-9-3 12-19 12" fill="#87a46b" stroke="#5e7f52"/>`,
 dust:`<path d="M15 47Q2 45 6 34q-4-11 8-14 3-12 15-8 11-10 18 2 14-1 12 13 9 10 0 17-5 11-17 6-7 8-15 1-7 3-12-4Z" fill="#cfbea0" stroke="#a28b6e"/><path d="M14 36q4-7 11-4m10-11q7-2 10 4m-12 14q8 6 14-1" stroke="#eadfc5"/><circle cx="8" cy="9" r="2" fill="#c2ad8d" stroke="none"/><circle cx="55" cy="54" r="3" fill="#c2ad8d" stroke="none"/><circle cx="57" cy="7" r="2" fill="#c2ad8d" stroke="none"/>`,
 cat:`<path d="M21 46q-15 2-12-10 1-5-3-9" stroke="#bd8b5c" stroke-width="7"/><path d="M19 44q0-16 15-16t15 16v13H19Z" fill="#c99b67"/><path d="m19 13 1-11 13 8L45 3l1 14q9 5 8 15-2 13-21 13T12 32q-1-12 7-19Z" fill="#d7b283"/><path d="m22 8 1 9 6-5m13-2-6 5 7 1" fill="#df9e95" stroke="none"/><path d="M21 26h7m12 0h7" stroke="#514a38"/><path d="m29 33 5 3 4-3" fill="#b87973" stroke="#b87973"/><path d="M34 36v3m0-1q-4 5-7 0m7 0q4 5 7 0M17 33l-10-2m10 6L6 38m43-5 10-2m-10 6 11 1" stroke-width="1.6"/><path d="M28 52v6m12-6v6"/><path d="m26 13 2 4m10-3-2 4" stroke="#ad7f52"/>`,
 tahini:`<path d="M8 34h48q-3 21-24 22Q11 55 8 34Z" fill="#9eac8d"/><ellipse cx="32" cy="34" rx="24" ry="9" fill="#f6e3b1"/><path d="M18 34q10-10 25-2 9 6-7 9-11 2-11-3 2-4 10-2" stroke="#d6b883" stroke-width="2"/><path d="m28 26 4-6 3 6m-2-3 6-2" stroke="#779061" stroke-width="3"/><path d="m14 18 5-3m25 4 5-3" stroke="#e1c97f"/>`,
 carrot:`<path d="M7 35h50q-3 21-25 22Q10 55 7 35Z" fill="#a8b49a"/><ellipse cx="32" cy="35" rx="25" ry="9" fill="#d9944f"/><path d="m15 31 13 7m-7-11 14 10m-1-10 11 10m-29 0 15 7m11-15 9 7m-22-9 13 5" stroke="#f0b36b" stroke-width="3"/><ellipse cx="19" cy="34" rx="3" ry="2" fill="#795640" stroke="none"/><ellipse cx="37" cy="32" rx="3" ry="2" fill="#795640" stroke="none"/><ellipse cx="31" cy="40" rx="3" ry="2" fill="#795640" stroke="none"/><ellipse cx="47" cy="37" rx="3" ry="2" fill="#795640" stroke="none"/>`,
 kubaneh:`<ellipse cx="32" cy="48" rx="28" ry="9" fill="#c8bea0"/><path d="M8 31q0-20 24-21t24 21v12q-2 13-24 13T8 43Z" fill="#b47b45"/><ellipse cx="32" cy="30" rx="24" ry="20" fill="#dcaa62"/><path d="M15 30q-2-12 11-12 13 0 10 13-4 10-14 6-7-5 0-9 6-4 8 2m4-15q16-1 16 12t-12 17m-23-2q12 10 25 2" stroke="#b77d44"/><path d="M17 20q4-4 9-3m16 2 4 5" stroke="#f4cc86" stroke-width="3"/>`,
 eggplant:`<path d="M8 37h48q-3 18-24 20Q12 55 8 37Z" fill="#acb99c"/><ellipse cx="32" cy="37" rx="24" ry="9" fill="#c4a57e"/><path d="m16 35 9-3m4 8 7-5m6 2 7-2" stroke="#937458"/><path d="M15 25q-9-13 7-20 10-1 10 8T15 25Z" fill="#7c657e"/><path d="M23 6q-1-7 6-5m-9 4 8 5" stroke="#788b5f" stroke-width="3"/><path d="m36 29 3-4 3 4m-3-3 5-1" stroke="#739061" stroke-width="2"/>`,
 lasagna:`<path d="m8 28 26-13 22 13v24L30 60 8 48Z" fill="#e0b975"/><path d="m8 28 22 10 26-10M30 38v22"/><path d="m10 35 20 9 24-8m-44 7 20 9 24-8" stroke="#ad6648" stroke-width="4"/><path d="m8 28 26-13 22 13-26 10Z" fill="#ebbd66"/><path d="m18 27 9-5m6 9 9-5m0-5 5 3" stroke="#bd754b" stroke-width="3"/><path d="m27 19 3 5 5-4" stroke="#7b8e58" stroke-width="2"/><path d="M20 9q-4-4 0-7m19 8q-4-4 0-7" stroke="#bba07e"/>`
};

export function iconArtwork(id){
 const aliases={'carrot-salad':'carrot','carrot-raisin':'carrot','eggplant-salad':'eggplant',tahina:'tahini',watering:'water',stop:'hand',meal:'serve'};
 const shape=shapes[aliases[id]||id]||shapes.bowl;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#624f3b" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>`;
}
