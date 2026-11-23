# Talking Cards

A phone/tablet web app for **Wembley Talking Flash Cards** when the physical reader is lost:

- **📷 Scan a card**: point the camera at a card and the app says the word, like the original reader.
- **🎴 Flash cards**: flip through all cards by category, tap to hear the word, or let it auto-play.
- **🎮 Find it!**: hear a word, then tap the matching picture (3, 4 or 6 choices). Earns stars.
- **⚙️ Grown-ups** (press and hold): teach the reader a card it doesn't know, see all cards, pick the voice, export/import.

Live: https://marshmellow-labs.github.io/talking-card/

## How the reader works

Each card has a black-and-white strip along its bottom edge. It is an **8-bit number**: after a white
lead-in, eight cells are either black (1) or white (0). The numbers run in category order (family 33–40,
shapes 45–52, animals 63–88, …, fruits 203–216). `src/detect.js`:

1. finds the strip: the lowest band with bright paper *and* true-black bars, near where the on-screen guide puts the card's bottom edge;
2. fits the card's left/right edges by searching around the guide position, scoring how cleanly the eight cells come out black or white, that the lead-in is white, and that the card ends at the fitted edges;
3. decodes the eight cells; a read is *confident* only if every cell is clear and the number belongs to a known card;
4. retries the image upside down.

The camera reads ~5 frames per second, and a word is spoken only after 3 frames agree.

Codes for 91 of the 94 cards are in `cards.json`. Colosseum, Eggplant and Fridge had glare in the
reference photos: teach them once under **Grown-ups → Teach the reader a card**.

## Development

No build step: plain ES modules, served as static files.

```sh
npm install          # test-only dependencies (JPEG/PNG decoding in Node)
npm test             # unit tests: strip fixtures, synthetic cards, game logic
npm run serve        # http://localhost:8000 (the camera works on localhost or https)
```

`ref-images/` (the full reference photos) is git-ignored. When it exists locally, `npm test` also runs
an accuracy check over every card in those photos (`npm run eval` prints the details). The tools in
`tools/` extract cards from those photos (`extract-cards.mjs`), assign codes (`assign-codes.mjs`) and
write the small committed strip fixtures (`make-fixtures.mjs`).

Card pictures are [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0), bundled into
`assets/emoji.svg` by `npm run sprite`.

## Hosting

Static files: GitHub Pages serves the `main` branch root. The service worker caches the app for
offline use and refreshes files in the background, so updates appear on the next launch.
