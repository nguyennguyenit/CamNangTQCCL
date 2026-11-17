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
        variant: "base", categoryVi: "Quân sự", exclusiveTitleVi: null, exclusiveTitleZh: null,
        conditions: [], flags: { isCollectible: false, isDynamicOpen: false, isMusou: false, isCO: false, isSp: false },
        growth: { luc: 0.98, tri: 1.71, thong: null, toc: null, chinh: null, mi: null },
        otherAptitudes: { infantry: null, navy: null },
        civil: { roleVi: null, bonusVi: null, specialtyVi: null, tacticBonusVi: null },
        civilInnatePoints: null, collectibleBonusVi: null, redRulesVi: null,
        usageVi: "Bắt buộc giữ 1 thẻ.", usageZh: "必留一個",
        cardPacks: [{ packVi: "Danh tướng", packZh: "名將", categoryVi: "Gói Danh tướng", categoryZh: "名將卡包", isCore: true, coreRate: 0.34, nonCoreRate: 0.66 }],
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
        conditions: [], revisions: [], inheritedFromIds: [], formerIds: [], missingFields: [], effectZhSource: null,
      },
    },
    ...over,
  ];
}

/** Điều kiện mùa của mọi hàng kỳ lược (`lookup.conditions` kind `season` kèm `textZh`, theo hợp đồng catalog). */
export const QILUE_SEASON = Object.freeze([{ kind: "season", textVi: "Mùa Hán Diễm Trường Minh (PK-S27, client 24.547)", textZh: "漢焰長明賽季（PK-S27，客戶端 24.547）" }]);

const qilueStrategy = (slug, nameVi, nameZh, cardTypes, over = {}) => ({
  id: `qilue-strategy:${slug}`, nameVi, aliasesVi: [], nameZh, aliasesZh: [nameZh], conditions: QILUE_SEASON.map((row) => ({ ...row })),
  missingFields: [], cardTypes, descriptionVi: `Mô tả ${nameVi}`, buffVi: `Mỗi trang bị 1 Kỳ Lược, buff ${nameVi}`,
  descriptionZh: `${nameZh}說明`, buffZh: `${nameZh}加成`, zhSource: { kind: "translation" }, ...over,
});

const qilueCard = (slug, nameVi, nameZh, type, rarity, targetVi, effectVi, effectZh) => ({
  id: `qilue-card:${slug}`, nameVi, aliasesVi: [], nameZh, aliasesZh: [nameZh], conditions: QILUE_SEASON.map((row) => ({ ...row })),
  missingFields: [], type, rarity, targetVi, effectVi, effectZh, zhSource: { kind: "translation" },
});

/** Phương lược theo hợp đồng (`qilueStrategies[]`, sắp theo `id`): tên client, `aliasesZh == [nameZh]`. */
export function qilueStrategiesDoc() {
  return [
    qilueStrategy("cuong-cong", "Cường Công", "強攻", ["dung", "phu"]),
    qilueStrategy("muu-tinh", "Mưu tính", "謀算", ["muu", "phu"], { aliasesVi: ["Mưu Toán"] }),
    qilueStrategy("quay-nhieu", "Quấy nhiễu", "襲擾", ["muu", "sach"], { aliasesVi: ["Tập Kích"] }),
  ];
}

/** Thẻ kỳ lược theo hợp đồng (`qilueCards[]`, sắp theo `id`); chữ hiệu ứng lấy từ client 24.547. */
export function qilueCardsDoc() {
  return [
    qilueCard("am-do-tran-thuong", "Ám Độ Trần Thương", "暗度陳倉", "muu", "common", "Nhóm quân ta", "Khi thi triển Chiến Pháp chuẩn bị hiệp này có 50% xác suất bỏ qua chuẩn bị", "本回合施放準備戰法時，有 50% 機率跳過準備"),
    qilueCard("bo-tri-thap-dien", "Bố Trí Thập Diện", "設伏十面", "muu", "common", "Nhóm quân ta", "Hiệp này Chiến Pháp Chủ Động tỉ lệ phát động tăng 10%", "本回合主動戰法發動率提升 10%"),
    qilueCard("cang-nhieu-cang-tot", "Càng Nhiều Càng Tốt", "多多益善", "muu", "rare", "Toàn quân ta", "Hiệu ứng hiếm Mưu", "稀有謀效果"),
    qilueCard("chi-khi-ngap-tran", "Chí Khí Ngập Tràn", "壯志不絕", "dung", "rare", "Một quân ta", "Hiệu ứng hiếm Dũng", "稀有勇效果"),
    qilueCard("cong-lao-hien-hach", "Công Lao Hiển Hách", "居功至偉", "sach", "rare", "Toàn quân địch", "Hiệu ứng hiếm Sách", "稀有策效果"),
    qilueCard("bac-lang-chuy-tan", "Bác Lãng Chuy Tần", "博浪椎秦", "phu", "common", "Toàn quân ta", "Tăng 20% Phá Trận", "破陣提升 20%"),
    qilueCard("an-tich-mang-thuong", "Ẩn Tích Mang Thương", "芒碭隱蹤", "te", "common", "Một quân địch", "Giảm 8% ST phải chịu hiệp này", "本回合受到的傷害降低 8%"),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function catalogDoc(over = {}) {
  return {
    schemaVersion: 1,
    equipment: [{ id: "equipment:y-thien-kiem", nameVi: "Ỷ Thiên Kiếm", slotVi: "Vũ khí", qualityVi: "Cam", aliasesVi: [], aliasesZh: ["倚天劍"], conditions: [], missingFields: [] }],
    specials: [
      { id: "equipment-special:gian-hung", nameVi: "Gian Hùng", equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: "hero:luu-bi", slotVi: "Vũ khí", tierVi: "T0", descriptionVi: "Mô tả", acquisitionVi: ["Rèn"], aliasesVi: [], aliasesZh: ["奸雄"], conditions: [], missingFields: [] },
      { id: "equipment-special:mo-coi", nameVi: "Mồ Côi", equipmentId: null, exclusiveHeroId: null, slotVi: "Vũ khí", tierVi: "T1", descriptionVi: "Chưa rõ trang bị cha", acquisitionVi: [], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [] },
    ],
    advisors: [{ id: "advisor:an-phuc-binh-tam", nameVi: "An Phủ Bình Tâm", elementVi: "Phong", heroIds: ["hero:luu-bi"], effectVi: "Hiệu ứng", tacticPoints: 3, usageVi: "Dùng", nameZh: null, effectZh: "效果", usageZh: null, zhSource: { kind: "source" }, aliasesVi: [], aliasesZh: ["恩服兵心"], conditions: [], missingFields: [] }],
    troopMods: [{
      id: "troop-mod:dan-duong-binh", nameVi: "Đan Dương Binh", appliesToVi: "Thuẫn binh", effectVi: "Hiệu ứng",
      effectZh: null, appliesToZh: null, suggestedBuildZh: null, zhSource: null,
      options: [{ id: "troop-option:dan-duong-binh:a", nameVi: "Xoay", convertsToVi: "Thương binh", descriptionVi: "Mô tả", tierVi: "Đặc biệt", nameZh: "轉·持槍", descriptionZh: null, zhSource: { kind: "translation" } }],
      revisions: [{ effectiveDate: "2024-08-28", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nội dung" }],
      suggestedBuildVi: "Gợi ý", troopLimitVi: [], aliasesVi: [], aliasesZh: ["丹陽兵"], conditions: [], missingFields: [],
    }],
    buildings: [{
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: "Tóm tắt", summaryZh: null, zhSource: null, mainCityOnly: false, maxLevel: 1,
      levels: [{ id: "building-level:bat-tran-do:1", level: 1, effectVi: "Hiệu ứng", durationVi: "2 giờ", effectZh: null, durationZh: null, costs: { wood: 32000, stone: 32000, iron: 16000 } }],
      aliasesVi: [], aliasesZh: ["八陣圖"], conditions: [], missingFields: [],
    }],
    qilueStrategies: qilueStrategiesDoc(),
    qilueCards: qilueCardsDoc(),
    ...over,
  };
}
