import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  WERISUPP_STEPS,
  WERISUPP_PHASES,
  circled,
  pageInfo,
  neighbors,
  readProgress,
  recordVisit,
} = require('../common.js');

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function spanTexts(html, className) {
  const re = new RegExp(`<span class="${className}">([^<]*)</span>`, 'g');
  return [...html.matchAll(re)].map((m) => m[1]);
}

// 本物の localStorage 代わりの最小実装
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('STEP一覧は16件で index.html の題名と一致する', () => {
  assert.equal(WERISUPP_STEPS.length, 16);
  assert.deepEqual(WERISUPP_STEPS.map((s) => s.n), [...Array(16)].map((_, i) => i + 1));
  assert.deepEqual(WERISUPP_STEPS.map((s) => s.title), spanTexts(indexHtml, 'step-title'));
  assert.deepEqual(WERISUPP_STEPS.map((s) => s.duration), spanTexts(indexHtml, 'step-duration'));
});

test('STEP一覧のフェーズと公開済みの印', () => {
  assert.deepEqual(WERISUPP_STEPS[2], { n: 3, title: '転職サービスに登録する', phase: 'prep', duration: '～1時間', ready: true });
  assert.deepEqual(WERISUPP_STEPS.filter((s) => s.ready).map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  for (const s of WERISUPP_STEPS) {
    const phase = WERISUPP_PHASES.find((p) => p.key === s.phase);
    assert.ok(phase && s.n >= phase.from && s.n <= phase.to, `STEP ${s.n} のフェーズ`);
  }
  assert.deepEqual(WERISUPP_PHASES.map((p) => [p.key, p.label, p.from, p.to]), [
    ['mind', 'マインドセット', 1, 2],
    ['prep', '準備', 3, 7],
    ['action', '活動', 8, 15],
    ['exit', '終了', 16, 16],
  ]);
});

test('circled は1〜16を丸数字にする', () => {
  assert.equal(circled(1), '①');
  assert.equal(circled(3), '③');
  assert.equal(circled(16), '⑯');
});

test('pageInfo はルート直下を判定する', () => {
  assert.deepEqual(pageInfo('/werisupp/step3.html', '/werisupp/common.js'), { kind: 'step', step: 3, root: './' });
  assert.equal(pageInfo('/', '/common.js').kind, 'map');
  assert.equal(pageInfo('/index.html', '/common.js').kind, 'map');
  assert.equal(pageInfo('/about.html', '/common.js').kind, 'about');
});

test('pageInfo は .html を省いた URL も判定する（Cloudflare Pages の形）', () => {
  assert.deepEqual(pageInfo('/step12', '/common.js'), { kind: 'step', step: 12, root: './' });
  assert.equal(pageInfo('/index', '/common.js').kind, 'map');
  assert.equal(pageInfo('/about', '/common.js').kind, 'about');
  assert.deepEqual(pageInfo('/tool/', '/common.js'), { kind: 'tool', step: null, root: '../' });
});

test('pageInfo は tool 配下を判定し、ルートへの相対パスを返す', () => {
  assert.deepEqual(pageInfo('/tool/axis.html', '/common.js'), { kind: 'tool', step: null, root: '../' });
  assert.deepEqual(pageInfo('/werisupp/tool/index.html', '/werisupp/common.js'), { kind: 'tool', step: null, root: '../' });
});

test('pageInfo は一覧にないページを other にする', () => {
  assert.equal(pageInfo('/step99.html', '/common.js').kind, 'other');
  assert.equal(pageInfo('/step99.html', '/common.js').step, null);
  assert.equal(pageInfo('/hoge.html', '/common.js').kind, 'other');
});

test('neighbors の端', () => {
  assert.equal(neighbors(1).prev, null);
  assert.equal(neighbors(1).next.n, 2);
  assert.equal(neighbors(16).next, null);
  assert.equal(neighbors(16).prev.n, 15);
  assert.equal(neighbors(3).prev.n, 2);
  assert.equal(neighbors(3).next.n, 4);
});

test('recordVisit は訪問を重複なく記録し last を更新する', () => {
  const storage = memoryStorage();
  assert.deepEqual(readProgress(storage), { visited: [], last: null });
  recordVisit(storage, 3);
  recordVisit(storage, 5);
  assert.deepEqual(recordVisit(storage, 3), { visited: [3, 5], last: 3 });
  assert.deepEqual(readProgress(storage), { visited: [3, 5], last: 3 });
});

test('recordVisit は保存が例外を投げても落ちない', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
  };
  assert.doesNotThrow(() => recordVisit(broken, 4));
  assert.deepEqual(recordVisit(broken, 4), { visited: [4], last: 4 });
  assert.deepEqual(readProgress(broken), { visited: [], last: null });
  assert.deepEqual(readProgress(null), { visited: [], last: null });
  assert.doesNotThrow(() => recordVisit(null, 4));
});

test('readProgress は壊れたデータを無視する', () => {
  const storage = memoryStorage();
  storage.setItem('werisupp.progress.v1', '{');
  assert.deepEqual(readProgress(storage), { visited: [], last: null });
  storage.setItem('werisupp.progress.v1', JSON.stringify({ visited: 'x', last: 'y' }));
  assert.deepEqual(readProgress(storage), { visited: [], last: null });
  storage.setItem('werisupp.progress.v1', JSON.stringify({ visited: [2, 99, 'a', 2], last: 99 }));
  assert.deepEqual(readProgress(storage), { visited: [2], last: null });
});
