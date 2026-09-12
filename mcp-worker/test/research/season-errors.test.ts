import { expect, it } from 'vitest';
import { formatToolError } from '../../src/mcp/format-result.js';
import { ResearchHandlerError } from '../../src/research/research-handlers.js';
import { errorEnvelopeSchema } from '../../src/research/research-contracts.js';
it('publishes actionable bounded config choices and candidate limits on only their errors', () => {
    const choices = { kind: 'team-config' as const, teamId: 'a', configIds: ['a', 'b'], totalCount: 2, omittedCount: 0 };
    const result = formatToolError(new ResearchHandlerError('CONFIG_AMBIGUOUS', 'private', false, [], choices));
    expect(result.structuredContent?.error).toMatchObject({ choices });
    expect(errorEnvelopeSchema.safeParse(result.structuredContent).success).toBe(true);
    const limited = formatToolError(new ResearchHandlerError('CANDIDATE_LIMIT_EXCEEDED', 'private', false, [], undefined, { maxCandidates: 500, candidateCount: 501 }));
    expect(limited.structuredContent?.error).toMatchObject({ limits: { maxCandidates: 500, candidateCount: 501 }, retryable: false });
    expect(errorEnvelopeSchema.safeParse({ error: { ...(result.structuredContent!.error as object), code: 'INVALID_REQUEST' } }).success).toBe(false);
});
it('exports required error payload branches to machine-readable JSON schema', async () => {
    const { z } = await import('zod');
    const schema = z.toJSONSchema(errorEnvelopeSchema) as unknown as {
        properties: {
            error: {
                oneOf?: Array<{
                    properties: Record<string, unknown>;
                    required: string[];
                }>;
                anyOf?: Array<{
                    properties: Record<string, unknown>;
                    required: string[];
                }>;
            };
        };
    };
    const branches = (schema as unknown as {
        properties: {
            error: {
                allOf: Array<{
                    oneOf?: Array<{
                        properties: Record<string, unknown>;
                        required: string[];
                    }>;
                }>;
            };
        };
    }).properties.error.allOf[1]!.oneOf!;
    expect(branches.find(branch => JSON.stringify(branch.properties.code).includes('CONFIG_AMBIGUOUS'))?.required).toContain('choices');
    const limits = branches.find(branch => JSON.stringify(branch.properties.code).includes('CANDIDATE_LIMIT_EXCEEDED'))!;
    expect(limits.required).toContain('limits');
    expect(limits.properties.retryable).toMatchObject({ const: false });
});
it('keeps context comparison semantic when callers construct fields in a different order', async () => {
    const { normalizeObservations } = await import('../../src/domain/normalization-service.js');
    const { recommendTeam } = await import('../../src/domain/recommendation-service.js');
    const { seasonConsumerFixture, context } = await import('../../../tests-js/fixtures/season-fixtures.mjs');
    const { validateSeasonBundle } = await import('../../../js/season-context.js');
    const model = await validateSeasonBundle(await seasonConsumerFixture());
    const n = await normalizeObservations({ observations: [], workflowVersion: 'workflow:a', seasonContext: context });
    await expect(recommendTeam({ snapshot: { releaseId: 'release', dataVersion: 'data', teams: [], teamTier: [], seasonModel: model }, canonicalState: n.canonicalState, confirmationBinding: n.confirmationBinding, workflowVersion: 'workflow:a', expectedWorkflowVersion: 'workflow:a', seasonContext: { rulesetId: context.rulesetId, scenarioId: context.scenarioId } })).resolves.toMatchObject({ teams: [] });
});
