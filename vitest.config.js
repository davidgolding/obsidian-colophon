import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@tiptap/pm/state': path.resolve(__dirname, 'node_modules/.pnpm/prosemirror-state@1.4.4/node_modules/prosemirror-state'),
      '@tiptap/pm/view': path.resolve(__dirname, 'node_modules/.pnpm/prosemirror-view@1.41.5/node_modules/prosemirror-view'),
      '@tiptap/core': path.resolve(__dirname, 'node_modules/.pnpm/@tiptap+core@3.17.1_@tiptap+pm@3.17.1/node_modules/@tiptap/core'),
    },
  },
});
