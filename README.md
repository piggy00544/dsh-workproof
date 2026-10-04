# DSH Workproof

**让 Agent 的“我做完了”，变成你能检查、能追溯的交付。**

作者：**牛村木木山**。两个可独立安装的 DeepSeek Harness 社区插件，不是官方产品。

来自长期使用代码与研究 Agent 的两个实际问题：成果究竟在哪、改完还是原来的验收版本吗？文章里的判断究竟有来源支持，还是只是模型说得有道理？公开代码只保留通用方法，示例全部为合成内容。

## 选你需要的插件

| 插件 | 适合什么时候用 | 明确不做什么 |
|---|---|---|
| [交付回执](packages/dsh-delivery-receipts/README.zh.md) | 生成文章、报告、代码后，登记文件、查看哈希和文本，由你验收；文件改动后旧接受失效 | 不把哈希当质量证明，不冒充测试，不替你发送或发布 |
| [研究证据账本](packages/dsh-evidence-ledger/README.zh.md) | 整理论点、来源、推断、反证和未解决问题；选定论点后预览导出 | 不自动抓取来源，不判断真伪，不把有引用当成已核验 |

英文文档：[Delivery Receipts](packages/dsh-delivery-receipts/README.md) · [Evidence Ledger](packages/dsh-evidence-ledger/README.md)

## 安装与兼容

[下载 Release](https://github.com/piggy00544/dsh-workproof/releases) · [验证记录](docs/verification.md) · [反馈问题](https://github.com/piggy00544/dsh-workproof/issues)

首版 `0.1.0` 精确面向 **Harness `0.2.0-rc.2`，Node.js 22+，macOS 本地工作区**。其他宿主版本、系统和远程工作区不作未经验证的兼容承诺。源代码测试、安装包测试和社区收录是不同状态，见验证记录。

Release 使用 `.tgz` 预构建包及 `SHA256SUMS`，不需要 npm 账号、没有安装时脚本。对照校验和后，按各插件文档安装到你应用实际使用的 profile；文档中的 `web` 只是示例，不能拿来覆盖桌面 profile。

新手可先试交付回执：

> 生成文件后，请用 delivery_receipt 登记本轮成果，列出相对路径，把声明做过的检查和文件证据分开；不要替我验收。

研究时可用：

> 用 evidence_ledger 整理本轮研究：分别记录事实断言、推断和建议，关联来源及定位，保留反证与待解决问题；不要把有引用写成已核验。

然后在已有普通会话中打开对应标签页。Harness rc.2 的空白会话不显示会话标签；单独运行斜杠命令也不会退出空白状态。

## 隐私和证据边界

- 插件不新增模型调用、遥测、后台扫描或自动上传；安装时包管理器可能下载依赖。
- 交付回执只读取你明确登记的本地文件；研究账本只保存引用元信息，不读取引用内容。
- 导出是本地 Markdown，不等于对外发送；标题、路径、论点、意见和链接仍需自己检查是否敏感。
- 账本的选中范围和隐私省略只作用于导出 Markdown；本地所属会话仍能读取完整账本，不能当秘密保险箱。
- 宿主插件拥有宿主进程权限，“本地优先”不等于安全沙箱。

## 开发与复现

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:host
```

设计与验收范围：[交付回执](docs/superpowers/specs/2026-10-04-delivery-receipts-design.md) · [研究证据账本](docs/superpowers/specs/2026-10-04-evidence-ledger-design.md)。欢迎携带最小合成复现来提 Issue，不要上传密钥、内部资料或原始聊天记录。

MIT licensed. Local-first plugins that keep agent claims, observable artifacts and human review distinct.
