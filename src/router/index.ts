import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { routes } from './routes';
import { navSections } from './nav';

export { navSections };

export const router = createRouter({
    history: createWebHistory('/admin/'),
    routes,
});

/// A protected page opens only with a usable session, or on a gateway that needs no login. Otherwise
/// the login starts here and the navigation is cancelled, so the page never renders and fails.
router.beforeEach(async (to) => {
    if (to.meta.public) return true;
    const auth = useAuthStore();
    if (!(await auth.needsLogin())) return true;
    await auth.beginLogin(to.fullPath);
    return false;
});