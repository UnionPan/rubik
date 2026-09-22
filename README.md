# Rubik.Group

An interactive Rubik's Cube (2×2 to 5×5) for learning the group theory and graph theory behind it.
Turn the 3D cube and watch the same move animate in lockstep on a colored graph of its facelets, trace the permutation it builds, and let the pattern detector and solver guide you to a solve.

## Features

- **3D cube, 2×2 to 5×5.** Turn layers with the buttons, the keyboard, notation, or by dragging a sticker.
- **Facelet graph.** Every facelet is a vertex; a layer turn is a rigid rotation of a sphere, so facelets travel along circles, drawn as three families of loops (one per axis). The graph animates in lockstep with the cube from a shared clock.
- **Group Theory tab.** The exact sticker permutation of the current position (tracked through every turn), its cycle structure and parity, and a move-by-move trace.
- **Graph Theory tab.** The facelet graph as the Schreier graph of the cube group: its connected components are the orbits of the group, each of exactly 24 vertices, and the parity of every orbit is predicted by per-move sign characters.
- **Algorithms tab with a pattern detector.** Detects the solve stage on every size (layer-by-layer on the 2×2, CFOP on the 3×3, reduction on the 4×4 and 5×5), matches the library algorithm that applies, tells you the setup turn, and explains OLL/PLL parity as broken 3×3 invariants.
- **Solve tab.** Kociemba's two-phase algorithm, implemented from scratch, solving from the cube's state: directly on the 3×3, via a virtual 3×3 on the 2×2, and after reduction (with automatic parity fixes) on the 4×4 and 5×5.
- **Shareable links.** The URL always encodes the cube size, scramble and every move; the Share button copies it.
- **Accessibility.** Keyboard turning, touch gestures, resizable panes, and instant turns when the system asks for reduced motion.

## Notation

Typed moves and algorithms use WCA / SiGN notation.

| Move | Meaning |
|---|---|
| `R U F D L B` | Outer face, clockwise; `'` counter-clockwise, `2` half turn |
| `2R`, `3R` | A single inner layer, counted from the R face |
| `Rw`, `r`, `3Rw` | Wide turn of the outer 2 (or n) layers |
| `M E S` | Middle slice: the central layer on odd cubes, all inner layers on even cubes |
| `x y z` | Whole-cube rotation, following R, U, F |

3×3 algorithms run on big cubes through the reduction map: outer layers stay outer, and the 3×3 middle slice becomes all inner slices.

Keyboard: `R U F D L B` turn a face, `Shift` makes it counter-clockwise, `Alt`/`Option` makes it wide, `M E S` turn slices and `X Y Z` rotate the cube.

## Development

Requires Node 20.19+ (Vite 8).

```sh
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run lint
npm run build      # production build in dist/
```

## Project layout

```
src/
  App.jsx                    layout, move pipeline, keyboard, share links
  components/
    CubeViewer3D.jsx         three.js cube, turn animation, drag-to-turn
    FaceletGraph.jsx         the synchronized facelet graph (SVG)
    GraphTheoryPanel.jsx     orbits, parity characters, Schreier vs Cayley graphs
    AlgebraPanel.jsx         exact permutation stats and move trace
    AlgorithmPanel.jsx       algorithm stepper and pattern detector
    SolverPanel.jsx          two-phase solver UI and reduction guide
  lib/
    cubeState.js             state, moves, notation parser, scrambles
    faceletGraph.js          sphere layout, orbits, sign characters
    patternRecognition.js    stage detection, reduction, parity invariants
    twophase.js              Kociemba's two-phase algorithm
    solveInput.js            any N×N state → solvable 3×3 (+ parity fix)
    share.js                 URL fragment encoding
    __tests__/               Vitest suites for all of the above
```

## Deployment

`netlify.toml` builds with `npm run lint && npm test && npm run build` and publishes `dist/`, so a failing check blocks the deploy.
GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.

## References

- Janet Chen, [Group Theory and the Rubik's Cube](https://people.math.harvard.edu/~jjchen/docs/Group%20Theory%20and%20the%20Rubik's%20Cube.pdf)
- Herbert Kociemba, [The two-phase algorithm](https://kociemba.org/cube.htm)
- [God's Number is 20](https://cube20.org)
