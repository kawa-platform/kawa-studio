import type { OAuthClientAudience } from '@/api/types';

/// A preset that only prefills the create form; nothing is sent until the admin saves.
export interface OAuthClientTemplate {
    id: string;
    name: string;
    redirectUris: readonly string[];
    audience: OAuthClientAudience;
}

/// Well-known MCP clients, with the callback URIs their vendors document.
export const OAUTH_CLIENT_TEMPLATES: readonly OAuthClientTemplate[] = [
    {
        id: 'claude-code',
        name: 'Claude Code',
        // Native client on a random loopback port.
        redirectUris: ['http://localhost:*/callback'],
        audience: 'mcp',
    },
    {
        id: 'claude',
        name: 'Claude',
        // Web, desktop and mobile. Anthropic documents claude.com as a possible move, so both are registered.
        redirectUris: ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'],
        audience: 'mcp',
    },
    {
        id: 'vscode',
        name: 'VS Code',
        redirectUris: ['http://127.0.0.1:33418', 'https://vscode.dev/redirect'],
        audience: 'mcp',
    },
];
