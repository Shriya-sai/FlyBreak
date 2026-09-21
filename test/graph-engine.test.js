const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../dist/graph-engine.js');

const level = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/malecns_lc4_dng108.json'), 'utf8'));

function tinyLevel(edges, overrides = {}) {
  return {
    nodes: [...new Set(edges.flatMap(edge => [edge.source, edge.target]))].map(id => ({ id })),
    edges,
    rules: {
      source: 'A',
      target: 'T',
      max_target_paths: 8,
      target_baseline_capacity: 10,
      protected_targets: [{ id: 'P', path_count: 1, baseline_capacity: 5 }],
      shared_gate_penalties: {},
      ...overrides,
    },
  };
}

test('directed paths respect edge orientation', () => {
  const edges = [{ source: 'A', target: 'B', weight: 5 }, { source: 'B', target: 'T', weight: 4 }];
  assert.equal(G.allPaths(edges, 'A', 'T').length, 1);
  assert.equal(G.allPaths(edges, 'T', 'A').length, 0);
});

test('cut nodes are excluded from every route', () => {
  const paths = G.allPaths(level.edges, 'LC4', 'DNg108', new Set(['DNp02']));
  assert.ok(paths.length > 0);
  assert.ok(paths.every(route => !route.nodes.includes('DNp02')));
});

test('a jam blocks one evaluation and the route returns next pulse', () => {
  const baseline = G.targetPaths(level);
  const jammed = G.targetPaths(level, new Set(), new Set(['DNp02']));
  const nextPulse = G.targetPaths(level);
  assert.ok(baseline.some(route => route.nodes.at(-2) === 'DNp02'));
  assert.ok(jammed.every(route => route.nodes.at(-2) !== 'DNp02'));
  assert.deepEqual(nextPulse, baseline);
});

test('route selection keeps distinct final gates', () => {
  const paths = [
    { nodes: ['A', 'X', 'G', 'T'], capacity: 9, edges: [] },
    { nodes: ['A', 'Y', 'G', 'T'], capacity: 8, edges: [] },
    { nodes: ['A', 'H', 'T'], capacity: 7, edges: [] },
  ];
  assert.deepEqual(G.selectDistinctFinalGatePaths(paths, 8).map(route => route.nodes.at(-2)), ['G', 'H']);
});

test('route capacity is the weakest edge', () => {
  const edges = [
    { source: 'A', target: 'B', weight: 10 },
    { source: 'B', target: 'T', weight: 3 },
  ];
  assert.equal(G.allPaths(edges, 'A', 'T')[0].capacity, 3);
});

test('shared-gate cuts apply explicit protected penalties', () => {
  const intact = G.protectedScore(level, new Set());
  const anCut = G.protectedScore(level, new Set(['AN_multi_12']));
  const clCut = G.protectedScore(level, new Set(['CL342']));
  assert.equal(intact, 100);
  assert.equal(intact - anCut, 14);
  assert.equal(intact - clCut, 8);
});

test('rerouting is deterministic', () => {
  const blocked = new Set(['DNp02', 'DNp04']);
  assert.deepEqual(G.targetPaths(level, blocked), G.targetPaths(level, blocked));
});

test('game scores are bounded from zero to one hundred', () => {
  assert.equal(G.gameScore(150, 100, 10), 100);
  assert.equal(G.gameScore(0, 0, 0), 0);
});

test('timeline snapshots preserve every action and are immutable', () => {
  const actions = [{ tool: 'CUT', id: 'X', loss: 5 }, { tool: 'JAM', id: 'Y', loss: 0 }];
  const paths = [{ nodes: ['A', 'T'], edges: [['A', 'T']], capacity: 2 }];
  const snap = G.snapshot(2, actions, new Set(['X']), new Set(['Y']), paths, 80, 95);
  actions[0].id = 'MUTATED';
  paths[0].nodes[0] = 'MUTATED';
  assert.equal(snap.actions[0].id, 'X');
  assert.equal(snap.paths[0].nodes[0], 'A');
  assert.deepEqual(snap.disabled, ['X']);
  assert.deepEqual(snap.jammed, ['Y']);
});

test('computed baselines are deterministic and policy-derived', () => {
  const first = G.computeBaselines(level, 6);
  const second = G.computeBaselines(level, 6);
  assert.deepEqual(first, second);
  assert.equal(first.wrecker.cuts.length, 6);
  assert.equal(first.navigator.cuts.length, 6);
  assert.equal(first.random.runs, 64);
  assert.ok(first.random.min <= first.random.mean && first.random.mean <= first.random.max);
});

test('browser game uses the derived JSON rather than a second edge list', () => {
  const source = fs.readFileSync(path.join(__dirname, '../dist/game.js'), 'utf8');
  assert.match(source, /fetch\('malecns_lc4_dng108\.json'\)/);
  assert.doesNotMatch(source, /const edges\s*=\s*\[/);
  assert.equal(level.edges.length, 43);
});
