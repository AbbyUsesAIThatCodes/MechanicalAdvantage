# Mechanical Advantage

A standalone classroom lever game: move gram masses along a millimeter scale and see mechanical advantage change in real time.

This is the independent home of **Millimeter Lab**, originally developed in an unmerged LeverWorkshop PR. [Lever Workshop](https://github.com/AbbyUsesAIThatCodes/LeverWorkshop) remains its own game and repository.

## Explore

- Drag either hanging weight, use the green arrows, or enter exact mass and distance values.
- Change masses from 25–1,000 g and distances from 50–300 mm, in steps of 25.
- Try equal arms, 2× distance and 3× distance. Double the distance and halve the mass to retain balance.
- Reveal or hide the live math panel. Compare arm lengths and turning effects, or trace grams → kilograms → newtons and millimeters → meters → N·m.
- Hover, focus or tap underlined units and operations for short explanations.
- Orbit the familiar desk, hold the lever level, and release it to test a prediction.

The model is explicitly ideal: only the two labeled masses count, and the fixed central axle has no static friction. This keeps simple ratios exact. It is not a calibrated VEX simulation. See the [teacher guide and verification history](docs/MILLIMETER-LAB.md).

## Run locally

Node.js 22 or later:

```sh
npm ci
npm run build
npm run dev
```

Open <http://localhost:4173/MechanicalAdvantage/> or <http://localhost:4173/>. The game is at the site root; there is no separate `metric/` route. Serve `dist/` over HTTP, rather than opening the HTML through `file://`.

```sh
npm test
npx playwright install chromium
npm run test:browser
```

For software WebGL in headless Linux, set `BROWSER_SOFTWARE_GL=1`. `CHROMIUM_EXECUTABLE` can select an existing Chromium executable.

## Review and publishing

The initial implementation is delivered in a pull request. The included GitHub Pages workflow builds `dist/` after a merge to `main`; GitHub Pages must be configured to use GitHub Actions before the first deployment. This README does not claim that the site is already live.

Everything is served from the site: JavaScript, fonts and meshes. There are no accounts, analytics or external runtime requests. Settings stay in this browser under a MechanicalAdvantage-specific storage key. Without WebGL, a diagram and the numeric controls remain available.

The room, lighting and renderer support code were copied from LeverWorkshop commit `6031c3b90adb28f12aa722f496c836f6d8574545`, rather than linked to its repository or deployment. Future changes here are independent. See [third-party notices](THIRD_PARTY_NOTICES.md).
