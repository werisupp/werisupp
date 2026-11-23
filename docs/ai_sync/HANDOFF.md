# 引き継ぎメモ（Claude Code / Codex 共通）

途中で止める作業があるときに、下のひな形で上に追記する（新しいものが上）。
引き継いだ側は、読んだら「引き継ぎ済み（日付・担当）」と書き足す。済んだメモは消してよい（履歴はgitに残る）。

## 2026-11-23 サイト全体の見た目と導線の一新（Claude 監督 → Claude 窓口）
- ブランチ: 統合用 `claude/ui-refresh`。公開用 PR は #22（`claude/ui-refresh` → `main`、ホストの確認待ち）。
- 済んだこと:
  - 全21ページの作り替え（#13〜#21 を `claude/ui-refresh` に統合済み）と Codex のレビュー。
  - ホストが PR #22 を見て「前のデザインの方がメリハリがあった」と指摘。モックアップを4回やり取りして、新しい方針が決まった。
- 進行中: 子ワークスペース `ui-foundation`（Opus 5.5 / high）が新しい方針を実装中。
  - ブランチは `claude/ui-foundation`。終わると `claude/ui-refresh` 向けに新しい PR を出す。
  - 依頼の全文と、ホストが見たモックアップは `ui-foundation-shots/host-mockup/`（このリポジトリの外、`~/orca/workspaces/werisupp/` の下）にある。
  - 設計書の「10. ホスト確認後の変更」も、その PR で書き足される。
- 次にやること:
  1. `gh pr list --base claude/ui-refresh` で `claude/ui-foundation` の新しい PR を確認する。中身が依頼どおりか見る（スクリーンショット・axe の結果・Playwright の確認）。
  2. 統合する。`node --test tests/`・`node tests/text-compare.mjs`（全21ファイル OK）・`node tests/screens.mjs`（全ページ exit 0）を、`claude/ui-refresh` の上でもう一度実行する。
  3. プレビュー https://claude-ui-refresh.werisupp.pages.dev/ をホストに見せる（トップ・step3・PC）。前のデザインとの比較を求められたら、`origin/main` を取り出して Playwright で同じ場所を撮る。
  4. ホストの OK のあと、PR #22 の本文を更新する（見た目の方針が変わったこと）。マージはホストの明示 OK のあと。
- 注意点・未決事項:
  - 本文は変えない約束。h1 と一覧の題名の食い違い、STEP⑥ の画像が仮の URL のまま（本番でも出ていない）、STEP⑦ の最後の案内文のずれは、PR #22 の本文に「ホストに判断してほしいこと」として載せてある。
  - Chrome のヘッドレスは幅500px未満にならないので、375px の確認は Playwright で行う（`npm i --no-save playwright@1.58`）。
  - ボックスの中の文字は約15px（ホストの判断。設計書の「16px以上」の例外）。
- 関連: PR #22、設計書 `docs/superpowers/specs/2026-11-23-ui-refresh-design.md`、計画 `docs/superpowers/plans/2026-11-23-ui-refresh.md`

---

## ひな形

```
## YYYY-MM-DD 〈タスク名〉（〈Claude/Codex〉→〈Claude/Codex/どちらでも〉）
- ブランチ: 
- 済んだこと: 
- 次にやること: 
- 注意点・未決事項: 
- 関連: PR / Issue / ファイル
```

---

