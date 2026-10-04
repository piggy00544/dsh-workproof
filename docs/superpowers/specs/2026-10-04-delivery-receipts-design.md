# Delivery Receipts v0.1 design

## Product contract

The user has approved a small delivery-receipt plugin and end-to-end development and community publication. This first release is separate from the later evidence-ledger plugin. The deliverable is an installed and tested Harness plugin, not a standalone mockup. Publication means a public source repository and a downloadable prebuilt release; community submission and maintainer acceptance are separate states.

A receipt answers four questions: what was requested, where is the artifact, what evidence exists for this exact version, and what is still unresolved? This supports writing, reports and software packages without embedding business-specific policies or private examples.

## In scope

1. An agent tool creates a receipt for 1–20 explicit relative workspace files, a title and optional agent-declared checks. The host computes file observations itself; the tool cannot supply machine hashes or a user decision.
2. A per-session interface lists receipts and the latest artifact state. It shows agent-declared checks separately from machine-observed existence/size/SHA-256 and UI-recorded acceptance or requested changes.
3. A person may accept the current observed version or request changes. Acceptance is a user-interface record, not cryptographic proof of human identity and not a claim of delivery to an external recipient.
4. Rechecking a receipt after content changes marks its prior snapshot and acceptance stale. Missing, unreadable, oversized or changing files never receive a verified-current badge. Rechecking does not silently replace the baseline; refresh explicitly creates a new version and resets acceptance.
5. A bounded plain-text preview and a downloadable Markdown receipt provide navigation and handoff. The export contains workspace-relative paths, not absolute host paths. It warns that titles, filenames and notes may still be sensitive; no promise of automatic comprehensive redaction.
6. Records persist across restart in session-scoped plugin storage. The plugin writes no custom events into the core session log and never rewrites conversation history.

## Non-goals

No background filesystem scan, source crawling, custom model call, autonomous retry loop, shell execution, automatic publish/send/deploy, migration of existing sessions, memory database, or automatic business-quality verdict. An agent-declared successful test remains an agent claim in v0.1.

## Trust and storage

- Tool input is untrusted. IDs, titles, paths, notes, check counts and lengths have bounded schemas and runtime validation.
- Paths must be relative, beneath the real workspace root, and point to regular files. Reject absolute paths, drive/UNC forms, traversal, null bytes and symlinks below the root. Do not accept an arbitrary root from the tool or browser.
- Hash only explicit files, with a 64 MiB per-file limit; preview plain text up to 64 KiB. The host refuses device/FIFO/directory reads and detects file changes during inspection.
- Storage keys bind records to the actual session. Browser requests cannot nominate a different workspace root. User confirmation is not exposed as an agent tool.
- Writes use the official storage-domain mechanism or a documented equivalent; never write profile manifests or core session JSON directly.
- No telemetry/network requests or credentials. An exported receipt is local until a user shares it.
- This is not a security boundary against an adversary with arbitrary host execution or write access to the data store.

## Modules

`packages/dsh-delivery-receipts/src/domain.js`: pure receipt version/state/export functions.

`packages/dsh-delivery-receipts/src/artifacts.js`: bounded workspace file inspection and text preview.

`packages/dsh-delivery-receipts/index.js`: version-pinned Harness services, storage, commands and agent tool adapter.

`packages/dsh-delivery-receipts/client.js`: native Harness slot, session-scoped list/detail view, recheck, refresh, acceptance, changes requested and local export.

`packages/dsh-delivery-receipts/package.json` and `cordis.patch.yml`: installable, prebuilt bundle without install-time scripts.

## Visual direction

Use the current Harness theme tokens, native type hierarchy, thin separators, compact rows and restrained semantic status colors. Both dark and light mode must work. No branded imitation, gradients, nested decorative cards or external font/image fetches. Scope CSS under the plugin root; do not import internal Harness UI component packages.

## Acceptance evidence

- Unit and filesystem tests cover stale hashes, missing files, invalid paths, symlink escape, nonregular files, size limits, acceptance reset and export escaping.
- A fresh isolated profile installs the packed archive, mounts the real plugin, exercises tools and UI on synthetic files, persists across restart, and removes cleanly.
- Three synthetic demos represent a draft article, a data report and a code/test handoff. They demonstrate status boundaries, not fabricated real-world deployments.
- Independent spec and code/security reviews have no unresolved critical or important findings before public release.
- A clean-profile installation of the downloaded Release archive, not just the source checkout, is verified before community submission.
- README states the exact tested Harness version and limits; checksums and a source commit identify release artifacts.

