import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { isNavigationFailure, NavigationFailureType } from 'vue-router';
import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import { apiKey } from './api/api';
import { ApiError } from './api/error';
import { fetchApi } from './api/fetchApi';
import '@kawa/design/index.css';

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

const app = createApp(App)
    .use(createPinia())
    .use(router)
    .use(VueQueryPlugin, queryOptions)
    .provide(apiKey, fetchApi);

/// Mount once the first route has resolved. Before that the route carries no `meta`, so the shell
/// would render on the login and callback pages, its API calls would 401, and the login would restart.
/// When the router guard cancels the first navigation to start a login, the app is not mounted at all:
/// the browser is already on its way to the login page.
router.isReady().then(() => app.mount('#app'), (error: unknown) => {
    if (!isNavigationFailure(error, NavigationFailureType.aborted)) console.error(error);
});
