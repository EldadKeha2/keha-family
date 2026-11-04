# Share icon sources

The website bundles vector brand artwork locally in `public/assets/share-icons.svg`.

- WhatsApp, Facebook, Messenger and Instagram brand paths: [Simple Icons](https://github.com/simple-icons/simple-icons/tree/develop/icons), a CC0 icon project.
- Gmail color artwork: [gilbarbara/logos](https://github.com/gilbarbara/logos/blob/main/logos/google-gmail.svg).
- Copy link: a simple site-owned outline symbol.

The brand marks use their original geometry. Colors are set in the SVG sprite, and the UI preserves their aspect ratios with 44-pixel touch targets.

Instagram photo sharing uses the [Web Share API](https://www.w3.org/TR/web-share/). A file is prepared only after the visitor clicks Instagram, then shared through the device chooser. If native file sharing is unavailable, the UI offers a photo download, the Instagram website, and a copied gallery link. It never publishes a post automatically.
