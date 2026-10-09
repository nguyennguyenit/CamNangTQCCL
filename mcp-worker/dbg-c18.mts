import { realHandlers } from "./test/fixtures/real-handlers.ts";
const h = realHandlers();
const ev = { batchId: "b", sourceScope: "manualCorrection" as const };
const heroes = ["40Y Lữ Bố","Vương Dị","SP Pháp Chính","CO Đại Kiều","Tôn Thượng Hương","CO Tiểu Kiều"];
const tactics = ["Dẫn Huyền Lực Chiến","Huyết Đao Tranh Giành","Đoạt Hồn Hiệp Phách","Đương Phong Thôi Quyết","Tam Thế Trận","Lâm Nguy Cứu Chủ","Mê Hoặc","Thuyền Cỏ Mượn Tên","Mau Giành Lợi Thế","Hổ Báo Kỵ"];
const ids: any[] = [];
for (const [kind, names] of [["hero", heroes], ["tactic", tactics]] as const) for (const n of names) {
  const r: any = await h.call("tqccl_search", { query: n, kinds: [kind] } as any);
  const it = r.items.find((x: any) => x.displayName === n) ?? r.items[0]; ids.push({ kind, id: it.entityId, n });
}
const norm: any = await h.call("tqccl_normalize_entities", { observations: ids.map((x, i) => ({ observationId: "o"+i, entityKind: x.kind, canonicalId: x.id, displayName: x.n, evidence: ev })) } as any);
const pb: any = await h.call("tqccl_get_playbook", { intent: "coexist" } as any);
const rec: any = await h.call("tqccl_recommend_teams", { expectedWorkflowVersion: norm.workflowVersion, canonicalState: norm.canonicalState, confirmationBinding: norm.confirmationBinding, sourceSeasonId: pb.seasonSelection.sourceSeasonId } as any);
console.log("portfolio", rec.portfolioTeams.map((t: any) => t.name));
console.log("omitted", rec.omittedCounts);

