import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/topics' },
    { path: '/topics', name: 'topics', component: () => import('../pages/topics/TopicsPage.vue'), meta: { crumb: 'Topics' } },
    { path: '/topics/new', name: 'topic-new', component: () => import('../pages/topics/NewTopicPage.vue'), meta: { crumb: 'New topic' } },
    { path: '/topics/:name/edit', name: 'topic-edit', component: () => import('../pages/topics/NewTopicPage.vue'), meta: { crumb: 'Edit topic' } },
    { path: '/clusters', name: 'clusters', component: () => import('../pages/clusters/ClustersPage.vue'), meta: { crumb: 'Clusters' } },
    /// Backwards compatibility: creating topics now lives under /topics/new.
    { path: '/virtualization/new', redirect: '/clusters/new' },
    { path: '/publish', name: 'publish', component: () => import('../pages/publish/PublishPage.vue'), meta: { crumb: 'Publish' } },
    { path: '/clients', name: 'clients', component: () => import('../pages/clients/ClientsPage.vue'), meta: { crumb: 'Clients' } },
    { path: '/clients/new', name: 'client-new', component: () => import('../pages/clients/NewClientPage.vue'), meta: { crumb: 'New client' } },
    { path: '/clients/:name', name: 'client-details', component: () => import('../pages/clients/ClientDetailsPage.vue'), meta: { crumb: 'Client details' } },
    { path: '/clients/:name/edit', name: 'client-edit', component: () => import('../pages/clients/ClientEditorPage.vue'), meta: { crumb: 'Edit client' } },
    { path: '/clients/access', name: 'clients-access', component: () => import('../pages/clients/EffectiveAccessPage.vue'), meta: { crumb: 'Effective access' } },
    /// Backwards compatibility: the clients section moved from /users to /clients.
    { path: '/users', redirect: '/clients' },
    { path: '/users/new', redirect: '/clients/new' },
    { path: '/users/access', redirect: '/clients/access' },
    { path: '/users/:name/edit', redirect: (to) => `/clients/${to.params.name as string}/edit` },
    { path: '/acls', name: 'acls', component: () => import('../pages/acls/AclsPage.vue'), meta: { crumb: 'ACLs' } },
    { path: '/rbac/roles', name: 'rbac-roles', component: () => import('../pages/rbac/roles/RolesPage.vue'), meta: { crumb: 'Roles' } },
    { path: '/rbac/roles/new', name: 'rbac-role-new', component: () => import('../pages/rbac/roles/RoleEditorPage.vue'), meta: { crumb: 'New role' } },
    { path: '/rbac/roles/:name', name: 'rbac-role-details', component: () => import('../pages/rbac/roles/RoleDetailsPage.vue'), meta: { crumb: 'Role details' } },
    { path: '/rbac/roles/:name/edit', name: 'rbac-role-edit', component: () => import('../pages/rbac/roles/RoleEditorPage.vue'), meta: { crumb: 'Edit role' } },
    { path: '/rbac/groups', name: 'rbac-groups', component: () => import('../pages/rbac/groups/GroupsPage.vue'), meta: { crumb: 'Groups' } },
    { path: '/rbac/groups/new', name: 'rbac-group-new', component: () => import('../pages/rbac/groups/GroupEditorPage.vue'), meta: { crumb: 'New group' } },
    { path: '/rbac/groups/:name/', name: 'rbac-group-details', component: () => import('../pages/rbac/groups/GroupDetailsPage.vue'), meta: { crumb: 'Group details' } },
    { path: '/rbac/groups/:name/edit', name: 'rbac-group-edit', component: () => import('../pages/rbac/groups/GroupEditorPage.vue'), meta: { crumb: 'Edit group' } },
    { path: '/rbac/permissions', redirect: '/clients/access' },
];