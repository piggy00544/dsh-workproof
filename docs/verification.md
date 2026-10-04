# Verification record

This file separates source-level checks, real runtime checks, packaged UI checks and public-release verification. A completed earlier layer does not imply later layers passed. All examples are synthetic; no business files, model credentials or existing conversations are used.

## Delivery Receipts 0.1.0

Target: official DeepSeek Harness Desktop/Web runtime **0.2.0-rc.2**, macOS arm64. The official desktop update's signature and notarization were checked separately from plugin acceptance.

| Check | Current result |
|---|---|
| Domain, filesystem, service and client-registration tests | 34/34 passed on 2026-10-04 |
| Real Cordis, ToolRuntime, CommandRuntime, SessionStore and JSON/Domain storage | 2/2 passed on 2026-10-04 |
| Independent specification review | Passed after regression fixes |
| Independent code/security review | No unresolved important or critical findings |
| Packed allowlist/privacy audit | 15 intended files; no install scripts, credentials or private host paths found |
| Official CLI installation in an isolated profile | Installed and host started; final installed source compared with the checkout |
| Native UI scenarios, themes, keyboard and download | Passed in the official isolated rc.2 Web UI on 2026-10-04; details below |
| Full web-host restart and plugin remove/reinstall | Passed: official remove made the bundle/source and command unavailable; official reinstall restored all three synthetic receipts with their exact versions and decisions |
| Public Release archive re-download and clean-profile installation | Pending |

The host integration test executes registered tools and commands through actual official services, verifies exact UTF-8/binary hashes, rejects a model-side acceptance action and cross-session reads, checks accepted-to-stale-to-refreshed transitions and rejects old-version decisions. It disposes and reopens actual JSON/Domain services to verify persisted records. It does not exercise an LLM, the Electron IPC boundary, or the full browser transport; those are distinct checks.

Regression findings fixed before release: sparse path/check/history arrays, invalid falsy check/note types silently replaced with defaults, and an unsupported theme-variable name. Tests observed the corresponding failures before the fixes.

Actual browser acceptance used only three synthetic fixtures:

- Article: created in the UI, previewed, accepted with the keyboard, and downloaded as Markdown. Changing its bytes produced `stale` and disabled acceptance; explicit baseline confirmation produced version 2 with no current decision. Temporarily moving that fixture produced `missing` and disabled acceptance; the fixture was restored.
- Arithmetic CSV: the deliberately false `2 + 3 = 9` claim stayed separately labelled as an agent claim. The user-side UI recorded `changes_requested`; no automatic arithmetic verdict was produced.
- Fictional release note: plain-text preview and a downloaded receipt retained the explicit distinction between a local artifact, declared checks and actual external delivery.
- Native settings switched light/dark themes, both rendered readable text/borders without horizontal overflow at the tested desktop viewport. Keyboard focus reached the lower review controls without the host composer hiding them. This is a targeted desktop check, not a complete accessibility or mobile audit.

Screenshots show only the isolated synthetic workspace: [light](screenshots/delivery-receipts-light.png), [dark](screenshots/delivery-receipts-dark.png).

Harness rc.2 hides native conversation tabs in a blank session. The isolated profile contained no model credentials. One ordinary synthetic prompt was accepted by the host and failed with `MISSING_CREDENTIAL`, which moved the session out of the blank state. No successful model response or model-driven workflow is claimed. Subsequent plugin operations used official commands; no core session log was hand-edited.

## Evidence Ledger 0.1.0

Target: official runtime **0.2.0-rc.2**, local macOS arm64 workspace.

| Check | Current result |
|---|---|
| Domain, service, host adapter and client-registration tests | 27/27 passed on 2026-10-04 |
| Real host tool/command/session and storage integration | 2/2 passed on 2026-10-04 |
| Independent specification then code/security reviews | Passed; no unresolved important or critical findings |
| Packed allowlist/privacy audit | 12 intended files; no install scripts, credentials or private host paths found |
| Native UI, selective export and review invalidation | Passed on 2026-10-04; details below |
| Official installation, full restart and remove/reinstall | Passed: remove left Delivery Receipts available but removed the ledger command/bundle/source; reinstall and a full host restart restored version 7, two sources, two claims and one question with review cleared, contradiction and open question intact |
| Public archive re-download and clean-profile installation | Pending |

The real host test caught an invalid nested tool-schema representation (`required` array). The adapter was changed to the official rc.2 field-level `required: true` representation and the failing test reran successfully. Export privacy applies to the generated Markdown only; the internal owning-session operation response retains the full ledger.

Actual native UI checks in the same isolated official host:

- Two synthetic claims, two sources and one question showed an unsourced assertion, a recorded contradiction and an open question. Keyboard-triggered user review at version 6 preserved those observations.
- Empty export selection disabled preview. Selecting only the inference produced an actual downloaded Markdown without the other claim, source excerpts, review note or local reference path, but retained the associated contradiction and question. The downloaded bytes were checked, not just the on-screen preview.
- Enabling the three optional fields cleared the previous preview and disabled download until a new preview was generated. The next actual download included all three explicitly enabled fields while still omitting the unselected claim.
- Editing the existing question through the official command advanced to version 7 and cleared review; refreshing the UI showed the edited text, unreviewed state and cleared export preview. The contradiction and open question remained visible.
- Both native light/dark themes rendered correctly at the tested desktop viewport with no horizontal overflow. This is not a claim of full accessibility or mobile coverage. Screenshots: [light](screenshots/evidence-ledger-light.png), [dark](screenshots/evidence-ledger-dark.png).

## User-profile and platform boundaries

The official Desktop app was upgraded separately to `0.2.0-rc.2`. Plugin UI and lifecycle tests used the official bundled runtime in a disposable `DSH_HOME`, not the user's existing conversations or model credentials. These new plugins have **not** been silently installed into the user's live Desktop profile: its active-agent state was not established. The tests do not claim a successful model workflow or complete Electron IPC coverage.

## Reproduce source checks

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:host
npm run test:release
```

The release-audit helper is deliberately limited to the two v0.1.0 npm-pack formats. It checks the exact archive allowlist, fixed manifest/peers, loader identity, missing/extra files and common secret/path patterns without extracting or executing archive contents. A clean heuristic scan is not a general malware audit or proof that no secret exists. Run it against downloaded `.tgz` assets with `node scripts/check-release.mjs <receipt.tgz> <ledger.tgz>`; its 11 regression tests include rejection cases, not 11 extra product scenarios.

GitHub-hosted CI has **not run**. The current GitHub OAuth credential cannot create workflow files (`workflow` scope is absent), so the initial push was rejected. The workflow is retained as an inactive template at [`docs/ci/test.yml`](ci/test.yml), not under `.github/workflows`. It can be enabled later by a repository owner with the appropriate permission. It uses read-only repository permissions and commit-pinned Actions, but Node major versions and hosted runner images are not immutable environments. Local source tests do not prove that a release tarball installs or that a community maintainer has accepted an entry.
