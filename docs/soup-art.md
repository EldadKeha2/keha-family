# The Secret Recipe

Grandma Yona’s cooking sprites were generated from her fixed portrait in `public/assets/games/heads/yona.png`, with the existing construction illustration used only as a storybook style reference. The user approved this exact caricature. Preserve her face, natural brown complexion, white patterned headscarf, cream apron and embroidered navy clothing.

`public/assets/games/soup/yona-chef.webp` is one transparent 1881 × 836 image. Its three equal 627 × 836 panels show idle, picking up an ingredient, and throwing it into the pot. The image is a WebP encoding of the complete approved PNG; it has not been cropped, recoloured or redrawn. CSS selects the approved poses, while the selected shelf icon is carried through her hands, held briefly, then lowered into the pot over 2.8 seconds. The source icon is hidden during the transfer. The original third pose is reused for placement and stirring, without altering the approved caricature.

The kitchen, pot, stove, water, bubbles and ingredient icons are code-native artwork. All twelve products sit on wooden shelves. A separate 3.6-second spoon animation provides optional stirring; it never calls the recipe engine or changes ingredients, quantities, water or tasting attempts. No runtime image generation or media database requests are needed.

The one fixed recipe is defined in `public/assets/soup.mjs`: two potatoes, three necks, three carrots and one quarter cup of hawaij, with water that has reached the illustrated boiling state. Any extra ingredient or incorrect quantity fails. Ingredient order does not change the solution. The recipe is withheld from the opening and play screens and revealed after success.

The local puzzle stores state only for the current page session, supports measured corrections and a fresh pot, and preserves an already selected ingredient if navigation interrupts its animation. Heating uses a wall-clock deadline so hiding the tab does not restart the boil.
