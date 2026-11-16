# Family champions and rotating records

The games lobby ends with eight existing shared scoreboards: the four timed quizzes, Catch the Jachnun, Yemeanite Rex, Hashmal Neto Tetris and Ruti's House. Each uses its existing read-only scores endpoint and its own columns; games without saved scores are not offered. No score writes or scoring rules change.

An independently shuffled bag picks the opening board and visits every board before reshuffling, without repeating the board at a cycle boundary. The board changes every twelve seconds while its footer is near the viewport. Hovering or keyboard focus keeps the current board readable. Selecting a game pauses rotation until the visitor resumes it. Leaving the lobby, hiding the tab or scrolling away stops the timer. Cached scores avoid repeated downloads; Refresh explicitly reloads the selected game's scores. Failed and empty tables keep their normal retry/empty messages.

`public/assets/games/yemeni-champion.webp` and `yemeni-champion-woman.webp` are original 1024 x 1536 transparent illustrations generated with the built-in image generation tool and encoded as WebP with their original alpha, without cropping or recoloring. They sit beside the records on wide screens and above them on small screens, after all game categories.

Generation briefs: (1) a cheerful Yemeni Jewish grandfather in a burgundy tarboosh, brown suit and cream shirt, holding a golden trophy with a gold medal on an olive ribbon; (2) a cheerful Yemeni Jewish grandmother in an olive traditional embroidered dress, burgundy headscarf and silver jewelry, holding a golden cup with a medal on a burgundy ribbon. Both use dignified, warm storybook linework and softly painted shading in cream, olive, antique gold, burgundy and brown; complete head-to-toe figures, generous margins, transparent backgrounds, no letters or logos.

The dancing hosts' speech uses an explicit RTL/LTR isolated text element, so the Hebrew exclamation mark stays at the end of the sentence despite the illustration layout's direction.
