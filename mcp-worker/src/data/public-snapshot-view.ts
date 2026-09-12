import { validateSeasonBundle } from '../../../js/season-context.js';
import type { DataSnapshot } from './artifact-contracts.js';

function evidenceIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach(item => evidenceIds(item, ids));
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'evidenceRefs' && Array.isArray(nested)) {
        nested.forEach(id => { if (typeof id === 'string') ids.add(id); });
      } else {
        evidenceIds(nested, ids);
      }
    }
  }
  return ids;
}

/** Derive one public view only after immutable raw snapshot validation. */
export async function publicSnapshotView(snapshot: DataSnapshot): Promise<DataSnapshot> {
  const teams = snapshot.artifacts.teams.filter(team => team.source !== 'do-uy');
  if (teams.length === snapshot.artifacts.teams.length) return snapshot;

  const visible = new Set(teams.map(team => team.id));
  const configs = (snapshot.artifacts['season-team-configs'] ?? []).filter(config => visible.has(config.teamId));
  const configIds = new Set(configs.map(config => config.id));
  const removed = (snapshot.artifacts['season-team-configs'] ?? []).filter(config => !configIds.has(config.id));
  const removedIds = new Set(removed.map(config => config.id));
  const links = (snapshot.artifacts['season-content-links'] ?? []).filter(link =>
    !(Array.isArray(link.configIds) && link.configIds.some(id => removedIds.has(id))));
  const evaluations = (snapshot.artifacts['season-team-evaluations'] ?? []).filter(row => configIds.has(row.configId));
  const hiddenProofs = evidenceIds([
    removed,
    (snapshot.artifacts['season-team-evaluations'] ?? []).filter(row => !configIds.has(row.configId)),
    (snapshot.artifacts['season-content-links'] ?? []).filter(link => !links.includes(link)),
  ]);
  const retainedProofs = evidenceIds([snapshot.artifacts['season-registry'], configs, evaluations, links]);
  const evidence = (snapshot.artifacts['season-evidence'] ?? []).filter(row =>
    !hiddenProofs.has(String(row.id)) || retainedProofs.has(String(row.id)));
  const artifacts = {
    ...snapshot.artifacts,
    teams,
    'team-tier': snapshot.artifacts['team-tier'].filter(row => visible.has(row.teamId)),
    ...(snapshot.seasonModel ? {
      'season-team-configs': configs,
      'season-team-evaluations': evaluations,
      'season-content-links': links,
      'season-evidence': evidence,
    } : {}),
  };
  if (!snapshot.seasonModel) return { ...snapshot, artifacts };

  const { 'team-tier': _legacyTier, ...bundle } = artifacts;
  const seasonModel = await validateSeasonBundle(bundle);
  return { ...snapshot, artifacts, seasonModel };
}
