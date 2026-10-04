# DSH Workproof

Small, local-first DeepSeek Harness plugins that distinguish an agent's claims from the evidence a person can inspect.

Author: **牛村木木山** · Community project, not an official DeepSeek product.

## Status

In development. No release is ready for installation yet. Published releases will include prebuilt packages, tested host versions, checksums, installation and removal instructions, and explicit limitations.

## First plugin: Delivery Receipts / 交付回执

Find the current artifact, inspect file evidence, and record acceptance without confusing “generated”, “checked”, and “delivered”. File changes invalidate earlier acceptance. This is an evidence display and handoff tool, not a quality oracle or autonomous retry controller.

## Next candidate: Evidence Ledger / 研究证据账本

Keep explicit claims, public sources, short excerpts, and unresolved questions together. A recorded source is not proof that a claim is true.

## Privacy principles

- No telemetry, background crawling, automatic upload, or bundled credentials.
- Operate on explicitly selected workspace artifacts, not private conversation history.
- Public examples use synthetic content only.
- Host plugins run with host-process permissions. “Local-first” is not a sandbox guarantee.

See [the design](docs/superpowers/specs/2026-10-04-delivery-receipts-design.md) and [implementation plan](docs/superpowers/plans/2026-10-04-delivery-receipts.md).

