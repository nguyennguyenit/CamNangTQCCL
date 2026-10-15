/**
 * Allowlist các field nguồn của đội mà website thật sự render (`js/render.js`:
 * khaihoangGuide/khaihoangRatings/khaihoangBuildContent, trang đội khác). Builder dùng để dựng
 * artifact, handler dùng lại ở biên output: field lạ của nguồn không bao giờ đi tiếp.
 * Hàm idempotent và chỉ giữ giá trị đúng kiểu.
 */

type Raw = Record<string, unknown>;

function rec(value: unknown): Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : {};
}
function recs(value: unknown): Raw[] {
  return Array.isArray(value) ? value.map(rec) : [];
}
function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function strs(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
function pick<T extends Raw>(source: Raw, shape: { [K in keyof T]: (value: unknown) => T[K] | undefined }): T {
  const out: Raw = {};
  for (const key of Object.keys(shape)) {
    const value = (shape as Record<string, (value: unknown) => unknown>)[key]!(source[key]);
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

const GUIDE_RATING_KEYS = ["overall", "land4", "land5", "land6", "land7to8", "transition"] as const;

export interface GuideDefender {
  hero?: string;
  unitType?: string;
}

export function allowGuide(raw: unknown): Raw {
  const guide = rec(raw);
  const out: Raw = {};
  const overview = str(guide.overview);
  if (overview !== undefined) out.overview = overview;
  const ratings = rec(guide.ratings);
  const ratingOut: Raw = {};
  for (const key of GUIDE_RATING_KEYS) {
    const value = num(ratings[key]);
    if (value !== undefined) ratingOut[key] = value;
  }
  if (Object.keys(ratingOut).length > 0) out.ratings = ratingOut;
  if (Array.isArray(guide.redRequirements)) {
    out.redRequirements = recs(guide.redRequirements).map((item) => pick(item, { hero: str, minimum: num, recommended: num, note: str }));
  }
  const defenders = rec(guide.defenders);
  if (Object.keys(defenders).length > 0) {
    const row = (item: Raw) => pick(item, { hero: str, unitType: str });
    out.defenders = {
      ...(Array.isArray(defenders.land4) ? { land4: recs(defenders.land4).map(row) } : {}),
      ...(Array.isArray(defenders.land5) ? { land5: recs(defenders.land5).map(row) } : {}),
      ...(str(defenders.warning) === undefined ? {} : { warning: str(defenders.warning) }),
    };
  }
  const split = rec(guide.splitTeams);
  if (Object.keys(split).length > 0) {
    out.splitTeams = {
      ...(Array.isArray(split.teams)
        ? {
            teams: recs(split.teams).map((team) => ({
              ...pick(team, { target: str, note: str }),
              ...(Array.isArray(team.heroes)
                ? {
                    heroes: recs(team.heroes).map((hero) => ({
                      ...pick(hero, { name: str }),
                      ...(Array.isArray(hero.tactics) ? { tactics: strs(hero.tactics) } : {}),
                    })),
                  }
                : {}),
            })),
          }
        : {}),
      ...(str(split.note) === undefined ? {} : { note: str(split.note) }),
    };
  }
  if (Array.isArray(guide.transitions)) {
    out.transitions = recs(guide.transitions).map((item) => ({
      ...pick(item, { target: str, note: str }),
      ...(Array.isArray(item.steps)
        ? {
            steps: recs(item.steps).map((step) => ({
              ...pick(step, { mainCityLevel: num, commandCost: num, timing: str, note: str }),
              ...(Array.isArray(step.trainHeroes) ? { trainHeroes: strs(step.trainHeroes) } : {}),
            })),
          }
        : {}),
    }));
  }
  return out;
}

/** Hero của build Khai hoang (team hoặc variant). */
export function allowKhaiHoangHero(raw: unknown): Raw {
  const hero = rec(raw);
  return {
    ...pick(hero, { name: str, note: str, buildNote: str, openingNote: str, tacticBefore: str, unitTypeBefore: str, unitTypeAfter: str }),
    ...(Array.isArray(hero.tacticsAfter) ? { tacticsAfter: strs(hero.tacticsAfter) } : {}),
    ...(Array.isArray(hero.tactics) ? { tactics: strs(hero.tactics) } : {}),
  };
}

export function allowKhaiHoangVariant(raw: unknown): Raw {
  const variant = rec(raw);
  return {
    ...pick(variant, {
      id: str,
      label: str,
      displayLabel: str,
      period: str,
      region: str,
      commanderBefore: str,
      commanderAfter: str,
      buildNote: str,
      note: str,
      openingNote: str,
      unitType: str,
    }),
    heroes: recs(variant.heroes).map(allowKhaiHoangHero),
  };
}

export function allowKhaiHoangTeam(raw: unknown): Raw {
  const team = rec(raw);
  const guide = allowGuide(team.guide);
  return {
    ...pick(team, {
      id: str,
      title: str,
      period: str,
      region: str,
      commanderBefore: str,
      commanderAfter: str,
      context: str,
      buildNote: str,
      note: str,
      openingNote: str,
      unitType: str,
    }),
    heroes: recs(team.heroes).map(allowKhaiHoangHero),
    ...(Array.isArray(team.variants) ? { variants: recs(team.variants).map(allowKhaiHoangVariant) } : {}),
    ...(Object.keys(guide).length === 0 ? {} : { guide }),
  };
}

/** Xếp hạng lịch sử của biến thể đội khác / team-tier. */
export function allowTierRanking(raw: unknown): { id?: string; tier?: string; updatedAt?: string } {
  return pick(rec(raw), { id: str, tier: str, updatedAt: str });
}

/** Holder của biến thể đội khác: chỉ các field trang đội đọc. */
export function allowOtherHolder(raw: unknown): Raw {
  const holder = rec(raw);
  return {
    ...pick(holder, { displayNameVi: str, nameRaw: str, statFocusRaw: str, notesRaw: str, faction: str, heroIdentityId: str }),
    ...(Array.isArray(holder.tacticSlotsRaw) ? { tacticSlotsRaw: holder.tacticSlotsRaw } : {}),
    ...(Array.isArray(holder.bookSlotsRaw) ? { bookSlotsRaw: holder.bookSlotsRaw } : {}),
    ...(Array.isArray(holder.tacticIdentityIds) ? { tacticIdentityIds: holder.tacticIdentityIds } : {}),
  };
}
