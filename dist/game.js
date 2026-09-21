const NS = 'http://www.w3.org/2000/svg';
const G = window.FlyBreakGraph;
const $ = selector => document.querySelector(selector);
const board = $('#board');

const UI = {
  LC4: { name: 'LC4', role: 'VISUAL SOURCE', x: 55, y: 265, s: 100, l: 100, kind: 'source', locked: true, f: 'Real MaleCNS v1.0 cell-type group used as the visual source population.' },
  SAD064: { name: 'SAD064', role: 'RELAY', x: 180, y: 115, s: 64, l: 58, f: 'Real type-level relay receiving 1,732 male synapses from LC4.' },
  PVLP046: { name: 'PVLP046', role: 'CROSSFEED', x: 180, y: 245, s: 72, l: 61, f: 'Real type group with measured feed-forward and recurrent connections.' },
  LC31b: { name: 'LC31b', role: 'SHARED RELAY', x: 170, y: 390, s: 51, l: 48, f: 'Real shared relay feeding protected and target-adjacent routes.' },
  PVLP141: { name: 'PVLP141', role: 'SHARED RELAY', x: 335, y: 410, s: 69, l: 66, f: 'Real type group feeding both protected outputs and LT51.' },
  DNp02: { name: 'DNp02', role: 'TARGET GATE', x: 350, y: 105, s: 78, l: 88, f: 'Real descending type with 552 male synapses onto DNg108.' },
  DNp04: { name: 'DNp04', role: 'TARGET GATE', x: 350, y: 225, s: 92, l: 91, f: 'Real descending type with 411 male synapses onto DNg108 and a cross-feed to DNp35.' },
  DNp06: { name: 'DNp06', role: 'TARGET GATE', x: 470, y: 55, s: 60, l: 52, f: 'Real descending type with 1,152 male synapses from LC4 and 385 onto DNg108.' },
  DNp11: { name: 'DNp11', role: 'TARGET GATE', x: 665, y: 60, s: 70, l: 58, f: 'Real descending type with 3,666 male synapses from LC4 and 325 onto DNg108.' },
  CB0623: { name: 'CB0623', role: 'QUIET RELAY', x: 335, y: 330, s: 22, l: 18, f: 'A weak measured ingress into AN_multi_12. Easy to overlook; safe to cut.' },
  PLP060: { name: 'PLP060', role: 'QUIET RELAY', x: 490, y: 365, s: 20, l: 20, f: 'A low-weight measured ingress into CL342. It isolates a collateral-heavy final gate.' },
  DNp35: { name: 'DNp35', role: 'TARGET GATE', x: 520, y: 165, s: 55, l: 62, f: 'Real descending type receiving direct and DNp04-mediated LC4 influence.' },
  PVLP137: { name: 'PVLP137', role: 'SHARED RELAY', x: 505, y: 300, s: 61, l: 57, f: 'Real type group feeding DNg52 and protected output DNa13.' },
  LT51: { name: 'LT51', role: 'PROTECTED RELAY', x: 510, y: 420, s: 58, l: 54, f: 'Real type group carrying measured connectivity to DNa13 and DNa02.' },
  DNg52: { name: 'DNg52', role: 'TARGET GATE', x: 675, y: 270, s: 48, l: 53, f: 'Real type group with 458 male synapses onto target DNg108.' },
  AN_multi_12: { name: 'AN_multi_12', role: 'SHARED END GATE', x: 680, y: 180, s: 58, l: 76, f: 'Feeds DNg108 with 594 male synapses—but also feeds protected DNa13 with 443. Cutting it causes collateral damage.' },
  CL342: { name: 'CL342', role: 'SHARED END GATE', x: 755, y: 245, s: 46, l: 67, f: 'Feeds DNg108 with 394 male synapses and protected DNa13 with 238. Jam it or cut its upstream relay.' },
  LAL028: { name: 'LAL028', role: 'PROTECTED RELAY', x: 675, y: 410, s: 63, l: 65, f: 'Real type group carrying 1,063 male synapses to protected DNa02.' },
  DNa13: { name: 'DNa13', role: 'PROTECTED', x: 825, y: 325, s: 42, l: 46, kind: 'protected', locked: true, f: 'Real descending type used here as protected structural output A.' },
  DNa02: { name: 'DNa02', role: 'PROTECTED', x: 825, y: 420, s: 45, l: 49, kind: 'protected', locked: true, f: 'Real descending type used here as protected structural output B.' },
  DNg108: { name: 'DNg108', role: 'TARGET', x: 840, y: 155, s: 52, l: 100, kind: 'target', locked: true, f: 'Real MaleCNS v1.0 descending type used as the intervention target.' },
};

let level;
let nodes = [];
let edges = [];
let baselines;
let state;
let clockId;
let pulseId;

const nodeBy = id => nodes.find(node => node.id === id);

function reset() {
  clearInterval(clockId);
  clearInterval(pulseId);
  state = {
    started: false,
    turn: 0,
    lesions: 6,
    jams: 2,
    tool: 'lesion',
    selected: null,
    disabled: new Set(),
    jammed: new Set(),
    contain: 0,
    protected: 100,
    collateralEvents: 0,
    history: [],
    timeline: [],
    pendingActions: [],
    lastPaths: [],
    replaying: false,
    timeLeft: 30,
    live: false,
  };
  render();
  $('#startOverlay').classList.remove('hidden');
  $('#routeCards').classList.add('hidden');
  $('#replayBanner').classList.add('hidden');
  $('#advanceBtn').disabled = true;
  $('#quip').textContent = '“The fly has no idea you’re here. Mostly because this is a graph.”';
}

function el(tag, attrs = {}) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function pathData(a, b) {
  const x1 = a.x + 24;
  const x2 = b.x - 24;
  const middle = (x1 + x2) / 2;
  return `M${x1},${a.y} C${middle},${a.y} ${middle},${b.y} ${x2},${b.y}`;
}

function edgeKey(a, b) {
  return `${a}-${b}`;
}

function routeClass(a, b) {
  if (state.disabled.has(a) || state.disabled.has(b)) return 'edge dead';
  const active = new Set(state.lastPaths.flatMap(path => path.edges.map(edge => edgeKey(...edge))));
  if (active.has(edgeKey(a, b))) return state.turn > 1 ? 'edge reroute' : 'edge active';
  return 'edge';
}

function render() {
  board.innerHTML = '';
  edges.forEach(([from, to]) => {
    board.append(el('path', {
      d: pathData(nodeBy(from), nodeBy(to)),
      class: routeClass(from, to),
      'data-edge': edgeKey(from, to),
    }));
  });
  nodes.forEach((node) => {
    const group = el('g', {
      class: `node ${node.kind || ''} ${state.disabled.has(node.id) ? 'disabled' : ''} ${state.jammed.has(node.id) ? 'jammed' : ''} ${state.selected === node.id ? 'selected' : ''}`,
      transform: `translate(${node.x} ${node.y})`,
      tabindex: node.locked ? '-1' : '0',
      role: 'button',
      'aria-label': node.name,
    });
    group.append(el('circle', { r: node.kind ? 27 : 22 }));
    if (node.kind === 'source') group.append(el('circle', { r: 34, class: 'pulse-ring' }));
    const title = el('text', { 'text-anchor': 'middle', y: 42 });
    title.textContent = node.name;
    group.append(title);
    const role = el('text', { 'text-anchor': 'middle', y: 56, class: 'mini' });
    role.textContent = node.role;
    group.append(role);
    if (!node.locked) {
      group.addEventListener('click', () => selectNode(node.id));
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') selectNode(node.id);
      });
    }
    board.append(group);
  });
  updateUI();
}

function updateUI() {
  $('#turnTop').textContent = `${state.turn}/6`;
  $('#containTop').textContent = `${state.contain}%`;
  $('#timerTop').textContent = `00:${String(state.timeLeft ?? 30).padStart(2, '0')}`;
  $('#lesionsLeft').textContent = state.lesions;
  $('#jamsLeft').textContent = state.jams;
  const damage = 100 - state.protected;
  $('#collateralValue').textContent = `${damage}%`;
  $('#collateralNote').textContent = damage
    ? `${state.collateralEvents} damaging cut${state.collateralEvents === 1 ? '' : 's'} recorded`
    : 'Protected routes intact';
  $('#collateralStatus').classList.toggle('damaged', damage > 0);
  document.querySelectorAll('.tool').forEach(button => button.classList.toggle('selected', button.dataset.tool === state.tool));
}

function selectNode(id) {
  if (!state.started) return;
  state.selected = id;
  const node = nodeBy(id);
  $('#emptyIntel').classList.add('hidden');
  $('#nodeIntel').classList.remove('hidden');
  $('#nodeRole').textContent = node.role;
  $('#nodeName').textContent = node.name;
  $('#nodeId').textContent = 'MALECNS V1.0 // REAL TYPE GROUP';
  $('#strengthBar').style.width = `${node.s}%`;
  $('#strengthVal').textContent = node.s;
  $('#loadBar').style.width = `${node.l}%`;
  $('#loadVal').textContent = node.l;
  $('#forecastText').textContent = node.f;
  const button = $('#actionBtn');
  const used = state.disabled.has(id);
  button.textContent = used ? 'ALREADY DISABLED' : `${state.tool === 'lesion' ? 'CUT' : 'JAM'} NODE`;
  button.disabled = used || (state.tool === 'lesion' ? state.lesions < 1 : state.jams < 1);
  render();
}

function cleanCutQuip(node) {
  if (node.role === 'TARGET GATE') return '“Target gate down. Protected routes remain intact.”';
  if (node.role === 'QUIET RELAY') return '“Quiet relay cut. Tiny node, enormous main-character energy.”';
  return '“Clean cut. No protected connectivity lost.”';
}

function intervene() {
  const id = state.selected;
  if (!id) return;
  if (state.tool === 'lesion') {
    const before = G.protectedScore(level, state.disabled);
    state.disabled.add(id);
    state.lesions--;
    const after = G.protectedScore(level, state.disabled);
    const loss = Math.max(0, before - after);
    state.protected = after;
    state.pendingActions.push({ tool: 'CUT', id, loss });
    if (loss > 0) {
      state.collateralEvents++;
      quip(`“Collateral alert: ${nodeBy(id).name} carried protected traffic.”`);
      toast(`⚠ COLLATERAL PENALTY: −${loss}% protected connectivity`);
    } else {
      quip(cleanCutQuip(nodeBy(id)));
      toast('Clean intervention. Protected routes intact.');
    }
  } else {
    state.jammed.add(id);
    state.jams--;
    state.pendingActions.push({ tool: 'JAM', id, loss: 0 });
    quip('“Temporary jam deployed. Neural hold music begins now.”');
    toast('Test jam armed. No permanent penalty.');
  }
  state.selected = null;
  $('#nodeIntel').classList.add('hidden');
  $('#emptyIntel').classList.remove('hidden');
  $('#advanceBtn').disabled = false;
  $('#systemState').textContent = 'INTERVENTION ARMED';
  render();
}

function showRoutes(paths) {
  const box = $('#routeCards');
  if (!paths.length) {
    box.classList.add('hidden');
    return;
  }
  box.innerHTML = paths.map((path, index) => `
    <article class="route-card" data-route="${index}">
      <b>${path.capacity}</b>
      <small>ROUTE ${String.fromCharCode(65 + index)}</small>
      <strong>${path.nodes.at(-2)} GATE</strong>
      <p>${path.nodes.map(id => nodeBy(id).name).join(' → ')}</p>
    </article>`).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('.route-card').forEach((card) => {
    card.onmouseenter = () => highlightRoute(paths[Number(card.dataset.route)]);
    card.onmouseleave = () => render();
  });
}

function highlightRoute(path) {
  const keep = new Set(path.edges.map(edge => edgeKey(...edge)));
  board.querySelectorAll('.edge').forEach((edge) => {
    edge.style.opacity = keep.has(edge.dataset.edge) ? '1' : '.12';
    edge.style.strokeWidth = keep.has(edge.dataset.edge) ? '5' : '1';
  });
}

function advance() {
  if (state.turn >= 6) return;
  state.turn++;
  const activeJams = new Set(state.jammed);
  const paths = G.targetPaths(level, state.disabled, activeJams);
  state.lastPaths = paths;
  state.history.push(paths);
  state.contain = G.containment(level, state.disabled, activeJams);
  state.protected = G.protectedScore(level, state.disabled);
  state.timeline.push(G.snapshot(
    state.turn,
    state.pendingActions,
    state.disabled,
    activeJams,
    paths,
    state.contain,
    state.protected,
  ));
  state.pendingActions = [];
  state.jammed.clear();
  $('#advanceBtn').disabled = true;
  $('#systemState').textContent = paths.length > 1
    ? `${paths.length} ROUTES ACTIVE`
    : paths.length ? 'ONE ROUTE ACTIVE' : 'SIGNAL CONTAINED';
  render();
  showRoutes(paths);
  animatePaths(paths);
  if (!paths.length) quip('“Full containment. The target has been stood up by every signal.”');
  else if (paths.length === 8) quip('“Eight measured routes are active—and two final gates are collateral traps.”');
  else if (state.turn > 1) quip(`“It rerouted through ${paths.map(path => nodeBy(path.nodes.at(-2)).name).join(' and ')}. Rude.”`);
  else quip('“Contact. Multiple paths are carrying signal. Try looking tactical.”');
  if (state.turn === 6 || (!paths.length && state.turn >= 2)) setTimeout(finish, 1200);
}

function animatePaths(paths) {
  const colors = ['var(--cyan)', 'var(--amber)', 'var(--violet)', 'var(--acid)', '#ff7ad9', '#7aff8e', '#ff9f6e', '#8eb8ff'];
  paths.forEach((path, pathIndex) => path.edges.forEach(([, destination], edgeIndex) => {
    setTimeout(() => {
      const node = nodeBy(destination);
      const courier = el('text', {
        x: node.x,
        y: node.y + 7,
        class: 'courier',
        'text-anchor': 'middle',
        style: `filter:drop-shadow(0 0 8px ${colors[pathIndex]})`,
      });
      courier.textContent = '🪰';
      board.append(courier);
      setTimeout(() => courier.remove(), 720);
    }, edgeIndex * 260 + pathIndex * 110);
  }));
}

function updateBotRow(prefix, score, detail = '') {
  $(`#${prefix}Score`).textContent = detail || score;
  $(`#${prefix}Bar`).style.setProperty('--w', `${score}%`);
}

function finish() {
  stopLive();
  const containmentValue = state.contain;
  const precision = state.protected;
  const unused = state.lesions + state.jams;
  const damage = 100 - precision;
  const score = G.gameScore(containmentValue, precision, unused);
  let rank = 'C';
  let title = 'TARGET PARTIALLY CONTAINED';
  let copy = 'The intervention needs another pass.';
  if (containmentValue >= 95 && precision >= 95) {
    rank = 'S'; title = 'SURGICAL SABOTEUR'; copy = 'Full containment with protected structural pathways intact.';
  } else if (containmentValue >= 80 && precision >= 85 && score >= 75) {
    rank = 'A'; title = 'CLEAN GETAWAY'; copy = 'Strong containment with limited collateral disruption.';
  } else if (containmentValue >= 60 && precision >= 60) {
    rank = 'B'; title = 'MESSY, BUT EFFECTIVE'; copy = 'The target was suppressed, but protected connectivity paid a price.';
  } else if (precision < 60) {
    rank = 'D'; title = 'COLLATERAL CATASTROPHE'; copy = 'Target suppression cannot compensate for destroying unrelated pathways.';
  }
  $('#rank').textContent = rank;
  $('#resultTitle').textContent = title;
  $('#resultCopy').textContent = copy;
  $('#finalContain').textContent = `${containmentValue}%`;
  $('#finalPrecision').textContent = `${precision}%`;
  $('#finalStyle').textContent = damage ? `−${Math.round(damage * 0.9)}` : `+${unused * 2}`;
  $('#youScore').textContent = score;
  $('#youBar').style.setProperty('--w', `${score}%`);
  updateBotRow('wrecker', baselines.wrecker.score);
  updateBotRow('navigator', baselines.navigator.score);
  updateBotRow('random', baselines.random.mean, `${baselines.random.mean} (${baselines.random.min}–${baselines.random.max})`);
  const broad = ['PVLP137', 'PVLP141', 'LC31b', 'LAL028', 'LT51', 'AN_multi_12', 'CL342']
    .some(id => state.disabled.has(id));
  $('#insight').innerHTML = broad
    ? `<strong>Collateral penalty:</strong> ${damage}% of protected structural connectivity was lost. Shared end gates are tempting, but their upstream relays are the surgical targets.`
    : '<strong>What happened:</strong> You traced the shared end gates backward and cut their quiet ingress relays—the structural equivalent of stealing the keys instead of demolishing the building.';
  $('#resultDialog').showModal();
}

function stopLive() {
  clearInterval(clockId);
  clearInterval(pulseId);
  clockId = null;
  pulseId = null;
  if (state) state.live = false;
}

function startLive() {
  state.live = true;
  clockId = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    updateUI();
    if (state.timeLeft === 0) {
      stopLive();
      finish();
    }
  }, 1000);
  setTimeout(() => {
    if (state.live && state.turn === 0) advance();
  }, 1200);
  pulseId = setInterval(() => {
    if (state.live && state.turn < 6) advance();
  }, 4200);
}

function start() {
  state.started = true;
  $('#startOverlay').classList.add('hidden');
  $('#advanceBtn').disabled = false;
  toast('Live hunt started. The fly reroutes every four seconds.');
  startLive();
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2400);
}

function quip(message) {
  $('#quip').textContent = message;
}

function actionLabel(actions) {
  if (actions.length === 1 && actions[0].tool === 'OBSERVE') return 'BASELINE PROPAGATION';
  return actions.map(action => `${action.tool}: ${nodeBy(action.id).name}`).join(' · ');
}

function playDetailedReplay() {
  if (!state.timeline.length) return;
  $('#resultDialog').close();
  const finished = state;
  const steps = finished.timeline;
  state = {
    ...finished,
    started: false,
    replaying: true,
    disabled: new Set(),
    jammed: new Set(),
    lastPaths: [],
    contain: 0,
    protected: 100,
  };
  const banner = $('#replayBanner');
  banner.classList.remove('hidden');
  $('#routeCards').classList.add('hidden');
  $('#replayTitle').textContent = 'INTACT NETWORK';
  $('#replayDetail').textContent = 'Baseline: all structural routes are available.';
  $('#replayProgress').style.width = '5%';
  render();
  let index = 0;
  const next = () => {
    if (index >= steps.length) {
      $('#replayTitle').textContent = 'PLAYBACK COMPLETE';
      $('#replayDetail').textContent = `Final containment ${finished.contain}% · protected connectivity ${finished.protected}%`;
      $('#replayProgress').style.width = '100%';
      setTimeout(() => {
        state = finished;
        banner.classList.add('hidden');
        render();
        showRoutes(state.lastPaths);
        $('#resultDialog').showModal();
      }, 2200);
      return;
    }
    const step = steps[index++];
    state.turn = step.turn;
    state.disabled = new Set(step.disabled);
    state.jammed = new Set(step.jammed);
    state.lastPaths = step.paths;
    state.contain = step.contain;
    state.protected = step.protected;
    render();
    showRoutes(step.paths);
    animatePaths(step.paths);
    const loss = step.actions.reduce((sum, action) => sum + action.loss, 0);
    $('#replayTitle').textContent = `STEP ${index} — ${actionLabel(step.actions)}`;
    $('#replayDetail').textContent = loss
      ? `Protected connectivity −${loss}%. ${step.paths.length} target route${step.paths.length === 1 ? '' : 's'} remain.`
      : `No collateral loss. ${step.paths.length} target route${step.paths.length === 1 ? '' : 's'} remain.`;
    $('#replayProgress').style.width = `${Math.round(index / steps.length * 100)}%`;
    setTimeout(next, 2400);
  };
  setTimeout(next, 1100);
}

function endCinematic() {
  const cinematic = $('#cinematic');
  if (!cinematic || cinematic.classList.contains('gone')) return;
  cinematic.style.transition = 'opacity .45s ease';
  cinematic.style.opacity = '0';
  setTimeout(() => cinematic.classList.add('gone'), 480);
}

function wireInteractions() {
  document.querySelectorAll('.tool').forEach((button) => {
    button.onclick = () => {
      state.tool = button.dataset.tool;
      if (state.selected) selectNode(state.selected);
      updateUI();
    };
  });
  $('#actionBtn').onclick = intervene;
  $('#advanceBtn').onclick = advance;
  $('#startBtn').onclick = start;
  $('#overlayStart').onclick = start;
  $('#resetBtn').onclick = reset;
  $('#replayBtn').onclick = () => {
    $('#resultDialog').close();
    reset();
    start();
  };
  $('#watchReplayBtn').onclick = playDetailedReplay;
  $('#methodBtn').onclick = () => $('#methodDialog').showModal();
  $('#flyBtn').onclick = () => $('#flyDialog').showModal();
  $('#skipIntro').onclick = endCinematic;
  document.querySelectorAll('.close').forEach(button => {
    button.onclick = () => button.closest('dialog').close();
  });
}

async function bootstrap() {
  $('#startBtn').disabled = true;
  $('#overlayStart').disabled = true;
  try {
    const response = await fetch('malecns_lc4_dng108.json');
    if (!response.ok) throw new Error(`level load failed: ${response.status}`);
    level = await response.json();
    const missing = level.nodes.map(node => node.id).filter(id => !UI[id]);
    if (missing.length) throw new Error(`missing UI metadata: ${missing.join(', ')}`);
    nodes = level.nodes.map(node => ({ id: node.id, ...UI[node.id] }));
    edges = G.normalizeEdges(level.edges);
    baselines = G.computeBaselines(level, 6);
    wireInteractions();
    reset();
    $('#startBtn').disabled = false;
    $('#overlayStart').disabled = false;
  } catch (error) {
    console.error(error);
    $('#systemState').textContent = 'LEVEL LOAD FAILED';
    $('#quip').textContent = '“The connectome did not arrive. This is technically excellent camouflage.”';
  }
}

setTimeout(endCinematic, 10000);
bootstrap();
