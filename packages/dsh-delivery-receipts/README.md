# Delivery Receipts for DeepSeek Harness

[中文说明](README.zh.md)

Keep an artifact's file evidence, the agent's declared checks, and your acceptance decision in one session-scoped receipt.

Author: **牛村木木山**. This is a community project, not an official DeepSeek product.

## Release status

**Version 0.1.0.** See [Releases](https://github.com/piggy00544/dsh-workproof/releases) for downloadable assets and [the verification record](https://github.com/piggy00544/dsh-workproof/blob/main/docs/verification.md) for completed checks and remaining boundaries. A package version is not a promise of compatibility with untested hosts.

The initial runtime target is **DeepSeek Harness `0.2.0-rc.2`**. The package declares these exact peers:

- `@deepseek-ai/dsh-tools@0.2.0-rc.2`
- `@deepseek-ai/dsh-storage-domain@0.2.0-rc.2`
- `@deepseek-ai/dsh-commands@0.2.0-rc.2`

Node.js 22 or newer is required. Initial end-to-end acceptance is scoped to **local files on macOS**. Windows, Linux, remote workspaces and other Harness versions are not yet verified.

## What a receipt tells you

| Layer | What is recorded | What it does not prove |
|---|---|---|
| Agent claims | A title, explicit file paths and declared checks | That a test ran or a claim is independently verified |
| File observations | Readability, byte size and SHA-256 of explicit local files | Correctness, factual accuracy, visual quality or test coverage |
| User decision | Acceptance or requested changes for one receipt version | Cryptographic human identity or delivery to another person |

A stable file is ready for review, not automatically complete. The plugin does not run test commands, judge content, call a model, publish files or send messages.

## Installation

The distribution uses a **prebuilt GitHub Release `.tgz`**, without `install`, `postinstall` or other install-time scripts. npm account credentials are not required. A package manager may still fetch declared dependencies during installation.

After checking the v0.1.0 Release and its checksums, install into your intended profile:

```sh
dsh plugin --profile web add https://github.com/piggy00544/dsh-workproof/releases/download/v0.1.0/dsh-delivery-receipts-0.1.0.tgz
```

`web` is the profile name in this example, not a universal Desktop profile name. Use the profile selected by your actual app. Follow the Harness version's normal plugin reload/restart behavior; do not edit another profile merely to make the tab appear.

Source and release status: [piggy00544/dsh-workproof](https://github.com/piggy00544/dsh-workproof).

## Everyday use

In a local workspace conversation, open the **Delivery receipts / 交付回执** conversation tab. It uses the native `conversation.view` slot.

In Harness rc.2, an untouched new conversation stays on the welcome screen and does not show conversation tabs. Use an existing conversation or begin a normal conversation first; running only a slash command does not leave that blank-session state. This is a host UI behavior, not a reason to change your model settings or reinstall the plugin.

1. Create a receipt for the files you want to hand off. You can use the tab or ask the agent to record it after producing the files.
2. Inspect the current file observations and the separately labelled agent checks. Plain-text preview displays text without executing HTML; binary or invalid UTF-8 content is unsupported.
3. Record **Accept this version** or **Request changes**, with an optional note. Acceptance is available only when every current file is readable and matches the baseline hash and size.
4. Recheck after edits. A changed file makes the previous receipt **stale**. Rechecking never replaces its baseline.
5. **Create new version** explicitly records a fresh baseline, increments the version and clears the previous acceptance. Previous decisions remain in the bounded audit history. Review the new version separately.
6. Export a Markdown receipt when useful. This creates a local export; it does not send, upload or publish anything.

Missing files show `missing`. Unreadable, oversized, nonregular, invalid or changing files show `unverifiable`. A baseline mismatch shows `stale`. Only intact current evidence can reach `review_required`, `accepted` or `changes_requested`; an old decision may remain visible alongside a stale/missing state.

The list is an index of stored receipts. Open or recheck a receipt to get fresh observations; its last decision alone is not evidence that the files are unchanged now.

## Agent and user interfaces

The model-facing tool is **`delivery_receipt`**, with these actions:

| Action | Use |
|---|---|
| `record` | Register a title, 1–20 paths and optional declared checks |
| `list` | List receipts belonging to this conversation and workspace |
| `inspect` | Reobserve the registered files without changing the baseline |
| `refresh` | Create a new version; requires the inspected `expectedVersion` |
| `preview` | Read bounded text from one path already in the receipt |
| `export` | Return the current Markdown receipt |

The tool has **no `decide` action**. It cannot record acceptance on the user's behalf, supply trusted hashes, change the workspace root or impersonate another session.

The slash command **`/delivery_receipts`** is the user-side entry used by the tab and accepts a JSON action. A read-only example:

```text
/delivery_receipts {"action":"list"}
```

User decisions require the receipt ID and current version. The UI handles these fields and rejects a decision if the version has changed. This separation is a product interaction boundary, not protection against code already able to execute in the host process.

## Three synthetic walkthroughs

Copy the repository's [`examples`](examples) directory into an empty local test workspace. These examples contain no real organisation, customer, account, deployment or measurement. The procedures below are reproducible scenarios; consult the verification record for the actual test coverage.

### 1. Article: acceptance becomes stale after editing

Ask the agent to use `delivery_receipt` with:

```json
{"action":"record","title":"Synthetic article draft","paths":["examples/article.md"],"checks":["A draft file was produced; factual and editorial review remains with the reader."]}
```

Open the receipt, inspect the text, and accept version 1 yourself. Change `Draft version: one` to `Draft version: two` in the file. Recheck: the expected state is `stale`, with the old decision still associated with version 1. Create a new version: the expected result is version 2 with no decision. This checks version-bound acceptance rather than assuming an old approval covers new bytes.

### 2. Report: a hash does not validate arithmetic

[`examples/report.csv`](examples/report.csv) intentionally contains synthetic inputs `2` and `3` with a wrong total of `9`.

```json
{"action":"record","title":"Synthetic arithmetic boundary demo","paths":["examples/report.csv"],"checks":["Intentionally false demonstration claim: the totals were checked."]}
```

Inspect the receipt. The check must remain labelled as an **agent claim**; a valid SHA-256 must not become proof that `2 + 3 = 9`. Request changes with a note identifying the mismatch. Correct the total to `5`, recheck for `stale`, then explicitly create a new version and review the corrected report.

### 3. Release notes: a local receipt is not a release or test report

```json
{"action":"record","title":"Synthetic release-note handoff","paths":["examples/release-notes.md"],"checks":["No automated test evidence is attached to this synthetic note."]}
```

Preview the note and request changes if executable test evidence or a release link is required. Export Markdown and read its boundaries: the agent's check is not an independently observed test result, and the local export is not external delivery. The example intentionally has no real release URL and reports no tests as executed.

## Limits and local storage

- At most **20 unique relative paths** per receipt, **100 receipts per session**, and the latest **100 audit events** per receipt.
- At most 20 declared checks, each 500 characters; title 200 characters; decision note 2,000 characters.
- Hashing is capped at **64 MiB per file**. Text preview is capped at **64 KiB**, with an explicit truncation indicator.
- Only local regular files beneath the real workspace root are supported. The trusted host root is canonicalized first (for example, macOS `/tmp` resolves to `/private/tmp`). Absolute artifact paths, traversal, Windows drive/UNC paths, symlinks below the root, directories, FIFOs and devices are rejected. Files that change during inspection do not receive an `ok` observation.
- The host derives the workspace and session; tool/browser requests cannot nominate arbitrary roots.
- Records use the official `storageDomain` named **`workproof_delivery_receipts`**. The plugin does not create custom core-conversation events or replace conversation history. Standard tool/command use, including text previews, may still enter the local session command log.

## Privacy and authority boundaries

The plugin itself makes **no network requests or model calls**, collects no telemetry, and performs no background scan of files or private conversation history. Normal Harness/model behavior is separate; asking an agent to operate the tool still occurs within that agent's existing session.

The host plugin runs with the local host process's permissions, **outside the agent sandbox**. Path checks and version checks reduce accidental misuse; this is not a security sandbox against an adversary with arbitrary host execution or storage-write access.

Markdown exports contain relative artifact paths, not the workspace's absolute root, and do not embed file contents. Titles, filenames, checks and notes can still contain sensitive information. Review them before sharing: **there is no promise of complete automatic deidentification**. An acceptance record is a UI-recorded decision, not cryptographic proof of who clicked it or of an external recipient's receipt.

## Removal and reporting problems

Use the normal Harness plugin removal command for the profile where it was installed:

```sh
dsh plugin --profile web remove dsh-delivery-receipts
```

Removal does not delete your business files or conversations. Plugin-owned receipt records may remain in Harness storage so that reinstalling can recover them. This release does not provide a purge command; do not delete the Harness home directory to remove receipts.

Report reproducible issues at [GitHub Issues](https://github.com/piggy00544/dsh-workproof/issues), including the plugin/Harness/Node versions and a minimal synthetic case. Review screenshots and exports for sensitive material before attaching them.

## License

[MIT](LICENSE), copyright 2026 牛村木木山.
