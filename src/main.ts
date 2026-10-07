import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import { apiKey } from './api/api';
import { ApiError } from './api/error';
import { fetchApi } from './api/fetchApi';
import './assets/broadsheet.css';
import './assets/theme.css';

/// There is one API adapter: a fetch client against the gateway. In dev it calls the
/// backend directly; in production nginx forwards the same paths to the gateway.
const queryOptions: VueQueryPluginOptions = {
    queryClientConfig: {
        defaultOptions: {
            // A 401 has already been retried after a token refresh in fetchApi; retrying it again
            // would only delay the login page.
            queries: {
                staleTime: 15_000,
                retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.code === '401'),
                refetchOnWindowFocus: false,
            },
        },
    },
};

createApp(App)
    .use(createPinia())
    .use(router)
    .use(VueQueryPlugin, queryOptions)
    .provide(apiKey, fetchApi)
    .mount('#app');
