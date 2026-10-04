# Delivery Receipts Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and independent review. Each worker owns explicit files. Do not mutate real Harness profiles during testing.

**Goal:** Publish an installable, evidence-bounded Delivery Receipts plugin for official Harness 0.2.0-rc.2.

**Architecture:** A zero-dependency domain and bounded file reader feed a thin official Harness tool/command/storage adapter. A native session view invokes the same operations; user decisions are UI commands, never tool-writable evidence.

**Tech Stack:** Node.js ESM, node:test, official Cordis/Harness 0.2.0-rc.2 peer APIs and the native module loader. No network service or private model credential is required.

---

## Task 1: Domain and bounded artifact reads

Files: `packages/dsh-delivery-receipts/src/domain.js`, `src/artifacts.js`, `test/domain.test.js`, `test/artifacts.test.js`.

- [x] Write failing node:test assertions for exported `createReceipt`, `inspectReceipt`, `refreshReceipt`, `decideReceipt`, `receiptMarkdown`, `probeArtifact` and `previewArtifact`.
- [x] Implement after observing the expected failures; retain passing tests for traversal, symlink, nonregular file, stale acceptance and size bounds.
- [x] Run `node --test packages/dsh-delivery-receipts/test/*.test.js` and record output.
- [x] Review the actual diff against the spec, then commit reviewed project files.

Domain contracts (all timestamps supplied by the caller):

```js
const observation = { path: 'report.md', status: 'ok', size: 8, sha256: 'a'.repeat(64) };
const r = createReceipt({ id: 'r1', title: 'Report', paths: ['report.md'], checks: ['Numbers checked'], now: '2026-10-04T00:00:00Z' }, [observation]);
const view = inspectReceipt(r, [observation]);
// view.state === 'review_required'; view.claims.source === 'agent'
const accepted = decideReceipt(r, [observation], { decision: 'accepted', note: '', now: '2026-10-04T00:01:00Z' });
// inspectReceipt(accepted, [observation]).state === 'accepted'
const changed = { ...observation, sha256: 'b'.repeat(64) };
// inspectReceipt(accepted, [changed]).state === 'stale'
const next = refreshReceipt(accepted, [changed], '2026-10-04T00:02:00Z');
// next.version === 2; next.decision === null
```

`probeArtifact(root, relativePath, options?)` returns only `{path,status,size?,sha256?,reason?}`; statuses are `ok`, `missing`, `unreadable`, `too_large`, `not_file`, `invalid_path`, `changed`. Default maxBytes is 64 MiB. Options may lower the bound in tests. `previewArtifact` returns a bounded UTF-8 preview with an explicit truncation flag or a structured unsupported result; never evaluate HTML.

`createReceipt` requires 1–20 unique paths, title <=200 characters, <=20 checks <=500 characters. Caller-generated IDs use safe alphanumeric/dash/underscore, <=80 characters. `decideReceipt` accepts `accepted` or `changes_requested`; acceptance requires all current observations to match an intact baseline. User note <=2000 characters. Rejection may be recorded for stale/missing artifacts. Functions do not mutate inputs. Markdown escapes structural injection and omits raw content and absolute paths; exports state explicit evidence boundaries.

## Task 2: Actual Harness adapter

Files: package `index.js`, `client.js`, `package.json`, `cordis.patch.yml`, `test/service.test.js`, `test/client.test.js`, root `scripts/host-smoke.mjs`.

- [x] Read tagged official plugin templates and tool/command/storage/slot contracts; pin the tested runtime version rather than invent API names.
- [x] Write adapter tests for session scoping, input validation, shared operation handlers and absence of an agent confirmation tool.
- [x] Implement receipt registration, listing, inspection and refresh tools. Tool operations derive session/workspace context from Harness, not caller paths.
- [x] Implement UI list/detail, bounded preview, checks/provenance, recheck/refresh, decisions and Markdown download. Use official theme tokens only.
- [x] Install into a fresh test DSH_HOME via the official plugin CLI/manager, not hand-written profile edits; verify actual registration and behavior.
- [x] Independently review spec compliance then code quality/security; repair findings with regression tests.

## Task 3: Public package and end-to-end proof

Files: package `README.md`, `LICENSE`, root `package.json`, `scripts/check-release.mjs`, `examples/`, `docs/verification.md`, release `.tgz` and checksums.

- [x] Create synthetic article/report/release-note fixtures and exercise their receipts through the real adapter; actual scenario coverage is listed in `docs/verification.md`.
- [x] Exercise light/dark UI, keyboard navigation, stale/missing files, restart persistence and remove/reinstall in the isolated profile.
- [x] Pack prebuilt files with `npm pack`; inspect the archive allowlist, scan for private paths/secrets and verify no install/prepare script.
- [ ] Create GitHub Release only after tests/review pass. Download that published archive into a second clean location, compare its checksum and smoke install/remove it.
- [ ] Submit the exact community YAML only after release verification and the repository age rule is satisfied; report submission separately from maintainer acceptance.

## Task 4: Evidence Ledger decision

- [x] After Delivery Receipts passes review, specify the separate claim/source ledger against existing community coverage.
- [x] Reuse infrastructure only when it is already tested; give the second plugin its own domain tests, bundle, documentation and installation verification.
- [x] Never publish an unfinished placeholder package to increase plugin count.

## Progress and boundaries

- Approved design: previous proposal plus explicit end-to-end user authorization.
- Host upgrade is an independent task with recoverable app/data backups.
- Public distribution: GitHub Release tarballs; npm publication is optional and currently unauthenticated.
- Author identity: 牛村木木山. No private workspace, company data, profile file, credential or conversation is a release asset.
