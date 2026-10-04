# DeepSeek Harness 研究证据账本

[English](README.md)

找到判断的依据，不把“有引用”当成“已核验”。

作者：**牛村木木山**。社区项目，不是 DeepSeek 官方产品。

## 发布状态与兼容范围

**版本 0.1.0。** 下载资产见 [Releases](https://github.com/piggy00544/dsh-workproof/releases)，实际完成的检查与验证边界见[验证记录](https://github.com/piggy00544/dsh-workproof/blob/main/docs/verification.md)。包版本不等于对未测试宿主的兼容承诺。

首版精确面向 **DeepSeek Harness `0.2.0-rc.2`**，`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-storage-domain`、`@deepseek-ai/dsh-commands` 三个 peer dependency 均固定为 `0.2.0-rc.2`。需要 **Node.js 22+**。首次验收范围为 **macOS 本地工作区**；其他系统、远程工作区与 Harness 版本尚未验证。

## 它做什么

每个会话与工作区有一份账本，连接四类记录：

- **登记的来源**：引用元信息、定位与可选短摘录。插件不抓取链接，也不读取被引用的本地文件。
- **论点**：分为事实断言 `fact_assertion`、推断 `inference`、建议 `proposal`；来源关系为支持 `supports`、反证 `contradicts`、背景 `context`。分类与关系都是录入者的声明，不是事实裁决。
- **问题**：待解决或标记已解决，可关联一个论点。标记解决必须写说明，但说明本身不证明正确。
- **你的审阅**：“已审阅此版本”或“需要补充”，可附备注。任何来源、论点或问题保存后，都清除当前审阅；即使改动条目没有关联你刚审阅的论点，也按整份账本失效处理。

结构性提示包括：事实断言未关联来源、来源缺少定位、登记了反证、仍有开放问题。不提供质量评分、自动核验事实或自动通过；没有结构性提示也不代表结论正确。

**交付回执**管理文件字节与版本验收；**研究证据账本**管理登记的推理结构和来源关系。两者可独立安装，不互相依赖。

## 安装方式

使用 GitHub Release 预构建 `.tgz`，**没有安装时脚本**，无需 npm 账号。安装时，包管理器仍可能下载声明的依赖。

检查 v0.1.0 Release 和校验和后，安装到目标 profile：

```sh
dsh plugin --profile web add https://github.com/piggy00544/dsh-workproof/releases/download/v0.1.0/dsh-evidence-ledger-0.1.0.tgz
```

`web` 是示例 profile 名，不是所有桌面应用通用的配置名。请使用实际应用选中的 profile，加载和重启遵循该版本 Harness 的正常机制。源码与发布状态：[piggy00544/dsh-workproof](https://github.com/piggy00544/dsh-workproof)。

## 日常使用

1. 在本地工作区会话打开原生 `conversation.view` 标签页 **研究证据账本 / Evidence ledger**。
2. 让 Agent 先查看账本，再登记来源、论点与未解决问题。空账本从版本 `0` 开始。
3. 展开论点对应的来源，查看关系、定位、摘录。引用只作普通文本显示，不自动打开或抓取。
4. 按你的正常研究流程实际阅读来源，再在标签页记录“已审阅此版本”或“需要补充”。这只是界面决定，不是独立核验，也不是点击者的密码学身份证明。
5. 保存任何条目后重新查看并审阅新版本。更新保留条目 ID，账本版本增加，当前审阅清除；只保留最近 100 条审计事件。
6. 明确选择要导出的论点，先查看 Markdown 预览，再下载。未选择论点时不能导出。本地导出不等于发布或对外送达。

Harness rc.2 在空白会话中隐藏会话标签页。请使用已有普通对话，或先开始一段对话；只执行斜杠命令不会离开空白会话状态。此时看不到标签页，不需要重装插件或修改配置。

首版不重复建设手工录入表单：Agent 负责结构化登记，用户负责查看、审阅与控制可选导出字段。

## 工具与命令合同

Agent 工具为 **`evidence_ledger`**。用户命令为 **`/evidence_ledger`**，接收 JSON 对象；空输入默认 `inspect`。

| action | 除 action 外的必填项 | 可选项 |
|---|---|---|
| `inspect` | 无 | 无 |
| `save_source` | `expectedVersion`、`title`、`sourceKind`、`reference` | 已存在的 `id`、`locator`、`excerpt` |
| `save_claim` | `expectedVersion`、`text`、`claimKind` | 已存在的 `id`、`links` |
| `save_question` | `expectedVersion`、`question` | 已存在的 `id`、`claimId`、`status`、`resolution` |
| `export` | 非空、不重复的 `claimIds` | 下述仅供用户的隐私选项 |
| `review`，仅用户命令 | `expectedVersion`、`status` | `note` |

`sourceKind` 为 `public_url` 或 `local_reference`；`claimKind` 为 `fact_assertion`、`inference` 或 `proposal`。`links` 是 `{sourceId, relation}` 数组，同一来源 ID 最多出现一次；关系为 `supports`、`contradicts`、`context`。问题 `status` 默认 `open`，`resolved` 需非空 `resolution`；审阅 `status` 为 `reviewed` 或 `needs_work`。

不传条目 `id` 即新建，由宿主生成 ID；传已存在 ID 即替换条目，未知 ID 会被拒绝。更新是完整替换，不是只修改已填写字段：例如更新问题时省略 `claimId`，会解除原关联。每次保存前应先查看版本，携带 `expectedVersion`；过期版本报错，不静默覆盖新修改。可选默认值仅适用于未提供/undefined，`null` 与错误类型会被拒绝。

查看、保存和审阅返回 `{ledger, issues}`；导出返回 `{ledger, issues, markdown}`。这些内部 RPC/工具响应仍包含完整的所属会话账本，包括摘录、审阅备注和未选中的论点。选中范围与隐私选项只控制**下载/分享的 Markdown**，不会对完整内部响应脱敏，也不限制已有本地 Agent/会话查看账本。这不是隐私保险箱或跨 Agent 秘密存储；不同会话的隔离仍由宿主归属校验保障。

模型工具不能审阅。只有用户命令可在导出时设置 `includeExcerpts`、`includeReviewNotes`、`includeLocalReferences`，三项默认均为 `false`。这是产品交互边界，不是抵御任意宿主代码执行的安全隔离。

## 三个合成示例

在空白合成会话中按 [`examples/walkthroughs.md`](examples/walkthroughs.md) 操作，验证：

1. 无来源的事实断言：显示结构性提示，不自动判错或核验通过。
2. 来源只说明原型存在，论点却推断可用性：登记为支持，不能让推断变成已成立事实。
3. 相反的合成记录加一个开放问题：反证与问题持续可见；标记问题解决必须写说明，修改会清除整份账本审阅。

`example.invalid` 链接和本地引用路径都是占位符，不是研究来源。示例不声称真实实验、部署、组织信息或已执行测试。

## 上限、隐私与持久化

- 每个会话/工作区最多 **100 个来源、100 个论点、50 个问题、最近 100 条审计事件**；每个论点最多 **20 个不同来源关联**。
- 来源标题 200 字符，引用 2,000，定位 300，摘录 500；论点 2,000，问题与解决说明各 1,000，审阅备注 2,000。按 JavaScript 字符串单位计算，不是词数。
- 公开引用仅接受 HTTP(S)，不允许 URL 内嵌用户名密码。本地引用必须是安全相对路径，不能含目录穿越、盘符或 UNC。它们只是**元信息**：插件不检查存在性、符号链接或文件正文。
- 使用官方 `storageDomain` **`workproof_evidence_ledger`**。会话与本地工作区由宿主提供，请求不能任意选择归属或存储键。插件不创建自定义核心会话事件；标准工具与命令的输入输出仍可能进入本地会话日志。
- 插件不发网络请求、不调用模型、不收遥测、不执行 shell、不读文件正文、不抓取网页、不扫描私人历史。Harness/Agent 的正常行为是另一层。
- 插件以宿主权限运行在 **Agent 沙箱之外**。校验不能隔离拥有宿主任意代码执行或存储写入能力的人。

Markdown 只包含选中论点、它们关联的来源以及明确关联这些论点的问题；不含未关联问题和其他论点、来源。默认不含摘录、审阅备注、本地引用路径。审阅信息明确标为“整份账本审阅”，不冒充对导出子集的新批准。

标题、论点、问题、定位、解决说明和公开 URL 仍可能敏感。即使 URL 没有内嵌用户名密码，查询参数也可能含令牌或个人标识。**分享前检查预览，不承诺自动完成全面去标识化。** 导出不会上传或发送任何内容。

## 卸载与反馈

```sh
dsh plugin --profile web remove dsh-evidence-ledger
```

卸载不会删除业务文件或对话。插件账本记录可能保留在 Harness 存储中，供重装恢复。v0.1 不提供清空记录命令；不要为了删除账本移除整个 Harness home。

请向 [GitHub Issues](https://github.com/piggy00544/dsh-workproof/issues) 提交最小合成复现，以及插件、Harness、Node 版本。上传截图或导出前先检查敏感元信息。

## 许可

[MIT](LICENSE)，Copyright 2026 牛村木木山。
