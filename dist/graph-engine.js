(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FlyBreakGraph = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function edgeTuple(edge) {
    return Array.isArray(edge)
      ? [edge[0], edge[1], Number(edge[2])]
      : [edge.source, edge.target, Number(edge.weight)];
  }

  function normalizeEdges(edges) {
    return edges.map(edgeTuple);
  }

  function allPaths(edges, source, target, blocked = new Set()) {
    const adjacency = {};
    normalizeEdges(edges).forEach(([from, to, weight]) => {
      (adjacency[from] ??= []).push({ to, weight });
    });

    const paths = [];
    function walk(id, seen, nodes, pathEdges, weights) {
      if (id === target) {
        paths.push({
          nodes,
          edges: pathEdges,
          capacity: weights.length ? Math.min(...weights) : 0,
        });
        return;
      }
      for (const edge of adjacency[id] || []) {
        if (blocked.has(edge.to) || seen.has(edge.to)) continue;
        walk(
          edge.to,
          new Set([...seen, edge.to]),
          [...nodes, edge.to],
          [...pathEdges, [id, edge.to]],
          [...weights, edge.weight],
        );
      }
    }

    if (!blocked.has(source)) walk(source, new Set([source]), [source], [], []);
    return paths.sort((a, b) => b.capacity - a.capacity || a.nodes.join('>').localeCompare(b.nodes.join('>')));
  }

  function selectDistinctFinalGatePaths(paths, limit = 8) {
    const chosen = [];
    for (const path of paths) {
      const gate = path.nodes.at(-2);
      if (!chosen.some(candidate => candidate.nodes.at(-2) === gate)) chosen.push(path);
      if (chosen.length === limit) break;
    }
    return chosen;
  }

  function totalCapacity(paths) {
    return paths.reduce((sum, path) => sum + path.capacity, 0);
  }

  function targetPaths(level, disabled = new Set(), jammed = new Set()) {
    const rules = level.rules;
    const blocked = new Set([...disabled, ...jammed]);
    return selectDistinctFinalGatePaths(
      allPaths(level.edges, rules.source, rules.target, blocked),
      rules.max_target_paths,
    );
  }

  function containment(level, disabled = new Set(), jammed = new Set()) {
    const active = totalCapacity(targetPaths(level, disabled, jammed));
    return Math.round(100 * Math.max(0, 1 - active / level.rules.target_baseline_capacity));
  }

  function protectedScore(level, disabled = new Set()) {
    const rules = level.rules;
    const capacities = rules.protected_targets.map((target) => {
      const paths = allPaths(level.edges, rules.source, target.id, disabled).slice(0, target.path_count);
      return totalCapacity(paths) / target.baseline_capacity;
    });
    const base = Math.round(100 * Math.min(1, capacities.reduce((a, b) => a + b, 0) / capacities.length));
    const explicitLoss = Object.entries(rules.shared_gate_penalties || {})
      .reduce((loss, [id, penalty]) => loss + (disabled.has(id) ? penalty : 0), 0);
    return Math.max(0, base - explicitLoss);
  }

  function gameScore(containmentValue, protectedValue, unusedActions = 0) {
    const damage = 100 - protectedValue;
    return Math.max(0, Math.min(100, Math.round(containmentValue - damage * 0.9 + unusedActions * 2)));
  }

  function evaluate(level, disabled = new Set(), jammed = new Set(), unusedActions = 0) {
    const contain = containment(level, disabled, jammed);
    const protectedValue = protectedScore(level, disabled);
    return {
      containment: contain,
      protected: protectedValue,
      damage: 100 - protectedValue,
      score: gameScore(contain, protectedValue, unusedActions),
      paths: targetPaths(level, disabled, jammed),
    };
  }

  function weightedDegree(level, id) {
    return normalizeEdges(level.edges).reduce(
      (sum, [from, to, weight]) => sum + (from === id || to === id ? weight : 0),
      0,
    );
  }

  function eligibleNodes(level) {
    const excluded = new Set([
      level.rules.source,
      level.rules.target,
      ...level.rules.protected_targets.map(target => target.id),
    ]);
    return level.nodes.map(node => node.id).filter(id => !excluded.has(id));
  }

  function simulateCuts(level, cuts) {
    return evaluate(level, new Set(cuts), new Set(), 0);
  }

  function wreckerPolicy(level, budget = 6) {
    const cuts = eligibleNodes(level)
      .sort((a, b) => weightedDegree(level, b) - weightedDegree(level, a) || a.localeCompare(b))
      .slice(0, budget);
    return { name: 'Wrecker Bot', cuts, ...simulateCuts(level, cuts) };
  }

  function navigatorPolicy(level, budget = 6) {
    const cuts = [];
    const available = new Set(eligibleNodes(level));
    while (cuts.length < budget && available.size) {
      const ranked = [...available].map((id) => {
        const result = simulateCuts(level, [...cuts, id]);
        return { id, result };
      }).sort((a, b) => b.result.score - a.result.score || b.result.containment - a.result.containment || a.id.localeCompare(b.id));
      cuts.push(ranked[0].id);
      available.delete(ranked[0].id);
    }
    return { name: 'Navigator', cuts, ...simulateCuts(level, cuts) };
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function randomBaselines(level, budget = 6, runs = 64, seed = 2025) {
    const scores = [];
    const candidates = eligibleNodes(level);
    for (let run = 0; run < runs; run++) {
      const random = seededRandom(seed + run);
      const pool = [...candidates];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      scores.push(simulateCuts(level, pool.slice(0, budget)).score);
    }
    return {
      name: 'Random Bot',
      mean: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      min: Math.min(...scores),
      max: Math.max(...scores),
      runs,
      seed,
    };
  }

  function computeBaselines(level, budget = 6) {
    return {
      wrecker: wreckerPolicy(level, budget),
      navigator: navigatorPolicy(level, budget),
      random: randomBaselines(level, budget),
    };
  }

  function snapshot(turn, actions, disabled, jammed, paths, contain, protectedValue) {
    const recordedActions = Array.isArray(actions) && actions.length
      ? actions.map(action => ({ ...action }))
      : [{ tool: 'OBSERVE', id: null, loss: 0 }];
    return {
      turn,
      actions: recordedActions,
      disabled: [...disabled],
      jammed: [...jammed],
      paths: paths.map(path => ({
        nodes: [...path.nodes],
        edges: path.edges.map(edge => [...edge]),
        capacity: path.capacity,
      })),
      contain,
      protected: protectedValue,
    };
  }

  return {
    allPaths,
    computeBaselines,
    containment,
    edgeTuple,
    eligibleNodes,
    evaluate,
    gameScore,
    normalizeEdges,
    protectedScore,
    randomBaselines,
    selectDistinctFinalGatePaths,
    snapshot,
    targetPaths,
    totalCapacity,
    weightedDegree,
    wreckerPolicy,
    navigatorPolicy,
  };
});
