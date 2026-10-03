import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import { apiKey } from './api/api';
import { fetchApi } from './api/fetchApi';
import './assets/broadsheet.css';
import './assets/theme.css';

/// There is one API adapter: a fetch client against the gateway. In dev it calls the
/// backend directly; in production nginx forwards the same paths to the gateway.
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
    .provide(apiKey, fetchApi)
    .mount('#app');
