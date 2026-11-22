// 無料ツールの純粋な処理（DOM・window に触らない）。ブラウザと Node の両方から読み込める ES module。
// 入力内容はブラウザの localStorage にだけ保存し、どこにも送信しない。

export const STORAGE_KEY = 'werisupp-tool-v1';
export const STATE_VERSION = 1;
export const AXIS_TOTAL = 30;
export const PROMPT_NOTICE = '※社名・個人名は伏せてから貼ってください。';

export const PRIORITIES = ['MUST', 'WANT', 'NONE'];
export const PRIORITY_LABELS = { MUST: 'MUST', WANT: 'WANT', NONE: '不要' };
export const MARKS = ['○', '△', '×'];

const CATEGORY_NUMBERS = '①②③④⑤';

export function emptyState() {
  return { version: STATE_VERSION, axes: {}, compare: { targets: [], marks: {} }, stories: [] };
}

// 軸の一意キー: カテゴリ番号（①〜⑤→1〜5）-カテゴリ内の番号
export function axisKey(axis) {
  return `${CATEGORY_NUMBERS.indexOf(axis.category.charAt(0)) + 1}-${axis.no}`;
}

// ---- 検証（形が違えば例外。loadState は握りつぶして空状態に、importState はそのまま投げる） ----
const AXIS_KEY_RE = /^[1-5]-\d{1,2}$/;
const TARGET_ID_RE = /^t\d{1,4}$/;
const MARK_KEY_RE = /^(current|t\d{1,4})$/;
const STORY_ID_RE = /^s\d{1,6}$/;

function fail(what) {
  throw new Error(`データの形が正しくありません（${what}）`);
}
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function str(v, what) {
  if (typeof v !== 'string') fail(what);
  return v;
}

function parseState(obj) {
  if (!isPlainObject(obj) || obj.version !== STATE_VERSION) fail('version');
  if (!isPlainObject(obj.axes)) fail('axes');
  if (!isPlainObject(obj.compare)) fail('compare');
  if (!Array.isArray(obj.compare.targets) || !isPlainObject(obj.compare.marks)) fail('compare');
  if (!Array.isArray(obj.stories)) fail('stories');

  const out = emptyState();

  for (const key of Object.keys(obj.axes)) {
    if (!AXIS_KEY_RE.test(key)) fail(`axes.${key}`);
    const v = obj.axes[key];
    if (!isPlainObject(v)) fail(`axes.${key}`);
    const detail = str(v.detail, `axes.${key}.detail`);
    const priority = str(v.priority, `axes.${key}.priority`);
    if (priority !== '' && !PRIORITIES.includes(priority)) fail(`axes.${key}.priority`);
    out.axes[key] = { detail, priority };
  }

  for (const t of obj.compare.targets) {
    if (!isPlainObject(t) || !TARGET_ID_RE.test(str(t.id, 'targets.id'))) fail('targets');
    out.compare.targets.push({ id: t.id, name: str(t.name, 'targets.name') });
  }

  for (const key of Object.keys(obj.compare.marks)) {
    if (!AXIS_KEY_RE.test(key) || !isPlainObject(obj.compare.marks[key])) fail(`marks.${key}`);
    const row = {};
    for (const col of Object.keys(obj.compare.marks[key])) {
      const m = obj.compare.marks[key][col];
      if (!MARK_KEY_RE.test(col) || (m !== '' && !MARKS.includes(m))) fail(`marks.${key}.${col}`);
      row[col] = m;
    }
    out.compare.marks[key] = row;
  }

  for (const s of obj.stories) {
    if (!isPlainObject(s) || !STORY_ID_RE.test(str(s.id, 'stories.id'))) fail('stories');
    out.stories.push({
      id: s.id,
      title: str(s.title, 'stories.title'),
      s: str(s.s, 'stories.s'),
      t: str(s.t, 'stories.t'),
      a: str(s.a, 'stories.a'),
      r: str(s.r, 'stories.r'),
    });
  }
  return out;
}

// ---- 保存・読み込み ----
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) return emptyState();
    return parseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    fail('JSONとして読めません');
  }
  return parseState(obj);
}

// ---- 進捗 ----
// 「優先度（MUST／WANT／不要）」を選んだ軸を、検討が済んだ軸として数える。
export function axisProgress(state) {
  let done = 0;
  for (const key of Object.keys(state.axes)) {
    if (PRIORITIES.includes(state.axes[key].priority)) done += 1;
  }
  return { done: Math.min(done, AXIS_TOTAL), total: AXIS_TOTAL };
}

// ---- 文章化（画面のコピー・印刷、プロンプトの材料） ----
function filled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

// 入力のある軸を MUST → WANT → 不要 → 未選択（条件だけ入力）の順にまとめる。空なら ''。
export function formatAxes(state, axes) {
  const groups = [...PRIORITIES, ''];
  const lines = [];
  for (const p of groups) {
    const items = axes.filter((a) => {
      const v = state.axes[axisKey(a)];
      return v && v.priority === p && (p !== '' || filled(v.detail));
    });
    if (items.length === 0) continue;
    lines.push(`■ ${p === '' ? '優先度は未選択' : PRIORITY_LABELS[p]}`);
    for (const a of items) {
      const v = state.axes[axisKey(a)];
      lines.push(filled(v.detail) ? `・${a.axis}：${v.detail.trim()}` : `・${a.axis}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// 現職・応募先との比較（○△×が1つでもある軸だけ）。空なら ''。
export function formatCompare(state, axes) {
  const cols = [{ id: 'current', name: '現職' }, ...state.compare.targets.map((t) => ({ id: t.id, name: filled(t.name) ? t.name.trim() : `応募先(${t.id.slice(1)})` }))];
  const lines = [];
  for (const a of axes) {
    const row = state.compare.marks[axisKey(a)];
    if (!row) continue;
    const parts = cols.filter((c) => row[c.id]).map((c) => `${c.name}${row[c.id]}`);
    if (parts.length > 0) lines.push(`・${a.axis}：${parts.join(' ／ ')}`);
  }
  return lines.join('\n');
}

export function buildAxisText(state, axes) {
  const parts = [formatAxes(state, axes)];
  const compare = formatCompare(state, axes);
  if (compare) parts.push(`■ 現職・応募先との比較（○満たす・△一部・×満たさない）\n${compare}`);
  return parts.filter(Boolean).join('\n\n');
}

export function formatStories(state) {
  const blocks = [];
  let n = 0;
  for (const st of state.stories) {
    const fields = [['状況', st.s], ['課題・目標', st.t], ['行動', st.a], ['結果', st.r]].filter(([, v]) => filled(v));
    if (!filled(st.title) && fields.length === 0) continue;
    n += 1;
    const lines = [`エピソード${n}${filled(st.title) ? `：${st.title.trim()}` : ''}`];
    for (const [label, v] of fields) lines.push(`${label}：${v.trim()}`);
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

// ---- プロンプト（利用者が自分で ChatGPT・Claude 等に貼る。このツールは送信しない） ----
export function buildAxisPrompt(state, axes) {
  const body = formatAxes(state, axes);
  if (body === '') return '';
  const compare = formatCompare(state, axes);
  return [
    PROMPT_NOTICE,
    '',
    '転職の軸を整理しました。次の観点で見直しを手伝ってください。',
    '1. MUSTに入れたものの中に、WANTに下げても困らないものはないか',
    '2. 書いた条件の中で、互いに両立しにくいものはないか',
    '3. 条件が曖昧なものについて、具体的にするための質問',
    '4. 面接で「転職の軸」として話すときの、1分程度の説明の下書き',
    '',
    '【私の転職の軸】',
    body,
    ...(compare ? ['', '【現職・応募先との比較（○満たす・△一部・×満たさない）】', compare] : []),
  ].join('\n');
}

export function buildSelfPrompt(state) {
  const body = formatStories(state);
  if (body === '') return '';
  return [
    PROMPT_NOTICE,
    '',
    '自己分析として、仕事のエピソードを状況・課題・行動・結果（STAR）の形で書きました。次の観点で見直しを手伝ってください。',
    '1. 抜けている情報や、数字・根拠があるとよい箇所への質問',
    '2. 読む人に伝わりにくい表現の指摘',
    '3. このエピソードから読み取れる、私の強みの候補',
    '',
    '【私のエピソード】',
    body,
  ].join('\n');
}
