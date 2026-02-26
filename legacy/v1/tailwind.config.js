import forms from '@tailwindcss/forms';
// サイドパネルのスタイルをビルドするための Tailwind 設定ファイル。
// tree-shaking の対象パスやブランドカラーをここで宣言し、開発時とビルド時の設定を共通化する。
export default {
  content: [
    './sidepanel/src/**/*.{js,jsx}',
    './common/**/*.js',
  ],
  theme: {
    extend: {
      boxShadow: {
        brand: '0 12px 24px rgba(15, 23, 42, 0.08)',
      },
      colors: {
        brand: {
          start: '#6366f1',
          end: '#3b82f6',
        },
      },
    },
  },
  plugins: [forms],
};
