import { createRouter, createWebHistory } from 'vue-router';
import { routes } from './routes';
import { defaultPaths, enableAllPages, navSections } from './nav';

export { navSections };

export const router = createRouter({
    history: createWebHistory('/admin/'),
    routes,
});

router.beforeEach((to) => {
    if (enableAllPages) return true;
    // RBAC routes stay reachable without the feature flag, including the parameterized
    // editors (their resolved path never matches the defaultPaths set above). The client
    // editor under /clients/:name/edit is likewise covered by the /clients/ prefix.
    if (to.path === '/' || to.path.startsWith('/rbac/') || to.path.startsWith('/clients/') || to.path.startsWith('/topics/') || to.path.startsWith('/governance/') || defaultPaths.has(to.path)) return true;
    return { path: '/topics' };
});