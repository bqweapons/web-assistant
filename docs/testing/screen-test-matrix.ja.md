# 画面テストマトリクス（docs テストページ）

## 目的 / 範囲

このドキュメントは `docs/test-pages/**` を対象にした手動テスト用の画面マトリクスを定義します。  
静的ページを使った拡張機能の動作確認に焦点を当てます。

## テスト環境

- ブラウザ: Chrome（最新安定版推奨）
- 拡張機能: Ladybird メインラインビルド（リポジトリ root）
- テスト前確認:
  - サイドパネルが開ける
  - 現在ページのドメインが拡張機能権限で許可されている

## 画面マトリクス概要

| グループ | ページパス | 目的 | カバー機能 | 優先度 |
|---|---|---|---|---|
| Basic Playground | `docs/test-pages/basic/test-page.html` | 基本操作ページ | elements, hidden, popup, input, navigate | P0 |
| Basic Playground | `docs/test-pages/basic/test-page2.html` | 戻り先ページ | navigation, site/page scope 挙動 | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-a.html` | フォーム入力ページ | text/email/date/number 入力、送信 | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-b.html` | 結果表示ページ | 結果確認、戻りリンク | P0 |

## 詳細カバレッジ

### Basic Playground（`test-page.html`, `test-page2.html`）
- button/link/tooltip/area 要素の作成・編集
- hidden ルール作成とページ要素非表示の確認
- 単純なフロー実行（`click`, `input`, `popup`, `navigate`）
- 2ページ間の遷移後の保存済み要素の再表示確認

### Data Source Flow（`datasource-form-a.html`, `datasource-form-b.html`）
- 複数フィールド型（`text`, `email`, `date`, `number`）のフロー入力
- 送信後に Screen B で結果表示を確認
- Screen B から Screen A への戻り遷移確認
- CSV（`docs/assets/data/datasource-form-data.csv`）を手動入力用サンプルとして利用

## リリース前スモーク（最小セット）

1. Basic ページでボタン作成 + popup フロー実行
2. Basic ページで hidden ルール作成と反映確認
3. Data Source A -> B のフォーム送信成功
4. 任意ページで Vault 利用フローの解錠/再試行成功

## 既知の不足 / 今後追加したいテストページ（P2）

現在の `docs` テストページでは以下を十分にカバーしていません:
- iframe / multi-frame ターゲティング
- 高頻度に DOM が変化するページ
- 厳しい CSP の模擬ページ
- 複雑な業務フォーム（以前の Kintai mock は削除）

今後の追加候補として別ページを検討してください。
