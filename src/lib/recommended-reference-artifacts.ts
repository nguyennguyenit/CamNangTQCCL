import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join, relative, isAbsolute, sep } from 'node:path';

const GENERATION = /^[0-9a-f]{64}$/;
const FILE = /^(?:manifest|seasons|index|other-teams|hero-summaries|details-s-[0-9a-f]{64})\.json$/;
export const DEFAULT_RECOMMENDED_ROOT = join(process.cwd(),'src/data/recommended-reference');
const hash = (bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export interface RecommendedPublicationSnapshot {
  pin:{schemaVersion:number;generationId:string;manifestSha256:string};
  currentBytes:Uint8Array;
  manifest:{schemaVersion:number;generationId:string;dedupKeyVersion:number;files:Record<string,{bytes:number;sha256:string}>;allowedScopeKeys?:string[];[key:string]:unknown};
  files:Record<string,Uint8Array>;
}
const inside = (path:string,root:string)=>{const value=relative(root,path);return value==='' || (value!=='..'&&!value.startsWith(`..${sep}`)&&!isAbsolute(value));};

async function safeFile(path:string, parent:string) {
  const stat=await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Recommended artifact is not a regular file: ${path}`);
  const [actual,root]=await Promise.all([realpath(path),realpath(parent)]);
  if (!inside(actual,root) || dirname(actual)!==root) throw new Error(`Recommended artifact escapes generation: ${path}`);
  return readFile(actual);
}

async function readPublicationSnapshot(rootDir:string):Promise<RecommendedPublicationSnapshot> {
  const root=await realpath(rootDir);
  const currentPath=join(root,'current.json');
  const currentBytes=await safeFile(currentPath,root);
  const current=JSON.parse(currentBytes.toString());
  if (current.schemaVersion!==1 || Object.keys(current).sort().join(',')!=='generationId,manifestSha256,schemaVersion' || !GENERATION.test(current.generationId) || !/^[0-9a-f]{64}$/.test(current.manifestSha256)) throw new Error('Invalid Recommended current selector');
  const generation=join(root,current.generationId);
  const generationStat=await lstat(generation);
  if (generationStat.isSymbolicLink() || !generationStat.isDirectory() || !inside(await realpath(generation),root)) throw new Error('Invalid Recommended generation directory');
  const manifestBytes=await safeFile(join(generation,'manifest.json'),generation);
  if (hash(manifestBytes)!==current.manifestSha256) throw new Error('Recommended manifest hash mismatch');
  const manifest=JSON.parse(manifestBytes.toString());
  if (manifest.schemaVersion!==1 || manifest.generationId!==current.generationId || manifest.dedupKeyVersion!==1) throw new Error('Recommended manifest identity mismatch');
  const declared=Object.keys(manifest.files || {}).sort();
  const scopes=Array.isArray(manifest.allowedScopeKeys) ? manifest.allowedScopeKeys : [];
  const required=['index.json','other-teams.json','seasons.json','hero-summaries.json',...scopes.map((key:string)=>`details-${key}.json`)].sort();
  if (!declared.length || declared.includes('manifest.json') || declared.some(name=>!FILE.test(name)) || JSON.stringify(declared)!==JSON.stringify(required)) throw new Error('Invalid Recommended file inventory');
  const actual=(await readdir(generation)).sort();
  if (JSON.stringify(actual)!==JSON.stringify([...declared,'manifest.json'].sort())) throw new Error('Recommended generation inventory mismatch');
  const files:Record<string,Uint8Array>={'manifest.json':manifestBytes};
  for (const name of declared) {
    const bytes=await safeFile(join(generation,name),generation); const item=manifest.files[name];
    if (bytes.byteLength!==item.bytes || hash(bytes)!==item.sha256) throw new Error(`Recommended artifact hash mismatch: ${name}`);
    files[name]=bytes;
  }
  const reread=await readFile(currentPath);
  if (!reread.equals(currentBytes)) throw new Error('Recommended current changed during snapshot');
  return {pin:{schemaVersion:current.schemaVersion,generationId:current.generationId,manifestSha256:current.manifestSha256},currentBytes,manifest,files};
}

let defaultSnapshot:Promise<RecommendedPublicationSnapshot>|undefined;
export function recommendedPublicationSnapshot(rootDir=DEFAULT_RECOMMENDED_ROOT) {
  if (rootDir===DEFAULT_RECOMMENDED_ROOT) return defaultSnapshot ??= readPublicationSnapshot(rootDir);
  return readPublicationSnapshot(rootDir);
}

export async function recommendedStaticPaths(rootDir=DEFAULT_RECOMMENDED_ROOT) {
  const snapshot=await recommendedPublicationSnapshot(rootDir);
  return Object.keys(snapshot.files).map(file=>({params:{generationId:snapshot.pin.generationId,file:file.slice(0,-5)},props:{file}}));
}

export async function readRecommendedArtifact(generationId:string|undefined,file:string|undefined,rootDir=DEFAULT_RECOMMENDED_ROOT) {
  if (!generationId || !GENERATION.test(generationId) || !file || !/^[a-z0-9-]+$/.test(file)) throw new Error('Invalid Recommended artifact route');
  const snapshot=await recommendedPublicationSnapshot(rootDir);
  if (generationId!==snapshot.pin.generationId) throw new Error('Recommended generation is not selected');
  const name=`${file}.json`; const bytes=snapshot.files[name];
  if (!bytes) throw new Error('Recommended artifact is not declared');
  return {bytes,mimeType:'application/json; charset=utf-8'};
}
