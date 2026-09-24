# Mechanical Advantage — Millimeter Lab

This standalone game opens at the root of the MechanicalAdvantage site. It was moved from the unmerged LeverWorkshop PR #5 at the user’s request. LeverWorkshop remains a separate repository and application.

## Classroom use

- Two named masses (A/B), 25–1,000 g in 25 g steps. Their size changes with mass.
- Each carriage slides 50–300 mm from a fixed central fulcrum, in 25 mm steps.
- Drag the object or label; select to retain green arrows. Horizontal arrows move across the screen, including from behind. Drag the vertical handle to resize, or use plus/minus, sliders, number boxes and keyboard alternatives.
- Begin with equal arms. Double A's distance, predict, then halve its mass. It balances again. The 2× and 3× presets give other balanced starting arrangements, without lesson gates or scores.
- The 3D workbench fills the viewport. Camera, balance, hold and reset controls sit at the top. Math floats in a scrollable tray; changing its text, switching tabs or hiding it leaves the render size and framing unchanged. On compact screens, **Weights** opens the mass/distance tray.
- Mass/distance labels and translucent green controls sit above the apparatus with leader lines. They remain readable from both sides without text sprites clipping through the masses.
- Hide math for predictions. Reveal **Balance & advantage** for live distance ratio, mass-distance products, and required effort mass. **Grams → newtons** shows every conversion and the resulting SI turning effects.
- Choose which side represents effort. A and B remain attached to the same physical parts.
- Focus, hover or tap dotted math terms for concise explanations. Fraction bars explain division; units and operators have definitions.

## Deliberate idealization

The original workshop remains the approximate real-kit model. This companion counts only its two labeled masses. Its beam and hangers are massless and its centered axle has zero static friction. The full model uses gravity 9.81 N/kg and torque `(massA_g * distanceA_mm - massB_g * distanceB_mm) * 9.81 / 1e6 * cos(angle)` in N·m. Exact integer products determine balance, avoiding floating-point drift at balance.

Distance labels measure along the rail from the axle to the hanger. At tilt, both perpendicular moment arms are multiplied by cos(angle), so equilibrium and IMA are unchanged. Displayed turning effects are evaluated at level. IMA = effort arm / load arm; the load/effort force ratio only equals IMA when balanced. Required masses outside the range or 25 g steps are identified explicitly. Decimal results are rounded for display, not for calculation.

The original Three.js room, materials setup, lighting and orbit controls are reused. The companion has a custom slotted rail, sliding clamps, bored bearings, axle, hanging masses and restrained brass fittings. It is not a VEX CAD replica or a verified classroom kit. Hangers counter-rotate to stay vertical. Motion has visual damping and a ±12° display travel limit; it is not a prediction of real settling time.

Saved state has its own browser-storage key. All runtime assets are local; no student data or external service is used. Without WebGL, the same calculations and side controls work with a diagram. The diagram does not support object dragging or camera controls.

## Verification (2026-09-24)

- `npm test`: 17 tests passed, including all 193,600 legal metric mass/distance combinations, SI units, role reversal, exact balance, animation limits and invalid input.
- Geometry checks: axle ray passes through the beam's real bore; hangers stay vertical; minimum/maximum masses and positions clear the center support and desk at either travel stop.
- Before migration, `npm run build` passed for the companion. The standalone build is verified separately in the MechanicalAdvantage pull request.
- Interactive cloud browser: fallback UI verified at 1366×768 and 390×844; checked 2:1 balancing, 3:1 conversions, role changes, held/released status, math hide/show, input limits and responsive layout.
- The interactive cloud browser disables WebGL. GitHub Actions run 35944628135 passed the original workshop regression suite and the new software-WebGL 3D checks: startup, object-label dragging, vertical mass resizing, keyboard, reverse-camera movement, math toggle, newton conversions and mobile width. Its captured 3D screenshots were downloaded and visually reviewed. That review prompted a phone document-scroll fix and separation for nearby floating labels; subsequent CI results belong to the PR checks.
- No physical classroom validation or student trial has been performed.

The immersive-layout update is delivered as a separate review PR.
