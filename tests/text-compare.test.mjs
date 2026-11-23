import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleText, compareHtml } from './text-compare.mjs';

test('タグとコメントとscriptを消し空白をまとめる', () => {
  assert.equal(
    extractArticleText('<main><!-- x --><p>あ\n  い</p><script>z</script></main>'),
    'あ い'
  );
});

test('data-ui の要素を入れ子ごと消す', () => {
  assert.equal(
    extractArticleText('<main><div data-ui><div>ナビ</div></div><p>本文</p></main>'),
    '本文'
  );
});

test('一覧に戻るリンクを消す', () => {
  assert.equal(
    extractArticleText('<main><a href="./index.html" class="back-button">← 脱出ガイド一覧に戻る</a><p>本文</p></main>'),
    '本文'
  );
});

test('final-cta の中のSTEPリンクだけ消す', () => {
  assert.equal(
    extractArticleText('<main><section class="final-cta"><p>次へ</p><a href="./step4.html">STEP④ →</a><a href="https://example.com">PR リンク</a></section></main>'),
    '次へ PR リンク'
  );
});

test('見出し帯の h1 も比べる', () => {
  const before = '<header class="step-header"><h1>脱出STEP③<br/>登録</h1></header><main></main>';
  const after = '<header class="step-header"><h1><span class="step-kicker">脱出STEP③</span>登録</h1></header><main></main>';
  assert.equal(compareHtml(before, after).ok, true);
});

test('1文字の違いを見つける', () => {
  const r = compareHtml('<main><p>今日中に登録</p></main>', '<main><p>今日中に登録。</p></main>');
  assert.equal(r.ok, false);
  assert.equal(r.index, 6);
});

test('雛形の main は準備中の案内（data-ui）に置き換えても一致する', () => {
  const before = '<header class="step-header"><h1>脱出STEP⑫<br/>面接</h1></header><main><p>（ここに本文を追加してください）</p></main>';
  const after = '<header class="step-header"><h1><span class="step-kicker">脱出STEP⑫</span>面接</h1></header><main><section class="step-pending" data-ui><h2>このSTEPは準備中です</h2></section></main>';
  assert.equal(compareHtml(before, after).ok, true);
});

test('本文のある main の1文字の違いは雛形扱いにならない', () => {
  const r = compareHtml('<main><p>本文です</p></main>', '<main><p>本文です。</p></main>');
  assert.equal(r.ok, false);
});

test('after 側に雛形の文を足しても、本文の削除を見逃さない', () => {
  const before = '<header class="step-header"><h1>脱出STEP⑩</h1></header><main><p>提出書類の本文です</p></main>';
  const after = '<header class="step-header"><h1>脱出STEP⑩</h1></header><main><p>（ここに本文を追加してください）</p></main>';
  assert.equal(compareHtml(before, after).ok, false);
});

test('雛形の文を含むかどうかは before 側の main だけで決める', () => {
  // after 側に雛形入りの main を足しても、外さずに比べる（足した文は差になる）
  const before = '<main><p>本文</p></main>';
  const after = '<main><p>本文</p></main><main><p>（ここに本文を追加してください）</p></main>';
  assert.equal(compareHtml(before, after).ok, false);
  // before の main が空でも、after に足した雛形の文は差になる
  assert.equal(compareHtml('<main></main>', '<main><p>（ここに本文を追加してください）</p></main>').ok, false);
});

test('before 側が雛形なら、after 側の main は中身を問わず外す', () => {
  const before = '<main><p>（ここに本文を追加してください）</p></main>';
  assert.equal(compareHtml(before, '<main><p>準備中です</p></main>').ok, true);
  assert.equal(compareHtml(before, '<main><p>（ここに本文を追加してください）</p></main>').ok, true);
});

test('final-cta の中の .html を省いた STEP リンクも導線として消す', () => {
  const before = '<main><section class="final-cta"><p>次へ</p><a href="./step7" class="step-link">STEP⑦ →</a></section></main>';
  const after = '<main><section class="final-cta"><p>次へ</p></section></main>';
  assert.equal(compareHtml(before, after).ok, true);
  // 外部のリンクは今までどおり本文として比べる
  assert.equal(compareHtml('<main><section class="final-cta"><a href="https://example.com/step7">PR</a></section></main>', '<main><section class="final-cta"></section></main>').ok, false);
});
