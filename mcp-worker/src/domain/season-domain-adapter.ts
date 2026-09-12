import * as shared from '../../../js/season-context.js';
import type { SeasonModel } from '../data/artifact-contracts.js';
import type { SeasonContext } from './canonical-state.js';
type RecordData = Record<string, unknown>;
export interface Config extends RecordData {
    id: string;
    teamId: string;
    heroSlots: Array<{
        heroRefs: string[];
        tacticSlots: Array<{
            tacticRefs: string[];
        }>;
    }>;
}
export interface ConfigChoices {
    kind: 'team-config';
    teamId: string;
    configIds: string[];
    totalCount: number;
    omittedCount: number;
}
export interface CandidateLimits {
    maxCandidates: 500;
    candidateCount: number;
}
export type SeasonFailure = {
    ok: false;
    code: 'SEASON_CONTEXT_INVALID' | 'CONFIG_NOT_FOUND' | 'CONFIG_AMBIGUOUS' | 'CANDIDATE_LIMIT_EXCEEDED';
    choices?: ConfigChoices;
    limits?: CandidateLimits;
};
export interface BrowseEntry {
    configId: string;
    teamId: string;
    team: RecordData;
    config: Config;
    evaluation: RecordData | null;
}
export interface ReferenceEntry {
    recordId: string;
    classification: string;
    source: RecordData | null;
    content: RecordData;
    configIds: string[];
}
export const seasonDomain = {
    candidates: shared.projectSeasonCandidates as unknown as (model: SeasonModel, context: SeasonContext, options: {
        experimentalUntiered?: boolean | undefined;
    }) => SeasonFailure | {
        ok: true;
        teams: RecordData[];
        teamTier: RecordData[];
        diagnostics: unknown[];
    },
    config: shared.resolveTeamConfig as unknown as (model: SeasonModel, input: {
        teamId: string;
        configId?: string | undefined;
        context: SeasonContext;
    }) => SeasonFailure | {
        ok: true;
        config: Config;
        team: RecordData;
        evaluation: RecordData | null;
    },
    browse(model: SeasonModel, context: SeasonContext) { return shared.projectSeasonBrowse(model, shared.resolveBrowseState(model, context)) as unknown as {
        applicable: BrowseEntry[];
        coexist: {
            applicable: ReferenceEntry[];
            scenarioReference: ReferenceEntry[];
            unknown: ReferenceEntry[];
        };
    }; },
    selection: shared.selectionFromEntry,
    score: shared.resolveSelectionScore,
};
