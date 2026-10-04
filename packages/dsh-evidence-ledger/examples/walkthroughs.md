# Synthetic evidence-boundary walkthroughs

These are fictional demonstrations, not research findings or executed test results. Use one empty local test conversation. Invoke the `evidence_ledger` tool; inspect before every save and substitute the returned version and host-generated IDs. The plugin never opens these references.

## 1. An assertion with no source

Start with `{"action":"inspect"}`. In an empty ledger, record:

```json
{"action":"save_claim","expectedVersion":0,"text":"Synthetic assertion: every reader understands the imaginary prototype immediately.","claimKind":"fact_assertion","links":[]}
```

Expected: version 1, an `assertion_without_source` observation, and no review. This does not prove the assertion false, nor turn it into a verified fact. Open the native tab to see its classification and missing citation.

## 2. A recorded source does not establish an inference

After inspecting the current version, record:

```json
{"action":"save_source","expectedVersion":1,"title":"Fictional prototype note","sourceKind":"public_url","reference":"https://example.invalid/synthetic-prototype","locator":"Synthetic paragraph A","excerpt":"The fictional prototype exists. No usability evaluation is described."}
```

Replace `SOURCE_A` with the returned source ID, then inspect and use the current version:

```json
{"action":"save_claim","expectedVersion":2,"text":"Synthetic inference: the fictional prototype will be easy for every reader to use.","claimKind":"inference","links":[{"sourceId":"SOURCE_A","relation":"supports"}]}
```

Expected: the source and the recorder's `supports` relation appear. The plugin does not say the source establishes usability. The cited excerpt explicitly contains no usability evidence. Record “Needs more work” yourself if that inference needs support.

## 3. A contradiction and an open question survive review

Inspect again, then record the second fictional source:

```json
{"action":"save_source","expectedVersion":3,"title":"Fictional counterexample note","sourceKind":"local_reference","reference":"synthetic-notes/counterexample.md","locator":"Synthetic observation B","excerpt":"An imaginary reader could not find the prototype's next step."}
```

The reference need not exist: it is metadata and is never read. Replace `CLAIM_B`, `SOURCE_A` and `SOURCE_B` with returned IDs. After inspecting, update the inference:

```json
{"action":"save_claim","expectedVersion":4,"id":"CLAIM_B","text":"Synthetic inference: the fictional prototype will be easy for every reader to use.","claimKind":"inference","links":[{"sourceId":"SOURCE_A","relation":"supports"},{"sourceId":"SOURCE_B","relation":"contradicts"}]}
```

Then record a question with the current version:

```json
{"action":"save_question","expectedVersion":5,"question":"What observation would distinguish prototype existence from actual usability?","claimId":"CLAIM_B","status":"open"}
```

Expected: `recorded_contradiction` and `open_question` remain visible even if you record “Reviewed this version.” User review does not erase structural observations or verify either source.

To test invalidation, edit this question through `save_question`, retaining its returned ID and using the current `expectedVersion`. Any edit increments the ledger version and clears the review. Marking it `resolved` without a nonempty `resolution` must fail. A resolution such as “Synthetic scope was narrowed; usability still requires a separate observation” records an explanation, not an executed experiment.

## Export check

In the tab, select only `CLAIM_B`, preview and download. The unrelated assertion from step 1 must be absent. Associated questions and both sources remain, but the excerpt, review note and `synthetic-notes/counterexample.md` path are omitted by default. Enable an optional inclusion only in the user UI when appropriate, regenerate the preview and check it before sharing.

The whole ledger, including optional metadata, is still available to the existing local session through inspect/operation responses. Export omission is not local access control. Titles, claim text and URLs can still be sensitive. Downloading the Markdown does not publish or send it.

## 中文验收提示

三个例子分别验证“无来源不冒充已核验”“有引用不代表推理成立”“反证和开放问题不会被审阅按钮抹去”。所有名称、链接、摘录都是合成材料。按实际返回版本和 ID 替换示例，不把这里的编号当成可直接复用的真实账本状态；若中途多做一次保存，先重新 inspect。
