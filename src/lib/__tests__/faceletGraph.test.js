import { describe, it, expect } from 'vitest';
import { solvedState, applyMove, getMovePositionCycles } from '../cubeState';
import {
  buildFaceletGraph, rotateAboutAxis, moveAxis, moveAngle, nodesInSlice,
  componentsAreRotationOrbits, generatorSigns, orbitDiameters,
} from '../faceletGraph';

describe('facelet graph geometry', () => {
  it.each([2, 3, 4, 5])('every turn of a %i×%i is an exact rotation of the sphere layout', (N) => {
    const g = buildFaceletGraph(N);
    for (const face of 'URFDLB') {
      for (let layer = 0; layer < N; layer++) {
        for (const cw of [true, false]) {
          const moved = new Set();
          for (const cyc of getMovePositionCycles(face, layer, cw, N)) {
            for (let k = 0; k < 4; k++) {
              const a = cyc[k], b = cyc[(k + 1) % 4];
              moved.add(a);
              const p = rotateAboutAxis(g.nodes[a].sphere, moveAxis(face), moveAngle(face, cw));
              const q = g.nodes[b].sphere;
              expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeLessThan(1e-9);
            }
          }
          // stickers in the slice that no cycle moves (face centers) stay put
          for (const i of nodesInSlice(g, face, [layer])) {
            if (moved.has(i)) continue;
            const p = rotateAboutAxis(g.nodes[i].sphere, moveAxis(face), moveAngle(face, cw));
            const q = g.nodes[i].sphere;
            expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeLessThan(1e-9);
          }
        }
      }
    }
  });

  it('cycles agree with the facelet engine (a → b means the sticker at a moves to b)', () => {
    const N = 3, nn = 9;
    for (const cyc of getMovePositionCycles('F', 0, true, N)) {
      const [a, b] = cyc;
      let s = solvedState(N).map(f => f.map(r => r.map(() => 0)));
      s[Math.floor(a / nn)][Math.floor((a % nn) / N)][a % N] = 9;
      s = applyMove(s, 'F', 0, true);
      expect(s[Math.floor(b / nn)][Math.floor((b % nn) / N)][b % N]).toBe(9);
    }
  });
});

describe('orbits (connected components of the Schreier graph)', () => {
  const expected = {
    2: ['Corners'],
    3: ['Corners', 'Edges', 'Face centers'],
    4: ['Corners', 'Wings A', 'Wings B', 'Centers'],
    5: ['Corners', 'Midges', 'Wings A', 'Wings B', 'X-centers', '+-centers', 'Face centers'],
  };
  it.each([2, 3, 4, 5])('%i×%i has (N² − [N odd]) / 4 components of 24', (N) => {
    const g = buildFaceletGraph(N);
    expect(g.orbits.map(o => o.label)).toEqual(expected[N]);
    const big = g.orbits.filter(o => o.kind !== 'fixed');
    expect(big).toHaveLength((N * N - (N % 2)) / 4);
    big.forEach(o => expect(o.members).toHaveLength(24));
  });

  it.each([2, 3, 4, 5])('%i×%i components are exactly orbits of the rotation group', (N) => {
    expect(componentsAreRotationOrbits(buildFaceletGraph(N))).toBe(true);
  });

  it('4×4: outer turns are even on the wings, inner slices odd', () => {
    const g = buildFaceletGraph(4);
    const wingA = g.orbits.find(o => o.label === 'Wings A').id;
    const [outer, inner] = generatorSigns(g).filter(r => r.face === 'R');
    expect(outer.signs[wingA]).toBe(1);
    expect(inner.signs[wingA]).toBe(-1);
  });

  it('3×3 component diameters: 3 for corners, 4 for edges', () => {
    const g = buildFaceletGraph(3);
    expect(orbitDiameters(g).slice(0, 2).map(d => d.diameter)).toEqual([3, 4]);
  });
});
