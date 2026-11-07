<script setup lang="ts">
import type { LoginClientView } from '@/api/types';

/// What an MCP client gets by signing in, from the tools of the gateway's `kawa-mcp` module (`list_topics`, its
/// only tool), so keep it in step with them. An MCP token is accepted on `POST /mcp` only.
const CAPABILITIES = [
    'List the virtual topics and the physical topic each one maps to',
    'See each topic’s consume filter and value format',
    'See the broker’s physical topics, with partitions and replication factor',
];

defineProps<{ client: LoginClientView }>();
</script>

<template>
    <aside class="mcp" aria-label="MCP access request">
        <span class="badge">MCP</span>
        <h1>Authorize MCP access</h1>
        <p class="lead">
            <strong class="name">{{ client.clientName }}</strong> is asking to use kawa’s MCP tools on your behalf.
        </p>

        <p class="label">It will be able to</p>
        <ul class="can">
            <li v-for="capability in CAPABILITIES" :key="capability">
                <i class="ph-duotone ph-check-circle" />
                <span>{{ capability }}</span>
            </li>
        </ul>
        <p class="cannot">
            <i class="ph-duotone ph-prohibit" />
            <span>No access to the rest of the admin API</span>
        </p>

        <dl class="details">
            <div><dt>Returns to</dt><dd class="mono">{{ client.redirectHost }}</dd></div>
            <div><dt>Client ID</dt><dd class="mono">{{ client.clientId }}</dd></div>
        </dl>

        <p class="note">Nothing is granted until you authorize. Closing this tab cancels the request.</p>
    </aside>
</template>

<style scoped>
.mcp {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 56px clamp(32px, 6vw, 88px);
    background:
        radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 60%),
        var(--chrome);
    border-right: 1px solid var(--chrome-line);
}

.badge {
    align-self: flex-start;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    color: var(--brand-text);
    border: 1px solid color-mix(in srgb, var(--brand) 45%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--brand) 10%, transparent);
}

h1 {
    max-width: 560px;
    margin: 20px 0 0;
    font-family: var(--font-heading);
    font-size: clamp(28px, 3.2vw, 40px);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
}

.lead { max-width: 520px; margin: 14px 0 0; font-size: 16px; line-height: 1.55; color: var(--muted); }
.name { color: var(--color-text); overflow-wrap: anywhere; }

.label { margin: 32px 0 10px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }

.can { display: grid; gap: 10px; max-width: 520px; margin: 0; padding: 0; list-style: none; }
.can li, .cannot { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 1.45; }
.can i { flex: none; margin-top: 1px; font-size: 20px; color: var(--brand-text); }
.cannot { margin: 14px 0 0; color: var(--muted); }
.cannot i { flex: none; margin-top: 1px; font-size: 20px; }

.details { display: grid; gap: 2px; max-width: 520px; margin: 32px 0 0; font-size: 12px; color: var(--muted); }
.details div { display: grid; grid-template-columns: 84px 1fr; gap: 8px; }
.details dd { margin: 0; overflow-wrap: anywhere; }

.note { max-width: 520px; margin: 20px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
</style>
