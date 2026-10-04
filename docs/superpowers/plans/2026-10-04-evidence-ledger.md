# Evidence Ledger implementation plan

Use subagent-driven development with separate implementation and independent reviews. Start implementation only after the Delivery Receipts specification review passes.

1. Domain and service: write failing tests for versioned source/claim/question edits, reference validation, whole-ledger review invalidation, bounded metadata, selected safe exports and session ownership. Implement pure functions and a serialized table adapter under `packages/dsh-evidence-ledger/src/`.
2. Host bundle: reuse only verified public rc.2 patterns. Add `index.js`, manifest, Cordis patch, locale labels and exact package loader ID. Use `evidence_ledger` tool and `/evidence_ledger` command. Register no custom session events.
3. Native UI: show claims and their related sources/questions, explicit issue labels, current review and local export preview. The agent owns data entry, the user owns review and optional sensitive export fields. Use existing Harness theme tokens, keyboard-operable controls, session remount guards and inert text.
4. Verification: unit tests, syntax checks, real Host pipeline integration, isolated packaged installation, light/dark layout, export contents, refresh/restart and uninstall/reinstall. Fix review findings with regression tests.
5. Public delivery: bilingual README, MIT license, synthetic examples, exact compatibility/limitations, checksum and source commit. No release or community entry for an unfinished or unverified package. A downloaded release must pass clean-profile installation before submission.

The first release may contain both packages only when both satisfy their own acceptance gates. Do not delay or mislabel a validated first package merely because the second is still in development.
