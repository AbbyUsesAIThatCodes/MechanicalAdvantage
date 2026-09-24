# Third-party notices

## VEX IQ part geometry

The beam, upright, angle beam, corner connector, offset connector, pin, gears, shaft, collar, and standoff meshes originate from VEX Robotics CAD files supplied in the teacher's existing curriculum repository. See `docs/cad-provenance.json` for exact paths and Git blob hashes. The app converts coordinates and packs the existing triangles; it does not claim authorship or an open-source license over VEX's geometry. VEX and VEX IQ are trademarks of their respective owner. This independent classroom prototype is not affiliated with or endorsed by VEX Robotics.

The teacher-provided curriculum packets are reference material only and are not redistributed in this repository. Assembly transforms, scene, game rules, and lesson text are new work. The part geometry is not a claim of certified assembly accuracy. See docs/MILLIMETER-LAB.md for this ideal model's assumptions. The retained renderer support code and assets are derived from LeverWorkshop commit 6031c3b90adb28f12aa722f496c836f6d8574545; the active lever uses custom procedural geometry.

## three.js

Version 0.180.0, MIT license. Copyright © 2010–2025 three.js authors.
The full MIT license is included in `public/licenses/three-LICENSE.txt` and the deployed site.

## Comic Neue

Bundled as a fallback when Comic Sans is not installed. Comic Neue is distributed under the SIL Open Font License 1.1. The original copyright and full license are included in `public/licenses/comic-neue-LICENSE.txt` and the deployed site.

Comic Sans is referenced as a system font and is not redistributed.

## Development dependencies

esbuild and Playwright are development tools installed through npm. They are not runtime CDN dependencies. Their package licenses are retained in the installed packages.
