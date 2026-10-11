import 'vue-router';

/// The `meta` every route in `routes.ts` may carry.
declare module 'vue-router' {
    interface RouteMeta {
        /// The topbar breadcrumb label.
        crumb?: string;
        /// Reachable without signing in.
        public?: boolean;
        /// Rendered without the app shell (sidebar and topbar).
        bare?: boolean;
        /// The gateway module the page belongs to: while it is disabled the page shows a banner.
        module?: string;
    }
}
