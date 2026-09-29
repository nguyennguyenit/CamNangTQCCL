// Lấy danh sách model id của các mẫu nhà cung cấp (GET {base}/models) để cập nhật catalog tĩnh
// shared/ai-models.ts. /models không cho biết model nào nhận ảnh hay nhận mức suy luận nào, nên script chỉ
// in ra model mới/đã mất; cờ `vision`/`effortStyle`/`efforts` phải điền tay theo tài liệu nhà cung cấp.
//
//   node scripts/scan-ai-models.mjs
//
// Key (tuỳ chọn, nhà cung cấp nào bắt đăng nhập thì cần): DEEPSEEK_API_KEY, OPENCODE_API_KEY.

import { AI_PRESETS } from '../shared/ai-models.ts';

const KEY_ENV = { deepseek: 'DEEPSEEK_API_KEY', 'opencode-zen': 'OPENCODE_API_KEY' };

let failed = false;
for (const preset of AI_PRESETS) {
  const url = preset.endpoint.replace(/\/chat\/completions$/u, '/models');
  const key = process.env[KEY_ENV[preset.id]];
  const resp = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  if (!resp.ok) {
    failed = true;
    console.error(`${preset.label}: ${url} -> HTTP ${resp.status}${key ? '' : ` (thử đặt ${KEY_ENV[preset.id]})`}`);
    continue;
  }
  const remote = new Set(((await resp.json()).data ?? []).map((m) => m.id));
  const known = new Set(preset.models.map((m) => m.modelId));
  console.log(`${preset.label} (${url}): ${remote.size} model`);
  console.log(`  chưa có trong catalog: ${[...remote].filter((id) => !known.has(id)).join(', ') || '(không)'}`);
  console.log(`  catalog có nhưng /models không còn: ${[...known].filter((id) => !remote.has(id)).join(', ') || '(không)'}`);
}
process.exitCode = failed ? 1 : 0;
