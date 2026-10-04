# DeepSeek Harness 交付回执

[English](README.md)

把文件证据、Agent 声明和你的验收意见放进同一条会话回执，知道当前该看哪个成果、旧的接受意见是否仍适用。

作者：**牛村木木山**。社区项目，不是 DeepSeek 官方产品。

## 发布状态

**版本 0.1.0。** 下载资产见 [Releases](https://github.com/piggy00544/dsh-workproof/releases)，实际完成的检查与验证边界见[验证记录](https://github.com/piggy00544/dsh-workproof/blob/main/docs/verification.md)。包版本不等于对未测试宿主的兼容承诺。

首版精确面向 **DeepSeek Harness `0.2.0-rc.2`**，三个 peer dependency 均固定为该版本：

- `@deepseek-ai/dsh-tools`
- `@deepseek-ai/dsh-storage-domain`
- `@deepseek-ai/dsh-commands`

需要 Node.js 22 或更新版本。首轮端到端验收范围为 **macOS 本地文件**；Windows、Linux、远程工作区和其他 Harness 版本尚未验证。

## 回执能说明什么

| 层次 | 记录什么 | 不能据此证明什么 |
|---|---|---|
| Agent 声明 | 标题、明确的文件路径、声称做过的检查 | 测试真的执行过，或结论已被独立核验 |
| 文件观察 | 能否读取、字节大小、SHA-256 | 内容正确、事实可靠、排版合格或测试充分 |
| 用户决定 | 对某个回执版本接受或要求修改 | 点击者的密码学身份，或收件人实际收到成果 |

文件没有变化，只能说明可以按这一版本继续验收。插件不执行测试命令、不判断内容质量、不调用模型，也不发布文件或发送消息。

## 安装方式

使用 **GitHub Release 预构建 `.tgz`** 分发，不包含 `install`、`postinstall` 等安装时脚本，不需要 npm 账号凭据。安装时，包管理器仍可能下载声明的依赖。

检查 v0.1.0 Release 和校验和后，安装到目标 profile：

```sh
dsh plugin --profile web add https://github.com/piggy00544/dsh-workproof/releases/download/v0.1.0/dsh-delivery-receipts-0.1.0.tgz
```

命令中的 `web` 是示例 profile 名，不是所有桌面应用通用的配置名；请使用实际应用选中的 profile。插件加载和重启遵循该版本 Harness 的正常机制，不要为寻找标签页修改其他 profile。

源码与发布状态：[piggy00544/dsh-workproof](https://github.com/piggy00544/dsh-workproof)。

## 日常使用

在本地工作区会话中打开 **交付回执 / Delivery receipts** 标签页，入口使用 Harness 原生 `conversation.view` 槽位。

Harness rc.2 的空白新会话仍停留在欢迎页，不展示会话标签。请在已有对话中使用，或先开始一次普通对话；仅运行斜杠命令不会退出空白状态。这是宿主界面的行为，不需要因此改模型配置或重装插件。

1. 登记要交付的文件。可以在标签页操作，也可以让 Agent 产出文件后登记回执。
2. 查看当前文件观察与单独标注的 Agent 检查声明。预览只显示纯文本，不执行 HTML；二进制或无效 UTF-8 会提示不支持预览。
3. 选择“接受此版本”或“要求修改”，可附备注。只有全部文件可读，且当前大小、哈希与基线一致时，才能接受。
4. 编辑文件后重新检查。变化会使旧回执变成 `stale`；重新检查不会替换基线。
5. 显式“建立新版本”才会记录新基线、版本加一并清除当前接受意见。旧决定保留在有上限的审计历史中，新版本需要重新审看。
6. 可将回执导出为本地 Markdown。导出不会发送、上传或发布文件。

文件缺失显示 `missing`；不可读、过大、非普通文件、无效路径或读取中变化显示 `unverifiable`；与基线不一致显示 `stale`。证据完整且当前一致时，才显示待验收 `review_required`、已接受 `accepted` 或要求修改 `changes_requested`。旧决定可能与“已过期/缺文件”状态同时展示，不能只看决定文字。

列表是已保存回执的索引。打开或重新检查回执才取得新观察；上次决定不表示文件此刻仍未变化。

## Agent 工具与用户入口

模型侧工具名为 **`delivery_receipt`**：

| action | 功能 |
|---|---|
| `record` | 登记标题、1–20 个路径和可选检查声明 |
| `list` | 列出当前会话与工作区的回执 |
| `inspect` | 重新观察文件，不更新基线 |
| `refresh` | 建立新版本，需提供已查看的 `expectedVersion` |
| `preview` | 预览已经登记在该回执中的某个文件 |
| `export` | 返回当前 Markdown 回执 |

模型工具**没有 `decide` 操作**，不能替用户接受、提交可信哈希、改工作区根目录或冒充其他会话。

斜杠命令 **`/delivery_receipts`** 是标签页使用的用户入口，接收 JSON。只读示例：

```text
/delivery_receipts {"action":"list"}
```

用户决定需要回执 ID 和当前版本，界面负责携带这些字段；版本已改变时会要求重新加载。这是产品交互边界，不是抵御拥有宿主进程执行权限代码的安全隔离。

## 三个合成示例

将仓库中的 [`examples`](examples) 复制到一个空白本地测试工作区。示例不含真实组织、客户、账户、部署或业务数据。以下为可复现的操作场景，实际覆盖情况以验证记录为准。

### 1. 文章：改动文件让旧接受意见失效

让 Agent 调用 `delivery_receipt`：

```json
{"action":"record","title":"合成文章草稿","paths":["examples/article.md"],"checks":["已产生草稿文件，事实与编辑质量仍待读者检查。"]}
```

打开回执、查看文本，由你接受版本 1。将文件中的 `Draft version: one` 改为 `Draft version: two`，再重新检查：预期状态为 `stale`，旧决定仍对应版本 1。显式建立新版本后，预期得到无决定的版本 2。这验证的是“接受绑定具体版本”，不是旧接受自动覆盖新内容。

### 2. 报告：文件哈希不证明算术正确

[`examples/report.csv`](examples/report.csv) 故意使用合成数据：输入 `2`、`3`，总计错写为 `9`。

```json
{"action":"record","title":"合成算术边界示例","paths":["examples/report.csv"],"checks":["故意错误的演示声明：已经核对总计。"]}
```

查看回执：这句话必须仍标为 **Agent 声明**。哈希有效不能证明 `2 + 3 = 9`。选择“要求修改”，备注指出差异；将总计改成 `5`，重新检查应显示 `stale`，然后显式建立新版本并审看修正后的报告。

### 3. 发布说明：本地回执不是实际发布或测试报告

```json
{"action":"record","title":"合成发布说明交接","paths":["examples/release-notes.md"],"checks":["这份合成说明没有附带自动化测试证据。"]}
```

预览文件。如果任务还要求可执行测试证据或发布链接，应要求修改。导出 Markdown 并检查边界说明：Agent 声明不是独立观察到的测试结果，本地导出也不是外部送达。示例故意不提供真实发布 URL，也不声称执行过测试。

## 上限与存储

- 每条回执最多 **20 个不重复相对路径**；每个会话最多 **100 条回执**；每条保留最近 **100 条审计事件**。
- 最多 20 条检查声明，每条 500 字符；标题最多 200 字符；决定备注最多 2,000 字符。
- 每个文件最多计算 **64 MiB** 的哈希；纯文本预览上限 **64 KiB**，截断会明确标注。
- 只读真实工作区根目录下的本地普通文件。先对宿主提供的可信根目录做规范化（例如 macOS `/tmp` 对应 `/private/tmp`）。拒绝交付物绝对路径、目录穿越、Windows 盘符/UNC 路径、根目录以下的符号链接、目录、FIFO 和设备。读取中发生变化的文件不会得到 `ok`。
- 会话与工作区由宿主提供，工具或浏览器请求不能指定任意根目录。
- 回执存放在官方 `storageDomain` **`workproof_delivery_receipts`**；插件不创建自定义核心会话事件，也不替换对话历史。标准工具或命令调用（包括纯文本预览）仍可能进入本地会话命令日志。

## 隐私与权限边界

插件自身**不发起网络请求、不调用模型、不收集遥测**，不后台扫描文件或私人会话历史。Harness 和模型的正常行为是另一层：让 Agent 使用工具，仍发生在该 Agent 已有会话中。

宿主插件拥有本机进程权限，运行在 **Agent 沙箱之外**。路径检查与版本检查用于减少误操作；本项目不是抵御任意宿主代码执行或存储写权限的安全沙箱。

Markdown 导出保留相对文件路径，不携带工作区绝对根路径，也不嵌入文件正文。但标题、文件名、检查声明和备注仍可能敏感，请在分享前审看；**不承诺自动完成全面去标识化**。接受记录只是界面记录的决定，不是点击者身份的密码学证明，也不是收件人的签收证明。

## 卸载与问题反馈

在安装过本插件的 profile 中使用 Harness 正常卸载入口：

```sh
dsh plugin --profile web remove dsh-delivery-receipts
```

卸载不会删除业务文件或对话。插件自身的回执记录可能继续保留在 Harness 存储中，供重装后恢复。首版不提供清空记录命令；不要为了删除回执而删除整个 Harness home。

问题请提交到 [GitHub Issues](https://github.com/piggy00544/dsh-workproof/issues)，附插件、Harness、Node 版本与最小合成复现。上传截图或导出前，请先检查敏感内容。

## 许可

[MIT](LICENSE)，Copyright 2026 牛村木木山。
