import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    version: '1.0.2.101',
    default_locale: 'en',
    action: {
      default_title: '__MSG_actionDefaultTitle__',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    permissions: ['storage', 'tabs', 'sidePanel', 'webNavigation', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    background: {
      type: 'module',
    },
  },
});
