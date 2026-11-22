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
