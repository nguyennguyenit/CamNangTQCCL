import { expect, it, vi } from 'vitest';
import { seasonConsumerFixture, context, refreshConfigProofs } from '../../../tests-js/fixtures/season-fixtures.mjs';
import { createDataManifest, validateDataSnapshot, type ArtifactName } from '../../src/data/artifact-contracts.js';
import { createResearchHandlers } from '../../src/research/research-handlers.js';
import { fitSeasonResult, projectSeasonReferences } from '../../src/domain/season-reference-projection.js';
import { RESEARCH_CONTRACTS, configChoicesSchema } from '../../src/research/research-contracts.js';
import { legacyDomainAdapter } from '../../src/domain/legacy-domain-adapter.js';
async function handler(data: Awaited<ReturnType<typeof seasonConsumerFixture>>) {
    const bytes = new Map(Object.entries({ ...data, 'team-tier': [] }).map(([name, v]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(v))]));
    const snapshot = await validateDataSnapshot(await createDataManifest(bytes), bytes);
    return { snapshot, h: createResearchHandlers({ dataSource: { load: async () => snapshot } }) };
}
it('excludes private descendants before search, detail, matching, and provenance', async () => {
    const data = await seasonConsumerFixture();
    data.teams[0]!.source = 'do-uy';
    const { h, snapshot } = await handler(data);
    const v = await h.call('tqccl_get_data_version', {});
    expect(v.releaseId).toBe(snapshot.releaseId);
    const { publicSnapshotView } = await import("../../src/data/public-snapshot-view.js");
    const view = await publicSnapshotView(snapshot);
    expect(view.artifacts["season-evidence"]!.some(row => row.id === "config-proof-config-a")).toBe(false);
    const search = await h.call('tqccl_search', { query: '', kinds: ['team'], seasonContext: context });
    expect(JSON.stringify(search)).not.toContain('config-a');
    await expect(h.call('tqccl_get_team', { teamId: 'team-a', configId: 'config-a', seasonContext: context, expectedWorkflowVersion: v.workflowVersion })).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' });
    const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
    const r = await h.call('tqccl_recommend_team', { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding });
    expect(JSON.stringify(r)).not.toContain('config-a');
});
it('rejects 501 eligible configs before calling engine and exposes all ambiguity choices by paging', async () => {
    const data = await seasonConsumerFixture();
    const base = data['season-team-configs'][0]!;
    const evaluation = data['season-team-evaluations'][0]!;
    data['season-team-configs'] = Array.from({ length: 501 }, (_, i) => ({ ...structuredClone(base), id: `config-${String(i).padStart(3, '0')}` }));
    data['season-team-evaluations'] = data['season-team-configs'].map(config => ({ ...structuredClone(evaluation), id: `eval-${config.id}`, configId: config.id, sourceScore: null }));
    refreshConfigProofs(data);
    const { h } = await handler(data);
    const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
    await expect(h.call('tqccl_recommend_team', { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding })).rejects.toMatchObject({ code: 'CANDIDATE_LIMIT_EXCEEDED', limits: { maxCandidates: 500, candidateCount: 501 }, retryable: false });
    await expect(h.call('tqccl_get_team', { teamId: 'team-a', seasonContext: context, expectedWorkflowVersion: n.workflowVersion })).rejects.toMatchObject({ code: 'CONFIG_AMBIGUOUS', choices: { totalCount: 501, omittedCount: 481, configIds: Array.from({ length: 20 }, (_, i) => `config-${String(i).padStart(3, '0')}`) } });
    const seen = [];
    let cursor: string | undefined;
    do {
        const r = await h.call('tqccl_search', { query: '', kinds: ['team'], seasonContext: context, limit: 50, ...(cursor ? { cursor, expectedWorkflowVersion: n.workflowVersion } : {}) });
        seen.push(...r.items.map(x => x.configId));
        cursor = r.nextCursor;
    } while (cursor);
    expect(new Set(seen).size).toBe(501);
});
it('fits nested references by dropping optional details without breaking required slots or schema', () => {
    const content = { summaryRaw: 'J'.repeat(256), teams: Array.from({ length: 10 }, (_, i) => ({ recordId: `t${i}`, teamNameRaw: 'J'.repeat(256), unitTacticEffectsRaw: 'J'.repeat(256), heroes: Array.from({ length: 3 }, () => ({ nameRaw: 'J'.repeat(256), tacticSlotsRaw: ['J'.repeat(256), 'J'.repeat(256)], bookSlotsRaw: ['J'.repeat(256), 'J'.repeat(256), 'J'.repeat(256)], statFocusRaw: 'J'.repeat(256) })) })) };
    const refs = projectSeasonReferences(Array.from({ length: 50 }, (_, i) => ({ recordId: `g${i}`, classification: 'scenarioReference', source: null, content, configIds: [] })));
    const base = { releaseId: `sha256:${'a'.repeat(64)}`, dataVersion: 'data:aaaaaaaaaaaa', workflowVersion: 'workflow:a', provenance: [], warnings: [], truncated: false, teams: [], diagnostics: {}, seasonContext: context, coexistReference: refs };
    const fitted = fitSeasonResult(base);
    expect(new TextEncoder().encode(JSON.stringify(fitted)).byteLength).toBeLessThanOrEqual(65536);
    expect(fitted.truncated).toBe(true);
    expect(RESEARCH_CONTRACTS.tqccl_recommend_coexist.output.safeParse(fitted).success).toBe(true);
    const malformed = structuredClone(base);
    malformed.coexistReference[0]!.teams[0]!.heroes[0]!.tacticSlotsRaw = [];
    expect(RESEARCH_CONTRACTS.tqccl_recommend_coexist.output.safeParse(malformed).success).toBe(false);
});
it('rejects unordered or underspecified ambiguity choices', () => {
    expect(configChoicesSchema.safeParse({ kind: 'team-config', teamId: 't', configIds: ['b', 'a'], totalCount: 2, omittedCount: 0 }).success).toBe(false);
});
it('projects the five-group twenty-five-team seventy-five-position source snapshot', async () => {
    const { seasonFingerprint, contentFingerprintProjection } = await import('../../../js/season-context.js');
    const data = await seasonConsumerFixture();
    const links = data['season-content-links'] as unknown as Array<{
        id: string;
        recordId: string;
        target: {
            payload: {
                teams: Array<{
                    recordId: string;
                    contentFingerprint: string;
                    [key: string]: unknown;
                }>;
                [key: string]: unknown;
            };
            contentFingerprint: string;
        };
    }>;
    const base = links[0]!;
    links.splice(0);
    for (let group = 0; group < 5; group++) {
        const link = structuredClone(base);
        link.id = `link-${group}`;
        link.recordId = `group-${group}`;
        link.target.payload.teams = [];
        for (let team = 0; team < 5; team++) {
            const row = structuredClone(base.target.payload.teams[0]!);
            row.recordId = `source-team-${group}-${team}`;
            row.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(row));
            link.target.payload.teams.push(row);
        }
        link.target.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(link.target.payload));
        links.push(link);
    }
    const { h } = await handler(data);
    const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
    const r = await h.call('tqccl_recommend_coexist', { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding });
    const groups = r.coexistReference.filter(group => 'teams' in group);
    expect(groups).toHaveLength(5);
    expect(groups.flatMap(group => 'teams' in group ? group.teams ?? [] : [])).toHaveLength(25);
    expect(groups.flatMap(group => 'teams' in group ? group.teams ?? [] : []).flatMap(team => team.heroes)).toHaveLength(75);
    expect(r.truncated).toBe(false);
});

it('reports text truncation even when the shortened reference fits the byte budget', async () => {
    const { seasonFingerprint, contentFingerprintProjection } = await import('../../../js/season-context.js');
    const data = await seasonConsumerFixture();
    const link = (data['season-content-links'] as unknown as Array<{target:{payload:Record<string,unknown>;contentFingerprint:string}}>)[0]!;
    link.target.payload.summaryRaw = 'J'.repeat(300);
    link.target.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(link.target.payload));
    const { h } = await handler(data);
    const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
    const r = await h.call('tqccl_recommend_coexist', { seasonContext: context, expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding });
    expect(r.truncated).toBe(true);
});
