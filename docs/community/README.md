# Community submission preparation

Status: local drafts only. No community pull request or acceptance is recorded here. The tarball URLs in the two YAML files are intended release locations, not evidence that the assets already exist or install successfully.

Target: [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), a community-curated list. A listing is not official DeepSeek approval or a security audit.

## Files to submit

After the release gates below pass, copy these files, without renaming, into the community repository's `data/plugins/` directory:

- `piggy00544__dsh-workproof--packages-dsh-delivery-receipts.yml`
- `piggy00544__dsh-workproof--packages-dsh-evidence-ledger.yml`

These are two independently installable packages in one monorepo. Their URLs point to their own package directories, not the private workspace root. Both use `workflow` because their primary function is a human-reviewed delivery/research workflow, not model-driven autonomous verification. The tarball URLs pin both the release tag and asset version.

Do not add an `npm`, `verified`, `status`, or custom installation-command field. Do not edit the community repository's generated READMEs. No npm publication is required for listing.

## Required checks before opening a pull request

- The public source contains each complete package and its `dsh.bundle` manifest, not just initial documentation.
- The repository is public, not archived, has the `dsh-plugin` topic, and its GitHub `created_at` is at least 24 hours earlier than submission. There is no commit-count minimum; do not create filler commits.
- Both pinned release assets exist, have been downloaded again, match the published SHA-256 values, and have passed clean isolated-profile installation checks on the declared host version.
- Package READMEs and the release verification record describe observed results, with remaining platform and UI limits stated. Local tests are not GitHub CI results. An inactive CI template is not an executed workflow.
- Descriptions still match the released code. In particular, file identity is not content quality or external publication, and evidence bookkeeping is not automated source verification. Ledger export selection and omissions apply to the generated Markdown, not an access-control boundary against the owning session's agent.
- The two YAML files pass the upstream entry validator and the eventual upstream PR checks. Do not interpret local YAML parsing as a complete submission-gate pass.
- Open at most one PR containing these two new entry files only. The current cap is three entries per PR. Maintainers still review claims, duplication, and category after CI.

If the repository-age gate is the only remaining failure, the current checker says it will rerun automatically. Do not close/reopen a PR or manufacture commits merely to clear the age gate. Recheck current upstream rules immediately before actual submission; this file is not a scheduled submission request.

## Rules reviewed

Read on 2026-10-04 at upstream commit `bb8496ec4cbb9217b33bf081ec4cdf06b51501e8`:

- [Contribution requirements and monorepo/tarball conventions](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/bb8496ec4cbb9217b33bf081ec4cdf06b51501e8/contributing.md).
- [Allowed YAML fields, category IDs, filename and tarball validation](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/bb8496ec4cbb9217b33bf081ec4cdf06b51501e8/scripts/lib/entries.mjs).
- [Live submission checker: one-day age, no commit floor, three-entry cap, exact subpackage manifest](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/bb8496ec4cbb9217b33bf081ec4cdf06b51501e8/scripts/check-submission.mjs).
- [Submission-gate workflow and its data-only treatment of PR entry files](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/bb8496ec4cbb9217b33bf081ec4cdf06b51501e8/.github/workflows/pr-gate.yml).

Optional screenshots belong in each plugin's own repository directory, declared by a `screenshots.json` beside its `package.json`; they are not needed for these drafts. Only synthetic, privacy-reviewed images should be considered.
