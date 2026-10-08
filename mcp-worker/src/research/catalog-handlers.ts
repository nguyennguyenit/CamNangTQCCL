import { z } from "zod";

import { normalizeText } from "../../../js/filters.js";
import type { CatalogEntityView, CatalogKind, LocalePaths } from "../data/publication-projection.js";
import { decodeCursor, encodeCursor, type CursorBinding } from "./cursor.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "./handler-error.js";
import { fitPage } from "./page.js";
import { commonResultSchema, decimalNumberish, jsonArrayish, workflowVersion } from "./shared-schemas.js";
import { publicVariantId, referenceSelectorSchema } from "./team-handlers.js";
import { parseToolInput, type ToolContext } from "./tool-context.js";

export const SEARCH_KINDS = ["hero", "tactic", "equipment", "advisor", "troopMod", "building", "book", "team"] as const;
type SearchKindName = (typeof SEARCH_KINDS)[number];
type Locale = "vi" | "zh";

const PUBLIC_KIND: Record<CatalogKind, Exclude<SearchKindName, "team">> = {
  hero: "hero",
  tactic: "tactic",
  equipment: "equipment",
  "equipment-special": "equipment",
  advisor: "advisor",
  "troop-mod": "troopMod",
  building: "building",
  book: "book",
};
const CATALOG_KINDS_FOR: Record<Exclude<SearchKindName, "team">, CatalogKind[]> = {
  hero: ["hero"],
  tactic: ["tactic"],
  equipment: ["equipment", "equipment-special"],
  advisor: ["advisor"],
  troopMod: ["troop-mod"],
  building: ["building"],
  book: ["book"],
};

const locale = z.enum(["vi", "zh"]).optional().describe("vi (mặc định) hoặc zh; chỉ đổi tên hiển thị và pagePath.");
const cursorText = z.string().max(2_048).optional().describe("Cursor trang trước; bắt buộc kèm expectedWorkflowVersion.");
const nullableText = z.string().max(2_048).nullable().optional();

export const searchInputSchema = z
  .object({
    query: z.string().max(256).describe("Tên Việt/Hán/Hán-Việt/alias; chuỗi rỗng để duyệt."),
    kinds: jsonArrayish(z.array(z.enum(SEARCH_KINDS)).max(8).optional()).describe("Loại cần tìm; bỏ trống = tất cả."),
    limit: decimalNumberish(z.number().int().min(1).max(50).optional()).describe("Số kết quả mỗi trang, mặc định 20."),
    cursor: cursorText,
    locale,
    expectedWorkflowVersion: workflowVersion.optional(),
  })
  .strict();

export const searchOutputSchema = commonResultSchema.extend({
  locale: z.enum(["vi", "zh"]).describe("Locale đã dùng cho tên và pagePath."),
  total: z.number().int().nonnegative().describe("Tổng số kết quả khớp."),
  items: z
    .array(
      z
        .object({
          entityId: z.string().max(300).describe("ID thực thể, hoặc ref đội <collection>:<id>."),
          kind: z.enum(SEARCH_KINDS).describe("Loại kết quả; equipment gồm cả đặc tính trang bị."),
          displayName: z.string().max(256).describe("Tên hiển thị theo locale."),
          matchedTerm: z.string().max(256).optional().describe("Chuỗi khớp truy vấn; vắng khi duyệt."),
          pagePath: z.string().max(512).optional().describe("Đường dẫn trang website theo locale."),
          collection: z.enum(["recommended", "other", "khaihoang", "engine"]).optional().describe("Họ đội (kind=team)."),
          reference: referenceSelectorSchema.optional().describe("Selector cho tqccl_get_team (kind=team)."),
        })
        .strict(),
    )
    .max(50)
    .describe("Kết quả của trang hiện tại."),
});

export async function handleSearch(ctx: ToolContext, rawInput: unknown) {
  const input = parseToolInput(searchInputSchema, rawInput);
  const loc: Locale = input.locale ?? "vi";
  const limit = input.limit ?? 20;
  const query = input.query.trim();
  const kinds = input.kinds === undefined || input.kinds.length === 0 ? [...SEARCH_KINDS] : [...new Set(input.kinds)];
  if (input.cursor === undefined) ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion);
  else ctx.requireExpectedWorkflow(input.expectedWorkflowVersion);
  const pub = ctx.publication();
  const binding: CursorBinding = {
    tool: "tqccl_search",
    locale: loc,
    workflowVersion: ctx.workflowVersion,
    filter: { query: normalizeText(query), kinds: [...kinds].sort() },
  };
  const offset = input.cursor === undefined ? 0 : await decodeCursor(input.cursor, binding);

  const catalogKinds = kinds.filter((kind): kind is Exclude<SearchKindName, "team"> => kind !== "team").flatMap((kind) => CATALOG_KINDS_FOR[kind]);
  const wantTeams = kinds.includes("team");
  const catalogTotal = catalogKinds.length === 0 ? 0 : pub.searchCatalog(query, { kinds: catalogKinds, limit: 1 }).total;
  const teamViews: Array<{ ref: string; name: string; reference: z.infer<typeof referenceSelectorSchema>; collection: "recommended" | "other" | "khaihoang" | "engine"; path?: string; matchedTerm?: string }> = [];
  if (wantTeams) {
    for (let page = 0; ; page += 100) {
      const found = pub.findTeams({ query, limit: 100, offset: page });
      for (const view of found.items) {
        teamViews.push({
          ref: view.ref,
          name: loc === "zh" ? (view.nameZh ?? view.nameVi) : view.nameVi,
          collection: view.collection,
          reference:
            view.collection === "recommended" ? { collection: "recommended", sourceConfigId: view.id }
            : view.collection === "khaihoang" ? { collection: "khaihoang", khaiHoangTeamId: view.id }
            : { collection: "other", legacyTeamId: view.id, legacyVariantId: await variantOf(ctx, view.ref) },
          path: view.pagePath[loc],
        });
      }
      if (page + 100 >= found.total || found.items.length === 0) break;
    }
    const needle = normalizeText(query);
    const engine: Array<{ score: number; order: number; entry: (typeof teamViews)[number] }> = [];
    ctx.snapshot.artifacts.teams.forEach((team, order) => {
      const terms = [team.id, team.name, team.nickname, team.source].filter((value): value is string => typeof value === "string");
      let score = needle === "" ? 0 : -1;
      let matchedTerm: string | undefined;
      if (needle !== "") {
        for (const term of terms) {
          const normalized = normalizeText(term);
          const value = normalized === needle ? 3 : normalized.startsWith(needle) ? 2 : normalized.includes(needle) ? 1 : -1;
          if (value > score) {
            score = value;
            matchedTerm = term.trim().slice(0, 256);
          }
        }
      }
      if (score < 0) return;
      const id = String(team.id);
      engine.push({ score, order, entry: { ref: `engine:${id}`, name: String(team.name), collection: "engine", reference: { collection: "engine", teamId: id }, ...(matchedTerm === undefined ? {} : { matchedTerm }) } });
    });
    engine.sort((a, b) => b.score - a.score || a.order - b.order);
    teamViews.push(...engine.map((entry) => entry.entry));
  }
  const total = catalogTotal + teamViews.length;

  const items: Array<z.infer<typeof searchOutputSchema>["items"][number]> = [];
  if (offset < catalogTotal) {
    const page = pub.searchCatalog(query, { kinds: catalogKinds, limit: Math.min(limit, catalogTotal - offset), offset });
    for (const match of page.items) items.push(catalogItem(match.entity, loc, match.matchedTerm));
  }
  const teamStart = Math.max(offset - catalogTotal, 0);
  for (const team of teamViews.slice(teamStart, teamStart + (limit - items.length))) {
    items.push({
      entityId: team.ref,
      kind: "team",
      displayName: team.name,
      collection: team.collection,
      reference: team.reference,
      ...(team.matchedTerm === undefined ? {} : { matchedTerm: team.matchedTerm }),
      ...(team.path === undefined ? {} : { pagePath: team.path }),
    });
  }
  const next = offset + items.length;
  const hasMore = next < total;
  const provenance = [
    ...(catalogKinds.length > 0 ? [{ artifact: "catalog-entities", trust: "untrusted" as const }] : []),
    ...(wantTeams ? [{ artifact: "reference-team-index", trust: "untrusted" as const }, { artifact: "teams", trust: "untrusted" as const }] : []),
  ];
  return {
    ...ctx.commonResult(provenance),
    locale: loc,
    total,
    items,
    truncated: hasMore,
    ...(hasMore ? { nextCursor: await encodeCursor(binding, next) } : {}),
  };
}

async function variantOf(ctx: ToolContext, ref: string): Promise<string> {
  const detail = ctx.publication().getTeam(ref) as { variants?: Array<{ variantId?: string }> } | undefined;
  return publicVariantId(detail?.variants?.[0]?.variantId ?? "");
}

function displayName(entity: CatalogEntityView, loc: Locale): string {
  return loc === "zh" ? (entity.nameZh ?? entity.nameVi) : entity.nameVi;
}

function catalogItem(entity: CatalogEntityView, loc: Locale, matchedTerm: string) {
  return {
    entityId: entity.id,
    kind: PUBLIC_KIND[entity.kind],
    displayName: displayName(entity, loc),
    ...(matchedTerm === "" ? {} : { matchedTerm }),
    pagePath: entity.pagePath[loc],
  };
}

// -------------------------------------------------------------------------------------------
// get_entity
// -------------------------------------------------------------------------------------------

export const ENTITY_SECTIONS = ["overview", "specials", "options", "levels", "revisions"] as const;
type EntitySection = (typeof ENTITY_SECTIONS)[number];

/** Section lồng nhau: tên → khoá trong `profile`. */
const NESTED: Record<Exclude<EntitySection, "overview">, string> = {
  specials: "specialIds",
  options: "options",
  levels: "levels",
  revisions: "revisions",
};

export const getEntityInputSchema = z
  .object({
    entityId: z.string().min(1).max(256).describe("ID từ tqccl_search, ví dụ hero:..., equipment:..."),
    section: z.enum(ENTITY_SECTIONS).optional().describe("overview (mặc định) hoặc section lồng nhau có phân trang."),
    limit: decimalNumberish(z.number().int().min(1).max(50).optional()).describe("Số mục mỗi trang của section, mặc định 20."),
    cursor: cursorText,
    locale,
    expectedWorkflowVersion: workflowVersion.optional(),
  })
  .strict();

export const getEntityOutputSchema = commonResultSchema.extend({
  locale: z.enum(["vi", "zh"]).describe("Locale đã dùng cho tên và pagePath."),
  section: z.enum(ENTITY_SECTIONS).describe("Section đã trả về."),
  entity: z
    .object({
      entityId: z.string().max(300).describe("ID thực thể."),
      kind: z.enum(SEARCH_KINDS).describe("Loại thực thể."),
      group: z.string().max(64).describe("Nhóm Tra cứu: heroes, tactics, equipment, advisors, troop-mods, buildings, books."),
      displayName: z.string().max(256).describe("Tên hiển thị theo locale."),
      nameVi: z.string().max(256).describe("Tên tiếng Việt."),
      nameZh: z.string().max(2_048).nullable().optional().describe("Tên tiếng Hán nếu có."),
      hanViet: z.string().max(2_048).nullable().optional().describe("Âm Hán-Việt nếu có."),
      aliases: z.array(z.string().max(256)).max(100).describe("Tên khác và alias."),
      pagePath: z.string().max(512).describe("Trang /tra-cuu/<nhóm>/ theo locale."),
    })
    .strict()
    .describe("Thông tin nhận dạng thực thể."),
  profile: z.record(z.string(), z.unknown()).optional().describe("Trường hồ sơ như trang Tra cứu; phần lồng nhau nằm trong sections."),
  sections: z
    .array(z.object({ name: z.enum(ENTITY_SECTIONS).describe("Tên section."), total: z.number().int().positive().describe("Số mục của section.") }).strict())
    .max(4)
    .optional()
    .describe("Section lồng nhau có dữ liệu, đọc bằng tham số section."),
  omittedCounts: z.record(z.string(), z.number().int().nonnegative()).optional().describe("Số mục lồng nhau không nằm trong overview."),
  total: z.number().int().nonnegative().optional().describe("Tổng mục của section phân trang."),
  items: z.array(z.record(z.string(), z.unknown())).max(50).optional().describe("Mục của trang hiện tại (section lồng nhau)."),
});

function pathsOf(paths: LocalePaths, loc: Locale): string {
  return paths[loc];
}

export async function handleGetEntity(ctx: ToolContext, rawInput: unknown) {
  const input = parseToolInput(getEntityInputSchema, rawInput);
  const loc: Locale = input.locale ?? "vi";
  const section: EntitySection = input.section ?? "overview";
  const limit = input.limit ?? 20;
  if (input.cursor === undefined) ctx.ensureExpectedWorkflow(input.expectedWorkflowVersion);
  else ctx.requireExpectedWorkflow(input.expectedWorkflowVersion);
  const pub = ctx.publication();

  if (section === "overview" && input.cursor !== undefined) {
    throw new ResearchHandlerError("CURSOR_INVALID", PUBLIC_ERRORS.CURSOR_INVALID.message);
  }
  const entity = pub.getEntity(input.entityId);
  if (!entity) throw new ResearchHandlerError("ENTITY_NOT_FOUND", PUBLIC_ERRORS.ENTITY_NOT_FOUND.message);

  const header = {
    entityId: entity.id,
    kind: PUBLIC_KIND[entity.kind],
    group: entity.group,
    displayName: displayName(entity, loc),
    nameVi: entity.nameVi,
    nameZh: entity.nameZh,
    hanViet: entity.hanViet,
    aliases: [...entity.aliases],
    pagePath: pathsOf(entity.pagePath, loc),
  };
  const base = { ...ctx.commonResult([{ artifact: "catalog-entities", recordId: entity.id, trust: "untrusted" }]), locale: loc, section, entity: header };

  const totals = (Object.entries(NESTED) as Array<[Exclude<EntitySection, "overview">, string]>).flatMap(([name, key]) => {
    const value = entity.profile[key];
    return Array.isArray(value) && value.length > 0 ? [{ name, total: value.length }] : [];
  });

  if (section === "overview") {
    const nestedKeys = new Set(totals.map((entry) => NESTED[entry.name]));
    const profile = Object.fromEntries(Object.entries(entity.profile).filter(([key]) => !nestedKeys.has(key)));
    return {
      ...base,
      profile,
      ...(totals.length === 0 ? {} : { sections: totals, omittedCounts: Object.fromEntries(totals.map((entry) => [entry.name, entry.total])) }),
    };
  }

  const available = totals.find((entry) => entry.name === section);
  if (!available) throw new ResearchHandlerError("INVALID_REQUEST", `${PUBLIC_ERRORS.INVALID_REQUEST.message} Trường sai: section.`, false, ["section"]);
  const raw = entity.profile[NESTED[section]] as unknown[];
  const rows: Array<Record<string, unknown>> =
    section === "specials"
      ? raw.map((id) => {
          const special = pub.getEntity(String(id));
          return special
            ? { entityId: special.id, displayName: displayName(special, loc), pagePath: pathsOf(special.pagePath, loc), ...special.profile }
            : { entityId: String(id) };
        })
      : raw.map((row) => (typeof row === "object" && row !== null ? (row as Record<string, unknown>) : { value: row }));

  const binding: CursorBinding = {
    tool: "tqccl_get_entity",
    locale: loc,
    workflowVersion: ctx.workflowVersion,
    filter: { entityId: entity.id, section },
  };
  const offset = input.cursor === undefined ? 0 : await decodeCursor(input.cursor, binding);
  const { page, nextOffset } = fitPage(rows, offset, limit, (slice) => ({ ...base, total: rows.length, items: slice }));
  return {
    ...base,
    total: rows.length,
    items: page,
    truncated: nextOffset !== null,
    ...(nextOffset === null ? {} : { nextCursor: await encodeCursor(binding, nextOffset) }),
  };
}
