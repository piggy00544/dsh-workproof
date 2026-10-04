# Evidence Ledger v0.1 design

## Purpose and scope

The second plugin turns reusable research and analytical habits into a small native Harness ledger: which statement is an assertion, inference or proposal; which recorded sources support or challenge it; and which questions remain open. Delivery Receipts tracks file versions. Evidence Ledger tracks reasoning structure. Neither automatically determines truth.

This is a separate installable bundle, `dsh-evidence-ledger`, targeting the same official Harness 0.2.0-rc.2 APIs. No private project content is part of its source or examples.

## Minimal model

One ledger per trusted session and local workspace, with a monotonically increasing version starting at 0. It contains at most 100 sources, 100 claims, 50 questions and 100 recent audit entries.

- Source: stable generated ID, title (200 characters), reference kind `public_url` or `local_reference`, reference (2,000 characters), optional locator (300) and excerpt (500). HTTP(S) URLs must not contain embedded username/password. Local references must be safe relative paths; they are metadata and are never read. Entries are recorded material, not evidence that the source was opened or verified.
- Claim: stable generated ID, text (2,000), kind `fact_assertion`, `inference` or `proposal`, and at most 20 unique links `{sourceId, relation}` where relation is `supports`, `contradicts` or `context`. Referenced sources must exist. Classification and relations are the recorder's claims.
- Question: stable generated ID, question (1,000), optional existing claim ID, `open` or `resolved`, and resolution text (1,000). Resolving requires a nonempty explanation; no automatic correctness claim follows.
- Review: user command only, `reviewed` or `needs_work`, note (2,000), timestamp and exact ledger version. Any source, claim or question edit clears the current review; bounded history keeps previous review metadata. This conservative whole-ledger invalidation is explicit, not selective causal tracking.

## Operations and UI

Agent tool `evidence_ledger`: `inspect`, `save_source`, `save_claim`, `save_question`, `export`. All saves require `expectedVersion`; absent item ID creates a generated ID, present item ID must already exist. No delete, arbitrary store key, custom events, model calls, filesystem scan, external fetch or shell execution.

User slash command `/evidence_ledger` supports the same actions plus `review`. Native conversation view shows the ledger, structural issues, sources and open questions; the agent creates/edits entries while the user reviews and exports. No duplicate manual data-entry UI is required in v0.1.

Structural issues are descriptive: assertion without a source, source without a locator, recorded contradiction, open question. No score, `true`, `verified` or automatically approved status. User review remains a UI record, not cryptographic human identity or proof of source accuracy.

Downloaded Markdown exports require an explicit nonempty selection of claim IDs, include only their associated sources/questions, and default to omitting excerpts, review notes and local reference paths. User-side export may explicitly include those optional fields; agent exports cannot opt them in. This omission applies to the Markdown artifact, not the internal response: inspection and export responses include the complete owning-session ledger for UI updates. This is not a private vault hiding fields from the agent in that same session. Export is a local Markdown download, not publication. Text and URLs may still be sensitive; the preview warns the user to review before sharing. All metadata is inert and structurally escaped; public URLs are links only when their protocol is safe.

## Engineering and acceptance

Use official storageDomain and exact package/module IDs. No profile JSON edits, private credentials or telemetry. Serialize writes per owner and reject stale versions, wrong types, unknown fields, malformed or sparse collections, dangling references, duplicate relation IDs and exceeded bounds. Canonical storage schema validates every write. Session/workspace ownership comes only from the host.

Tests must show expected failures before implementation, then cover references, invalidation, safe exports, limits, isolation and concurrency. Run the real rc.2 host integration, install a packed bundle in an isolated profile, exercise native UI and download, restart persistence, uninstall/reinstall, and independently review specification then code quality. Publish only after these pass; download the public release and verify a clean installation before community submission.

Synthetic examples: an assertion with no source, an inference whose recorded source does not itself establish the conclusion, and a claim with contradicting material plus an open question. These are demonstrations, not fabricated research results.
