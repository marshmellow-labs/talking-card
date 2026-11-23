# Talking Cards PWA

## Host on GitHub Pages
1. Create a public GitHub repository.
2. Upload the contents of this folder to the repository root (including `index.html`, `app.js`, `cards.json`, manifest, service worker, and icons).
3. Open repository **Settings → Pages**; set **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Open `https://YOUR-USERNAME.github.io/YOUR-REPO/` once Pages deploys. The HTTPS URL permits camera requests.

## Host on Vercel
Import the repository in Vercel as a static site (framework preset: Other; no build command). Deploy. The provided HTTPS URL works with camera permissions.

## Local testing with camera
Run `python -m http.server 8000` from this directory, then visit `http://localhost:8000` on the same computer. On a phone, use HTTPS hosting: accessing your computer over its LAN IP with HTTP generally does not meet secure-context requirements.

## Sharing trained patterns
Train patterns using the app. Export `shared-patterns.json` from the Data tab and commit it to the same site folder. Other users will receive those starter patterns when they open the hosted site. Their own additional patterns remain local unless exported. No photos are transmitted to a server.

## Limitations
This is an optical pattern matcher, not a proven manufacturer-code decoder. Auto-detection expects one upright card with the strip near the bottom and may need adjustment. Distinctive pattern samples are needed for reliable identification. For similar stripe patterns, the app deliberately says Unknown instead of guessing. For robust detection, capture 2–3 examples per card under different lighting and verify against a separate photo.
