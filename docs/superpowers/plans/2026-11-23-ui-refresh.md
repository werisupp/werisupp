# サイト全体の見た目と導線の一新 — 作業計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本文を1文字も変えずに、全ページを「B すっきり・信頼」の見た目と共通の導線（STEP題名つきメニュー・位置表示・次のSTEPへ・続きから読む）にそろえる。

**Architecture:** 見た目は `style.css` を作り直し、今のクラス名のまま新しい見た目を当てる。導線は `common.js` が STEP 一覧（1か所）から組み立て、各ページに複製されているサイドバーHTMLとインラインスクリプトを消す。本文が変わっていないことは `tests/text-compare.mjs` で `origin/main` と比べて確かめる。

**Tech Stack:** 素の HTML / CSS / JavaScript（ビルドなし）。テストは Node 組み込みの `node --test`。画面確認は Playwright（リポジトリには入れず `npm i --no-save` で一時的に入れる）。

**Spec:** `docs/superpowers/specs/2026-11-23-ui-refresh-design.md`（必ず先に読む）

## Global Constraints

- 記事の本文（`header.step-header` の h1・`.step-meta` と `main` の中の文字）を追加・削除・言い換え・並べ替えしない。例外は設計書 §6-5・§8-3 で決めた導線の部分だけ。
- 新しく書いてよい文言は、ナビゲーションとボタンの短い文言だけ。HTML に直接書く場合は、その要素に `data-ui` 属性を付ける（本文比較から外れる）。
- ビルドの仕組み・npm の依存（`package.json`）をリポジトリに入れない。`node_modules/` は `.gitignore` に入れる。
- Webフォントを使わない。フォントは `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif`。
- 色は設計書 §5-1 の値（文字 `#1D2939`／補助 `#5D6B7E`／紺 `#1F5FAD`／淡色 `#EEF4FB`／線 `#E4E8EE`／面 `#F6F8FA`／良い `#1E7A4F`／注意 `#8A5A00` と `#FFF7E6`／危険 `#B42318` と `#FEF3F2`）を `:root` の変数にする。グラデーション・グラデーション文字は使わない。
- 本文の文字はスマホ16px以上・PC17px、行の高さ1.85前後、本文の最大幅は約720px。押せる部品の高さは44px以上。
- PR表記（`.site-pr-banner` と記事内の `.pr-note`）と `data-track` 属性を消さない。
- 利用者の情報は外部に送らない。続きから読む記録は `localStorage` だけに保存し、読み書きはすべて try/catch で囲む。
- 共通の見た目は `style.css`、共通の動きは `common.js`。ページごとに同じコードを複製しない。
- 公開リポジトリなので、実名・内部メモ・収益の話をファイルにもコミットにも書かない。
- ブランチは `claude/ui-refresh` から切り、PR の行き先は `claude/ui-refresh`（`main` ではない）。自分でマージしない。

## Review Focus

1. **Playwright で 375px 幅にしたときのはみ出し**: 横に長い表・画像・長い英数字の URL で、ページ全体が横スクロールしないこと（表だけが横スクロールする）。→ Task 3 の `tests/screens.mjs` が、`document.documentElement.scrollWidth <= 375` を全ページで確かめる。
2. **`localStorage` が使えない環境**（プライベートブラウズ・保存が無効）: メニュー・次のSTEP・全体マップが普通に表示されること。→ Task 2 のテスト `recordVisit は保存が例外を投げても落ちない`。
3. **`tool/` の下のページ**（パスが1段深い）: メニューのリンクが `../step3.html` のように正しく解決されること。→ Task 2 のテスト `pageInfo は tool 配下を判定し、ルートへの相対パスを返す`。
4. **JavaScript が動く前の一瞬・動かない環境**: 本文が読めること（ヘッダーが無くても本文とPR表記は出る）。→ Task 3 で JS を止めた状態のスクリーンショットを1枚撮る。
5. **準備中のSTEPへの直接アクセス**（X などの古いリンク）: 雛形の文ではなく「このSTEPは準備中です」と全体マップへの案内が出ること。→ Task 7 の確認項目。

---

## 担当の割り振り（監督: 窓口の Claude セッション）

| Task | 内容 | 子ワークスペース | エージェント／モデル／エフォート | 依存 |
| --- | --- | --- | --- | --- |
| 1 | 本文比較スクリプト | ui-text-compare | Claude Code / Sonnet 5.5 / medium | なし |
| 2 | common.js の導線 | ui-foundation | Claude Code / Opus 5.5 / high | なし |
| 3 | style.css 作り直し＋見本（index・step3）＋画面確認スクリプト | ui-foundation（2の続き） | Claude Code / Opus 5.5 / high | 1, 2 |
| — | **ホストの確認①**（プレビューで index・step3） | — | — | 3 |
| 4 | step1・2・4・5 | ui-pages-a | Claude Code / Sonnet 5.5 / medium | 確認① |
| 5 | step6・7（インライン指定が多い） | ui-pages-b | Claude Code / Sonnet 5.5 / high | 確認① |
| 6 | step8・9・about | ui-pages-c | Claude Code / Sonnet 5.5 / medium | 確認① |
| 7 | tool/ | ui-tool | Claude Code / Sonnet 5.5 / high | 確認① |
| 8 | step10〜16（準備中の扱い） | ui-pending | Claude Code / Sonnet 5.5 / medium | 4〜7、PR #11・#12 の判断 |
| 9 | 全体レビュー | ui-review | Codex（別モデルの目で）／ 窓口 | 8 |
| — | **ホストの確認②**（全ページ）→ `main` へマージ | — | — | 9 |

- 割り振りの理由: Task 2・3 はこの後の全ページの土台（クラス名・JS の作り）を決めるので、一番強いモデルに高めのエフォートで任せる。Task 4〜8 は決まった部品を当てはめる作業なので Sonnet 5.5。インライン指定が約110か所ある step6・7 と、動きを壊しやすい tool/ だけ high にする。最後のレビューは、作った側と違うモデル（Codex）に見させる。
- Task 4〜7 は並行で進める。`style.css` に部品を足すときは、ファイルの末尾にある自分の Task の区画（`/* ===== Task N で追加 ===== */`）にだけ書き、衝突を避ける。統合は窓口が行う。

---

### Task 1: 本文比較スクリプト

**Files:**
- Create: `tests/text-compare.mjs`（CLI と関数）
- Create: `tests/text-compare.test.mjs`
- Modify: `.gitignore`（無ければ作る。`node_modules/` を入れる）

**Interfaces:**
- Produces:
  - `extractArticleText(html: string): string`: `header.step-header` と `main` の中の文字を、下のルールで取り出す。どちらも無いページは `body` 全体を対象にする。
  - `compareHtml(beforeHtml: string, afterHtml: string): { ok: boolean, index?: number, before?: string, after?: string }`: 差があれば、最初に違う位置と、その前後40文字を返す。
  - CLI: `node tests/text-compare.mjs [--base <git ref>] [file ...]`。base の既定は `origin/main`、file の既定は `index.html step*.html about.html tool/*.html`。base 側は `git show <ref>:<file>` で読む。差があれば exit 1、すべて一致なら `OK: N files` を出して exit 0。
- 取り出すときのルール（before 側・after 側の両方に同じように当てる）:
  - `<!-- -->`・`<script>`・`<style>`・`<template>` は中身ごと消す。
  - `data-ui` 属性を持つ要素は中身ごと消す（同じ名前のタグが入れ子でも正しく閉じタグを数える）。
  - `id="toc-container"` の要素の中身を消す（自動生成の目次）。
  - 文字に「一覧に戻る」を含む `<a>` を消す。
  - `section.final-cta` の中の `<a>` のうち、`href` が `./index.html`・`index.html`・`./stepN.html`・`stepN.html` のものを消す（ほかのリンクは残す）。
  - 残りのタグを消し、`&nbsp; &amp; &lt; &gt; &quot; &#39;` と数値文字参照を戻し、空白と改行を1つの空白にまとめる。

- [ ] **Step 1: 失敗するテストを書く**（`tests/text-compare.test.mjs`、`node:test` と `node:assert/strict`）
  - `タグとコメントとscriptを消し空白をまとめる`: `<main><!-- x --><p>あ\n  い</p><script>z</script></main>` → `'あ い'`
  - `data-ui の要素を入れ子ごと消す`: `<main><div data-ui><div>ナビ</div></div><p>本文</p></main>` → `'本文'`
  - `一覧に戻るリンクを消す`: `<main><a href="./index.html" class="back-button">← 脱出ガイド一覧に戻る</a><p>本文</p></main>` → `'本文'`
  - `final-cta の中のSTEPリンクだけ消す`: `<main><section class="final-cta"><p>次へ</p><a href="./step4.html">STEP④ →</a><a href="https://example.com">PR リンク</a></section></main>` → `'次へ PR リンク'`
  - `見出し帯の h1 も比べる`: before `<header class="step-header"><h1>脱出STEP③<br/>登録</h1></header><main></main>` と after `<header class="step-header"><h1><span class="step-kicker">脱出STEP③</span>登録</h1></header><main></main>` は `compareHtml(...).ok === true`。
  - `1文字の違いを見つける`: `<main><p>今日中に登録</p></main>` と `<main><p>今日中に登録。</p></main>` は `ok === false`、`index === 6`。
- [ ] **Step 2: 失敗を確かめる**: `node --test tests/` → text-compare のテストが FAIL（モジュールが無い）。
- [ ] **Step 3: `tests/text-compare.mjs` を実装する**（外部ライブラリなし。タグの対応は簡単な字句解析で数える）。
- [ ] **Step 4: 通ることを確かめる**: `node --test tests/` → すべて PASS（既存の `tool-core.test.mjs` も）。
- [ ] **Step 5: 今の main に対して実行する**: `node tests/text-compare.mjs` → `OK: 21 files`（何も変えていないので全部一致）。
- [ ] **Step 6: コミットし、`claude/ui-refresh` 向けに PR を出す**: `tests/text-compare.mjs tests/text-compare.test.mjs .gitignore`

---

### Task 2: common.js の導線

**Files:**
- Modify: `common.js`（既存の PR 表記・計測・Drive 画像・目次の処理は残す）
- Create: `tests/common-nav.test.mjs`

**Interfaces:**
- Produces（Node から `createRequire(import.meta.url)('../common.js')` で読めるように、ファイル末尾で `if (typeof module !== 'undefined') module.exports = { … }`。DOM を触る処理は `if (typeof document !== 'undefined')` の中だけで動かす）:
  - `WERISUPP_STEPS: Array<{ n: number, title: string, phase: 'mind'|'prep'|'action'|'exit', duration: string, ready: boolean }>`: 16件。題名と所要時間は今の `index.html` の `.step-title`・`.step-duration` をそのまま写す（例: `{ n: 3, title: '転職サービスに登録する', phase: 'prep', duration: '～1時間', ready: true }`）。`ready` は①〜⑨が true、⑩〜⑯が false。
  - `WERISUPP_PHASES: Array<{ key, label, from, to }>`: `mind` マインドセット 1–2、`prep` 準備 3–7、`action` 活動 8–15、`exit` 終了 16。
  - `circled(n: number): string`: 1→`'①'` … 16→`'⑯'`。
  - `pageInfo(pathname: string, scriptSrcPath: string): { kind: 'map'|'step'|'about'|'tool'|'other', step: number|null, root: string }`: `root` はサイトのルートへの相対パス（ルート直下は `'./'`、`tool/` の下は `'../'`）。サイトのルートは `common.js` の置き場所（`scriptSrcPath`）から求める。`/index.html` と `/`（末尾がスラッシュ）は `map`。
  - `neighbors(n: number): { prev: Step|null, next: Step|null }`
  - `readProgress(storage): { visited: number[], last: number|null }`: キーは `'werisupp.progress.v1'`。例外・壊れたデータは `{ visited: [], last: null }`。
  - `recordVisit(storage, n: number): { visited, last }`: 保存に失敗しても例外を投げずに結果を返す。
- 組み立てる HTML（クラス名は Task 3 の CSS が使う。変えるときは Task 3 と同じ作業者なので合わせる）:
  - 既存の `.pub-header`・`.pub-sidebar`・`.pub-sidebar-overlay` がページにあれば取り除いてから組み立てる（作り替え前のページでも二重にならないように）。
  - `header.site-header` > `a.site-logo`（うぇりサポ → 全体マップ）＋ `button.site-menu-btn`（文字「メニュー」、`aria-expanded`、`aria-controls="site-drawer"`）。その直後に既存の `.site-pr-banner`。
  - `nav#site-drawer.site-drawer` > 全体マップ・無料ツール・フェーズごとの `ol`（`a.site-drawer-step` に `.n` 番号・`.t` 題名、今のページは `aria-current="page"`、開いたことがあるSTEPには `.is-visited`、`ready:false` はリンクにせず `span` で「準備中」）・運営者情報。`div.site-drawer-overlay`。Esc・背景タップで閉じ、閉じたらメニューボタンにフォーカスを戻す。幅1080px以上では常に表示（`body.has-drawer-pinned` で余白を調整）。
  - STEPのページ: `.step-header-content` の先頭に `div.step-progress`（`i` 16個、済みは `.is-done`、今は `.is-current`）と `p.step-label`「STEP 3 / 16 ・ 準備」、`.step-meta` の後に `p.step-time`「目安 ～1時間」。
  - STEPのページ: `section.final-cta` があればその末尾に、無ければ `.content-wrapper` の末尾に `nav.step-next`。中身は `a.step-next-card`（`small`「次のSTEP ④」＋題名）、次が準備中なら `div.step-next-card.is-pending`（「STEP ⑫ は準備中です」）、STEP⑯ では全体マップへのカード。その下に `p.step-next-sub`（「← STEP ② に戻る」と「全体マップ」）。
  - 全体マップ: `main .content-wrapper` の先頭に `div.map-resume`。記録が無ければ `a`「STEP ① から始める」、あれば「前回の続き：STEP ⑤ 転職活動で必要なモノ・環境を揃える」。
  - 目次: 幅768px未満では `.table-of-contents` を閉じた状態にし、見出しを `button.toc-toggle`（「この記事の内容（N項目）」、`aria-expanded`）にする。
  - 開いたSTEPのページでは `recordVisit` を呼ぶ。
  - 古い `pubToggleSidebar`・`pubCloseSidebar` を `window` に置いておく（作り替え前のページの `onclick` が残っていてもエラーにしない。Task 8 の後に消す）。

- [ ] **Step 1: 失敗するテストを書く**（`tests/common-nav.test.mjs`）
  - `STEP一覧は16件で index.html の題名と一致する`: `index.html` を読み、`.step-title` の文字列16件と `WERISUPP_STEPS.map(s => s.title)` が一致。`.step-duration` も同様。
  - `circled は1〜16を丸数字にする`: `circled(1) === '①'`、`circled(16) === '⑯'`。
  - `pageInfo はルート直下を判定する`: `pageInfo('/werisupp/step3.html', '/werisupp/common.js')` → `{ kind: 'step', step: 3, root: './' }`。`pageInfo('/', '/common.js').kind === 'map'`。`pageInfo('/about.html', '/common.js').kind === 'about'`。
  - `pageInfo は tool 配下を判定し、ルートへの相対パスを返す`: `pageInfo('/tool/axis.html', '/common.js')` → `{ kind: 'tool', step: null, root: '../' }`。
  - `neighbors の端`: `neighbors(1).prev === null`、`neighbors(16).next === null`、`neighbors(3).next.n === 4`。
  - `recordVisit は訪問を重複なく記録し last を更新する`: メモリの storage に 3, 5, 3 を記録 → `{ visited: [3, 5], last: 3 }`。
  - `recordVisit は保存が例外を投げても落ちない`: `setItem`・`getItem` が throw する storage で例外にならず、`readProgress` は `{ visited: [], last: null }`。
  - `readProgress は壊れたデータを無視する`: 値が `'{'` → `{ visited: [], last: null }`。
- [ ] **Step 2: 失敗を確かめる**: `node --test tests/` → common-nav のテストが FAIL。
- [ ] **Step 3: 上の関数とデータを `common.js` に実装する**。
- [ ] **Step 4: 通ることを確かめる**: `node --test tests/` → PASS。
- [ ] **Step 5: DOM の組み立て（上の「組み立てる HTML」）を実装する**。この時点では CSS が古いので見た目は崩れてよい。ブラウザで `step3.html` を開き、メニューの開閉・Esc・次のSTEPのリンク先が正しいことだけ確かめる。
- [ ] **Step 6: コミット**（Task 3 と同じブランチ `claude/ui-foundation` で続ける）。

---

### Task 3: style.css の作り直しと見本（index・step3）

**Files:**
- Modify: `style.css`（作り直し。今のクラス名は残す）
- Modify: `index.html`, `step3.html`
- Create: `tests/screens.mjs`

**Interfaces:**
- Consumes: Task 2 のクラス名。Task 1 の `node tests/text-compare.mjs`。
- Produces:
  - `style.css` の構成（Task 4〜8 が使う）: 1) `:root` の変数 2) 土台（body・文字・リンク）3) サイトの枠（`.site-*`）4) 記事の見出し帯と導線（`.step-*`、`.map-*`、`.toc-*`）5) 本文の部品（設計書 §5-3 の既存クラス）6) 足した部品（インライン指定の置き換え用。名前は `.u-` ではなく意味の名前にする）7) 末尾に Task 4〜8 用の空の区画 `/* ===== Task N で追加 ===== */`（N = 4, 5, 6, 7, 8）。
  - `tests/screens.mjs`: `node tests/screens.mjs [file ...] [--out <dir>]`。各ページを Playwright で 375×812 と 1280×900 の幅で開いて、ページ全体のスクリーンショットを撮る。375px で `document.documentElement.scrollWidth > 375` のページがあれば、名前を出して exit 1。`--nojs` を付けると JavaScript を止めて撮る。Playwright は `npm i --no-save playwright@1.58` で入れる（ファイルの先頭のコメントに書く）。
- 作り替えのしかた（Task 4〜8 も同じ手順を使う。PR の説明にこの手順を書いておく）:
  1. 各ページの静的なサイドバー・ヘッダーの HTML（`.pub-header`・`.pub-sidebar-overlay`・`.pub-sidebar`）と、末尾の `pubToggleSidebar` のスクリプトを消す。
  2. 「一覧に戻る」のリンクと、`final-cta` の中の STEP・一覧へのリンクを消す（設計書 §6-5）。
  3. h1 の「脱出STEP③」の部分を `<span class="step-kicker">…</span>` で包む（文字は変えない）。
  4. `style="…"` を部品のクラスに置き換える。
  5. `node tests/text-compare.mjs <変えたファイル>` → OK、`node tests/screens.mjs <変えたファイル>` → exit 0。

- [ ] **Step 1: `tests/screens.mjs` を書き、今のページで動くことを確かめる**: `node tests/screens.mjs index.html step3.html --out /tmp/ui-shots/before` → 4枚の画像、exit 0。
- [ ] **Step 2: `style.css` を作り直す**（上の構成。設計書 §5 の値。`prefers-reduced-motion` ではアニメーションを止める。キーボードで動かしたときのフォーカスの枠を見えるようにする）。
- [ ] **Step 3: `step3.html` を、上の手順1〜4で作り替える**（インライン指定36か所）。
- [ ] **Step 4: `index.html` を、上の手順で作り替える**。16 STEP の一覧（`phase-card`・`step-item`）は、フェーズごとの縦の流れに見せる（設計書 §7）。
- [ ] **Step 5: 確かめる**:
  - `node tests/text-compare.mjs index.html step3.html` → `OK: 2 files`
  - `node --test tests/` → PASS
  - `node tests/screens.mjs index.html step3.html --out /tmp/ui-shots/after` → exit 0
  - `node tests/screens.mjs step3.html --nojs --out /tmp/ui-shots/nojs` → 本文と PR 表記が読める
  - 作り替えていないページ（例: `step7.html`）も開き、新しいヘッダーが二重にならず、本文が読める状態であること
- [ ] **Step 6: コミットしてプッシュし、`claude/ui-refresh` 向けに PR を出す**。PR の説明に after の画像（375・1280）と、作り替えの手順を貼る。

---

### Task 4〜6: 記事ページの作り替え

| Task | ファイル | 注意 |
| --- | --- | --- |
| 4 | `step1.html` `step2.html` `step4.html` `step5.html` | step4 にある `<style>` ブロックの中身は `style.css` の Task 4 の区画へ移す |
| 5 | `step6.html` `step7.html` | インライン指定が17・92か所。似たものはまとめて1つの部品にする |
| 6 | `step8.html` `step9.html` `about.html` | step8 の h1 は「STEP⑧」（「脱出」なし）。文字は変えず、そのまま `step-kicker` で包む |

**Interfaces:**
- Consumes: Task 3 の「作り替えのしかた」と `style.css` の部品。部品が足りなければ、`style.css` の自分の Task の区画にだけ足す。

- [ ] **Step 1: 担当ファイルを手順1〜4で作り替える**。
- [ ] **Step 2: 確かめる**: `node tests/text-compare.mjs <担当ファイル>` → OK。`node tests/screens.mjs <担当ファイル> --out /tmp/ui-shots/taskN` → exit 0。`node --test tests/` → PASS。
- [ ] **Step 3: 画像を見て、ボックス・表・画像・アフィリエイトの PR 表記が崩れていないか確かめる**。
- [ ] **Step 4: コミットしてプッシュし、`claude/ui-refresh` 向けに PR を出す**（画像を貼る）。

---

### Task 7: 無料ツール（tool/）

**Files:**
- Modify: `tool/index.html` `tool/axis.html` `tool/self.html` `tool/tool.css` `tool/tool-ui.js`

- [ ] **Step 1: 3ページの静的なサイドバー・ヘッダーの HTML を消し、`tool-ui.js` のサイドバー開閉の処理（`#pubSidebar` などを触る部分）を消す**。
- [ ] **Step 2: `tool/tool.css` の色・文字を `style.css` の変数に合わせる**（ツールの画面の構成と動きは変えない）。
- [ ] **Step 3: 確かめる**: `node --test tests/` → PASS。`node tests/text-compare.mjs tool/index.html tool/axis.html tool/self.html` → OK。`node tests/screens.mjs tool/index.html tool/axis.html tool/self.html` → exit 0。
- [ ] **Step 4: 手で確かめる**（Playwright のスクリプトか、ブラウザで）: 3画面それぞれで、メニューの開閉、入力したものが再読み込み後も残ること、JSON の書き出しと読み込み、プロンプトのコピー、印刷プレビュー。PR に結果を書く。
- [ ] **Step 5: コミットしてプッシュし、`claude/ui-refresh` 向けに PR を出す**。

---

### Task 8: step10〜16 と準備中の扱い

この Task を始める前に、窓口が PR #11・#12 のマージ状況を確かめ、`claude/ui-refresh` に `main` を取り込んでおく。

**Files:**
- Modify: `step10.html` 〜 `step16.html`、`common.js`（`ready` の値と、古い `pubToggleSidebar` の置き場の削除）、`tests/text-compare.mjs`（必要なら）

- [ ] **Step 1: 本文があるページ（#11・#12 がマージ済みなら step10・11）を、手順1〜4で作り替え、`WERISUPP_STEPS` の `ready` を true にする**。
- [ ] **Step 2: 雛形のままのページは、`main` の中を `<section class="step-pending" data-ui>`（「このSTEPは準備中です」と全体マップへのリンク）に置き換える**。h1 と `.step-meta` は今の文字のまま残す。
- [ ] **Step 3: すべてのページから `onclick="pubToggleSidebar()"` が消えたことを確かめ（`grep -rn pubToggle --include=*.html .` → 何も出ない）、`common.js` の古い関数を消す**。
- [ ] **Step 4: 確かめる**: `node tests/text-compare.mjs` → 全ファイル OK（雛形のページは `data-ui` のため一致）。`node tests/screens.mjs` → 全ページ exit 0。`node --test tests/` → PASS。
- [ ] **Step 5: コミットしてプッシュし、`claude/ui-refresh` 向けに PR を出す**。

---

### Task 9: 全体レビューと公開の準備（窓口＋Codex）

- [ ] **Step 1: Codex に `claude/ui-refresh` と `origin/main` の差分をレビューさせる**（観点: 本文の取りこぼし、PR表記、アクセシビリティ、スマホ幅、`localStorage`、`tool/` の動き）。
- [ ] **Step 2: 窓口がすべての確認（本文比較・画面・テスト）を `claude/ui-refresh` の上でもう一度実行する**。
- [ ] **Step 3: `claude/ui-refresh` → `main` の PR を作る**。説明に入れるもの: 全ページの before/after 画像（375px）、h1 と一覧の題名の食い違いの一覧、`final-cta` の文章と次のSTEPが合っていないものの一覧（設計書 §6-1・§6-5）。
- [ ] **Step 4: ホストの確認②を待つ**（マージはホストの OK のあと）。
