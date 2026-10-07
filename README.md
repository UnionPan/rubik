# Rubik.Group

Interactive twisty puzzles for learning the group theory and graph theory behind them: Rubik's cubes from 2×2 to 5×5, the Ivy Cube and the Skewb Diamond.
Turn a puzzle in 3D and watch the same move animate in lockstep on a colored graph of its stickers, trace the permutation it builds, and let the pattern detector and solver guide you to a solve.

## Features

- **Six puzzles.** Cubes from 2×2 to 5×5, the Ivy Cube (corner-turning, leaf-shaped centers) and the Skewb Diamond (an octahedron with the Skewb mechanism). Turn them with the pad under the puzzle, the keyboard, or by dragging a sticker.
- **Facelet graph.** Every facelet is a vertex; a layer turn is a rigid rotation of a sphere, so facelets travel along circles, drawn as three families of loops (one per axis). The graph animates in lockstep with the cube from a shared clock.
- **Math › Groups.** The exact sticker permutation of the current position, in a picture of its loops and one plain sentence; click any earlier move to see the position after it.
- **Math › Graphs.** The facelet graph explained in three pictures: every sticker is a dot, a turn slides dots around loops, and dots that can reach each other form a family (an orbit).
- **Algorithms tab with a pattern detector.** Every stage and category says what it means in plain words, and OLL and PLL cases show the standard top-view picture, computed from the algorithm itself.
  It detects the solve stage on every size (layer-by-layer on the 2×2, CFOP on the 3×3, reduction on the 4×4 and 5×5), matches the library algorithm that applies, tells you the setup turn, and explains OLL/PLL parity as broken 3×3 invariants.
- **Solve tab.** Kociemba's two-phase algorithm, implemented from scratch, solving from the cube's state: directly on the 3×3 and via a virtual 3×3 on the 2×2.
  A scrambled 4×4 or 5×5 is solved by reduction, in stages you can play one at a time: centers (table-guided search, then generated 3-cycles), parity, edges (generated wing 3-cycles), then the 3×3.
  The Ivy Cube and Skewb Diamond are small enough to enumerate completely, so their solutions are optimal and the site shows their true God's numbers (8 and 10).
- **Less text by default.** Sections lead with pictures and short sentences; longer explanations sit behind a "Why?" toggle, and the Explain switch opens them all at once.
- **Shareable links.** The URL always encodes the cube size, scramble and every move; the Share button copies it.
- **Accessibility.** Keyboard turning, touch gestures, resizable panes, and instant turns when the system asks for reduced motion.

## Notation

Algorithms and share links use WCA / SiGN notation.

| Move | Meaning |
|---|---|
| `R U F D L B` | Outer face, clockwise; `'` counter-clockwise, `2` half turn |
| `2R`, `3R` | A single inner layer, counted from the R face |
| `Rw`, `r`, `3Rw` | Wide turn of the outer 2 (or n) layers |
| `M E S` | Middle slice: the central layer on odd cubes, all inner layers on even cubes |
| `x y z` | Whole-cube rotation, following R, U, F |

The Ivy Cube and Skewb Diamond turn about four axes through the corners URF, ULB, DLF and DRB, named `F`, `U`, `L` and `R`; each turn is 120°, and `'` turns the other way.

3×3 algorithms run on big cubes through the reduction map: outer layers stay outer, and the 3×3 middle slice becomes all inner slices.

Keyboard: `R U F D L B` turn a face, `Shift` makes it counter-clockwise, `Alt`/`Option` makes it wide, `M E S` turn slices and `X Y Z` rotate the cube.
On the Ivy Cube and Skewb Diamond, `F U L R` turn about the four axes.

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
    ui/Section.jsx           the panel building block: title, caption, "Why?" toggle
    three/stage.js           shared three.js stage: camera orbit, render loop, gestures
    CubeViewer3D.jsx         the cubes in 3D, turn animation, drag-to-turn
    PuzzleViewer3D.jsx       any geometry-engine puzzle in 3D
    FaceletGraph.jsx         the synchronized sticker graph (SVG), for every puzzle
    TurnPad.jsx              turn buttons, direction, layer, speed and keyboard help
    AlgebraPanel.jsx         Math › Groups: the position's loops, move by move
    GraphsPanel.jsx          Math › Graphs: the facelet graph in pictures, families, every position
    AlgorithmPanel.jsx       algorithm library with a stepper, and the pattern detector
    CaseDiagram.jsx          OLL / PLL case pictures, computed from each algorithm
    SolverPanel.jsx          solver UI (cubes); BigCubeSolution.jsx plays big-cube stages
    GenericSolvePanel.jsx    optimal solver (other puzzles)
  lib/
    cubeState.js             cube state, moves, notation parser, scrambles
    faceletGraph.js          sphere layout, projection, orbits, sign characters
    patternRecognition.js    cube stage detection, reduction, parity invariants
    twophase.js              Kociemba's two-phase algorithm
    solveInput.js            any N×N state → solvable 3×3 (+ parity fix)
    bigcube/                 4×4 / 5×5 reduction solver (runs in bigcube.worker.js)
      centers.js             center stages with exact distance tables
      centerCycles.js        5×5 +-centers by generated 3-cycles
      edges.js               wings by generated 3-cycles
      solve.js               the pipeline: centers, parity, edges, 3×3
    puzzles/                 the geometry engine
      engine.js              moves, enumeration, optimal solver, graph model, from geometry alone
      ivy.js, diamond.js     puzzle definitions: sticker outlines, axes, cuts
      models.js              one interface over cubes and engine puzzles
      detect.js, library.js  stage detector and verified-optimal algorithms
      puzzle.worker.js       enumerates every position off the main thread
    share.js                 URL fragment encoding
    __tests__/               Vitest suites for all of the above

### Adding a puzzle

A puzzle is a geometry definition (see `src/lib/puzzles/ivy.js`): sticker outlines with a home color and a reference point, turning axes, and a rule for which stickers a turn carries.
The engine derives the move permutations by rotating the reference points, and from those everything else: notation, enumeration, the optimal solver, the graph and its orbits.
Register it in `puzzles/index.js` and `puzzles/models.js`; the tests in `puzzles.test.js` check that every turn maps stickers onto stickers and that the group has the expected size.
```

## Deployment

`netlify.toml` builds with `npm run lint && npm test && npm run build` and publishes `dist/`, so a failing check blocks the deploy.
GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on every push and pull request.

## References

- Janet Chen, [Group Theory and the Rubik's Cube](https://people.math.harvard.edu/~jjchen/docs/Group%20Theory%20and%20the%20Rubik's%20Cube.pdf)
- Herbert Kociemba, [The two-phase algorithm](https://kociemba.org/cube.htm)
- [God's Number is 20](https://cube20.org)
