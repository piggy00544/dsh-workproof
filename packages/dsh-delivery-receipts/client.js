window.__ModuleLoader__.load({
  id: 'dsh-delivery-receipts',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      en: {
        title: 'Delivery receipts', subtitle: 'Claims, file evidence, and your decision — kept separate.',
        reload: 'Reload list', create: 'New receipt', record: 'Record artifacts', receiptTitle: 'Deliverable title',
        paths: 'Workspace-relative files, one per line', pathsHint: 'Explicit local files only. No folders or symlinks.',
        empty: 'No receipts in this session yet.', start: 'Ask the agent to use delivery_receipt after producing a file, or add one here.',
        select: 'Choose a receipt to inspect its current files.', recheck: 'Recheck files', refresh: 'Create a new baseline',
        refreshWarning: 'This creates a new version and clears the current acceptance. Previous decisions remain in the bounded audit history.',
        proceed: 'Create new version', cancel: 'Cancel', accept: 'Accept this version', reject: 'Request changes',
        note: 'Review note (optional)', decisionBoundary: 'Your decision applies to this file version. It does not mean the artifact was sent, published, or independently quality-checked.',
        claims: 'Agent-declared checks', noChecks: 'No checks declared.', claimWarning: 'These statements are claims, not independently observed test results.',
        files: 'Machine-observed files', hashBoundary: 'SHA-256 identifies bytes, not correctness. Results are point-in-time; recheck after changes.',
        checked: 'Checked at', version: 'Version', preview: 'View text', previewTitle: 'Plain-text preview',
        previewLimit: 'Preview truncated at the size limit.', previewUnavailable: 'Text preview unavailable',
        export: 'Download receipt', exportWarning: 'Local Markdown export. Review titles, filenames and notes before sharing; they may contain sensitive information.',
        error: 'Operation failed', loading: 'Working…', baseline: 'Recorded hash', current: 'Current hash', bytes: 'bytes',
        decision: 'Last user decision', noDecision: 'Not yet reviewed', recheckHint: 'Current state requires rechecking',
        review_required: 'Ready for review', accepted: 'Accepted version', changes_requested: 'Changes requested',
        stale: 'Version changed', missing: 'File missing', unverifiable: 'Not verifiable', ok: 'Observed',
        too_large: 'Too large to hash', not_file: 'Not a regular file', invalid_path: 'Path rejected', unreadable: 'Unreadable', changed: 'Changed while reading',
      },
      zh: {
        title: '交付回执', subtitle: '把模型声明、文件证据和你的验收意见分开。',
        reload: '刷新列表', create: '新建回执', record: '登记成果', receiptTitle: '成果标题',
        paths: '工作区相对文件路径，每行一个', pathsHint: '只读取指定的本地文件；不接受目录或符号链接。',
        empty: '此会话还没有交付回执。', start: '让 Agent 生成文件后调用 delivery_receipt，或在这里登记。',
        select: '选择一条回执，检查当前文件。', recheck: '重新检查文件', refresh: '建立新版本基线',
        refreshWarning: '这会建立新版本并清除当前验收状态。旧意见保留在有数量上限的审计历史中。',
        proceed: '确认建立新版本', cancel: '取消', accept: '接受此版本', reject: '要求修改',
        note: '验收意见（可选）', decisionBoundary: '验收仅针对这个文件版本，不代表已经发送、发布，或通过独立内容质量检查。',
        claims: '模型声明的检查', noChecks: '没有声明检查项。', claimWarning: '这些是声明，不是插件独立观察到的测试结果。',
        files: '机器观察到的文件', hashBoundary: 'SHA-256 标识文件字节，不证明内容正确。证据有时间点；文件变化后请重新检查。',
        checked: '检查时间', version: '版本', preview: '查看文本', previewTitle: '纯文本预览',
        previewLimit: '预览已按大小上限截断。', previewUnavailable: '暂不支持文本预览',
        export: '下载回执', exportWarning: '只导出本地 Markdown。分享前请检查标题、文件名和意见，其中仍可能含敏感信息。',
        error: '操作失败', loading: '处理中…', baseline: '登记时哈希', current: '当前哈希', bytes: '字节',
        decision: '最近一次用户意见', noDecision: '尚未验收', recheckHint: '重新检查后才显示当前状态',
        review_required: '待验收', accepted: '已接受此版本', changes_requested: '要求修改',
        stale: '文件版本已变化', missing: '文件缺失', unverifiable: '无法验证', ok: '已观察',
        too_large: '超过哈希大小上限', not_file: '不是普通文件', invalid_path: '路径已拒绝', unreadable: '无法读取', changed: '读取期间发生变化',
      },
    };
    const css = `
      .workproof-receipts{height:100%;overflow:auto;box-sizing:border-box;padding:24px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);font:inherit}
      .workproof-receipts *{box-sizing:border-box}.workproof-receipts h2{font-size:20px;margin:0 0 8px;font-weight:600}.workproof-receipts h3{font-size:16px;margin:0 0 10px}.workproof-receipts h4{font-size:13px;margin:18px 0 8px}
      .workproof-receipts p{line-height:1.65;margin:8px 0}.workproof-receipts .muted{color:var(--dsw-alias-label-secondary);font-size:12px}
      .workproof-receipts button,.workproof-receipts input,.workproof-receipts textarea{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:8px 10px}
      .workproof-receipts button{cursor:pointer;font-size:12px}.workproof-receipts button:disabled{opacity:.5;cursor:default}.workproof-receipts :focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:3px}
      .workproof-receipts input,.workproof-receipts textarea{display:block;width:100%;margin:6px 0 12px}.workproof-receipts textarea{resize:vertical;min-height:64px}.workproof-receipts label{font-size:12px;display:block}
      .workproof-receipts .layout{display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:24px;margin-top:22px}.workproof-receipts .toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.workproof-receipts .list{padding-right:16px;border-right:1px solid var(--dsw-alias-border-l2)}
      .workproof-receipts .row{width:100%;text-align:left;margin:0 0 8px;display:block;background:transparent}.workproof-receipts .row[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-secondary)}.workproof-receipts .row strong{display:block;overflow-wrap:anywhere;font-size:13px}.workproof-receipts .row small{display:block;margin-top:6px;font-size:11px}
      .workproof-receipts .status{display:inline-block;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:3px 7px;font-size:12px}.workproof-receipts .artifact{padding:14px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}.workproof-receipts .artifact code{display:block;font-size:11px;overflow-wrap:anywhere;margin:5px 0}.workproof-receipts .artifact strong{font-size:13px;overflow-wrap:anywhere}
      .workproof-receipts .notice{padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;margin:12px 0}.workproof-receipts details{margin:18px 0}.workproof-receipts summary{cursor:pointer;font-size:13px}.workproof-receipts form{max-width:600px;margin-top:12px}.workproof-receipts pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;font-size:12px;padding:12px;background:var(--dsw-alias-bg-layer-2);border-radius:7px}.workproof-receipts ul{padding-left:20px}.workproof-receipts li{font-size:13px;line-height:1.7}
      @media(max-width:760px){.workproof-receipts{padding:16px}.workproof-receipts .layout{grid-template-columns:1fr}.workproof-receipts .list{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2);padding:0 0 12px}}
    `;
    return {
      inject: ['slots', 'remote', 'remote.commands', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('workproof-receipts', dictionaries));
        const t = ctx.locale.bind('workproof-receipts');
        async function invoke(sessionId, input) {
          const reply = await ctx.remote.commands.execute(sessionId, '/delivery_receipts ' + JSON.stringify(input), []);
          if (!reply.ok) throw new Error(reply.error?.message || t('error'));
          const result = reply.value?.result;
          if (!result || result.kind !== 'success') throw new Error(result?.text || t('error'));
          return JSON.parse(result.text || '{}');
        }
        function ReceiptPanel({ sessionId }) {
          const [rows, setRows] = React.useState([]);
          const [current, setCurrent] = React.useState(null);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [title, setTitle] = React.useState('');
          const [paths, setPaths] = React.useState('');
          const [note, setNote] = React.useState('');
          const [preview, setPreview] = React.useState(null);
          const [confirmRefresh, setConfirmRefresh] = React.useState(false);
          const [download, setDownload] = React.useState(null);
          const alive = React.useRef(true);
          const sequence = React.useRef(0);
          const downloadLink = React.useRef(null);
          React.useEffect(() => {
            alive.current = true;
            setBusy(true);
            invoke(sessionId, { action: 'list' }).then(data => {
              if (alive.current) setRows(data.receipts || []);
            }).catch(e => { if (alive.current) setError(String(e.message || e)); })
              .finally(() => { if (alive.current) setBusy(false); });
            return () => { alive.current = false; sequence.current++; };
          }, [sessionId]);
          React.useEffect(() => {
            if (!download) return;
            downloadLink.current?.click();
            return () => URL.revokeObjectURL(download.url);
          }, [download]);
          async function run(input) {
            const request = ++sequence.current;
            setBusy(true); setError(''); setConfirmRefresh(false);
            try {
              const data = await invoke(sessionId, input);
              if (!alive.current || sequence.current !== request) return;
              if (data.view) { setCurrent(data); setPreview(null); }
              if (data.preview) setPreview(data.preview);
              if (data.markdown) setDownload({ url: URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' })), name: `delivery-receipt-${data.view.id}-v${data.view.version}.md` });
              const listing = input.action === 'list' ? data : await invoke(sessionId, { action: 'list' });
              if (alive.current && sequence.current === request) setRows(listing.receipts || []);
            } catch (e) { if (alive.current && sequence.current === request) setError(String(e.message || e)); }
            finally { if (alive.current && sequence.current === request) setBusy(false); }
          }
          const view = current?.view;
          const button = (label, onClick, disabled = busy) => h('button', { type: 'button', onClick, disabled }, label);
          const canAccept = view && ['review_required', 'accepted', 'changes_requested'].includes(view.state);
          return h('section', { className: 'workproof-receipts', 'aria-label': t('title'), 'aria-busy': busy },
            h('style', null, css),
            h('h2', null, t('title')), h('p', { className: 'muted' }, t('subtitle')),
            h('div', { className: 'toolbar' }, button(t('reload'), () => { setCurrent(null); setPreview(null); run({ action: 'list' }); }), busy && h('span', { className: 'muted', role: 'status' }, t('loading'))),
            error && h('p', { role: 'alert', className: 'notice' }, error),
            h('details', null, h('summary', null, t('create')),
              h('form', { onSubmit: e => { e.preventDefault(); setNote(''); run({ action: 'record', title, paths: paths.split('\n').map(x => x.trim()).filter(Boolean) }); } },
                h('label', null, t('receiptTitle'), h('input', { required: true, maxLength: 200, value: title, onChange: e => setTitle(e.target.value) })),
                h('label', null, t('paths'), h('textarea', { required: true, maxLength: 8192, value: paths, onChange: e => setPaths(e.target.value) })),
                h('p', { className: 'muted' }, t('pathsHint')), h('button', { disabled: busy, type: 'submit' }, t('record')))),
            h('div', { className: 'layout' },
              h('nav', { className: 'list', 'aria-label': t('title') },
                rows.length === 0 && h('div', null, h('p', null, t('empty')), h('p', { className: 'muted' }, t('start'))),
                ...rows.map(row => h('button', { key: row.id, className: 'row', disabled: busy, 'aria-pressed': view?.id === row.id, onClick: () => { setNote(''); run({ action: 'inspect', id: row.id }); } },
                  h('strong', null, row.title), h('small', { className: 'muted' }, `${t('version')} ${row.version} · ${t('recheckHint')}`)))),
              h('div', { className: 'detail' }, !view ? h('p', { className: 'muted' }, t('select')) : h(React.Fragment, null,
                h('h3', null, view.title), h('span', { className: 'status' }, `${t(view.state)} · v${view.version}`),
                h('p', { className: 'muted' }, `${t('checked')}: ${current.checkedAt}`),
                h('div', { className: 'toolbar' }, button(t('recheck'), () => run({ action: 'inspect', id: view.id })), button(t('refresh'), () => setConfirmRefresh(true)), button(t('export'), () => run({ action: 'export', id: view.id }))),
                confirmRefresh && h('div', { className: 'notice' }, h('p', null, t('refreshWarning')), h('div', { className: 'toolbar' }, button(t('proceed'), () => run({ action: 'refresh', id: view.id, expectedVersion: view.version })), button(t('cancel'), () => setConfirmRefresh(false)))),
                h('h4', null, t('files')), h('p', { className: 'muted' }, t('hashBoundary')),
                ...view.artifacts.map(file => h('div', { className: 'artifact', key: file.path }, h('strong', null, file.path), h('p', { className: 'muted' }, `${t(file.current.status)}${file.current.size === undefined ? '' : ` · ${file.current.size} ${t('bytes')}`}`),
                  h('code', null, `${t('baseline')}: ${file.baseline.sha256 || '—'}`), h('code', null, `${t('current')}: ${file.current.sha256 || '—'}`), button(t('preview'), () => run({ action: 'preview', id: view.id, path: file.path })))),
                preview && h('div', null, h('h4', null, `${t('previewTitle')} · ${preview.path}`), preview.status === 'ok' ? h('pre', null, preview.text) : h('p', null, `${t('previewUnavailable')}: ${preview.status}`), preview.truncated && h('p', { className: 'muted' }, t('previewLimit'))),
                h('h4', null, t('claims')), h('p', { className: 'muted' }, t('claimWarning')),
                view.claims.checks.length ? h('ul', null, ...view.claims.checks.map((check, i) => h('li', { key: i }, check))) : h('p', { className: 'muted' }, t('noChecks')),
                h('h4', null, t('decision')), h('p', { className: 'muted' }, t('decisionBoundary')),
                h('p', null, view.decision ? `${t(view.decision.decision)} · v${view.decision.version} · ${view.decision.at}` : t('noDecision')),
                view.decision?.note && h('p', null, view.decision.note),
                h('label', null, t('note'), h('textarea', { value: note, maxLength: 2000, onChange: e => setNote(e.target.value) })),
                h('div', { className: 'toolbar' }, button(`${t('accept')} v${view.version}`, () => run({ action: 'decide', id: view.id, expectedVersion: view.version, decision: 'accepted', note }), busy || !canAccept), button(t('reject'), () => run({ action: 'decide', id: view.id, expectedVersion: view.version, decision: 'changes_requested', note }))),
                h('p', { className: 'muted' }, t('exportWarning'))))),
            download && h('a', { ref: downloadLink, href: download.url, download: download.name, hidden: true }, t('export')));
        }
        function Panel(props) { return h(ReceiptPanel, { ...props, key: props.sessionId }); }
        ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'workproof-delivery-receipts', order: 30, locale: 'workproof-receipts', label: () => t('title') }, Panel));
      },
    };
  },
});
