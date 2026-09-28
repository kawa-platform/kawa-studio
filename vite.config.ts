import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    // kawa serves the built assets from its own classpath, under /admin.
    base: '/admin/',
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['vue', 'vue-router', 'pinia', 'reka-ui'],
                    query: ['@tanstack/vue-query', '@tanstack/vue-table'],
                    editor: ['@codemirror/view', '@codemirror/state', '@codemirror/language', '@codemirror/autocomplete'],
                },
            },
        },
    },
    server: {
        port: 5173,
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.spec.ts'],
    },
});
