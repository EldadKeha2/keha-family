// Additional family visitors. Stable IDs also select the matching face and full body.
export const EXTRA_FAMILY_GUESTS=Object.freeze([
  {
    "id": "eldad",
    "he": "אלדד קהא",
    "en": "Eldad Keha",
    "atlas": "a",
    "column": 0,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.949219,
      0.910156
    ],
    "bodySpan": 0.8945310000000001
  },
  {
    "id": "avigail",
    "he": "אביגיל נובל",
    "en": "Avigail Noble",
    "atlas": "a",
    "column": 1,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.951172,
      0.908203
    ],
    "bodySpan": 0.894531
  },
  {
    "id": "eddie",
    "he": "אדי פיש",
    "en": "Adi Fish",
    "atlas": "a",
    "column": 2,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.949219,
      0.910156
    ],
    "bodySpan": 0.896485
  },
  {
    "id": "yarden",
    "he": "ירדן גנדלמן",
    "en": "Yarden Gandelman",
    "atlas": "a",
    "column": 3,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.951172,
      0.908203
    ],
    "bodySpan": 0.886719
  },
  {
    "id": "raya",
    "he": "רעיה בלום",
    "en": "Raia Bloom",
    "atlas": "b",
    "column": 0,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.984375,
      0.988281
    ],
    "bodySpan": 0.957031
  },
  {
    "id": "elinor",
    "he": "אלינור נובל",
    "en": "Elinor Noble",
    "atlas": "b",
    "column": 1,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.984375,
      0.984375
    ],
    "bodySpan": 0.953125
  },
  {
    "id": "ora",
    "he": "אורה פיש",
    "en": "Ora Fish",
    "atlas": "b",
    "column": 2,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.986328,
      0.986328
    ],
    "bodySpan": 0.9609369999999999
  },
  {
    "id": "ariel-n",
    "he": "אריאל נובל",
    "en": "Ariele Noble",
    "atlas": "b",
    "column": 3,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.980469,
      0.988281
    ],
    "bodySpan": 0.951172
  },
  {
    "id": "tomer",
    "he": "תומר פיש",
    "en": "Tomer Fish",
    "atlas": "c",
    "column": 0,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.951172,
      0.927734
    ],
    "bodySpan": 0.886719
  },
  {
    "id": "amir",
    "he": "אמיר פיש",
    "en": "Amir Fish",
    "atlas": "c",
    "column": 1,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.951172,
      0.927734
    ],
    "bodySpan": 0.892578
  },
  {
    "id": "orit",
    "he": "אורית בלום",
    "en": "Oritt Bloom",
    "atlas": "c",
    "column": 2,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.953125,
      0.929688
    ],
    "bodySpan": 0.873047
  },
  {
    "id": "ariel-f",
    "he": "אריאל פיש",
    "en": "Ariel Fish",
    "atlas": "c",
    "column": 3,
    "center": 0.5,
    "foot": 0.96,
    "footByRow": [
      0.953125,
      0.927734
    ],
    "bodySpan": 0.892578
  }
].map(Object.freeze));
export const GUEST_ART=Object.freeze(Object.fromEntries(EXTRA_FAMILY_GUESTS.map(person=>[person.id,person])));
