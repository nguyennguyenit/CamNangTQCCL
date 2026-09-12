import type { ReferenceEntry } from './season-domain-adapter.js';

const MAX_RESULT_BYTES = 64 * 1024;
const text = (value: unknown) => String(value ?? '').slice(0, 256);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function projectHero(value: unknown) {
  const hero = record(value);
  const tactics = hero.tacticSlotsRaw as unknown[] | undefined;
  const books = hero.bookSlotsRaw as unknown[] | undefined;
  return {
    nameRaw: text(hero.nameRaw ?? hero.name),
    tacticSlotsRaw: [0, 1].map(index => text(tactics?.[index])),
    bookSlotsRaw: [0, 1, 2].map(index => text(books?.[index])),
    statFocusRaw: text(hero.statFocusRaw),
  };
}

function projectTeam(value: unknown) {
  const team = record(value);
  return {
    recordId: text(team.recordId),
    teamName: text(team.teamName ?? team.name),
    teamNameRaw: text(team.teamNameRaw),
    unitTacticEffectsRaw: text(team.unitTacticEffectsRaw),
    heroes: (Array.isArray(team.heroes) ? team.heroes : []).slice(0, 3).map(projectHero),
  };
}

/** Preserve slot position and raw multiline text without null placeholders. */
export function projectSeasonReferences(entries: ReferenceEntry[]) {
  return entries.slice(0, 50).map(entry => {
    const content = entry.content;
    const teams = Array.isArray(content.teams) ? content.teams : [];
    return {
      recordId: entry.recordId,
      classification: entry.classification,
      source: entry.source ? {
        id: text(entry.source.id),
        url: String(entry.source.url).slice(0, 2048),
        snapshotHash: text(entry.source.snapshotHash),
        disclaimerRaw: text(entry.source.disclaimerRaw),
      } : null,
      summary: text(content.summaryRaw ?? content.groupLabel ?? content.name),
      groupLabel: text(content.groupLabel),
      notesRaw: text(content.notesRaw),
      openingSuggestionsRaw: text(content.openingSuggestionsRaw),
      trust: 'untrusted' as const,
      teams: teams.slice(0, 10).map(projectTeam),
      omittedTeams: Math.max(0, teams.length - 10),
      summaryOnly: false,
    };
  });
}

/** Remove optional detail first, then whole references, keeping valid records. */
export function fitSeasonResult(value: Record<string, unknown>) {
  const output = structuredClone(value);
  const references = (output.coexistReference ?? []) as Array<Record<string, unknown>>;
  const bytes = () => new TextEncoder().encode(JSON.stringify(output)).byteLength;
  let omitted = Number(output.omittedReferences ?? 0);

  for (let index = references.length - 1; index >= 0 && bytes() > MAX_RESULT_BYTES; index--) {
    const entry = references[index]!;
    entry.omittedTeams = Number(entry.omittedTeams) + ((entry.teams as unknown[])?.length ?? 0);
    delete entry.teams;
    entry.summaryOnly = true;
    output.truncated = true;
  }
  while (references.length && bytes() > MAX_RESULT_BYTES) {
    references.pop();
    omitted++;
    output.truncated = true;
  }
  if ('coexistReference' in output) output.omittedReferences = omitted;
  return output;
}

function hasLongText(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 256;
  if (Array.isArray(value)) return value.some(hasLongText);
  return Boolean(value && typeof value === 'object' && Object.values(value).some(hasLongText));
}

export function seasonReferenceMetadata(entries: ReferenceEntry[]) {
  const omittedReferences = Math.max(0, entries.length - 50);
  return {
    omittedReferences,
    referenceTruncated: omittedReferences > 0 || entries.slice(0, 50).some(entry =>
      hasLongText(entry.content) || hasLongText(entry.source?.disclaimerRaw)),
  };
}
