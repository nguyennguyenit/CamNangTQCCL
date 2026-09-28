// Tài liệu bundle Tra cứu tối thiểu nhưng hợp lệ trọn vẹn: mọi ID chéo (tướng ↔ chiến pháp ↔ quân sư ↔ trang bị)
// giải được, nên `validateLookupBundle` nhận nguyên bộ. Test nào cần lệch thì truyền `over`.

export function heroesDoc(over = []) {
  return [
    {
      id: "hero:luu-bi", chinese: "劉備", viet: "Lưu Bị", hanViet: "Lưu Bị", faction: "Thục", stars: 5, cost: "7",
      aliases: ["劉備", "刘备"], stats: { luc: "71", tri: "81", thong: "79", toc: "62", chinh: "92", mi: "95" },
      troopApt: { ky: "S", thuan: "S", cung: "A", thuong: "A", khiGioi: "B" },
      selfTacticCn: "仁德載世", inheritTacticCn: "", roleTag: "support", roleTagViet: "Phụ trợ",
      iconUrl: null, isSP: false, linkScore: null, pending: false,
      lookup: {
        selfTacticId: "tactic:nhan-duc", inheritTacticId: null, advisorId: "advisor:an-phuc-binh-tam",
        variant: "base", categoryVi: "Quân sự", exclusiveTitleVi: null,
        conditions: [], flags: { isCollectible: false, isDynamicOpen: false, isMusou: false, isCO: false, isSp: false },
        growth: { luc: 0.98, tri: 1.71, thong: null, toc: null, chinh: null, mi: null },
        otherAptitudes: { infantry: null, navy: null },
        civil: { roleVi: null, bonusVi: null, specialtyVi: null, tacticBonusVi: null },
        civilInnatePoints: null, collectibleBonusVi: null, redRulesVi: null,
        revisions: [], missingFields: [],
      },
    },
    ...over,
  ];
}

export function tacticsDoc(over = []) {
  return [
    {
      id: "tactic:nhan-duc", chinese: "仁德載世", viet: "Nhân Đức Tải Thế", hanViet: "Nhân Đức Tải Thế",
      aliases: [], type: "Bị động", quality: "S", effect: "戰鬥中", effectViet: "Trong trận đấu",
      target: "友軍", targetViet: "Quân ta", troopFit: [], source: null, sourceHeroCn: null,
      iconUrl: null, linkScore: null, pending: false,
      lookup: {
        activationRate: 1, cooldown: null, maxUsers: 1, pointCost: null,
        effectTypeVi: null, exchangeConditionVi: null, acquiredFromVi: [], conflictsVi: null,
        conditions: [], revisions: [], inheritedFromIds: [], missingFields: [],
      },
    },
    ...over,
  ];
}

export function catalogDoc(over = {}) {
  return {
    schemaVersion: 1,
    equipment: [{ id: "equipment:y-thien-kiem", nameVi: "Ỷ Thiên Kiếm", slotVi: "Vũ khí", qualityVi: "Cam", aliasesVi: [], aliasesZh: ["倚天劍"], conditions: [], missingFields: [] }],
    specials: [
      { id: "equipment-special:gian-hung", nameVi: "Gian Hùng", equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: "hero:luu-bi", slotVi: "Vũ khí", tierVi: "T0", descriptionVi: "Mô tả", acquisitionVi: ["Rèn"], aliasesVi: [], aliasesZh: ["奸雄"], conditions: [], missingFields: [] },
      { id: "equipment-special:mo-coi", nameVi: "Mồ Côi", equipmentId: null, exclusiveHeroId: null, slotVi: "Vũ khí", tierVi: "T1", descriptionVi: "Chưa rõ trang bị cha", acquisitionVi: [], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [] },
    ],
    advisors: [{ id: "advisor:an-phuc-binh-tam", nameVi: "An Phủ Bình Tâm", elementVi: "Phong", heroIds: ["hero:luu-bi"], effectVi: "Hiệu ứng", tacticPoints: 3, usageVi: "Dùng", aliasesVi: [], aliasesZh: ["恩服兵心"], conditions: [], missingFields: [] }],
    troopMods: [{
      id: "troop-mod:dan-duong-binh", nameVi: "Đan Dương Binh", appliesToVi: "Thuẫn binh", effectVi: "Hiệu ứng",
      options: [{ id: "troop-option:dan-duong-binh:a", nameVi: "Xoay", convertsToVi: "Thương binh", descriptionVi: "Mô tả", tierVi: "Đặc biệt" }],
      revisions: [{ effectiveDate: "2024-08-28", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nội dung" }],
      suggestedBuildVi: "Gợi ý", troopLimitVi: [], aliasesVi: [], aliasesZh: ["丹陽兵"], conditions: [], missingFields: [],
    }],
    buildings: [{
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: "Tóm tắt", mainCityOnly: false, maxLevel: 1,
      levels: [{ id: "building-level:bat-tran-do:1", level: 1, effectVi: "Hiệu ứng", durationVi: "2 giờ", costs: { wood: 32000, stone: 32000, iron: 16000 } }],
      aliasesVi: [], aliasesZh: ["八陣圖"], conditions: [], missingFields: [],
    }],
    ...over,
  };
}
