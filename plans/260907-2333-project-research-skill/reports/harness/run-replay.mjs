import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runCase, assertParity } from './model-session.mjs';

const reports = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(reports, '../../..');
const mode = process.argv[2];
if (!['baseline-v2', 'candidate-v2'].includes(mode)) throw new Error('Specify baseline-v2 or candidate-v2');
const candidate = mode === 'candidate-v2';
const manifest = JSON.parse(fs.readFileSync(path.join(reports, 'input-packet-manifest.json')));
const chosen = process.argv.slice(3);
const ids = chosen.length ? chosen : Object.keys(manifest);
const output = path.join(reports, mode);
fs.mkdirSync(output, { recursive: true });
let instructions = '';
if (candidate) {
  const folder = path.join(root, '.agents/skills/tqccl-research');
  for (const name of ['SKILL.md', 'agents/openai.yaml', 'references/evidence-and-region-rules.md', 'references/report-template.md']) {
    instructions += `\nFILE tqccl-research/${name}\n${fs.readFileSync(path.join(folder, name), 'utf8')}\n`;
  }
}
for (const id of ids) {
  const file = path.join(reports, 'packets', id + '.json');
  const bytes = fs.readFileSync(file);
  if (createHash('sha256').update(bytes).digest('hex') !== manifest[id]) throw new Error('PACKET_CHANGED: ' + id);
  const packet = JSON.parse(bytes);
  const target = path.join(output, id + '.json');
  if (fs.existsSync(target)) throw new Error('REFUSE_OVERWRITE: ' + id);
  if (candidate) assertParity(packet, JSON.parse(fs.readFileSync(path.join(reports, 'baseline-v2', id + '.json'))));
  const reportPath = packet.reportKey ? path.join(root, 'plans/reports', `research-260912-${mode}-research-loop-regression.md`) : null;
  if (reportPath && fs.existsSync(reportPath)) throw new Error('REPORT_TARGET_EXISTS');
  const run = await runCase({ packet, instructions, outputPath: target, reportPath });
  console.log(JSON.stringify({ id, status: run.status, actions: run.trace.length, error: run.error }));
  if (run.status !== 'OBSERVED') {
    process.exitCode = 1;
    break; // Do not spend more calls after a quota, transport or incomplete-run failure.
  }
  if (id === '15' && run.trace.some((entry) => entry.action?.op === 'create_report' && entry.ok)) {
    // Only this branch's first-round report is admitted to its fresh second round.
    const next = { ...packet, id: '15-second', prompt: 'Tiếp tục nghiên cứu lần trước: tìm và đọc report đã lưu, rồi cho biết kết luận hiện còn hiệu lực và đính chính cần giữ.',
      sources: { ...packet.sources, [packet.reportKey]: fs.readFileSync(reportPath, 'utf8') } };
    delete next.reportKey;
    const secondPath = path.join(output, '15-second.json');
    if (fs.existsSync(secondPath)) throw new Error('REFUSE_OVERWRITE: 15-second');
    const second = await runCase({ packet: next, instructions, outputPath: secondPath });
    console.log(JSON.stringify({ id: '15-second', status: second.status, parent: run.parityHash }));
    if (second.status !== 'OBSERVED') {
      process.exitCode = 1;
      break;
    }
  }
}
