import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { OAuthClientConfigView } from '@/api/types';
import McpConnectInfo from './McpConnectInfo.vue';

vi.mock('@/api/oauth', () => ({ MCP_URL: 'http://gw:8080/mcp' }));

const client = (id: string, redirectUris: string[]): OAuthClientConfigView =>
    ({ id, name: null, enabled: true, redirectUris, audience: 'mcp' });

describe('McpConnectInfo', () => {
    it('shows the raw URL and the setup for Claude Code and VS Code without registered clients', () => {
        // when
        const text = mount(McpConnectInfo).text();

        // then
        expect(text).toContain('claude mcp add --transport http kawa http://gw:8080/mcp');
        expect(text).toContain('"url": "http://gw:8080/mcp"');
        expect(text).not.toContain('--client-id');
    });

    it('lists only the tools that have a registered client, with its client ID', () => {
        // when
        const text = mount(McpConnectInfo, {
            props: { clients: [client('my-claude', ['http://localhost:*/callback'])] },
        }).text();

        // then
        expect(text).toContain('claude mcp add --transport http --client-id my-claude kawa http://gw:8080/mcp');
        expect(text).toContain('MCP URL');
        expect(text).not.toContain('VS Code');
        expect(text).not.toContain('custom connector');
    });

    it('lists Claude and VS Code when they are registered', () => {
        // when
        const text = mount(McpConnectInfo, {
            props: {
                clients: [
                    client('claude', ['https://claude.ai/api/mcp/auth_callback']),
                    client('vscode', ['http://127.0.0.1:33418']),
                ],
            },
        }).text();

        // then
        expect(text).toContain('OAuth client ID: claude');
        expect(text).toContain('asks for client ID vscode');
        expect(text).not.toContain('Claude Code');
    });

    it('lists no tool for a client that matches none', () => {
        // when
        const text = mount(McpConnectInfo, { props: { clients: [client('other', ['https://x.example.com/cb'])] } }).text();

        // then
        expect(text).toContain('MCP URL');
        expect(text).not.toContain('claude mcp add');
        expect(text).not.toContain('VS Code');
    });

    it('copies a snippet', async () => {
        // given
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        const wrapper = mount(McpConnectInfo);

        // when
        await wrapper.get('[aria-label="Copy Claude Code"]').trigger('click');

        // then
        expect(writeText).toHaveBeenCalledWith('claude mcp add --transport http kawa http://gw:8080/mcp');
    });
});
