import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import { apiKey } from './api';
import { httpApi } from './api/http';
import './assets/broadsheet.css';
import './assets/theme.css';

/// There is one API adapter: a fetch client against /api. In dev the Vite proxy forwards
/// it to the gateway; in production nginx does the same.
const queryOptions: VueQueryPluginOptions = {
    queryClientConfig: {
        defaultOptions: {
            queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
    },
};

createApp(App)
    .use(createPinia())
    .use(router)
    .use(VueQueryPlugin, queryOptions)
    .provide(apiKey, httpApi)
    .mount('#app');
