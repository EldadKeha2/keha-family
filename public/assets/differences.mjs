export const DIFFERENCE_SECONDS=120;
export const differenceLevels=['easy','medium','hard'];
export function createDifferenceRound(puzzle,level='easy'){
  if(!puzzle?.differences?.[level]||!differenceLevels.includes(level))throw new TypeError('Unknown puzzle or difficulty');
  return {puzzle,level,status:'loading',found:[],mistakes:0,deadline:null,reason:null};
}
export function beginDifferenceRound(round,now=Date.now()){
  if(round.status==='loading'&&Number.isFinite(now)){round.status='playing';round.deadline=now+DIFFERENCE_SECONDS*1000;}
  return round;
}
export function checkDifferenceTime(round,now=Date.now()){
  if(round.status==='playing'&&now>=round.deadline){round.status='lost';round.reason='timeout';}
  return round.status;
}
export function markDifference(round,x,y,now=Date.now()){
  checkDifferenceTime(round,now);
  if(round.status!=='playing'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return {kind:'ignored'};
  const hit=round.puzzle.differences[round.level].find(d=>Math.abs(x-d.x)<=d.w/2+.008&&Math.abs(y-d.y)<=d.h/2+.008);
  if(hit){
    if(round.found.includes(hit.id))return {kind:'ignored'};
    round.found.push(hit.id);
    if(round.found.length===5)round.status='won';
    return {kind:'found',difference:hit};
  }
  round.mistakes++;
  if(round.mistakes>=3){round.status='lost';round.reason='mistakes';}
  return {kind:'miss'};
}
export const differencePuzzles=[
  {
    "id": "family-1",
    "mediaId": "9acc33fefa2842a79813ef7b6837e153",
    "original": "assets/games/differences/original-1.webp",
    "edited": "assets/games/differences/edited-1.webp",
    "width": 1600,
    "height": 1200,
    "tags": [
      "ben",
      "matan-g",
      "ilan",
      "matteo",
      "ariel-n",
      "ariel-f",
      "rivka"
    ],
    "differences": {
      "easy": [
        {
          "id": "easy-1",
          "x": 0.075,
          "y": 0.94,
          "w": 0.11,
          "h": 0.115,
          "label": "סרט על בקבוק",
          "labelEn": "Bottle ribbon"
        },
        {
          "id": "easy-2",
          "x": 0.633,
          "y": 0.84,
          "w": 0.061,
          "h": 0.053,
          "label": "פקק הבקבוק",
          "labelEn": "Bottle cap"
        },
        {
          "id": "easy-3",
          "x": 0.525,
          "y": 0.674,
          "w": 0.042,
          "h": 0.037,
          "label": "סיכה על השמלה",
          "labelEn": "Dress pin"
        },
        {
          "id": "easy-4",
          "x": 0.837,
          "y": 0.942,
          "w": 0.083,
          "h": 0.081,
          "label": "כרטיס על השולחן",
          "labelEn": "Table card"
        },
        {
          "id": "easy-5",
          "x": 0.613,
          "y": 0.228,
          "w": 0.084,
          "h": 0.105,
          "label": "קישוט תלוי",
          "labelEn": "Hanging decoration"
        }
      ],
      "medium": [
        {
          "id": "medium-1",
          "x": 0.387,
          "y": 0.967,
          "w": 0.05,
          "h": 0.047,
          "label": "פלח לימון",
          "labelEn": "Lemon wedge"
        },
        {
          "id": "medium-2",
          "x": 0.743,
          "y": 0.342,
          "w": 0.049,
          "h": 0.067,
          "label": "קישוט עץ",
          "labelEn": "Wall ornament"
        },
        {
          "id": "medium-3",
          "x": 0.236,
          "y": 0.879,
          "w": 0.065,
          "h": 0.043,
          "label": "צבע תווית",
          "labelEn": "Label colour"
        },
        {
          "id": "medium-4",
          "x": 0.332,
          "y": 0.593,
          "w": 0.019,
          "h": 0.025,
          "label": "כפתור בחולצה",
          "labelEn": "Shirt button"
        },
        {
          "id": "medium-5",
          "x": 0.935,
          "y": 0.928,
          "w": 0.045,
          "h": 0.075,
          "label": "דובדבן",
          "labelEn": "Cherry"
        }
      ],
      "hard": [
        {
          "id": "hard-1",
          "x": 0.157,
          "y": 0.155,
          "w": 0.018,
          "h": 0.016,
          "label": "נורת התקרה",
          "labelEn": "Ceiling light"
        },
        {
          "id": "hard-2",
          "x": 0.46,
          "y": 0.107,
          "w": 0.015,
          "h": 0.022,
          "label": "בורג בקורה",
          "labelEn": "Beam bolt"
        },
        {
          "id": "hard-3",
          "x": 0.794,
          "y": 0.312,
          "w": 0.02,
          "h": 0.027,
          "label": "כוכב קטן",
          "labelEn": "Tiny star"
        },
        {
          "id": "hard-4",
          "x": 0.057,
          "y": 0.753,
          "w": 0.012,
          "h": 0.018,
          "label": "תפר בחולצה",
          "labelEn": "Shirt stitch"
        },
        {
          "id": "hard-5",
          "x": 0.844,
          "y": 0.741,
          "w": 0.012,
          "h": 0.017,
          "label": "תפר בשמלה",
          "labelEn": "Dress stitch"
        }
      ]
    }
  },
  {
    "id": "family-2",
    "mediaId": "6b54b581220b46fb80161a835ff964aa",
    "original": "assets/games/differences/original-2.webp",
    "edited": "assets/games/differences/edited-2.webp",
    "width": 1050,
    "height": 1400,
    "tags": [
      "shani",
      "maya",
      "yuli",
      "avigail",
      "tal"
    ],
    "differences": {
      "easy": [
        {
          "id": "easy-1",
          "x": 0.707,
          "y": 0.089,
          "w": 0.04,
          "h": 0.03,
          "label": "כוכב בכרזה",
          "labelEn": "Poster star"
        },
        {
          "id": "easy-2",
          "x": 0.934,
          "y": 0.722,
          "w": 0.042,
          "h": 0.026,
          "label": "דוגמה במכנסיים",
          "labelEn": "Trouser pattern"
        },
        {
          "id": "easy-3",
          "x": 0.513,
          "y": 0.59,
          "w": 0.06,
          "h": 0.035,
          "label": "סיכה על החולצה",
          "labelEn": "Top pin"
        },
        {
          "id": "easy-4",
          "x": 0.142,
          "y": 0.492,
          "w": 0.037,
          "h": 0.031,
          "label": "פרח על הבגד",
          "labelEn": "Flower pin"
        },
        {
          "id": "easy-5",
          "x": 0.81,
          "y": 0.958,
          "w": 0.041,
          "h": 0.033,
          "label": "לב על הכיסא",
          "labelEn": "Chair heart"
        }
      ],
      "medium": [
        {
          "id": "medium-1",
          "x": 0.364,
          "y": 0.016,
          "w": 0.034,
          "h": 0.03,
          "label": "סמל בכרזה",
          "labelEn": "Poster symbol"
        },
        {
          "id": "medium-2",
          "x": 0.66,
          "y": 0.638,
          "w": 0.031,
          "h": 0.04,
          "label": "לולאת החגורה",
          "labelEn": "Belt loop"
        },
        {
          "id": "medium-3",
          "x": 0.147,
          "y": 0.694,
          "w": 0.03,
          "h": 0.028,
          "label": "רקמה בג׳ינס",
          "labelEn": "Jeans embroidery"
        },
        {
          "id": "medium-4",
          "x": 0.859,
          "y": 0.478,
          "w": 0.031,
          "h": 0.018,
          "label": "תג קטן",
          "labelEn": "Small badge"
        },
        {
          "id": "medium-5",
          "x": 0.274,
          "y": 0.685,
          "w": 0.025,
          "h": 0.019,
          "label": "כפתור במכנסיים",
          "labelEn": "Trouser button"
        }
      ],
      "hard": [
        {
          "id": "hard-1",
          "x": 0.114,
          "y": 0.16,
          "w": 0.012,
          "h": 0.012,
          "label": "מסמר בקיר",
          "labelEn": "Wall nail"
        },
        {
          "id": "hard-2",
          "x": 0.447,
          "y": 0.226,
          "w": 0.016,
          "h": 0.017,
          "label": "כוכב על העץ",
          "labelEn": "Wooden-panel star"
        },
        {
          "id": "hard-3",
          "x": 0.109,
          "y": 0.781,
          "w": 0.017,
          "h": 0.012,
          "label": "חרוז בצמיד",
          "labelEn": "Bracelet bead"
        },
        {
          "id": "hard-4",
          "x": 0.866,
          "y": 0.835,
          "w": 0.016,
          "h": 0.014,
          "label": "נקודה קטנה",
          "labelEn": "Tiny dot"
        },
        {
          "id": "hard-5",
          "x": 0.61,
          "y": 0.066,
          "w": 0.012,
          "h": 0.011,
          "label": "סימן בכרזה",
          "labelEn": "Poster detail"
        }
      ]
    }
  },
  {
    "id": "family-3",
    "mediaId": "2dc2fc927aaf47d7ba2cd72e39b03a49",
    "original": "assets/games/differences/original-3.webp",
    "edited": "assets/games/differences/edited-3.webp",
    "width": 1600,
    "height": 1200,
    "tags": [
      "tammy",
      "matteo",
      "ariel-n",
      "elinor",
      "orit"
    ],
    "differences": {
      "easy": [
        {
          "id": "easy-1",
          "x": 0.204,
          "y": 0.7,
          "w": 0.025,
          "h": 0.037,
          "label": "סמל על החולצה",
          "labelEn": "Polo emblem"
        },
        {
          "id": "easy-2",
          "x": 0.583,
          "y": 0.82,
          "w": 0.037,
          "h": 0.044,
          "label": "פרח בדוגמה",
          "labelEn": "Pattern flower"
        },
        {
          "id": "easy-3",
          "x": 0.53,
          "y": 0.683,
          "w": 0.123,
          "h": 0.113,
          "label": "צבע האביזר",
          "labelEn": "Prop colour"
        },
        {
          "id": "easy-4",
          "x": 0.966,
          "y": 0.675,
          "w": 0.038,
          "h": 0.04,
          "label": "סיכה ירוקה",
          "labelEn": "Green pin"
        },
        {
          "id": "easy-5",
          "x": 0.568,
          "y": 0.178,
          "w": 0.015,
          "h": 0.024,
          "label": "סמל במכונית",
          "labelEn": "Car decal"
        }
      ],
      "medium": [
        {
          "id": "medium-1",
          "x": 0.045,
          "y": 0.374,
          "w": 0.027,
          "h": 0.03,
          "label": "שלט עגול",
          "labelEn": "Round sign"
        },
        {
          "id": "medium-2",
          "x": 0.451,
          "y": 0.94,
          "w": 0.022,
          "h": 0.025,
          "label": "סיכה בתיק",
          "labelEn": "Bag pin"
        },
        {
          "id": "medium-3",
          "x": 0.795,
          "y": 0.794,
          "w": 0.028,
          "h": 0.035,
          "label": "רקמה במכנסיים",
          "labelEn": "Shorts embroidery"
        },
        {
          "id": "medium-4",
          "x": 0.918,
          "y": 0.455,
          "w": 0.068,
          "h": 0.04,
          "label": "אבזם התיק",
          "labelEn": "Bag buckle"
        },
        {
          "id": "medium-5",
          "x": 0.367,
          "y": 0.642,
          "w": 0.018,
          "h": 0.02,
          "label": "חרוז בשרשרת",
          "labelEn": "Necklace bead"
        }
      ],
      "hard": [
        {
          "id": "hard-1",
          "x": 0.206,
          "y": 0.075,
          "w": 0.028,
          "h": 0.014,
          "label": "ציפור בשמיים",
          "labelEn": "Sky bird"
        },
        {
          "id": "hard-2",
          "x": 0.377,
          "y": 0.196,
          "w": 0.017,
          "h": 0.021,
          "label": "סימון בתחנה",
          "labelEn": "Stop detail"
        },
        {
          "id": "hard-3",
          "x": 0.472,
          "y": 0.062,
          "w": 0.018,
          "h": 0.019,
          "label": "פרח על העץ",
          "labelEn": "Tree blossom"
        },
        {
          "id": "hard-4",
          "x": 0.074,
          "y": 0.611,
          "w": 0.018,
          "h": 0.018,
          "label": "כפתור נוסף",
          "labelEn": "Extra button"
        },
        {
          "id": "hard-5",
          "x": 0.895,
          "y": 0.94,
          "w": 0.023,
          "h": 0.027,
          "label": "כוכב בתיק",
          "labelEn": "Bag star"
        }
      ]
    }
  },
  {
    "id": "family-4",
    "mediaId": "c01f8eb0bd724442929b3be8e1dd049d",
    "original": "assets/games/differences/original-4.webp",
    "edited": "assets/games/differences/edited-4.webp",
    "width": 1600,
    "height": 1200,
    "tags": [
      "noga",
      "naomi",
      "yehiel",
      "rachel-katan",
      "bosmat",
      "itzik"
    ],
    "differences": {
      "easy": [
        {
          "id": "easy-1",
          "x": 0.516,
          "y": 0.264,
          "w": 0.05,
          "h": 0.072,
          "label": "פנס נייר",
          "labelEn": "Paper lantern"
        },
        {
          "id": "easy-2",
          "x": 0.575,
          "y": 0.606,
          "w": 0.025,
          "h": 0.026,
          "label": "פקק הבקבוק",
          "labelEn": "Bottle cap"
        },
        {
          "id": "easy-3",
          "x": 0.521,
          "y": 0.753,
          "w": 0.036,
          "h": 0.04,
          "label": "צבע הכוס",
          "labelEn": "Cup colour"
        },
        {
          "id": "easy-4",
          "x": 0.675,
          "y": 0.803,
          "w": 0.043,
          "h": 0.037,
          "label": "טבעת פלפל",
          "labelEn": "Pepper ring"
        },
        {
          "id": "easy-5",
          "x": 0.41,
          "y": 0.889,
          "w": 0.03,
          "h": 0.033,
          "label": "תות בצלחת",
          "labelEn": "Plate strawberry"
        }
      ],
      "medium": [
        {
          "id": "medium-1",
          "x": 0.313,
          "y": 0.199,
          "w": 0.04,
          "h": 0.034,
          "label": "חוליה בשרשרת",
          "labelEn": "Paper-chain link"
        },
        {
          "id": "medium-2",
          "x": 0.51,
          "y": 0.64,
          "w": 0.047,
          "h": 0.055,
          "label": "סרט על האגרטל",
          "labelEn": "Vase ribbon"
        },
        {
          "id": "medium-3",
          "x": 0.924,
          "y": 0.469,
          "w": 0.021,
          "h": 0.033,
          "label": "כוכב בקישוט",
          "labelEn": "Decoration star"
        },
        {
          "id": "medium-4",
          "x": 0.352,
          "y": 0.912,
          "w": 0.056,
          "h": 0.021,
          "label": "ידית הסכין",
          "labelEn": "Knife handle"
        },
        {
          "id": "medium-5",
          "x": 0.56,
          "y": 0.935,
          "w": 0.041,
          "h": 0.049,
          "label": "רקמה במפית",
          "labelEn": "Napkin embroidery"
        }
      ],
      "hard": [
        {
          "id": "hard-1",
          "x": 0.65,
          "y": 0.048,
          "w": 0.022,
          "h": 0.015,
          "label": "פס בפנס",
          "labelEn": "Lantern stripe"
        },
        {
          "id": "hard-2",
          "x": 0.397,
          "y": 0.348,
          "w": 0.045,
          "h": 0.055,
          "label": "כנף טחנת רוח",
          "labelEn": "Windmill blade"
        },
        {
          "id": "hard-3",
          "x": 0.222,
          "y": 0.778,
          "w": 0.017,
          "h": 0.017,
          "label": "פרח בכיסא",
          "labelEn": "Chair flower"
        },
        {
          "id": "hard-4",
          "x": 0.606,
          "y": 0.832,
          "w": 0.013,
          "h": 0.014,
          "label": "נקודה בכף",
          "labelEn": "Spoon dot"
        },
        {
          "id": "hard-5",
          "x": 0.445,
          "y": 0.685,
          "w": 0.015,
          "h": 0.017,
          "label": "סימן בקערה",
          "labelEn": "Bowl mark"
        }
      ]
    }
  },
  {
    "id": "family-5",
    "mediaId": "43079f909f4f43d893b3e97912bbdd4b",
    "original": "assets/games/differences/original-5.webp",
    "edited": "assets/games/differences/edited-5.webp",
    "width": 1050,
    "height": 1400,
    "tags": [
      "yarden",
      "raya",
      "tammy",
      "matan-g",
      "matteo"
    ],
    "differences": {
      "easy": [
        {
          "id": "easy-1",
          "x": 0.76,
          "y": 0.519,
          "w": 0.082,
          "h": 0.125,
          "label": "צבע הבקבוק",
          "labelEn": "Bottle colour"
        },
        {
          "id": "easy-2",
          "x": 0.437,
          "y": 0.527,
          "w": 0.023,
          "h": 0.036,
          "label": "דובדבן במשקה",
          "labelEn": "Drink cherry"
        },
        {
          "id": "easy-3",
          "x": 0.602,
          "y": 0.871,
          "w": 0.046,
          "h": 0.035,
          "label": "פרח בעלים",
          "labelEn": "Leafy-centrepiece flower"
        },
        {
          "id": "easy-4",
          "x": 0.644,
          "y": 0.736,
          "w": 0.031,
          "h": 0.022,
          "label": "זית בצלחת",
          "labelEn": "Plate olive"
        },
        {
          "id": "easy-5",
          "x": 0.82,
          "y": 0.25,
          "w": 0.068,
          "h": 0.068,
          "label": "שעון על הקיר",
          "labelEn": "Wall clock"
        }
      ],
      "medium": [
        {
          "id": "medium-1",
          "x": 0.791,
          "y": 0.611,
          "w": 0.036,
          "h": 0.027,
          "label": "רצועת שעון",
          "labelEn": "Watch strap"
        },
        {
          "id": "medium-2",
          "x": 0.278,
          "y": 0.784,
          "w": 0.031,
          "h": 0.027,
          "label": "לב על התיק",
          "labelEn": "Handbag heart"
        },
        {
          "id": "medium-3",
          "x": 0.809,
          "y": 0.742,
          "w": 0.077,
          "h": 0.043,
          "label": "פס במפית",
          "labelEn": "Napkin stripe"
        },
        {
          "id": "medium-4",
          "x": 0.213,
          "y": 0.212,
          "w": 0.048,
          "h": 0.048,
          "label": "דגל על הקורה",
          "labelEn": "Beam flag"
        },
        {
          "id": "medium-5",
          "x": 0.108,
          "y": 0.841,
          "w": 0.1,
          "h": 0.034,
          "label": "פס בכוס",
          "labelEn": "Glass stripe"
        }
      ],
      "hard": [
        {
          "id": "hard-1",
          "x": 0.596,
          "y": 0.178,
          "w": 0.018,
          "h": 0.014,
          "label": "אור בשרשרת",
          "labelEn": "String light"
        },
        {
          "id": "hard-2",
          "x": 0.346,
          "y": 0.17,
          "w": 0.016,
          "h": 0.014,
          "label": "בורג בתקרה",
          "labelEn": "Ceiling bolt"
        },
        {
          "id": "hard-3",
          "x": 0.392,
          "y": 0.986,
          "w": 0.021,
          "h": 0.02,
          "label": "לב על הנר",
          "labelEn": "Candle heart"
        },
        {
          "id": "hard-4",
          "x": 0.707,
          "y": 0.809,
          "w": 0.055,
          "h": 0.012,
          "label": "סימון בנר",
          "labelEn": "Candle detail"
        },
        {
          "id": "hard-5",
          "x": 0.428,
          "y": 0.824,
          "w": 0.025,
          "h": 0.02,
          "label": "פרח במפית",
          "labelEn": "Napkin flower"
        }
      ]
    }
  }
];
