const SOURCE_FIELDS = ['id', 'title', 'sourceKind', 'reference', 'locator', 'excerpt'];
const CLAIM_FIELDS = ['id', 'text', 'claimKind', 'links'];
const QUESTION_FIELDS = ['id', 'question', 'claimId', 'status', 'resolution'];
const REVIEW_FIELDS = ['status', 'note', 'at', 'version'];
const SOURCE_KINDS = new Set(['public_url', 'local_reference']);
const CLAIM_KINDS = new Set(['fact_assertion', 'inference', 'proposal']);
const RELATIONS = new Set(['supports', 'contradicts', 'context']);
const REVIEW_STATUSES = new Set(['reviewed', 'needs_work']);
const SAVE_TYPES = new Set(['save_source', 'save_claim', 'save_question']);

function object(value, fields, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${label} must be an object`);
  for (const key of Reflect.ownKeys(value)) if (!fields.includes(key)) throw new TypeError(`Unknown ${label} field: ${String(key)}`);
  return value;
}

function text(value, label, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new TypeError(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${limit} characters`);
  return value;
}

function optionalText(value, label, limit) {
  return text(value === undefined ? '' : value, label, limit);
}

function id(value, label = 'id') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}

function array(value, label, limit, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.length > limit) throw new TypeError(`${label} array limit is ${minimum}–${limit}`);
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index)) throw new TypeError(`${label} array cannot be sparse`);
  return value;
}

function version(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid ledger version');
  return value;
}

function date(value) {
  if (typeof value !== 'string') throw new TypeError('A valid UTC ISO date is required');
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) throw new TypeError('A valid UTC ISO date is required');
  const canonical = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  const parsed = new Date(canonical);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== canonical) throw new TypeError('Invalid ISO calendar date');
  return canonical;
}

function reference(value, kind) {
  text(value, 'reference', 2000, true);
  if (/[\u0000-\u0020\u007f-\u009f]/.test(value) && kind === 'public_url') throw new TypeError('Invalid public URL reference');
  if (kind === 'public_url') {
    let url;
    try { url = new URL(value); } catch { throw new TypeError('Invalid public URL reference'); }
    if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || value.includes('\\')) throw new TypeError('Only credential-free HTTP(S) reference URLs are allowed');
  } else if (/^[\/\\]|^[a-z]:/i.test(value) || /[\\\u0000-\u001f\u007f-\u009f]/.test(value)
    || value.split('/').some(part => part === '' || part === '.' || part === '..')) throw new TypeError('A safe relative local reference path is required');
  return value;
}

function sourceRecord(value) {
  object(value, SOURCE_FIELDS, 'source');
  if (!SOURCE_KINDS.has(value.sourceKind)) throw new TypeError('Invalid source kind');
  return { id: id(value.id), title: text(value.title, 'title', 200, true), sourceKind: value.sourceKind,
    reference: reference(value.reference, value.sourceKind), locator: optionalText(value.locator, 'locator', 300), excerpt: optionalText(value.excerpt, 'excerpt', 500) };
}

function claimRecord(value, sources) {
  object(value, CLAIM_FIELDS, 'claim');
  if (!CLAIM_KINDS.has(value.claimKind)) throw new TypeError('Invalid claim kind');
  const seen = new Set();
  const links = array(value.links === undefined ? [] : value.links, 'links', 20).map(link => {
    object(link, ['sourceId', 'relation'], 'link');
    id(link.sourceId, 'source ID');
    if (!sources.has(link.sourceId) || seen.has(link.sourceId)) throw new TypeError('Missing or duplicate linked source ID');
    if (!RELATIONS.has(link.relation)) throw new TypeError('Invalid source relation');
    seen.add(link.sourceId);
    return { sourceId: link.sourceId, relation: link.relation };
  });
  return { id: id(value.id), text: text(value.text, 'claim text', 2000, true), claimKind: value.claimKind, links };
}

function questionRecord(value, claims) {
  object(value, QUESTION_FIELDS, 'question');
  const status = value.status === undefined ? 'open' : value.status;
  if (!['open', 'resolved'].includes(status)) throw new TypeError('Invalid question status');
  const resolution = optionalText(value.resolution, 'resolution', 1000);
  if (status === 'resolved' && !resolution.trim()) throw new TypeError('Resolved questions need a nonempty resolution');
  const result = { id: id(value.id), question: text(value.question, 'question', 1000, true), status, resolution };
  if (value.claimId !== undefined) {
    id(value.claimId, 'claim ID');
    if (!claims.has(value.claimId)) throw new TypeError('Question claim ID does not exist');
    result.claimId = value.claimId;
  }
  return result;
}

function uniqueRecords(values, label, limit, parse) {
  const seen = new Set();
  return array(values, label, limit).map(value => {
    const record = parse(value);
    if (seen.has(record.id)) throw new TypeError(`Duplicate ${label} ID`);
    seen.add(record.id);
    return record;
  });
}

function reviewRecord(value, ledgerVersion) {
  if (value === null) return null;
  object(value, REVIEW_FIELDS, 'review');
  if (!REVIEW_STATUSES.has(value.status) || version(value.version) !== ledgerVersion) throw new TypeError('Invalid review status or version');
  return { status: value.status, note: text(value.note, 'review note', 2000), at: date(value.at), version: ledgerVersion };
}

/** Parse, clone and enforce canonical bounds/reference integrity for both reads and writes. */
export function validateLedger(value) {
  object(value, ['version', 'createdAt', 'updatedAt', 'sources', 'claims', 'questions', 'review', 'history'], 'ledger');
  const currentVersion = version(value.version);
  const createdAt = date(value.createdAt);
  const updatedAt = date(value.updatedAt);
  if (updatedAt < createdAt) throw new TypeError('Ledger updated time precedes creation');
  const sources = uniqueRecords(value.sources, 'sources', 100, sourceRecord);
  const sourceIds = new Set(sources.map(item => item.id));
  const claims = uniqueRecords(value.claims, 'claims', 100, item => claimRecord(item, sourceIds));
  const claimIds = new Set(claims.map(item => item.id));
  const questions = uniqueRecords(value.questions, 'questions', 50, item => questionRecord(item, claimIds));
  const review = reviewRecord(value.review, currentVersion);
  if (review && (review.at < createdAt || review.at > updatedAt)) throw new TypeError('Invalid review time');
  let previousVersion = 0;
  let previousTime = createdAt;
  const history = array(value.history, 'history', 100).map(event => {
    object(event, event?.type === 'review' ? ['type', ...REVIEW_FIELDS] : ['type', 'id', 'at', 'version'], 'history event');
    const eventVersion = version(event.version);
    const at = date(event.at);
    if (eventVersion > currentVersion || eventVersion < previousVersion || at < previousTime || at > updatedAt) throw new TypeError('Invalid history version or time');
    previousVersion = eventVersion;
    previousTime = at;
    if (event.type === 'review') return { type: 'review', ...reviewRecord({ status: event.status, note: event.note, at, version: eventVersion }, eventVersion) };
    if (!SAVE_TYPES.has(event.type) || eventVersion === 0) throw new TypeError('Invalid history event type or version');
    return { type: event.type, id: id(event.id), at, version: eventVersion };
  });
  return { version: currentVersion, createdAt, updatedAt, sources, claims, questions, review, history };
}

export function createLedger(now) {
  const at = date(now);
  return { version: 0, createdAt: at, updatedAt: at, sources: [], claims: [], questions: [], review: null, history: [] };
}

function expected(ledger, input, now) {
  if (version(input.expectedVersion) !== ledger.version) throw new Error('Ledger version changed; inspect again');
  const at = date(now);
  if (at < ledger.updatedAt) throw new TypeError('New time cannot precede ledger updated time');
  return at;
}

function save(value, input, options, type, field, fields, limit, parse) {
  const ledger = validateLedger(value);
  object(input, ['expectedVersion', ...fields], type);
  object(options, ['now', 'id'], 'save options');
  const at = expected(ledger, input, options.now);
  let key;
  if (input.id === undefined) {
    key = id(options.id);
    if (ledger[field].length >= limit) throw new Error(`${field} limit reached`);
    if (ledger[field].some(item => item.id === key)) throw new Error('Generated ID collision');
  } else {
    key = id(input.id);
    if (!ledger[field].some(item => item.id === key)) throw new Error('Updated item ID must already exist');
  }
  const { expectedVersion: _expectedVersion, ...recordInput } = input;
  const record = parse({ ...recordInput, id: key }, ledger);
  const records = input.id === undefined ? [...ledger[field], record] : ledger[field].map(item => item.id === key ? record : item);
  const nextVersion = version(ledger.version + 1);
  return validateLedger({ ...ledger, version: nextVersion, updatedAt: at, [field]: records, review: null,
    history: [...ledger.history, { type, id: key, at, version: nextVersion }].slice(-100) });
}

export function saveSource(ledger, input, options) {
  return save(ledger, input, options, 'save_source', 'sources', SOURCE_FIELDS, 100, sourceRecord);
}

export function saveClaim(ledger, input, options) {
  return save(ledger, input, options, 'save_claim', 'claims', CLAIM_FIELDS, 100,
    (record, current) => claimRecord(record, new Set(current.sources.map(item => item.id))));
}

export function saveQuestion(ledger, input, options) {
  return save(ledger, input, options, 'save_question', 'questions', QUESTION_FIELDS, 50,
    (record, current) => questionRecord(record, new Set(current.claims.map(item => item.id))));
}

export function reviewLedger(value, input, now) {
  const ledger = validateLedger(value);
  object(input, ['expectedVersion', 'status', 'note'], 'review input');
  const at = expected(ledger, input, now);
  const review = reviewRecord({ status: input.status, note: optionalText(input.note, 'review note', 2000), at, version: ledger.version }, ledger.version);
  return validateLedger({ ...ledger, updatedAt: at, review, history: [...ledger.history, { type: 'review', ...review }].slice(-100) });
}

export function inspectLedger(value) {
  const ledger = validateLedger(value);
  const issues = [];
  for (const source of ledger.sources) if (!source.locator.trim()) issues.push({ type: 'source_without_locator', sourceId: source.id, message: 'Recorded source has no locator.' });
  for (const claim of ledger.claims) {
    if (claim.claimKind === 'fact_assertion' && !claim.links.length) issues.push({ type: 'assertion_without_source', claimId: claim.id, message: 'Fact assertion has no recorded source.' });
    for (const link of claim.links) if (link.relation === 'contradicts') issues.push({ type: 'recorded_contradiction', claimId: claim.id, sourceId: link.sourceId, message: 'Contradicting material was recorded; its accuracy is not established.' });
  }
  for (const question of ledger.questions) if (question.status === 'open') issues.push({ type: 'open_question', questionId: question.id, ...(question.claimId ? { claimId: question.claimId } : {}), message: 'Question remains open.' });
  return { ledger, issues };
}

function markdownText(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, character => `&#${character.charCodeAt(0)};`);
}

export function exportLedger(value, options) {
  const ledger = validateLedger(value);
  object(options, ['claimIds', 'includeExcerpts', 'includeReviewNotes', 'includeLocalReferences'], 'export options');
  const selected = new Set();
  for (const key of array(options.claimIds, 'selected claim IDs', 100, 1)) {
    id(key, 'selected claim ID');
    if (selected.has(key) || !ledger.claims.some(item => item.id === key)) throw new TypeError('Selected claim IDs must exist and be unique');
    selected.add(key);
  }
  for (const field of ['includeExcerpts', 'includeReviewNotes', 'includeLocalReferences']) if (options[field] !== undefined && typeof options[field] !== 'boolean') throw new TypeError(`${field} must be boolean`);
  const claims = ledger.claims.filter(item => selected.has(item.id));
  const sourceIds = new Set(claims.flatMap(item => item.links.map(link => link.sourceId)));
  const sources = ledger.sources.filter(item => sourceIds.has(item.id));
  const questions = ledger.questions.filter(item => selected.has(item.claimId));
  const lines = ['# Evidence ledger', '', `Ledger version: ${ledger.version}`, '',
    'Recorded assertions, classifications, excerpts and relations are not independent verification or proof of truth.',
    'The plugin has not fetched, opened or verified these sources. User review is a version-bound UI record, not source verification.',
    'This selected local export is not publication or external delivery.',
    'Titles, claim text and URLs may still be sensitive. Review before sharing; automatic deidentification is not guaranteed.', '', '## Selected claims', ''];
  for (const claim of claims) {
    lines.push(`### ${markdownText(claim.id)}`, '', `Kind: ${claim.claimKind}`, `Text: ${markdownText(claim.text)}`, '');
    if (!claim.links.length) lines.push('- No source recorded.');
    for (const link of claim.links) lines.push(`- ${link.relation}: ${markdownText(link.sourceId)}`);
    lines.push('');
  }
  lines.push('## Associated sources', '');
  for (const source of sources) {
    lines.push(`### ${markdownText(source.id)}`, '', `Title: ${markdownText(source.title)}`, `Kind: ${source.sourceKind}`);
    // References remain inert text. Safe protocols are checked at ingestion; no URL is fetched.
    lines.push(`Reference: ${source.sourceKind === 'local_reference' && !options.includeLocalReferences ? '[local reference omitted]' : markdownText(source.reference)}`);
    lines.push(`Locator: ${markdownText(source.locator) || '[not recorded]'}`);
    if (options.includeExcerpts && source.excerpt) lines.push(`Recorded excerpt: ${markdownText(source.excerpt)}`);
    lines.push('');
  }
  lines.push('## Associated questions', '');
  for (const question of questions) {
    lines.push(`- ${markdownText(question.id)} (${question.status}; claim ${markdownText(question.claimId)}): ${markdownText(question.question)}`);
    if (question.resolution) lines.push(`  Recorded resolution: ${markdownText(question.resolution)}`);
  }
  if (!questions.length) lines.push('- No associated questions recorded.');
  lines.push('', '## Whole-ledger user review', '');
  if (ledger.review) {
    lines.push(`Status: ${ledger.review.status}; version: ${ledger.review.version}; at: ${ledger.review.at}`);
    if (options.includeReviewNotes) lines.push(`Note: ${markdownText(ledger.review.note)}`);
  } else lines.push('No current review recorded.');
  return `${lines.join('\n')}\n`;
}
