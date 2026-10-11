import { createRouter, createWebHistory } from 'vue-router';
import { routes } from './routes';
import { navSections } from './nav';

export { navSections };

export const router = createRouter({
    history: createWebHistory('/admin/'),
    routes,
});