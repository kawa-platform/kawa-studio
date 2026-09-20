/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<{}, {}, unknown>;
    export default component;
}

interface ImportMetaEnv {
    /// 'on' enables all non-Topics pages; omitted keeps them behind the Soon gate.
    readonly VITE_ENABLE_ALL_PAGES?: 'on';
    readonly VITE_API_BASE?: string;
    readonly VITE_ADMIN_API_BASE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
