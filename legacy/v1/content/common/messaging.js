// メッセージングヘルパーをコンテンツスクリプト専用パスから参照できるようにする再エクスポート。
// 実装自体は common/messaging.js に集約し、依存関係の循環を避けつつ import 経路を揃える。
export * from '../../common/messaging.js';

