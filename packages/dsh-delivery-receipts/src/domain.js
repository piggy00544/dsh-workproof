const STATUSES = new Set(['ok', 'missing', 'unreadable', 'too_large', 'not_file', 'invalid_path', 'changed']);
const DECISIONS = new Set(['accepted', 'changes_requested']);
const HISTORY_LIMIT = 100;

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
}

function text(value, label, limit, nonempty = false) {
  if (typeof value !== 'string' || value.length > limit || (nonempty && !value.trim())) throw new TypeError(`${label} must be ${nonempty ? 'nonempty ' : ''}text of at most ${limit} characters`);
  return value;
}

function isoDate(value) {
  if (typeof value !== 'string') throw new TypeError('A valid UTC ISO date is required');
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) throw new TypeError('A valid UTC ISO date is required');
  const canonical = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  const date = new Date(canonical);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== canonical) throw new TypeError('Invalid ISO calendar date');
  return canonical;
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    && !/^[\/\\]|^[a-z]:/i.test(value) && !/[\\\u0000-\u001f\u007f-\u009f]/.test(value)
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function claims(input) {
  requireObject(input, 'receipt');
  if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.id)) throw new TypeError('Invalid receipt id');
  const title = text(input.title, 'title', 200, true);
  if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > 20 || [...input.paths].some((path) => !safePath(path)) || new Set(input.paths).size !== input.paths.length) throw new TypeError('paths must contain 1–20 unique safe relative paths');
  const checks = input.checks === undefined ? [] : input.checks;
  if (!Array.isArray(checks) || checks.length > 20) throw new TypeError('checks must be an array of at most 20 items');
  return { id: input.id, title, paths: [...input.paths], checks: Array.from(checks, (check) => text(check, 'check', 500)) };
}

function observationsFor(paths, observations) {
  if (!Array.isArray(observations) || observations.length !== paths.length) throw new TypeError('observations must cover exactly the receipt paths');
  const byPath = new Map();
  for (const item of observations) {
    requireObject(item, 'observation');
    if (!paths.includes(item.path) || byPath.has(item.path)) throw new TypeError('Unexpected or duplicate observation path');
    if (!STATUSES.has(item.status)) throw new TypeError('Invalid observation status');
    if (item.size !== undefined && (!Number.isSafeInteger(item.size) || item.size < 0)) throw new TypeError('Invalid observation size');
    if (item.sha256 !== undefined && (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(item.sha256))) throw new TypeError('Invalid observation SHA-256 hash');
    if (item.status === 'ok' && (item.size === undefined || item.sha256 === undefined)) throw new TypeError('An ok observation requires size and SHA-256 hash');
    if (item.status !== 'ok' && item.sha256 !== undefined) throw new TypeError('A non-ok observation cannot carry a verified hash');
    const result = { path: item.path, status: item.status };
    if (item.size !== undefined) result.size = item.size;
    if (item.sha256 !== undefined) result.sha256 = item.sha256.toLowerCase();
    if (item.reason !== undefined) result.reason = text(item.reason, 'observation reason', 500);
    byPath.set(item.path, result);
  }
  return paths.map((path) => byPath.get(path));
}

function validVersion(version) {
  if (!Number.isSafeInteger(version) || version < 1) throw new TypeError('Invalid receipt version');
  return version;
}

function decisionRecord(value, version) {
  if (value === null) return null;
  requireObject(value, 'decision');
  if (!DECISIONS.has(value.decision) || value.version !== version) throw new TypeError('Invalid decision or decision version');
  return { decision: value.decision, note: text(value.note, 'note', 2000), at: isoDate(value.at), version };
}

function receiptRecord(input) {
  const base = claims(input);
  if (input.claimsSource !== 'agent') throw new TypeError('Invalid claims source');
  const version = validVersion(input.version);
  const createdAt = isoDate(input.createdAt);
  const updatedAt = isoDate(input.updatedAt);
  if (updatedAt < createdAt) throw new TypeError('Updated time precedes created time');
  if (!Array.isArray(input.history) || input.history.length < 1 || input.history.length > HISTORY_LIMIT) throw new TypeError('Invalid receipt history');
  const history = Array.from(input.history, (event) => {
    requireObject(event, 'history event');
    if (!['created', 'refreshed', 'decided'].includes(event.type) || validVersion(event.version) > version) throw new TypeError('Invalid history event version or type');
    const at = isoDate(event.at);
    if (at < createdAt || at > updatedAt) throw new TypeError('Invalid history event time');
    const clean = { type: event.type, at, version: event.version };
    if (event.type === 'decided') {
      if (!DECISIONS.has(event.decision)) throw new TypeError('Invalid history decision');
      clean.decision = event.decision;
      clean.note = text(event.note, 'history note', 2000);
    }
    return clean;
  });
  const decision = decisionRecord(input.decision, version);
  if (decision && (decision.at < createdAt || decision.at > updatedAt)) throw new TypeError('Invalid decision time');
  return { ...base, claimsSource: 'agent', version, createdAt, updatedAt, baseline: observationsFor(base.paths, input.baseline), decision, history };
}

function stateFor(baseline, current, decision) {
  if (current.some((item) => item.status === 'missing')) return 'missing';
  if (current.some((item) => item.status !== 'ok')) return 'unverifiable';
  if (current.some((item, i) => baseline[i].status !== 'ok' || item.sha256 !== baseline[i].sha256 || item.size !== baseline[i].size)) return 'stale';
  return decision?.decision ?? 'review_required';
}

function nextTime(receipt, now) {
  const at = isoDate(now);
  if (at < receipt.updatedAt) throw new TypeError('New time cannot precede the updated time');
  return at;
}

export function createReceipt(input, observations) {
  const base = claims(input);
  const at = isoDate(input.now);
  return { ...base, claimsSource: 'agent', version: 1, createdAt: at, updatedAt: at, baseline: observationsFor(base.paths, observations), decision: null, history: [{ type: 'created', at, version: 1 }] };
}

export function inspectReceipt(receipt, observations) {
  const clean = receiptRecord(receipt);
  const current = observationsFor(clean.paths, observations);
  return {
    id: clean.id, title: clean.title, paths: [...clean.paths], version: clean.version,
    createdAt: clean.createdAt, updatedAt: clean.updatedAt,
    claims: { source: 'agent', title: clean.title, paths: [...clean.paths], checks: [...clean.checks] },
    artifacts: clean.paths.map((path, i) => ({ path, current: current[i], baseline: clean.baseline[i] })),
    state: stateFor(clean.baseline, current, clean.decision), decision: clean.decision,
  };
}

export function refreshReceipt(receipt, observations, now) {
  const clean = receiptRecord(receipt);
  const at = nextTime(clean, now);
  const version = validVersion(clean.version + 1);
  return { ...clean, version, updatedAt: at, baseline: observationsFor(clean.paths, observations), decision: null, history: [...clean.history, { type: 'refreshed', at, version }].slice(-HISTORY_LIMIT) };
}

export function decideReceipt(receipt, observations, input) {
  const clean = receiptRecord(receipt);
  requireObject(input, 'decision');
  if (!DECISIONS.has(input.decision)) throw new TypeError('Invalid decision');
  const note = text(input.note === undefined ? '' : input.note, 'note', 2000);
  const at = nextTime(clean, input.now);
  const current = observationsFor(clean.paths, observations);
  if (input.decision === 'accepted' && !['review_required', 'accepted', 'changes_requested'].includes(stateFor(clean.baseline, current, clean.decision))) throw new Error('Acceptance requires every current file to match its intact baseline');
  const decision = { decision: input.decision, note, at, version: clean.version };
  return { ...clean, updatedAt: at, decision, history: [...clean.history, { type: 'decided', ...decision }].slice(-HISTORY_LIMIT) };
}

// Numeric entities render as text and cannot introduce Markdown links, HTML,
// directives or fences. Control/bidi characters never survive the export.
function markdownText(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function receiptMarkdown(view) {
  requireObject(view, 'receipt view');
  requireObject(view.claims, 'claims');
  if (view.claims.source !== 'agent') throw new TypeError('Invalid claims source');
  const base = claims({ id: view.id, title: view.title, paths: view.paths, checks: view.claims.checks });
  const version = validVersion(view.version);
  const decision = decisionRecord(view.decision, version);
  if (!Array.isArray(view.artifacts) || view.artifacts.length !== base.paths.length) throw new TypeError('Invalid artifact observations');
  const current = observationsFor(base.paths, view.artifacts.map((item) => item.current));
  const baseline = observationsFor(base.paths, view.artifacts.map((item) => item.baseline));
  const state = stateFor(baseline, current, decision);
  if (state !== view.state) throw new TypeError('Receipt view state does not match its evidence');
  const lines = [
    '# Delivery receipt', '', `ID: ${markdownText(base.id)}`, `Title: ${markdownText(base.title)}`,
    `Version: ${version}`, `State: ${state}`, '',
    'Agent claims are not independent verification.',
    'Local export is not external delivery. A recorded acceptance is a UI decision, not proof of recipient delivery.',
    'Titles, filenames, checks and notes may still contain sensitive information; review before sharing.', '',
    '## Agent-declared checks', '',
    ...(base.checks.length ? base.checks.map((check) => `- ${markdownText(check)}`) : ['- None declared.']), '',
    '## File observations', '',
  ];
  for (let i = 0; i < base.paths.length; i += 1) {
    const item = current[i];
    lines.push(`- Path: ${markdownText(item.path)}; current: ${item.status}; baseline: ${baseline[i].status}`);
    if (item.status === 'ok') lines.push(`  Size: ${item.size} bytes; SHA-256: ${item.sha256}`);
    if (baseline[i].status === 'ok') lines.push(`  Baseline size: ${baseline[i].size} bytes; SHA-256: ${baseline[i].sha256}`);
  }
  lines.push('', '## Recorded decision', '');
  if (decision) lines.push(`Decision: ${decision.decision}`, `At: ${decision.at}`, `Version: ${decision.version}`, `Note: ${markdownText(decision.note)}`);
  else lines.push('No decision recorded.');
  return `${lines.join('\n')}\n`;
}
