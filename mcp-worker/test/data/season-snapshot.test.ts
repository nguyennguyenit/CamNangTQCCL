import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { ARTIFACT_NAMES, createDataManifest, validateDataSnapshot, type ArtifactName } from '../../src/data/artifact-contracts.js';
import { FilesystemDataSource } from '../../src/data/filesystem-data-source.js';
import { seasonFixture } from '../../../tests-js/fixtures/season-fixtures.mjs';
const seasons = ['season-registry', 'season-evidence', 'season-team-configs', 'season-team-evaluations', 'season-content-links'];
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
function objects() {
    const data = { ...seasonFixture(), 'team-tier': [] };
    return new Map([...ARTIFACT_NAMES, ...seasons].map(name => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(data[name as keyof typeof data]))]));
}
it('creates eleven-artifact v2 while the original six-artifact fixture identity is unchanged', async () => {
    const bytes = objects();
    const manifest = await createDataManifest(bytes);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.artifacts).toHaveLength(11);
    const snapshot = await validateDataSnapshot(manifest, bytes);
    expect(snapshot.manifest.schemaVersion).toBe(2);
    const legacy = new Map(await Promise.all(ARTIFACT_NAMES.map(async (name) => [name, new Uint8Array(await readFile(new URL(`../fixtures/release-snapshot/${name}.json`, import.meta.url)))] as const)));
    expect(await createDataManifest(legacy)).toEqual(JSON.parse(await readFile(new URL('../fixtures/release-snapshot/manifest.json', import.meta.url), 'utf8')));
});
it('filesystem activates all five seasonal sidecars and refuses partial seasonal inventory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tqccl-season-snapshot-'));
    roots.push(root);
    for (const [name, bytes] of objects())
        await writeFile(join(root, `${name}.json`), bytes);
    expect((await new FilesystemDataSource({ dataRoot: root }).load()).manifest.schemaVersion).toBe(2);
    await rm(join(root, 'season-evidence.json'));
    await expect(new FilesystemDataSource({ dataRoot: root }).load()).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' });
});
it('v2 rejects valid JSON with broken seasonal cross references before activation', async () => {
    const bytes = objects();
    const data = seasonFixture();
    data['season-team-configs'][0]!.teamId = 'missing';
    bytes.set('season-team-configs' as ArtifactName, new TextEncoder().encode(JSON.stringify(data['season-team-configs'])));
    const manifest = await createDataManifest(bytes);
    await expect(validateDataSnapshot(manifest, bytes)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
});
it('rejects source groups above the bounded MCP team inventory before publication', async () => {
    const { seasonConsumerFixture } = await import('../../../tests-js/fixtures/season-fixtures.mjs');
    const { seasonFingerprint, contentFingerprintProjection } = await import('../../../js/season-context.js');
    const data = { ...await seasonConsumerFixture(), 'team-tier': [] };
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
    const payload = links[0]!.target.payload;
    const base = payload.teams[0]!;
    payload.teams = [];
    for (let i = 0; i < 11; i++) {
        const row = { ...structuredClone(base), recordId: `source-team-${i}` };
        row.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(row));
        payload.teams.push(row);
    }
    links[0]!.target.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(payload));
    const bytes = new Map(Object.entries(data).map(([name, value]) => [name as ArtifactName, new TextEncoder().encode(JSON.stringify(value))]));
    await expect(validateDataSnapshot(await createDataManifest(bytes), bytes)).rejects.toMatchObject({ code: 'INVALID_ARTIFACT' });
});
