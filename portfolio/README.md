# Portfolio site

A standalone, responsive portfolio page for presenting the Local AI Control Center and the AI-assisted development process. The page uses plain HTML, CSS, and JavaScript with no build step or external runtime dependencies.

## Preview locally

Open a terminal in `frontend/` and run:

```powershell
npm exec vite -- .. --host 127.0.0.1 --port 8080
```

Then open <http://127.0.0.1:8080/portfolio/>. Keep the terminal open while viewing the site. The Vite server serves the repository root so the page can load images from the sibling `screenshots/` directory.

## Deploy on Netlify

The repository-root `netlify.toml` runs `node netlify-build.mjs` and publishes only `portfolio-dist/`. The build copies the portfolio files and the three images from `screenshots/` into that publish directory, so the backend and application source are not part of the deployed site. Connect this repository to Netlify and use the detected configuration; no separate build settings are needed.

## Files

- `index.html` — page content and metadata
- `styles.css` — responsive visual design, states, and reduced-motion support
- `script.js` — language switch, screenshot gallery, and mobile navigation

The gallery reads `dashboard.png`, `playground-1.png`, and `playground-2.png` from the repository-level `screenshots/` directory. The Netlify build includes the current versions automatically.
