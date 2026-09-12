import { expect, it } from 'vitest';
import { seasonConsumerFixture, context } from '../../../tests-js/fixtures/season-fixtures.mjs';
import { createDataManifest, validateDataSnapshot, type ArtifactName } from '../../src/data/artifact-contracts.js';
import { createResearchHandlers } from '../../src/research/research-handlers.js';
import { createNormalizationDigest } from '../../src/domain/canonical-state.js';
export async function seasonalHandlers() {
    const data = { ...await seasonConsumerFixture(), 'team-tier': [] };
    const bytes = new Map(Object.entries(data).map(([name, value]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(value))]));
    const snapshot = await validateDataSnapshot(await createDataManifest(bytes), bytes);
    return createResearchHandlers({ dataSource: { load: async () => snapshot } });
}
it('binds explicit context to canonical projection while legacy digest stays separate', async () => {
    const state = { heroes: [], tactics: [], lockedTeams: [] };
    expect(await createNormalizationDigest({ ...state, seasonContext: context })).not.toBe(await createNormalizationDigest(state));
});
it('discovers both modes and eleven artifacts, requires explicit verified pair', async () => {
    const h = await seasonalHandlers();
    const v = await h.call('tqccl_get_data_version', {});
    expect(v.artifacts).toHaveLength(11);
    expect(v.capabilities.seasonContext).toBe(true);
    await expect(h.call('tqccl_search', { query: '', seasonContext: { scenarioId: 'scenario-a' } } as never)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
});
it('search exposes config identities and cursor cannot cross context mode', async () => {
    const h = await seasonalHandlers();
    const r = await h.call('tqccl_search', { query: '', kinds: ['team'], seasonContext: context, limit: 1 });
    expect(r.items[0]?.configId).toBe('config-a');
    expect(r.nextCursor).toBeDefined();
    await expect(h.call('tqccl_search', { query: '', kinds: ['team'], cursor: r.nextCursor, expectedWorkflowVersion: r.workflowVersion })).rejects.toMatchObject({ code: 'CURSOR_INVALID' });
});
it('detail refuses ambiguous team, resolves exact config and scoped source score', async () => {
    const h = await seasonalHandlers();
    const v = await h.call('tqccl_get_data_version', {});
    const input = { teamId: 'team-a', seasonContext: context, expectedWorkflowVersion: v.workflowVersion };
    await expect(h.call('tqccl_get_team', input)).rejects.toMatchObject({ code: 'CONFIG_AMBIGUOUS', choices: { kind: 'team-config', teamId: 'team-a', configIds: ['config-a', 'config-b'], totalCount: 2, omittedCount: 0 } });
    const detail = await h.call('tqccl_get_team', { ...input, configId: 'config-a' });
    expect(detail.configId).toBe('config-a');
    expect(detail.sourceScore?.value).toBe(132.5);
});
it('normalization echoes pair and blocks context removal from confirmed request', async () => {
    const h = await seasonalHandlers();
    const n = await h.call('tqccl_normalize_entities', { observations: [], seasonContext: context });
    expect(n.canonicalState.seasonContext).toEqual(context);
    expect(n.confirmationBinding.canonicalProjectionVersion).not.toBe('projection:v1');
    await expect(h.call('tqccl_recommend_team', { expectedWorkflowVersion: n.workflowVersion, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
});
export async function confirmedSeasonalFlow() {
    const h = await seasonalHandlers();
    const data = await seasonConsumerFixture();
    const observations = [...data['heroes-dict'].slice(0, 3).map((hero, i) => ({ observationId: `h${i}`, entityKind: 'hero', canonicalId: ['hero:anh', 'hero:binh', 'hero:cuong'][i], familyId: ['hero-family:anh', 'hero-family:binh', 'hero-family:cuong'][i], displayName: hero.viet, evidence: { sourceScope: 'manualCorrection', batchId: 'fixture' } })), ...data.tactics.map((tactic, i) => ({ observationId: `t${i}`, entityKind: 'tactic', canonicalId: ['mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay'].map(x => `tactic:${x}`)[i], displayName: tactic.viet, evidence: { sourceScope: 'manualCorrection', batchId: 'fixture' } }))];
    const n = await h.call('tqccl_normalize_entities', { observations, seasonContext: context } as never);
    return { h, input: { seasonContext: context, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding, expectedWorkflowVersion: n.workflowVersion } };
}
it('recommends executable configurations with exact source score and retains nested coexist reference', async () => {
    const { h, input } = await confirmedSeasonalFlow();
    const r = await h.call('tqccl_recommend_coexist', input);
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0]?.configId).toBe('config-a');
    expect((r.teams[0]?.sourceScore as {
        value: number;
    })?.value).toBe(132.5);
    if (!("summary" in r.coexistReference[0]!))
        throw new Error("Expected seasonal reference");
    expect(r.coexistReference[0]).toMatchObject({ recordId: 'source-group-a', classification: 'scenarioReference' });
    expect((r.coexistReference[0]?.teams as Array<{
        heroes: Array<{
            tacticSlotsRaw: string[];
        }>;
    }>)[0]?.heroes).toHaveLength(3);
    expect((r.coexistReference[0]?.teams as Array<{
        heroes: Array<{
            tacticSlotsRaw: string[];
        }>;
    }>)[0]?.heroes[0]?.tacticSlotsRaw).toEqual(['Lựa chọn A / B', '']);
    expect(r.coexistReference[0]?.summary).toContain('Dòng một\nDòng hai');
});
it('seasonal replacement uses config holder and invalidates exact-selection score', async () => {
    const { h, input } = await confirmedSeasonalFlow();
    const r = await h.call('tqccl_suggest_replacements', { ...input, teamId: 'team-a', configId: 'config-a', tacticName: 'Một', holderId: 'hero:anh', slotIndex: 0 });
    expect(r.replacements).toEqual(['Bảy']);
    expect(r.configId).toBe('config-a');
    expect(r.sourceScore).toBeNull();
});
it('final engine alternative selection removes the source score', async () => {
    const { h, input } = await confirmedSeasonalFlow();
    const state = structuredClone(input.canonicalState);
    state.tactics = state.tactics.filter(tactic => tactic.canonicalId !== 'tactic:mot');
    const changed = { ...input, canonicalState: state, confirmationBinding: { ...input.confirmationBinding, normalizationDigest: await createNormalizationDigest(state as Parameters<typeof createNormalizationDigest>[0]) } };
    const result = await h.call('tqccl_recommend_team', changed);
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0]?.configId).toBe('config-a');
    expect(result.teams[0]?.sourceScore).toBeNull();
});
it('preserves unsupported mandatory condition diagnostics instead of silently dropping configs', async () => {
    const { h, input } = await confirmedSeasonalFlow();
    const result = await h.call('tqccl_recommend_team', { ...input, experimentalUntiered: true });
    expect(JSON.stringify(result.diagnostics)).toContain('REQUIREMENT_UNVERIFIED');
    expect(JSON.stringify(result.diagnostics)).toContain('config-conditional');
});
it('searches configured heroes and alternatives using the shared team search surface', async () => {
    const h = await seasonalHandlers();
    const hero = await h.call('tqccl_search', { query: 'Anh', kinds: ['team'], seasonContext: context });
    expect(hero.items.map(item => item.configId)).toEqual(['config-a', 'config-b', 'config-conditional']);
    const tactic = await h.call('tqccl_search', { query: 'Bảy', kinds: ['team'], seasonContext: context });
    expect(tactic.items).toHaveLength(3);
});
