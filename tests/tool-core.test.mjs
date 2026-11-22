import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STORAGE_KEY,
  PROMPT_NOTICE,
  emptyState,
  axisKey,
  loadState,
  saveState,
  exportState,
  importState,
  buildAxisPrompt,
  buildSelfPrompt,
  axisProgress,
} from '../tool/tool-core.js';

const axes = JSON.parse(readFileSync(new URL('../tool/data/axes.json', import.meta.url), 'utf8'));

// 本物の localStorage 代わりの最小実装
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}
const throwingStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
};

function filledState() {
  const s = emptyState();
  s.axes[axisKey(axes[0])] = { detail: '顧客と直接話せる仕事', priority: 'MUST' };
  s.axes[axisKey(axes[1])] = { detail: '', priority: 'WANT' };
  s.axes[axisKey(axes[2])] = { detail: '専門性を活かしたい', priority: '' };
  s.compare.targets = [{ id: 't1', name: 'A社' }, { id: 't2', name: 'B社' }];
  s.compare.marks[axisKey(axes[0])] = { current: '×', t1: '○', t2: '△' };
  s.stories = [
    { id: 's1', title: '業務改善', s: '残業が多かった', t: '月20時間減らす', a: '手順を見直した', r: '月8時間になった' },
    { id: 's2', title: '', s: '', t: '', a: '', r: '' },
  ];
  return s;
}

test('storage key is werisupp-tool-v1', () => {
  assert.equal(STORAGE_KEY, 'werisupp-tool-v1');
});

test('axisKey is category number + no', () => {
  assert.equal(axisKey({ category: '①仕事内容', no: 3 }), '1-3');
  assert.equal(axisKey({ category: '⑤収入', no: 4 }), '5-4');
});

// ---- loadState / saveState ----
test('loadState: nothing stored -> empty state', () => {
  assert.deepEqual(loadState(memoryStorage()), emptyState());
});

test('loadState: broken JSON -> empty state', () => {
  assert.deepEqual(loadState(memoryStorage({ [STORAGE_KEY]: '{not json' })), emptyState());
});

test('loadState: old/unknown shape -> empty state', () => {
  for (const raw of ['[]', '"x"', '123', 'null', '{"axes":[]}', '{"version":0,"axes":{}}', '{"version":1,"axes":[]}']) {
    assert.deepEqual(loadState(memoryStorage({ [STORAGE_KEY]: raw })), emptyState(), raw);
  }
});

test('loadState: storage that throws (private browsing) -> empty state', () => {
  assert.deepEqual(loadState(throwingStorage), emptyState());
  assert.deepEqual(loadState(null), emptyState());
});

test('saveState: returns true and loadState reads it back', () => {
  const st = memoryStorage();
  const s = filledState();
  assert.equal(saveState(st, s), true);
  assert.deepEqual(loadState(st), s);
});

test('saveState: returns false when storage throws or is missing', () => {
  assert.equal(saveState(throwingStorage, filledState()), false);
  assert.equal(saveState(null, filledState()), false);
});

// ---- export / import ----
test('export -> import round trip keeps the same value', () => {
  const s = filledState();
  assert.deepEqual(importState(exportState(s)), s);
  assert.deepEqual(importState(exportState(emptyState())), emptyState());
});

test('importState throws on wrong shape', () => {
  for (const text of ['', '{broken', '[]', 'null', '{}', '{"version":2}',
    '{"version":1,"axes":[]}',
    '{"version":1,"axes":{"1-1":{"detail":1,"priority":"MUST"}},"compare":{"targets":[],"marks":{}},"stories":[]}',
    '{"version":1,"axes":{"1-1":{"detail":"","priority":"MAYBE"}},"compare":{"targets":[],"marks":{}},"stories":[]}',
    '{"version":1,"axes":{},"compare":{"targets":[],"marks":{}},"stories":"x"}',
  ]) {
    assert.throws(() => importState(text), undefined, text);
  }
});

test('importState does not pollute prototypes through keys', () => {
  const text = '{"version":1,"axes":{"__proto__":{"detail":"x","priority":"MUST"}},"compare":{"targets":[],"marks":{}},"stories":[]}';
  assert.throws(() => importState(text));
  assert.equal({}.detail, undefined);
});

// ---- axisProgress ----
test('axisProgress: empty is 0 of 30', () => {
  assert.deepEqual(axisProgress(emptyState()), { done: 0, total: 30 });
});

test('axisProgress counts axes whose priority is chosen (MUST/WANT/不要)', () => {
  const s = emptyState();
  s.axes['1-1'] = { detail: 'x', priority: 'MUST' };
  s.axes['1-2'] = { detail: '', priority: 'WANT' };
  s.axes['1-3'] = { detail: '', priority: 'NONE' };
  s.axes['1-4'] = { detail: '書いただけ', priority: '' };
  assert.deepEqual(axisProgress(s), { done: 3, total: 30 });
});

test('axisProgress: all 30 axes decided is 30 of 30', () => {
  const s = emptyState();
  for (const a of axes) s.axes[axisKey(a)] = { detail: '', priority: 'WANT' };
  assert.deepEqual(axisProgress(s), { done: 30, total: 30 });
});

// ---- prompts ----
test('buildAxisPrompt: empty input -> empty string', () => {
  assert.equal(buildAxisPrompt(emptyState(), axes), '');
  const s = emptyState();
  s.axes['1-1'] = { detail: '  ', priority: '' };
  assert.equal(buildAxisPrompt(s, axes), '');
});

test('buildAxisPrompt: first line is the anonymize notice', () => {
  const p = buildAxisPrompt(filledState(), axes);
  assert.equal(p.split('\n')[0], PROMPT_NOTICE);
  assert.match(PROMPT_NOTICE, /社名・個人名は伏せてから貼ってください/);
});

test('buildAxisPrompt: includes filled items only, skips blanks', () => {
  const p = buildAxisPrompt(filledState(), axes);
  assert.ok(p.includes(axes[0].axis));
  assert.ok(p.includes('顧客と直接話せる仕事'));
  assert.ok(p.includes(axes[1].axis));
  assert.ok(p.includes(axes[2].axis));
  assert.ok(p.includes('専門性を活かしたい'));
  // 未入力の軸は出さない
  assert.ok(!p.includes(axes[3].axis));
  // 比較（○△×）が入っている
  assert.ok(p.includes('A社'));
  assert.ok(p.includes('B社'));
});

test('buildAxisPrompt: does not print empty field labels', () => {
  const s = emptyState();
  s.axes['1-2'] = { detail: '', priority: 'WANT' };
  const p = buildAxisPrompt(s, axes);
  assert.ok(p.includes(axes[1].axis));
  assert.ok(!/条件[:：]\s*(\n|$)/.test(p));
});

test('buildSelfPrompt: empty input -> empty string', () => {
  assert.equal(buildSelfPrompt(emptyState()), '');
  const s = emptyState();
  s.stories = [{ id: 's1', title: '', s: ' ', t: '', a: '', r: '' }];
  assert.equal(buildSelfPrompt(s), '');
});

test('buildSelfPrompt: first line notice, skips blank fields and blank stories', () => {
  const s = filledState();
  s.stories[0].t = '';
  const p = buildSelfPrompt(s);
  assert.equal(p.split('\n')[0], PROMPT_NOTICE);
  assert.ok(p.includes('残業が多かった'));
  assert.ok(p.includes('手順を見直した'));
  assert.ok(p.includes('月8時間になった'));
  assert.ok(!p.includes('月20時間減らす'));
  assert.equal((p.match(/エピソード\d/g) || []).length, 1);
});
