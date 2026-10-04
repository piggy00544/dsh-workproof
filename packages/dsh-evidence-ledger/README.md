# Evidence ledger for DeepSeek Harness

[中文说明](README.zh.md)

Find the basis for a judgment without mistaking “has a reference” for “has been verified.”

Author: **牛村木木山**. A community project, not an official DeepSeek product.

## Release status and compatibility

**Version 0.1.0.** See [Releases](https://github.com/piggy00544/dsh-workproof/releases) for downloadable assets and [the verification record](https://github.com/piggy00544/dsh-workproof/blob/main/docs/verification.md) for completed checks and remaining boundaries. A package version is not a promise of compatibility with untested hosts.

This package targets **DeepSeek Harness `0.2.0-rc.2` exactly**, with peers `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-storage-domain` and `@deepseek-ai/dsh-commands` all pinned to `0.2.0-rc.2`. Node.js **22+** is required. The first acceptance target is a **local macOS workspace**; other operating systems, remote workspaces and Harness versions are unverified.

## What it does

One session/workspace ledger connects:

- **Recorded sources:** reference metadata, a locator and an optional short excerpt. The plugin never fetches a URL or reads a referenced local file.
- **Claims:** `fact_assertion`, `inference` or `proposal`, linked to sources as `supports`, `contradicts` or `context`. These classifications are the recorder's claims, not truth determinations.
- **Questions:** open or marked resolved, optionally connected to a claim. Resolution requires an explanation; it does not establish correctness.
- **Your review:** “Reviewed this version” or “Needs more work,” with an optional note. Every source, claim or question save clears the current review, even if the changed entry is not linked to the claim you reviewed.

Structural observations identify assertions with no source, sources with no locator, recorded contradictions and open questions. There is no quality score, automatically verified fact or automated approval. No listed issue is not proof of correctness.

**Delivery Receipts** tracks local artifact bytes and acceptance of a file version. **Evidence ledger** tracks recorded reasoning and source relationships. They are separate installable plugins; neither needs the other.

## Installation

The distribution uses a prebuilt GitHub Release `.tgz`, with **no install-time scripts** and no npm account requirement. The package manager may fetch declared dependencies when installing.

After checking the v0.1.0 Release and its checksums, install into your intended profile:

```sh
dsh plugin --profile web add https://github.com/piggy00544/dsh-workproof/releases/download/v0.1.0/dsh-evidence-ledger-0.1.0.tgz
```

`web` is an example profile, not a universal Desktop profile name. Use the profile selected by your actual app and follow the Harness version's normal reload/restart behavior. Source and release status: [piggy00544/dsh-workproof](https://github.com/piggy00544/dsh-workproof).

## Everyday use

1. Open **Evidence ledger / 研究证据账本** in the native `conversation.view` tab of a local workspace conversation.
2. Ask the agent to inspect the ledger and record sources, claims and unresolved questions. The first empty ledger is version `0`.
3. Expand a claim's sources and inspect the recorded relation, locator and excerpt. Reference text is inert; nothing is automatically opened or fetched.
4. Review the actual sources yourself through your normal workflow. Record “Reviewed this version” or “Needs more work” in the tab. That records your UI decision, not independent verification or a cryptographic identity proof.
5. After any entry is saved, reload and review the new version. IDs remain stable on update; the ledger version increases and the current review clears. Only the latest 100 audit events are retained.
6. Select the claim IDs you want to export, preview the resulting Markdown, then download. No export is generated for an empty selection. Export is local, not publication or delivery.

Harness rc.2 hides conversation tabs in a blank session. Use an existing normal conversation or start one first; running a slash command alone does not leave the blank-session state. A hidden tab in that state does not require reinstalling the plugin or changing configuration.

The initial UI deliberately has no duplicate manual entry form: the agent records structured entries; the user inspects, reviews and controls optional export fields.

## Tool and command contract

Agent tool: **`evidence_ledger`**. User command: **`/evidence_ledger`**, taking a JSON object and defaulting to `inspect` when empty.

| Action | Required input beyond `action` | Optional input |
|---|---|---|
| `inspect` | None | None |
| `save_source` | `expectedVersion`, `title`, `sourceKind`, `reference` | Existing `id`, `locator`, `excerpt` |
| `save_claim` | `expectedVersion`, `text`, `claimKind` | Existing `id`, `links` |
| `save_question` | `expectedVersion`, `question` | Existing `id`, `claimId`, `status`, `resolution` |
| `export` | Nonempty unique `claimIds` | User-command privacy options below |
| `review` — user command only | `expectedVersion`, `status` | `note` |

`sourceKind`: `public_url` or `local_reference`. `claimKind`: `fact_assertion`, `inference` or `proposal`. `links`: an array of `{sourceId, relation}`, with each source ID appearing at most once and each relation `supports`, `contradicts` or `context`. Question `status` defaults to `open`; `resolved` requires a nonempty `resolution`. Review `status` is `reviewed` or `needs_work`.

Omit an item `id` to create; the host generates it. Supply an existing ID to replace the entry; nonexistent IDs are rejected. Updates replace the entry's fields, not patch omitted optional fields. For example, omitting `claimId` on a question update removes its association. Always inspect before saving and use its `expectedVersion`; a stale save fails rather than silently overwriting newer work. Optional defaults apply only to absent/undefined fields: `null` and wrong types are rejected.

Inspect, saves and review return `{ledger, issues}`; export returns `{ledger, issues, markdown}`. These internal RPC/tool responses still include the complete owning-session ledger, including recorded excerpts, review notes and unselected claims. Selection and privacy options govern only the **downloaded/shareable Markdown**: they do not redact the complete internal response or restrict the existing local agent/session's access. This is not a privacy vault or a cross-agent secret store; separate-session isolation remains enforced by the host owner.

The model-facing tool cannot review. Only the user command may set `includeExcerpts`, `includeReviewNotes` or `includeLocalReferences` when exporting; all default to `false`. Command access is a product interaction boundary, not a sandbox against arbitrary code execution in the host.

## Three synthetic walkthroughs

Use the instructions in [`examples/walkthroughs.md`](examples/walkthroughs.md) in an empty synthetic session. They demonstrate:

1. A fact assertion with no source: a structural warning, never automatic rejection or verification.
2. A source about a prototype's existence paired with an inference about usability: recording support cannot make the inference established.
3. Contradicting synthetic notes plus an open question: both remain visible; marking a question resolved requires an explanation, and any edit clears the review.

`example.invalid` links and local-reference paths are placeholders, not research sources. No walkthrough claims a real experiment, deployment, organisation or executed test.

## Limits, privacy and persistence

- Per session/workspace: **100 sources**, **100 claims**, **50 questions**, **100 recent audit events**. At most **20 unique source links per claim**.
- Source title: 200 characters; reference: 2,000; locator: 300; excerpt: 500. Claim: 2,000; question/resolution: 1,000 each; review note: 2,000. Text limits count JavaScript string units, not words.
- Public references accept only HTTP(S), with no embedded username/password. Local references must be safe relative paths, without traversal, drive letters or UNC paths. Local references are **metadata only**: existence, symlinks and file contents are not inspected.
- Uses official `storageDomain` **`workproof_evidence_ledger`**. Ownership comes from the host's session and local workspace; requests cannot choose another owner or storage key. The plugin does not write custom core-session events. Standard tool/command inputs and outputs may still enter local session logs.
- No plugin network requests, model calls, telemetry, shell execution, file-content reads, crawling or scanning of private history. Ordinary Harness/agent behavior remains separate.
- The host plugin runs with host permissions **outside the agent sandbox**. Validation is not isolation from someone who can execute arbitrary host code or modify storage directly.

Selected Markdown includes only the selected claims, their linked sources and questions associated with those claims. Unassociated questions, unrelated claims and unrelated sources are omitted. Excerpts, review notes and local reference paths are omitted by default. The whole-ledger review is identified as such, not presented as a fresh approval of the selected subset.

Titles, claim text, questions, locators, resolution text and public URLs may still be sensitive. Query strings can contain tokens or personal identifiers even without embedded URL credentials. **Review the preview before sharing; complete automatic deidentification is not promised.** No export uploads or sends anything.

## Removal and issues

```sh
dsh plugin --profile web remove dsh-evidence-ledger
```

Removing the plugin does not delete business files or conversations. Plugin-owned ledger records may remain in Harness storage for recovery after reinstalling. v0.1 has no purge command; do not remove the Harness home directory to delete a ledger.

Report minimal synthetic reproductions at [GitHub Issues](https://github.com/piggy00544/dsh-workproof/issues), with plugin, Harness and Node versions. Check screenshots and exports for sensitive metadata first.

## License

[MIT](LICENSE), copyright 2026 牛村木木山.
