// 画面の動き。入力内容は localStorage にだけ保存し、どこにも送信しない。
import {
  AXIS_TOTAL,
  MARKS,
  PRIORITIES,
  PRIORITY_LABELS,
  STORAGE_KEY,
  axisKey,
  axisProgress,
  buildAxisPrompt,
  buildAxisText,
  buildSelfPrompt,
  emptyState,
  exportState,
  formatStories,
  importState,
  loadState,
  saveState,
} from './tool-core.js';

// ---- 小さな道具 ----
const track = (name) => {
  try { window.werisuppTrack?.(name); } catch { /* 計測は失敗しても何もしない */ }
};
const $ = (sel, root = document) => root.querySelector(sel);

// DOM を作る。利用者の入力は必ず textContent / value で入れる（innerHTML は使わない）。
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c !== null && c !== undefined && c !== false) el.append(c);
  }
  return el;
}

// replaceChildren は null や配列を文字列にしてしまうので、空の値を除き、配列は平らにして入れる
function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
}

async function loadJSON(name) {
  const res = await fetch(new URL(`./data/${name}`, import.meta.url));
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

function showLoadError(container) {
  fill(container, h('p', { class: 'tool-error', text: 'データを読み込めませんでした。ページを再読み込みしてください（ファイルを直接開いている場合は、Webサーバー経由で開いてください）。' }));
}

// ---- 保存 ----
let storage = null;
try { storage = window.localStorage; } catch { storage = null; }
let state = loadState(storage);

function persist() {
  const ok = saveState(storage, state);
  const warn = $('#storage-warning');
  if (warn) warn.hidden = ok;
  return ok;
}

// ---- 共通の枠（サイドバー） ----
function setupChrome() {
  const sidebar = $('#pubSidebar');
  const overlay = $('#pubSidebarOverlay');
  const toggle = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };
  $('.pub-menu-btn').addEventListener('click', toggle);
  overlay.addEventListener('click', close);
}

// ---- クリップボード ----
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 下の方法を試す */ }
  try {
    const ta = h('textarea', { 'aria-hidden': 'true', class: 'tool-offscreen' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function flash(statusEl, message) {
  statusEl.textContent = message;
  clearTimeout(statusEl._t);
  statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hasAnyInput(s) {
  return Object.keys(s.axes).length > 0 || s.compare.targets.length > 0 || s.stories.some((x) => x.title || x.s || x.t || x.a || x.r);
}

// ---- 出力パネル（印刷・コピー・書き出し／読み込み・プロンプト） ----
// getText: 印刷・コピーする本文、getPrompt: プロンプト、title: 印刷の見出し
function setupOutputPanel({ title, getText, getPrompt, rerender }) {
  const root = $('#output-panel');
  const print = $('#print-area');
  const status = h('p', { class: 'tool-status', role: 'status', 'aria-live': 'polite' });
  const promptBox = h('textarea', { class: 'tool-prompt-text', rows: '10', readonly: true, 'aria-label': 'AIに貼るプロンプト' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'tool-offscreen', tabindex: '-1', 'aria-hidden': 'true' });

  const refresh = () => {
    const prompt = getPrompt();
    promptBox.value = prompt || 'まだ入力がありません。入力すると、ここにプロンプトができあがります。';
    fill(print, 
      h('h1', { text: title }),
      h('pre', { text: getText() || '（入力がありません）' }),
    );
  };

  const onCopyText = async () => {
    const text = getText();
    if (!text) return flash(status, 'コピーする内容がまだありません。');
    flash(status, (await copyText(text)) ? '内容をコピーしました。' : 'コピーできませんでした。手動で選択してコピーしてください。');
  };
  const onCopyPrompt = async () => {
    const prompt = getPrompt();
    if (!prompt) return flash(status, 'プロンプトにする内容がまだありません。');
    if (await copyText(prompt)) {
      track('tool_prompt_copy');
      flash(status, 'プロンプトをコピーしました。社名・個人名を伏せてから、お使いのChatGPT・Claude等に貼ってください。');
    } else {
      flash(status, 'コピーできませんでした。上の枠を選択して手動でコピーしてください。');
    }
  };
  const onExport = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    download(`werisupp-tool-${ymd}.json`, exportState(state));
    flash(status, 'JSONファイルを書き出しました。');
  };
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let next;
    try {
      next = importState(await file.text());
    } catch {
      return flash(status, '読み込めませんでした。このツールで書き出したJSONファイルを選んでください。');
    }
    if (hasAnyInput(state) && !window.confirm('いまの入力内容は、読み込んだ内容で置き換わります。よろしいですか？')) return;
    state = next;
    persist();
    rerender();
    flash(status, 'ファイルから読み込みました。');
  });
  const onReset = () => {
    if (!window.confirm('このブラウザに保存した入力内容（転職の軸・自己分析の両方）をすべて消します。よろしいですか？\n必要なら先にJSONを書き出してください。')) return;
    state = emptyState();
    persist();
    rerender();
    flash(status, '入力内容を消しました。');
  };

  fill(root, 
    h('div', { class: 'tool-actions no-print' },
      h('button', { type: 'button', class: 'tool-btn', onclick: () => window.print(), text: '印刷する' }),
      h('button', { type: 'button', class: 'tool-btn', onclick: onCopyText, text: '内容をコピー' }),
      h('button', { type: 'button', class: 'tool-btn', onclick: onExport, text: 'JSONで書き出す' }),
      h('button', { type: 'button', class: 'tool-btn', onclick: () => fileInput.click(), text: 'JSONを読み込む' }),
      h('button', { type: 'button', class: 'tool-btn tool-btn-danger', onclick: onReset, text: '入力を全部消す' }),
      fileInput,
    ),
    h('div', { class: 'tool-prompt no-print' },
      h('h3', { class: 'tool-h3', text: 'AIに相談するときのプロンプト' }),
      h('p', { class: 'tool-note', text: 'このツールは入力内容を送信しません。下のプロンプトをコピーして、お使いのChatGPT・Claude等に自分で貼ってください。貼る前に社名・個人名を伏せてください。' }),
      promptBox,
      h('button', { type: 'button', class: 'tool-btn tool-btn-primary', onclick: onCopyPrompt, text: 'プロンプトをコピー' }),
    ),
    status,
  );
  refresh();
  return { refresh };
}

// ---- 転職の軸ページ ----
async function initAxis() {
  const list = $('#axis-list');
  let axes;
  try { axes = await loadJSON('axes.json'); } catch { return showLoadError(list); }

  let started = false;
  let completed = axisProgress(state).done >= AXIS_TOTAL;
  const progressText = $('#axis-progress-text');
  const progressBar = $('#axis-progress-bar');
  const compareRoot = $('#compare-root');

  const panel = setupOutputPanel({
    title: '転職の軸',
    getText: () => buildAxisText(state, axes),
    getPrompt: () => buildAxisPrompt(state, axes),
    rerender: () => render(),
  });

  const updateProgress = () => {
    const { done, total } = axisProgress(state);
    progressText.textContent = `${total}項目中 ${done}項目 検討済み（優先度を選んだ数）`;
    progressBar.value = done;
    progressBar.max = total;
    if (!completed && done >= total) {
      completed = true;
      track('tool_complete_axis');
    }
  };

  const touched = () => {
    if (!started) { started = true; track('tool_start_axis'); }
    persist();
    updateProgress();
    panel.refresh();
  };

  function axisCard(axis) {
    const key = axisKey(axis);
    const cur = state.axes[key] || { detail: '', priority: '' };
    const detail = h('textarea', { rows: '2', maxlength: '1000', placeholder: '例を参考に、自分の言葉で条件を書く', id: `detail-${key}`, value: cur.detail });
    const buttons = {};
    const sync = (rerenderCompare) => {
      const v = { detail: detail.value, priority: cur.priority };
      if (v.detail === '' && v.priority === '') delete state.axes[key];
      else state.axes[key] = v;
      for (const p of PRIORITIES) buttons[p].setAttribute('aria-pressed', String(cur.priority === p));
      touched();
      if (rerenderCompare) renderCompare();
    };
    detail.addEventListener('input', () => sync(false));
    const prioButtons = PRIORITIES.map((p) => {
      buttons[p] = h('button', {
        type: 'button',
        class: `tool-chip tool-chip-${p.toLowerCase()}`,
        'aria-pressed': String(cur.priority === p),
        text: PRIORITY_LABELS[p],
        onclick: () => { cur.priority = cur.priority === p ? '' : p; sync(true); },
      });
      return buttons[p];
    });
    return h('div', { class: 'axis-card' },
      h('h4', { class: 'axis-name', text: axis.axis }),
      h('ul', { class: 'axis-examples' }, axis.examples.map((ex) => h('li', {},
        h('span', { text: ex }),
        h('button', {
          type: 'button',
          class: 'tool-mini no-print',
          'aria-label': `「${ex}」を条件の詳細に追加`,
          text: '＋',
          onclick: () => { detail.value = detail.value ? `${detail.value}\n${ex}` : ex; sync(false); },
        })))),
      h('label', { class: 'tool-label', for: `detail-${key}`, text: '条件の詳細' }),
      detail,
      h('div', { class: 'axis-priority', role: 'group', 'aria-label': `${axis.axis}の優先度` },
        h('span', { class: 'tool-label', text: '優先度' }), prioButtons),
    );
  }

  function renderCompare() {
    const rows = axes.filter((a) => {
      const v = state.axes[axisKey(a)];
      return v && (v.priority === 'MUST' || v.priority === 'WANT');
    });
    const targets = state.compare.targets;
    const setMark = (key, col, value) => {
      const row = state.compare.marks[key] || {};
      if (value === '') delete row[col]; else row[col] = value;
      if (Object.keys(row).length === 0) delete state.compare.marks[key]; else state.compare.marks[key] = row;
      touched();
    };
    const markSelect = (key, col, label) => {
      const cur = (state.compare.marks[key] || {})[col] || '';
      return h('select', { 'aria-label': label, onchange: (e) => setMark(key, col, e.target.value) },
        ['', ...MARKS].map((m) => h('option', { value: m, selected: m === cur, text: m === '' ? '－' : m })));
    };
    const addTarget = () => {
      const next = Math.max(0, ...targets.map((t) => Number(t.id.slice(1)))) + 1;
      targets.push({ id: `t${next}`, name: '' });
      touched();
      renderCompare();
    };
    const removeTarget = (t) => {
      if (!window.confirm(`「${t.name || '名前なしの応募先'}」の列を削除します。よろしいですか？`)) return;
      state.compare.targets = targets.filter((x) => x.id !== t.id);
      for (const key of Object.keys(state.compare.marks)) {
        delete state.compare.marks[key][t.id];
        if (Object.keys(state.compare.marks[key]).length === 0) delete state.compare.marks[key];
      }
      touched();
      renderCompare();
    };

    const head = h('tr', {},
      h('th', { scope: 'col', text: '軸' }),
      h('th', { scope: 'col', text: '優先度' }),
      h('th', { scope: 'col', text: '現職' }),
      targets.map((t) => h('th', { scope: 'col', class: 'compare-target' },
        h('input', {
          type: 'text', maxlength: '40', value: t.name, placeholder: '応募先の名前',
          'aria-label': '応募先の名前',
          oninput: (e) => { t.name = e.target.value; touched(); },
        }),
        h('button', { type: 'button', class: 'tool-mini no-print', 'aria-label': 'この応募先を削除', text: '削除', onclick: () => removeTarget(t) }))));

    const body = rows.map((a) => {
      const key = axisKey(a);
      return h('tr', {},
        h('th', { scope: 'row', text: a.axis }),
        h('td', { text: PRIORITY_LABELS[state.axes[key].priority] }),
        h('td', {}, markSelect(key, 'current', `${a.axis}：現職`)),
        targets.map((t, i) => h('td', {}, markSelect(key, t.id, `${a.axis}：${t.name || `応募先${i + 1}`}`))));
    });

    fill(compareRoot, 
      rows.length === 0
        ? h('p', { class: 'tool-note', text: '上で優先度を「MUST」か「WANT」にした軸が、ここに並びます。' })
        : h('div', { class: 'table-scroll' }, h('table', { class: 'compare-table' }, h('thead', {}, head), h('tbody', {}, body))),
      h('p', { class: 'compare-legend', text: '○＝満たす　△＝一部だけ満たす　×＝満たさない' }),
      h('button', { type: 'button', class: 'tool-btn no-print', onclick: addTarget, text: '＋ 応募先を追加' }),
    );
  }

  function render() {
    const byCategory = new Map();
    for (const a of axes) {
      if (!byCategory.has(a.category)) byCategory.set(a.category, []);
      byCategory.get(a.category).push(a);
    }
    fill(list, ...[...byCategory].map(([category, items]) => h('div', { class: 'axis-category' },
      h('h3', { class: 'tool-h3', text: category }),
      items.map(axisCard))));
    renderCompare();
    updateProgress();
    panel.refresh();
  }
  render();
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) { state = loadState(storage); render(); }
  });
}

// ---- 自己分析ページ ----
const TABS = [
  { id: 'job', label: '職種' },
  { id: 'industry', label: '業界' },
  { id: 'portable', label: 'ポータブル' },
  { id: 'human', label: 'ヒューマン' },
];
const STAR_FIELDS = [
  ['s', 'S 状況', 'いつ・どこで・どんな状況だったか'],
  ['t', 'T 課題・目標', '何を求められていたか、何を目指したか'],
  ['a', 'A 行動', '自分が具体的に何をしたか'],
  ['r', 'R 結果', 'どうなったか（数字や周りの反応があれば）'],
];
const isComplete = (st) => STAR_FIELDS.every(([k]) => st[k].trim() !== '');

async function initSelf() {
  const exampleRoot = $('#example-root');
  let star;
  try { star = await loadJSON('star.json'); } catch { return showLoadError(exampleRoot); }

  let started = false;
  let completeCount = state.stories.filter(isComplete).length;
  let tab = 'job';
  const groupByTab = {};
  const storyRoot = $('#story-root');
  const progressText = $('#self-progress-text');

  const panel = setupOutputPanel({
    title: '自己分析（エピソード）',
    getText: () => formatStories(state),
    getPrompt: () => buildSelfPrompt(state),
    rerender: () => renderAll(),
  });

  const updateProgress = () => {
    const filledCount = state.stories.filter((s) => s.title || s.s || s.t || s.a || s.r).length;
    progressText.textContent = `エピソード ${filledCount}件（S・T・A・Rがそろったもの ${state.stories.filter(isComplete).length}件）`;
  };

  const touched = () => {
    if (!started) { started = true; track('tool_start_self'); }
    persist();
    updateProgress();
    const now = state.stories.filter(isComplete).length;
    if (now > completeCount) track('tool_complete_self');
    completeCount = now;
    panel.refresh();
  };

  function addStory(title = '') {
    const next = Math.max(0, ...state.stories.map((s) => Number(s.id.slice(1)))) + 1;
    state.stories.push({ id: `s${next}`, title, s: '', t: '', a: '', r: '' });
    if (title) touched(); else persist();
    renderStories();
    const cards = storyRoot.querySelectorAll('.story-card');
    const last = cards[cards.length - 1];
    last.scrollIntoView({ behavior: 'smooth', block: 'start' });
    last.querySelector('textarea').focus({ preventScroll: true });
  }

  function storyCard(st, index) {
    const fields = STAR_FIELDS.map(([k, label, hint]) => {
      const id = `${st.id}-${k}`;
      return h('div', { class: 'story-field' },
        h('label', { class: 'tool-label', for: id, text: label }),
        h('textarea', {
          id, rows: '3', maxlength: '2000', placeholder: hint, value: st[k],
          oninput: (e) => { st[k] = e.target.value; touched(); },
        }));
    });
    return h('div', { class: 'story-card' },
      h('div', { class: 'story-head' },
        h('h4', { class: 'axis-name', text: `エピソード${index + 1}` }),
        h('button', {
          type: 'button', class: 'tool-mini no-print', text: '削除',
          onclick: () => {
            const any = st.title || st.s || st.t || st.a || st.r;
            if (any && !window.confirm(`エピソード${index + 1}を削除します。よろしいですか？`)) return;
            state.stories = state.stories.filter((x) => x.id !== st.id);
            touched();
            renderStories();
          },
        })),
      h('label', { class: 'tool-label', for: `${st.id}-title`, text: '見出し（何についての話か）' }),
      h('input', {
        type: 'text', id: `${st.id}-title`, maxlength: '100', value: st.title,
        placeholder: '例：業務フローの見直し',
        oninput: (e) => { st.title = e.target.value; touched(); },
      }),
      fields);
  }

  function renderStories() {
    fill(storyRoot, 
      state.stories.length === 0 ? h('p', { class: 'tool-note', text: 'まだエピソードがありません。下のボタンで追加してください。' }) : null,
      state.stories.map(storyCard),
      h('button', { type: 'button', class: 'tool-btn tool-btn-primary no-print', onclick: () => addStory(), text: '＋ エピソードを追加' }),
    );
  }

  function renderExamples() {
    const items = star[tab];
    const groups = [...new Set(items.map((x) => x.group))];
    const group = groups.includes(groupByTab[tab]) ? groupByTab[tab] : groups[0];
    groupByTab[tab] = group;

    const tabs = h('div', { class: 'tool-tabs', role: 'tablist', 'aria-label': '例の種類' }, TABS.map((t) => h('button', {
      type: 'button', role: 'tab', class: 'tool-tab', 'aria-selected': String(t.id === tab), text: t.label,
      onclick: () => { tab = t.id; renderExamples(); },
    })));
    const select = groups.length > 1
      ? h('label', { class: 'tool-select' }, h('span', { class: 'tool-label', text: '分類' }),
        h('select', { onchange: (e) => { groupByTab[tab] = e.target.value; renderExamples(); } },
          groups.map((g) => h('option', { value: g, selected: g === group, text: g }))))
      : null;
    const cards = items.filter((x) => x.group === group).map((x) => h('details', { class: 'star-card' },
      h('summary', {},
        h('span', { class: 'star-skill', text: x.skill }),
        h('span', { class: 'star-title', text: x.title }),
        h('span', { class: 'tool-badge', text: 'AIで作った架空の例です' })),
      h('dl', { class: 'star-body' }, STAR_FIELDS.map(([k, label]) => [h('dt', { text: label }), h('dd', { text: x[k] })])),
      h('button', {
        type: 'button', class: 'tool-btn no-print', text: 'この例を見ながら自分のエピソードを書く',
        onclick: () => addStory(x.skill),
      })));

    fill(exampleRoot, 
      tabs,
      h('p', { class: 'tool-note', text: 'ここにある例は、AIで作った架空の例です。そのまま使わず、自分の経験を思い出すきっかけにしてください。' }),
      select,
      h('div', { class: 'star-list' }, cards),
    );
  }

  function renderAll() {
    if (state.stories.length === 0) state.stories.push({ id: 's1', title: '', s: '', t: '', a: '', r: '' });
    renderExamples();
    renderStories();
    updateProgress();
    panel.refresh();
  }
  renderAll();
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) { state = loadState(storage); renderAll(); }
  });
}

// ---- はじめにページ ----
function initIndex() {
  const root = $('#index-progress');
  if (!root) return;
  const { done, total } = axisProgress(state);
  const stories = state.stories.filter((s) => s.title || s.s || s.t || s.a || s.r).length;
  if (done === 0 && stories === 0) return;
  fill(root, h('p', { class: 'tool-note', text: `前回の続き：転職の軸 ${total}項目中${done}項目、自己分析のエピソード${stories}件（このブラウザに保存されています）` }));
}

// ---- 起動 ----
setupChrome();
persist();
const page = document.body.dataset.page;
if (page === 'axis') initAxis();
else if (page === 'self') initSelf();
else initIndex();
