import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { seasonConsumerFixture } from '../../../tests-js/fixtures/season-fixtures.mjs';
import { ARTIFACT_NAMES, SEASON_ARTIFACT_NAMES, V2_ARTIFACT_NAMES, createDataManifest, type ArtifactName } from '../../src/data/artifact-contracts.js';
import { stableStringify } from '../../src/domain/contracts.js';
import { buildWorkerAssets } from '../../scripts/build-worker-assets.js';
import { readWorkerAssetFiles } from '../../scripts/verify-worker-assets.js';
import { calculateWorkerAssetInventoryDigest, verifyWorkerReleaseEvidence } from '../../src/release/worker-release-evidence.js';

const roots: string[] = [];
const identity = { commitSha: 'a'.repeat(40), sourceTree: `git-tree:${'b'.repeat(40)}`, workflowBuildId: `build:sha256b64:${'c'.repeat(43)}` };
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), 'tqccl-season-assets-')); roots.push(parent);
  const dataRoot = join(parent, 'data'); await mkdir(dataRoot);
  const data = { ...await seasonConsumerFixture(), 'team-tier': [] };
  const objects = new Map<ArtifactName, Uint8Array>();
  for (const name of V2_ARTIFACT_NAMES) {
    const bytes = new TextEncoder().encode(JSON.stringify(data[name]));
    objects.set(name, bytes); await writeFile(join(dataRoot, `${name}.json`), bytes);
  }
  return { dataRoot, objects, outputDirectory: join(parent, '.worker-assets'), workflowBuildId: identity.workflowBuildId,
    readSourceState: async () => identity, assertCleanSource: async () => undefined };
}
it('builds deterministic twelve-file seasonal assets and verifies their exact source evidence', async () => {
  const options = await fixture();
  const built = await buildWorkerAssets(options);
  expect(built.artifactNames).toEqual(V2_ARTIFACT_NAMES);
  const names = (await readdir(options.outputDirectory)).sort();
  expect(names).toEqual([...V2_ARTIFACT_NAMES.map(name => `${name}.json`), 'manifest.json'].sort());
  const assets = new Map<string, Uint8Array>(await Promise.all(names.map(async name => [name, new Uint8Array(await readFile(join(options.outputDirectory, name)))] as const)));
  expect(JSON.parse(new TextDecoder().decode(assets.get('manifest.json'))).schemaVersion).toBe(2);
  await expect(verifyWorkerReleaseEvidence(built.evidence, { assets, expectedSource: identity })).resolves.toEqual(built.evidence);
  expect(await buildWorkerAssets(options)).toEqual(built);
  for (const name of ['season-evidence.json', 'season-team-configs.json']) {
    const missing = new Map(assets); missing.delete(name);
    await expect(verifyWorkerReleaseEvidence(built.evidence, { assets: missing, expectedSource: identity })).rejects.toMatchObject({ code: 'INVALID_RELEASE_EVIDENCE' });
  }
  const extra = new Map(assets); extra.set('private.json', new TextEncoder().encode('[]'));
  await expect(verifyWorkerReleaseEvidence(built.evidence, { assets: extra, expectedSource: identity })).rejects.toMatchObject({ code: 'INVALID_RELEASE_EVIDENCE' });
});
it('inventory digest supports exact v2 inventory while rejecting partial or arbitrary extensions', async () => {
  const { objects } = await fixture();
  const manifest = await createDataManifest(objects);
  const assets = new Map([...objects].map(([name, bytes]) => [`${name}.json`, bytes]));
  assets.set('manifest.json', new TextEncoder().encode(`${stableStringify(manifest)}\n`));
  await expect(calculateWorkerAssetInventoryDigest(assets)).resolves.toMatch(/^sha256:[a-f0-9]{64}$/u);
  assets.delete('season-evidence.json');
  await expect(calculateWorkerAssetInventoryDigest(assets)).rejects.toMatchObject({ code: 'INVALID_RELEASE_EVIDENCE' });
});
it('partial seasonal source cannot replace an existing accepted directory', async () => {
  const options = await fixture();
  await mkdir(options.outputDirectory); await writeFile(join(options.outputDirectory, 'previous.txt'), 'accepted');
  await rm(join(options.dataRoot, 'season-evidence.json'));
  await expect(buildWorkerAssets(options)).rejects.toMatchObject({ code: 'INVALID_SOURCE_ASSET' });
  expect(await readFile(join(options.outputDirectory, 'previous.txt'), 'utf8')).toBe('accepted');
});
it('verification reader loads every v2 file', async () => {
  const options = await fixture(); await buildWorkerAssets(options);
  expect((await readWorkerAssetFiles(options.outputDirectory)).size).toBe(12);
});
it.each(['unexpected', 'linked'])('verification reader refuses %s assets', async kind => {
  const options = await fixture(); await buildWorkerAssets(options);
  if (kind === 'unexpected') await writeFile(join(options.outputDirectory, 'unexpected.json'), '[]');
  else {
    const path = join(options.outputDirectory, 'season-evidence.json');
    await rm(path); await symlink(join(options.dataRoot, 'season-evidence.json'), path);
  }
  await expect(readWorkerAssetFiles(options.outputDirectory)).rejects.toThrow();
});
it.each([1, 2])('private SGSDeck subtree does not change bundled v%i artifacts or get read', async version => {
  const options = await fixture();
  if (version === 1) for (const name of SEASON_ARTIFACT_NAMES) await rm(join(options.dataRoot, `${name}.json`));
  const before = await buildWorkerAssets(options);
  const privateRoot = join(options.dataRoot, 'sgsdeck'); await mkdir(privateRoot);
  await writeFile(join(privateRoot, 'private-sentinel.json'), 'private source is not an artifact');
  await symlink(join(privateRoot, 'missing-target'), join(privateRoot, 'unreadable-sentinel'));
  const after = await buildWorkerAssets(options);
  expect(after.evidence.releaseId).toBe(before.evidence.releaseId);
  expect(after.evidence.assetInventoryDigest).toBe(before.evidence.assetInventoryDigest);
  const names = await readdir(options.outputDirectory);
  expect(names).toHaveLength(version === 1 ? 7 : 12);
  expect(names.some(name => name.includes('sgsdeck') || name.includes('sentinel'))).toBe(false);
});
it.each(['file', 'internal-link', 'external-link', 'other-directory', 'unexpected-file'])('source private boundary rejects %s', async kind => {
  const options = await fixture(); const privateRoot = join(options.dataRoot, 'sgsdeck');
  if (kind === 'file') await writeFile(privateRoot, 'invalid');
  if (kind === 'internal-link') await symlink(options.dataRoot, privateRoot);
  if (kind === 'external-link') await symlink(tmpdir(), privateRoot);
  if (kind === 'other-directory') await mkdir(join(options.dataRoot, 'other-private'));
  if (kind === 'unexpected-file') await writeFile(join(options.dataRoot, 'private.json'), '[]');
  await expect(buildWorkerAssets(options)).rejects.toMatchObject({ code: 'INVALID_SOURCE_ASSET' });
});
