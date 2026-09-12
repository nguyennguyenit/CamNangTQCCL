import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { expect, it } from 'vitest';
import { seasonConsumerFixture, context } from '../../../tests-js/fixtures/season-fixtures.mjs';
import { FilesystemDataSource } from '../../src/data/filesystem-data-source.js';
import { createWorker, type WorkerEnvironment } from '../../src/worker.js';
import { createResearchHandlers } from '../../src/research/research-handlers.js';
import { RESEARCH_TOOL_NAMES } from '../../src/research/research-contracts.js';
import { runCli } from '../../src/cli.js';
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
it('seasonal eight-tool results and actionable errors survive SDK discovery, stdio, HTTP and CLI', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tqccl-season-wire-'));
    const clients: Client[] = [];
    try {
        const data = { ...await seasonConsumerFixture(), 'team-tier': [] };
        for (const [name, value] of Object.entries(data))
            await writeFile(join(root, `${name}.json`), JSON.stringify(value));
        const source = new FilesystemDataSource({ dataRoot: root });
        const h = createResearchHandlers({ dataSource: source });
        const stdio = new Client({ name: 'season-stdio', version: '1' });
        clients.push(stdio);
        await stdio.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/stdio.ts'], cwd: packageRoot, env: { ...getDefaultEnvironment(), TQCCL_DATA_ROOT: root }, stderr: 'pipe' }));
        const token = 'A'.repeat(43);
        const environment: WorkerEnvironment = { CF_VERSION_METADATA: { id: '11111111-2222-4333-8444-555555555555' }, TQCCL_MCP_BEARER_CURRENT: token, TQCCL_MCP_ALLOWED_ORIGINS: '', TQCCL_MCP_MAX_BODY_BYTES: '65536', TQCCL_MCP_MAX_RESULT_BYTES: '98304', TQCCL_MCP_RATE_MAX: '100', TQCCL_MCP_RATE_WINDOW_MS: '60000', TQCCL_MCP_MAX_IN_FLIGHT: '4' };
        const worker = createWorker({ createDataSource: () => source });
        const http = new Client({ name: 'season-http', version: '1' });
        clients.push(http);
        await http.connect(new StreamableHTTPClientTransport(new URL('https://mcp.example/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch: (input, init) => worker.fetch(new Request(input, init), environment) }) as unknown as Transport);
        for (const client of clients) {
            const list = await client.listTools();
            expect(list.tools).toHaveLength(8);
            expect(list.tools.every(tool => tool.outputSchema?.type === 'object')).toBe(true);
        }
        const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
        const confirmed = { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding };
        const requests = { tqccl_get_data_version: {}, tqccl_normalize_entities: { observations: [], seasonContext: context }, tqccl_search: { query: '', seasonContext: context }, tqccl_get_team: { teamId: 'team-a', configId: 'config-a', seasonContext: context, expectedWorkflowVersion: n.workflowVersion }, tqccl_match_team: { heroes: [{ canonicalId: 'hero:anh', tacticIds: ['tactic:mot'] }], minHeroes: 1, seasonContext: context, expectedWorkflowVersion: n.workflowVersion }, tqccl_recommend_team: confirmed, tqccl_recommend_coexist: confirmed, tqccl_suggest_replacements: { ...confirmed, teamId: 'team-a', configId: 'config-a', holderId: 'hero:anh', slotIndex: 0, tacticName: 'Một' } };
        for (const name of RESEARCH_TOOL_NAMES) {
            const expected = await h.call(name, requests[name] as never);
            for (const client of clients) {
                const result = await client.callTool({ name, arguments: requests[name] });
                expect(result.isError).not.toBe(true);
                expect(result.structuredContent).toEqual(expected);
            }
        }
        const ambiguity = { teamId: 'team-a', seasonContext: context, expectedWorkflowVersion: n.workflowVersion };
        for (const client of clients) {
            const result = await client.callTool({ name: 'tqccl_get_team', arguments: ambiguity });
            expect(result.isError).toBe(true);
            expect((result.structuredContent as Record<string, unknown>)?.error).toMatchObject({ code: 'CONFIG_AMBIGUOUS', choices: { configIds: ['config-a', 'config-b'], totalCount: 2, omittedCount: 0 } });
            const invalid = await client.callTool({ name: 'tqccl_search', arguments: { query: '', seasonContext: { scenarioId: 'scenario-a' } } });
            expect((invalid.structuredContent as Record<string, unknown>)?.error).toMatchObject({ code: 'INVALID_REQUEST', fields: ['seasonContext.rulesetId'] });
        }
        let stdout = '';
        const exit = await runCli(['tqccl_get_team', '--data-root', root, '--input', JSON.stringify(ambiguity)], { stdout: { write(value: string) { stdout += value; return true; } }, stderr: { write() { return true; } } });
        expect(exit).toBe(1);
        expect(JSON.parse(stdout).error.choices.configIds).toEqual(['config-a', 'config-b']);
    }
    finally {
        await Promise.all(clients.map(client => client.close()));
        await rm(root, { recursive: true, force: true });
    }
}, 15000);
it('candidate-limit metadata remains identical through stdio HTTP and CLI', async () => {
    const { refreshConfigProofs } = await import('../../../tests-js/fixtures/season-fixtures.mjs');
    const root = await mkdtemp(join(tmpdir(), 'tqccl-season-limit-wire-'));
    const clients: Client[] = [];
    try {
        const data = await seasonConsumerFixture();
        const config = data['season-team-configs'][0]!;
        const evaluation = data['season-team-evaluations'][0]!;
        data['season-team-configs'] = Array.from({ length: 501 }, (_, i) => ({ ...structuredClone(config), id: `config-${i}` }));
        data['season-team-evaluations'] = data['season-team-configs'].map(c => ({ ...structuredClone(evaluation), id: `eval-${c.id}`, configId: c.id, sourceScore: null }));
        refreshConfigProofs(data);
        for (const [name, value] of Object.entries({ ...data, 'team-tier': [] }))
            await writeFile(join(root, `${name}.json`), JSON.stringify(value));
        const source = new FilesystemDataSource({ dataRoot: root });
        const h = createResearchHandlers({ dataSource: source });
        const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
        const input = { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding };
        const stdio = new Client({ name: 'limit-stdio', version: '1' });
        clients.push(stdio);
        await stdio.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/stdio.ts'], cwd: packageRoot, env: { ...getDefaultEnvironment(), TQCCL_DATA_ROOT: root }, stderr: 'pipe' }));
        const token = 'A'.repeat(43);
        const environment: WorkerEnvironment = { CF_VERSION_METADATA: { id: '11111111-2222-4333-8444-555555555555' }, TQCCL_MCP_BEARER_CURRENT: token, TQCCL_MCP_ALLOWED_ORIGINS: '', TQCCL_MCP_MAX_BODY_BYTES: '65536', TQCCL_MCP_MAX_RESULT_BYTES: '98304', TQCCL_MCP_RATE_MAX: '100', TQCCL_MCP_RATE_WINDOW_MS: '60000', TQCCL_MCP_MAX_IN_FLIGHT: '4' };
        const worker = createWorker({ createDataSource: () => source });
        const http = new Client({ name: 'limit-http', version: '1' });
        clients.push(http);
        await http.connect(new StreamableHTTPClientTransport(new URL('https://mcp.example/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch: (request, init) => worker.fetch(new Request(request, init), environment) }) as unknown as Transport);
        for (const client of clients) {
            await client.listTools();
            const result = await client.callTool({ name: 'tqccl_recommend_team', arguments: input });
            expect(result.isError).toBe(true);
            expect((result.structuredContent as Record<string, unknown>)?.error).toMatchObject({ code: 'CANDIDATE_LIMIT_EXCEEDED', limits: { maxCandidates: 500, candidateCount: 501 }, retryable: false });
        }
        let stdout = '';
        const exit = await runCli(['tqccl_recommend_team', '--data-root', root, '--input', JSON.stringify(input)], { stdout: { write(value: string) { stdout += value; return true; } }, stderr: { write() { return true; } } });
        expect(exit).toBe(1);
        expect(JSON.parse(stdout).error).toMatchObject({ code: 'CANDIDATE_LIMIT_EXCEEDED', limits: { maxCandidates: 500, candidateCount: 501 }, retryable: false });
    }
    finally {
        await Promise.all(clients.map(client => client.close()));
        await rm(root, { recursive: true, force: true });
    }
}, 15000);
