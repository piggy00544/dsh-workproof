window.__ModuleLoader__.load({
  id: 'dsh-evidence-ledger',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const dictionaries = {
      en: {
        title: 'Evidence ledger', subtitle: 'Find the basis for a judgment — without mistaking references for verification.',
        reload: 'Reload ledger', empty: 'No claims recorded yet.', start: 'Ask the agent to use evidence_ledger to record sources, claims and unresolved questions. No source is fetched automatically.',
        version: 'Ledger version', claims: 'Claims', sources: 'Recorded sources', questions: 'Questions', issues: 'Structural observations',
        issueBoundary: 'These are structural checks, not a judgment of truth or source quality.', noIssues: 'No listed structural issue. This does not establish correctness.',
        fact_assertion: 'Fact assertion', inference: 'Inference', proposal: 'Proposal', supports: 'Recorded support', contradicts: 'Recorded contradiction', context: 'Context only',
        assertion_without_source: 'Assertion has no recorded source', source_without_locator: 'Source has no locator', recorded_contradiction: 'Contradicting material recorded', open_question: 'Open question',
        noSources: 'No source linked.', sourceBoundary: 'References and excerpts were entered by the recorder. The plugin has not read or verified the source.',
        public_url: 'Public URL', local_reference: 'Local reference (not read)', locator: 'Locator', excerpt: 'Recorded excerpt', open: 'Open', resolved: 'Marked resolved', resolution: 'Recorded explanation',
        review: 'Your review', unreviewed: 'Not reviewed at this version', reviewed: 'Reviewed this version', needs_work: 'Needs more work', note: 'Review note (optional)',
        reviewBoundary: 'Review records your decision for this ledger version, not verified truth. Any source, claim or question edit clears it.',
        export: 'Export selected claims', select: 'Include in export', all: 'Select all', none: 'Clear selection', exportBoundary: 'Local Markdown only. Titles, claim text and URLs can still be sensitive. Review the preview before downloading.',
        excerpts: 'Include recorded excerpts', notes: 'Include review note', paths: 'Include local reference paths', preview: 'Preview export', download: 'Download Markdown', loading: 'Working…', error: 'Operation failed',
      },
      zh: {
        title: '研究证据账本', subtitle: '找到判断的依据，不把“有引用”当成“已核验”。',
        reload: '刷新账本', empty: '还没有登记论点。', start: '让 Agent 调用 evidence_ledger 录入来源、论点和待解决问题。插件不会自动抓取来源。',
        version: '账本版本', claims: '论点', sources: '登记的来源', questions: '待解决问题', issues: '结构性提示',
        issueBoundary: '这些只检查结构，不判断事实真伪或来源质量。', noIssues: '没有列出的结构性问题，但这不证明结论正确。',
        fact_assertion: '事实断言', inference: '推断', proposal: '建议', supports: '登记为支持', contradicts: '登记为反证', context: '仅作背景',
        assertion_without_source: '事实断言没有登记来源', source_without_locator: '来源缺少定位信息', recorded_contradiction: '登记了相反材料', open_question: '尚有待解决问题',
        noSources: '未关联来源。', sourceBoundary: '引用关系和摘录由录入者提供，插件没有读取或核验来源。',
        public_url: '公开链接', local_reference: '本地引用（未读取）', locator: '定位', excerpt: '登记的摘录', open: '待解决', resolved: '标记为已解决', resolution: '登记的解决说明',
        review: '你的审阅', unreviewed: '此版本尚未审阅', reviewed: '已审阅此版本', needs_work: '需要补充', note: '审阅意见（可选）',
        reviewBoundary: '审阅只记录你对这个账本版本的意见，不证明事实已核验。来源、论点或问题发生修改后，审阅状态会清除。',
        export: '导出选中论点', select: '纳入导出', all: '全选', none: '清空选择', exportBoundary: '只生成本地 Markdown。标题、论点和链接仍可能敏感；请先查看预览，再下载分享。',
        excerpts: '包含登记的摘录', notes: '包含审阅备注', paths: '包含本地引用路径', preview: '预览导出', download: '下载 Markdown', loading: '处理中…', error: '操作失败',
      },
    };
    const css = `
      .workproof-ledger{height:100%;overflow:auto;box-sizing:border-box;padding:24px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
      .workproof-ledger *{box-sizing:border-box}.workproof-ledger h2{font-size:20px;margin:0 0 8px}.workproof-ledger h3{font-size:16px;margin:22px 0 10px}.workproof-ledger p{line-height:1.65;margin:8px 0;overflow-wrap:anywhere}
      .workproof-ledger .muted{color:var(--dsw-alias-label-secondary);font-size:12px}.workproof-ledger .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.workproof-ledger button,.workproof-ledger textarea{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:8px 10px}.workproof-ledger button{font-size:12px;cursor:pointer}.workproof-ledger button:disabled{opacity:.5;cursor:default}
      .workproof-ledger :focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:3px}.workproof-ledger textarea{width:100%;min-height:64px;display:block;margin:8px 0;resize:vertical}.workproof-ledger label{font-size:12px}.workproof-ledger input[type=checkbox]{margin-right:8px;accent-color:var(--dsw-alias-label-primary)}
      .workproof-ledger .layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);gap:28px}.workproof-ledger article{padding:16px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}.workproof-ledger .tag{font-size:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:3px 6px}.workproof-ledger .notice{border:1px solid var(--dsw-alias-border-l2);padding:12px;border-radius:7px;margin:12px 0}
      .workproof-ledger code{font-size:11px;overflow-wrap:anywhere}.workproof-ledger pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto;font-size:12px;background:var(--dsw-alias-bg-layer-2);padding:12px;border-radius:7px}.workproof-ledger details{margin:10px 0}.workproof-ledger summary{cursor:pointer;font-size:12px}.workproof-ledger ul{padding-left:20px;font-size:12px;line-height:1.7}.workproof-ledger .options{display:grid;gap:10px;margin:12px 0}
      @media(max-width:800px){.workproof-ledger{padding:16px}.workproof-ledger .layout{grid-template-columns:1fr;gap:8px}}
    `;
    return {
      inject: ['slots', 'remote', 'remote.commands', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('workproof-ledger', dictionaries));
        const t = ctx.locale.bind('workproof-ledger');
        async function invoke(sessionId, input) {
          const reply = await ctx.remote.commands.execute(sessionId, '/evidence_ledger ' + JSON.stringify(input), []);
          if (!reply.ok) throw new Error(reply.error?.message || t('error'));
          const result = reply.value?.result;
          if (result?.kind !== 'success') throw new Error(result?.text || t('error'));
          return JSON.parse(result.text || '{}');
        }
        function Ledger({ sessionId }) {
          const [data, setData] = React.useState(null);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [note, setNote] = React.useState('');
          const [selected, setSelected] = React.useState([]);
          const [options, setOptions] = React.useState({ includeExcerpts: false, includeReviewNotes: false, includeLocalReferences: false });
          const [markdown, setMarkdown] = React.useState('');
          const [download, setDownload] = React.useState(null);
          const alive = React.useRef(true); const sequence = React.useRef(0); const anchor = React.useRef(null);
          async function run(input) {
            const request = ++sequence.current;
            setBusy(true); setError(''); setMarkdown('');
            try {
              const result = await invoke(sessionId, input);
              if (!alive.current || request !== sequence.current) return;
              setData(result);
              setSelected(previous => previous.filter(id => result.ledger.claims.some(claim => claim.id === id)));
              if (result.markdown) setMarkdown(result.markdown);
            } catch (e) { if (alive.current && request === sequence.current) setError(String(e.message || e)); }
            finally { if (alive.current && request === sequence.current) setBusy(false); }
          }
          React.useEffect(() => {
            alive.current = true; run({ action: 'inspect' });
            return () => { alive.current = false; sequence.current++; };
          }, [sessionId]);
          React.useEffect(() => {
            if (!download) return;
            anchor.current?.click();
            return () => URL.revokeObjectURL(download.url);
          }, [download]);
          const ledger = data?.ledger;
          const button = (label, onClick, disabled = busy) => h('button', { type: 'button', onClick, disabled }, label);
          const changeSelection = ids => { setSelected(ids); setMarkdown(''); };
          const sourceView = source => h('div', { key: source.id },
            h('p', null, source.title), h('code', null, source.id),
            h('p', { className: 'muted' }, `${t(source.sourceKind)}: ${source.reference}`),
            h('p', { className: 'muted' }, `${t('locator')}: ${source.locator || '—'}`),
            source.excerpt && h('details', null, h('summary', null, t('excerpt')), h('pre', null, source.excerpt)));
          return h('section', { className: 'workproof-ledger', 'aria-label': t('title'), 'aria-busy': busy },
            h('style', null, css), h('h2', null, t('title')), h('p', { className: 'muted' }, t('subtitle')),
            h('div', { className: 'toolbar' }, button(t('reload'), () => run({ action: 'inspect' })), busy && h('span', { role: 'status' }, t('loading'))),
            error && h('p', { role: 'alert', className: 'notice' }, error),
            ledger && h(React.Fragment, null,
              h('p', { className: 'muted' }, `${t('version')} ${ledger.version}`),
              h('div', { className: 'layout' },
                h('div', null,
                  h('h3', null, `${t('claims')} · ${ledger.claims.length}`),
                  ledger.claims.length === 0 && h('div', null, h('p', null, t('empty')), h('p', { className: 'muted' }, t('start'))),
                  h('div', { className: 'toolbar' }, button(t('all'), () => changeSelection(ledger.claims.map(claim => claim.id)), busy || !ledger.claims.length), button(t('none'), () => changeSelection([]), busy || !selected.length)),
                  ...ledger.claims.map(claim => h('article', { key: claim.id },
                    h('div', { className: 'toolbar' }, h('label', null, h('input', { type: 'checkbox', disabled: busy, checked: selected.includes(claim.id), onChange: e => changeSelection(e.target.checked ? [...selected, claim.id] : selected.filter(id => id !== claim.id)) }), t('select')), h('span', { className: 'tag' }, t(claim.claimKind))),
                    h('p', null, claim.text), h('code', null, claim.id),
                    claim.links.length === 0 ? h('p', { className: 'muted' }, t('noSources')) : h('details', null, h('summary', null, `${t('sources')} · ${claim.links.length}`),
                      ...claim.links.map(link => { const source = ledger.sources.find(item => item.id === link.sourceId); return h('div', { className: 'notice', key: link.sourceId }, h('span', { className: 'tag' }, t(link.relation)), source ? sourceView(source) : h('p', null, link.sourceId)); })))),
                  h('h3', null, t('questions')),
                  ...ledger.questions.map(question => h('article', { key: question.id }, h('span', { className: 'tag' }, t(question.status)), h('p', null, question.question), question.claimId && h('code', null, question.claimId), question.resolution && h('p', { className: 'muted' }, `${t('resolution')}: ${question.resolution}`))),
                  h('details', null, h('summary', null, `${t('sources')} · ${ledger.sources.length}`), h('p', { className: 'muted' }, t('sourceBoundary')), ...ledger.sources.map(source => h('article', { key: source.id }, sourceView(source))))),
                h('aside', null,
                  h('h3', null, t('issues')), h('p', { className: 'muted' }, t('issueBoundary')),
                  data.issues.length ? h('ul', null, ...data.issues.map((issue, i) => h('li', { key: i }, t(issue.type), ' · ', h('code', null, issue.claimId || issue.sourceId || issue.questionId || '')))) : h('p', { className: 'muted' }, t('noIssues')),
                  h('h3', null, t('review')), h('p', { className: 'muted' }, t('reviewBoundary')),
                  h('p', null, ledger.review ? `${t(ledger.review.status)} · v${ledger.review.version} · ${ledger.review.at}` : t('unreviewed')),
                  ledger.review?.note && h('p', null, ledger.review.note),
                  h('label', null, t('note'), h('textarea', { value: note, maxLength: 2000, disabled: busy, onChange: e => setNote(e.target.value) })),
                  h('div', { className: 'toolbar' }, button(t('reviewed'), () => run({ action: 'review', expectedVersion: ledger.version, status: 'reviewed', note }), busy || !ledger.claims.length), button(t('needs_work'), () => run({ action: 'review', expectedVersion: ledger.version, status: 'needs_work', note }), busy || !ledger.claims.length)),
                  h('h3', null, `${t('export')} · ${selected.length}`), h('p', { className: 'muted' }, t('exportBoundary')),
                  h('div', { className: 'options' }, ...[['includeExcerpts', 'excerpts'], ['includeReviewNotes', 'notes'], ['includeLocalReferences', 'paths']].map(([key, label]) => h('label', { key }, h('input', { type: 'checkbox', disabled: busy, checked: options[key], onChange: e => { setOptions({ ...options, [key]: e.target.checked }); setMarkdown(''); } }), t(label)))),
                  h('div', { className: 'toolbar' }, button(t('preview'), () => run({ action: 'export', claimIds: selected, ...options }), busy || !selected.length),
                    button(t('download'), () => setDownload({ url: URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' })), name: `evidence-ledger-v${ledger.version}.md` }), busy || !markdown)),
                  markdown && h('pre', { 'aria-label': t('preview') }, markdown)))),
            download && h('a', { ref: anchor, href: download.url, download: download.name, hidden: true }, t('download')));
        }
        function Panel(props) { return h(Ledger, { ...props, key: props.sessionId }); }
        ctx.slots.inject('conversation.view', () => ctx.slots.register({ name: 'conversation.view', id: 'workproof-evidence-ledger', order: 31, locale: 'workproof-ledger', label: () => t('title') }, Panel));
      },
    };
  },
});
