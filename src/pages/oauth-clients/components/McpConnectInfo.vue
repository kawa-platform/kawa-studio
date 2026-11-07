<script setup lang="ts">
import { computed, ref } from 'vue';
import { MCP_URL } from '@/api/oauth';
import type { OAuthClientConfigView } from '@/api/types';
import { matchesTemplate } from '../lib/oauthClients';
import { OAUTH_CLIENT_TEMPLATES } from '../lib/templates';

/// How to point an MCP tool at this gateway. Without `clients`, the tools identify themselves by a metadata
/// document and the setup for the common ones is listed. With `clients` (the pre-registered ones), only the tools
/// that have a client are listed, each with its own client ID.
const props = defineProps<{ clients?: readonly OAuthClientConfigView[] }>();

interface Snippet { id: string; label: string; text: string }

/// The setup of the tool behind template `tool`; `clientId` is set for a pre-registered client.
const setup = (tool: string, clientId?: string): Snippet | null => {
    switch (tool) {
        case 'claude-code':
            return { id: tool, label: 'Claude Code', text: `claude mcp add --transport http${clientId ? ` --client-id ${clientId}` : ''} kawa ${MCP_URL}` };
        case 'claude':
            return clientId
                ? { id: tool, label: 'Claude (web, desktop): custom connector', text: `URL: ${MCP_URL}\nOAuth client ID: ${clientId}` }
                : null;
        case 'vscode':
            return {
                id: tool,
                label: `VS Code, GitHub Copilot (.vscode/mcp.json)${clientId ? `; asks for client ID ${clientId} on sign-in` : ''}`,
                text: JSON.stringify({ servers: { kawa: { type: 'http', url: MCP_URL } } }, null, 2),
            };
        default:
            return null;
    }
};

const snippets = computed<Snippet[]>(() => {
    const url = { id: 'url', label: 'MCP URL', text: MCP_URL };
    const tools = OAUTH_CLIENT_TEMPLATES.flatMap((template) => {
        const client = props.clients?.find((candidate) => matchesTemplate(candidate, template));
        if (props.clients && !client) return [];
        const snippet = setup(template.id, client?.id);
        return snippet ? [snippet] : [];
    });
    return [url, ...tools];
});

const copied = ref<string | null>(null);
const copy = async (id: string, text: string): Promise<void> => {
    try {
        await navigator.clipboard.writeText(text);
        copied.value = id;
        setTimeout(() => { if (copied.value === id) copied.value = null; }, 1500);
    } catch {
        // clipboard unavailable (insecure context): the snippet stays selectable
    }
};
</script>

<template>
    <section class="connect" aria-label="Connect an MCP tool">
        <p class="connect-title"><i class="ph-duotone ph-plugs-connected" />Connect a tool</p>
        <div v-for="snippet in snippets" :key="snippet.id" class="snippet">
            <div class="snippet-head">
                <span>{{ snippet.label }}</span>
                <button
                    class="btn btn-ghost copy"
                    type="button"
                    :aria-label="`Copy ${snippet.label}`"
                    @click="copy(snippet.id, snippet.text)"
                >
                    <i :class="['ph-duotone', copied === snippet.id ? 'ph-check' : 'ph-copy']" />
                </button>
            </div>
            <pre class="mono">{{ snippet.text }}</pre>
        </div>
    </section>
</template>

<style scoped>
.connect {
    max-width: 760px; margin: 14px 0 28px; padding: 12px 14px;
    border: 1px solid var(--color-divider); border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-text) 4%, transparent);
}
.connect-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; font-weight: 600; }
.connect-title i { font-size: 17px; color: var(--color-accent-700); }
.snippet { margin-top: 10px; }
.snippet-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--muted); }
.copy { padding: 2px 6px; }
pre {
    margin: 2px 0 0; padding: 8px 10px; overflow-x: auto; font-size: 12.5px; line-height: 1.5;
    border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-divider);
}
</style>
