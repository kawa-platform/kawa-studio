# kawa-ui

Admin UI for the kawa Kafka access gateway. Vue 3 SPA served under `/admin/`.

## Commands

- `npm run dev` — Vite dev server (port 5173; proxies `/api` → `http://localhost:8080`)
- `npm run build` — `vue-tsc -b` typecheck + `vite build` → `dist/`
- `npm run preview` — serve the built `dist/`
- `npm test` — Vitest (jsdom), colocated `*.spec.ts`
- `npm run typecheck` — `vue-tsc --noEmit`

## Stack

Vue 3.5 (`<script setup lang="ts">`), Vite 7, TypeScript 5.9 (strict, `verbatimModuleSyntax`), Pinia, vue-router, TanStack Vue Query, reka-ui, CodeMirror 6, Vitest + @vue/test-utils.

## Layout

```
src/
  api/          Backend contract: index.ts (KawaApi interface + useApi()), http.ts (fetch impl), types.ts (DTOs)
  assets/       Global CSS (broadsheet.css, theme.css)
  components/   Shared app components (AppSidebar, DataTable, ConfirmDialog, …)
  lib/          Pure helpers shared across ≥2 features
  pages/        Feature modules — one directory per feature:
    <feature>/
      XxxPage.vue        Route components (one per route)
      components/        Feature-local components
      lib/               Feature-local pure logic
      queries.ts         TanStack query/mutation hooks for this feature
      *.spec.ts          Colocated tests
  queries/      keys.ts — the single query-key factory
  router/       routes.ts (route table), nav.ts (nav sections + feature flag), index.ts (router + guard)
  stores/       Pinia stores (ui.ts)
```

## Conventions

- **Feature modules**: every feature follows the shape above. Feature-local composables live in the feature dir (e.g. `pages/topics/useTopicView.ts`); `src/composables/` was removed and must not be re-created.
- **API**: extend `KawaApi` in `src/api/index.ts` and the impl in `src/api/http.ts`. Components never call `fetch` directly — use `useApi()`.
- **Data fetching**: `useQuery`/`useMutation` from TanStack Vue Query, always keyed from `src/queries/keys.ts`; invalidate after writes.
- **Types**: DTOs live in `src/api/types.ts`; use `import type` (verbatimModuleSyntax).
- **Tests**: colocated `*.spec.ts`, Vitest + @vue/test-utils; mock `@/api` and `@tanstack/vue-query`.
- **Style**: 4-space indent, `///` doc comments, `@/` alias imports.
- **Feature flag**: `VITE_ENABLE_ALL_PAGES === 'on'` gates non-default routes (see `src/router/nav.ts`).

## Gotchas

- Base path is `/admin/` (Vite `base` + router history + nginx).
- Dev: Vite proxies `/api` → `:8080`; the admin server (RBAC, auth clients, virtual topics) is called directly via CORS (`VITE_ADMIN_API_BASE`, default `http://localhost:8080`).
- Docker: `npm run build` (typecheck included) → nginx serves `dist/` under `/admin/`.