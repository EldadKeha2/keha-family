# Illustrated search game artwork

Five original images generated with the built-in image tool for the family website. Identity references were the family-tree screenshots supplied in the conversation. Original generated PNGs were retained, with WebP copies in `public/assets/games/chick/` for the website. No site profile photographs were exported.

## Final prompt set

Shared direction: create an original 3:2, densely detailed picture-book search illustration with about 100–130 small cartoon people, clear ink lines, rich hand-painted colors on warm cream paper, and visual distractors across the whole frame. Include exactly one affectionate caricature of the named family member, based on the user-supplied family-tree reference. Keep the target unmarked, visible, and rendered as part of the crowd. No text, labels, locator rings, arrows, insets, watermark, or game interface. Other crowd characters are invented.

### shlomo-market

- File: `public/assets/games/chick/shlomo-market.webp`
- Family member: Shlomo Keha (שלמה קהא).
- Scene: a lively old Jerusalem outdoor market, Yemenite embroidered textiles, fruit stalls, brass coffee pots, families, cats, baskets, musicians and shoppers.
- Identity direction: the grandfather in the user-supplied family tree reference, vintage dark wavy hair, long face, prominent nose, white shirt and dark jacket.
- Requested approximate placement: 72% across from the left and 42% down from the top.

### rachel-seaside

- File: `public/assets/games/chick/rachel-seaside.webp`
- Family member: Rachel Katan (רחל קטן).
- Scene: a crowded Mediterranean seaside promenade and beach picnic, umbrellas, bicycles, ice cream stands, sandcastles, beach balls and extended families.
- Identity direction: the smiling older woman labeled רחל קטן in the user-supplied full family tree reference, white sunhat, short gray hair, white cardigan.
- Requested approximate placement: 26% across from the left and 67% down from the top.

### ruti-garden

- File: `public/assets/games/chick/ruti-garden.webp`
- Family member: Ruth Harizi (רותי חריזי).
- Scene: a busy family garden celebration with a long picnic table, colorful bunting, children playing, many guests, musicians, cakes, potted plants, bowls and garden ornaments.
- Identity direction: the older woman labeled רותי חריזי in the user-supplied full family tree reference, dark curly bob hairstyle, eyeglasses, dark top.
- Requested approximate placement: 56% across from the left and 74% down from the top.

### avigail-station

- File: `public/assets/games/chick/avigail-station.webp`
- Family member: Avigail Noble (אביגיל נובל).
- Scene: a bustling vintage railway station family reunion, suitcases, flower sellers, toy stalls, a train, ticket windows, pigeons, luggage carts and many waiting families.
- Identity direction: the woman labeled אביגיל נובל in the user-supplied full family tree reference, voluminous curly light brown hair, warm expressive smile, glasses.
- Requested approximate placement: 37% across from the left and 37% down from the top.

### ora-festival

- File: `public/assets/games/chick/ora-festival.webp`
- Family member: Ora Fish (אורה פיש).
- Scene: a joyful crowded Yemenite heritage street festival with embroidered costumes, colorful patterned awnings, dancing, food stalls, brass instruments, pottery, children, plants and hanging ornaments.
- Identity direction: the woman labeled אורה פיש in the user-supplied full family tree reference, short dark curly hair, eyeglasses, warm smile.
- Requested approximate placement: 80% across from the left and 70% down from the top.

The final targets were visually checked against each generated image. Actual normalized bounding boxes are recorded in `public/assets/chick.mjs`; game coordinates and the displayed target crop both use those boxes. Dimensions: 1536 × 1024 for each scene.

