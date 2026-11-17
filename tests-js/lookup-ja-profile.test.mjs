// Tra cứu bản ja: tên Nhật, dòng "原名", nhãn trạng thái tên, nhãn 機械翻訳 + mốc số liệu, dòng báo thiếu, giá trị đóng tiếng Nhật,
// tìm kiếm ja, meta/JSON-LD không dùng chữ dịch máy, bộ tra tên ja. Khi `ja` chưa có trong `SITE_LOCALES`, file tự chạy lại trong
// tiến trình con nạp `scripts/preview-locale-hook.mjs` (js/i18n.js có `ja`), nên test đo đúng hành vi của trang ja sắp bật.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { SITE_LOCALES, withLocale } from "../js/i18n.js";
import { previewLocaleNodeArgs } from "../scripts/preview-locale-hook.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

if (!SITE_LOCALES.includes("ja")) {
  test("hồ sơ Tra cứu bản ja (chạy lại với ja bật tạm qua preview-locale-hook)", () => {
    // Bỏ NODE_TEST_CONTEXT của bộ chạy cha: không thì `node --test` lồng nhau báo kết quả lên cha và luôn thoát 0.
    const { NODE_TEST_CONTEXT: _parent, ...env } = process.env;
    const result = spawnSync(process.execPath, [...previewLocaleNodeArgs(), "--experimental-strip-types", "--test", fileURLToPath(import.meta.url)], {
      cwd: ROOT, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
} else {
  await jaSuite();
}

async function jaSuite() {
  const { lookupDisplayName, lookupProfile, sourceMissingNote, zhSafeValue } = await import("../js/lookup-detail.js");
  const { buildLookupCorpus, searchLookupGroup, tacticTableRow } = await import("../js/unified-lookup.js");
  const { createProfileRenderer } = await import("../js/lookup-profile.js");
  const { masterDetailTree, masterTargetFor } = await import("../js/lookup-master.js");
  const { tacticEffectVersions } = await import("../js/lookup-tactic-view.js");
  const { treeToHtml } = await import("../js/view-tree.js");
  const { loadRawNameResolver, localName } = await import("../js/website-display.js");
  const { lookupBuildCorpus } = await import("../src/lib/lookup-pages.ts");
  const { lookupItemPage } = await import("../src/lib/lookup-item-pages.ts");

  const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
  const ja = json("data/lookup-ja.json");
  const corpus = await lookupBuildCorpus();
  const inJa = (run) => withLocale("ja", run);
  const pageHtml = (id, locale = "ja") => withLocale(locale, () => {
    const entry = corpus.byId.get(id);
    const { profilePageTree } = createProfileRenderer({ group: entry.group, openInPage: () => {}, onClose: () => {} });
    return treeToHtml(profilePageTree(corpus, id));
  });
  const TACTIC = "tactic:am-tang-huyen-co";

  test("hồ sơ chiến pháp ja: tên Nhật, tên gốc + trạng thái, bản dịch máy và nhãn tiếng Nhật", () => {
    const profile = inJa(() => lookupProfile(corpus, TACTIC));
    const entry = ja.entries[TACTIC];
    assert.equal(profile.titleVi, entry.name);
    assert.deepEqual([profile.name.original, profile.name.status, profile.name.label], [entry.nameOriginal, entry.nameStatus, "確認済み"]);
    assert.ok(profile.name.title.length > 0);
    assert.equal(profile.machineTranslated, true);
    assert.deepEqual(profile.untranslated, []);
    const effect = profile.fields.find((field) => field.key === "effect");
    assert.deepEqual([effect.labelVi, effect.textVi], ["効果", entry.texts.effect]);
  });

  test("trang riêng ja hiện 原名, nhãn trạng thái tên (có title), nhãn 機械翻訳 và dòng mốc số liệu; không lộ tên Việt", () => {
    const html = pageHtml(TACTIC);
    assert.match(html, /原名 <span lang="zh-Hant">暗藏玄機<\/span>/u);
    assert.match(html, /data-name-status="verified"[^>]*title="[^"]+"[^>]*>確認済み</u);
    assert.match(html, /data-machine-translated[^>]*><span class="lookup-version-tag">機械翻訳<\/span> 数値は中国大陸版に基づく/u);
    assert.doesNotMatch(html, /Ám Tàng Huyền Cơ|Hiệu ứng|Đang cập nhật/u);
    const derived = Object.keys(ja.entries).find((id) => id.startsWith("hero:") && ja.entries[id].nameStatus === "derived");
    assert.match(pageHtml(derived), /data-name-status="derived"[^>]*>字形変換</u);
  });

  test("khóa chưa có bản dịch: hồ sơ ghi khóa, bỏ trường và hiện dòng báo thiếu tiếng Nhật; không có bản dịch nào thì không có nhãn dịch máy", () => {
    const tactics = json("data/tactics.json");
    const record = tactics.find((row) => row.id === TACTIC);
    const entry = structuredClone(ja.entries[TACTIC]);
    entry.texts = {};
    const small = buildLookupCorpus({ tactics: [record], ja: { entries: { [TACTIC]: entry }, notice: ja.notice } });
    const profile = inJa(() => lookupProfile(small, TACTIC));
    assert.deepEqual(profile.untranslated, ["effect", ...(record.target ? ["target"] : [])]);
    assert.equal(profile.viOnly, true);
    assert.equal(profile.machineTranslated, false);
    assert.equal(profile.fields.find((field) => field.key === "effect"), undefined);
    const html = inJa(() => treeToHtml(createProfileRenderer({ group: "tactics", openInPage: () => {}, onClose: () => {} }).profilePageTree(small, TACTIC)));
    assert.ok(html.includes(inJa(() => sourceMissingNote())));
    assert.doesNotMatch(html, /機械翻訳/u);
  });

  test("giá trị đóng tiếng Việt dịch theo cột ja của cùng bảng với zh", () => {
    assert.equal(zhSafeValue("Ngô", "ja"), "呉");
    assert.equal(zhSafeValue("Ngô", "zh"), "吴");
    assert.equal(zhSafeValue("Thục / Ngô", "ja"), "蜀 / 呉");
    assert.equal(zhSafeValue(["Kỵ binh", "Thương binh"], "ja"), "騎兵、槍兵");
    assert.equal(zhSafeValue("Cao cấp", "ja"), "上級");
    assert.equal(zhSafeValue("chữ lạ", "ja"), null);
    assert.equal(zhSafeValue("Ngô", "vi"), "Ngô");
    const hero = Object.keys(ja.entries).find((id) => id.startsWith("hero:") && corpus.byId.get(id)?.record.faction === "Ngô");
    const faction = inJa(() => lookupProfile(corpus, hero)).fields.find((field) => field.key === "faction");
    assert.deepEqual([faction.labelVi, faction.textVi], ["陣営", "呉"]);
  });

  test("tên theo locale ở một chỗ: bản ja dùng tên Nhật theo ID, bản ghi chưa gắn lớp ja lùi về chữ Hán", () => {
    const entry = corpus.byId.get(TACTIC);
    assert.equal(lookupDisplayName(entry.record, entry.nameVi, "ja"), ja.entries[TACTIC].name);
    assert.equal(lookupDisplayName(entry.record, entry.nameVi, "zh"), entry.record.chinese);
    assert.equal(lookupDisplayName({ ...entry.record }, entry.nameVi, "ja"), entry.record.chinese);
    assert.equal(tacticTableRow(entry.record, "ja").effect, ja.entries[TACTIC].texts.effect);
  });

  test("lớp ja không đổi hồ sơ vi/zh của cùng mục", () => {
    const bare = buildLookupCorpus({ heroes: corpus.heroes, tactics: corpus.tactics, catalog: corpus.catalog });
    for (const id of [TACTIC, "hero:40y-lu-bo", "advisor:an-nhan-doat-quyen"]) {
      for (const locale of ["vi", "zh"]) {
        assert.deepEqual(withLocale(locale, () => lookupProfile(corpus, id)), withLocale(locale, () => lookupProfile(bare, id)), `${locale} ${id}`);
      }
    }
  });

  test("tìm kiếm ja khớp tên Nhật, chữ Hán nguồn và giản thể, không khớp chữ Việt", () => {
    const entry = corpus.byId.get(TACTIC);
    const ids = (query, locale) => searchLookupGroup(corpus, { group: "tactics", query, locale, pageSize: 500 }).items.map((item) => item.id);
    assert.equal(ids(ja.entries[TACTIC].name, "ja")[0], TACTIC);
    assert.ok(ids(entry.record.chinese, "ja").includes(TACTIC));
    assert.deepEqual(ids(entry.nameVi, "ja"), []);
    assert.ok(ids(entry.nameVi, "zh").includes(TACTIC));
    const prefixed = ja.prefixedTactics[0];
    assert.ok(ids(prefixed.name, "ja").includes(prefixed.baseId));
  });

  test("hiệu ứng nhiều phiên bản của bản dịch máy tách đúng nhãn phiên bản (gồm 初期版)", () => {
    const record = corpus.tactics.find((row) => (ja.entries[row.id]?.texts.effect ?? "").includes(" / 初期版 / "));
    assert.ok(record, "cần một chiến pháp nhiều phiên bản có bản dịch");
    const ja_ = inJa(() => tacticEffectVersions(record, "ja"));
    const zh = withLocale("zh", () => tacticEffectVersions(record, "zh"));
    assert.equal(ja_.length, zh.length);
    assert.equal(ja_.at(-1).label, "初期版");
  });

  test("panel chi tiết catalog ja: tên gốc, nhãn dịch máy, bảng cấp dịch máy", () => {
    const id = "building:bat-tran-do";
    const target = masterTargetFor(corpus, id);
    const html = inJa(() => treeToHtml(masterDetailTree("buildings", target.item, corpus, "ja", { targetId: id, page: true })));
    assert.match(html, /原名 <span lang="zh-Hant">八陣圖<\/span>/u);
    assert.match(html, /機械翻訳<\/span> 数値は中国大陸版に基づく/u);
    assert.ok(html.includes(ja.entries[id].texts["levels.0.effect"]));
    assert.match(html, /所要時間/u);
    const zh = withLocale("zh", () => treeToHtml(masterDetailTree("buildings", target.item, corpus, "zh", { targetId: id, page: true })));
    assert.doesNotMatch(zh, /機械翻訳|原名/u);
  });

  test("原名 gắn lang theo nameOriginalLang (tính lúc build): giản thể zh-Hans, phồn thể zh-Hant, không phân biệt được thì zh", () => {
    const original = (id, group) => {
      const target = masterTargetFor(corpus, id);
      return inJa(() => treeToHtml(masterDetailTree(group, target.item, corpus, "ja", { targetId: id, page: true })));
    };
    assert.equal(ja.entries["advisor:bach-ma-thay-chu"].nameOriginal, "白马替主");
    assert.match(original("advisor:bach-ma-thay-chu", "advisors"), /原名 <span lang="zh-Hans">白马替主<\/span>/u);
    assert.match(original("building:bat-tran-do", "buildings"), /原名 <span lang="zh-Hant">八陣圖<\/span>/u);
    const neutral = Object.entries(ja.entries).find(([id, entry]) => id.startsWith("advisor:") && entry.nameOriginalLang === "zh");
    assert.ok(neutral, "cần một quân sư có tên gốc không phân biệt được lối viết");
    assert.ok(original(neutral[0], "advisors").includes(`原名 <span lang="zh">${neutral[1].nameOriginal}</span>`));
  });

  test("meta và JSON-LD trang riêng ja chỉ dùng chữ không phải dịch máy; alternateName là tên chữ Hán gốc", async () => {
    const page = await lookupItemPage(TACTIC, "ja", "https://tqccl.com");
    const entry = ja.entries[TACTIC];
    assert.equal(page.name, entry.name);
    assert.match(page.title, /三國志 真戦 攻略手帳$/u);
    assert.ok(!page.description.includes(entry.texts.effect.slice(0, 12)), page.description);
    const main = page.structured[0];
    assert.equal(main.inLanguage, "ja");
    assert.equal(main.mainEntity.alternateName, entry.nameOriginal);
    assert.equal(main.mainEntity.description, page.description);
    assert.doesNotMatch(JSON.stringify(page.structured), /Ám Tàng|Tra cứu/u);
  });

  test("bộ tra tên của trang ja nạp lookup-ja theo pin và trả tên Nhật cho tên Việt của dữ liệu cũ", async () => {
    const files = Object.fromEntries(["data/lookup-ja.json", "data/lookup-manifest.json", "data/ja-kanji-variants.json", "data/heroes-dict.json", "data/tactics.json", "data/books-dict.json"]
      .map((path) => [path, new Uint8Array(readFileSync(new URL(`../${path}`, import.meta.url)))]));
    const pin = `sha256:${createHash("sha256").update(files["data/lookup-ja.json"]).digest("hex")}`;
    const resolver = await loadRawNameResolver(async (path) => files[path], "ja", { pin });
    const record = corpus.byId.get(TACTIC).record;
    assert.equal(localName(record.viet, resolver, "ja"), ja.entries[TACTIC].name);
    assert.equal(resolver.fromRaw("暗藏玄機"), "暗蔵玄機");
  });

  test("lớp ja lỗi (thiếu/lệch pin, lỗi mạng) thì bộ tra lùi về chữ Hán nguồn, không bao giờ trả tên Việt", async () => {
    const files = Object.fromEntries(["data/lookup-ja.json", "data/lookup-manifest.json", "data/ja-kanji-variants.json", "data/heroes-dict.json", "data/tactics.json", "data/books-dict.json"]
      .map((path) => [path, new Uint8Array(readFileSync(new URL(`../${path}`, import.meta.url)))]));
    const pin = `sha256:${createHash("sha256").update(files["data/lookup-ja.json"]).digest("hex")}`;
    // Bản Nhật gọi 固若金湯 là 金城湯池: tên Nhật chỉ có khi lớp ja nạp được; lùi về thì hiện chữ Hán nguồn (đã đổi tự dạng).
    const tactic = json("data/tactics.json").find((record) => record.id === "tactic:co-nhuoc-kim-thang");
    const hero = json("data/heroes-dict.json").find((record) => record.id === "hero:sp-tuan-uc");
    const offline = (broken) => async (path) => {
      if (broken.includes(path)) throw new TypeError("Failed to fetch");
      return files[path];
    };
    const cases = [
      ["thiếu pin", async (path) => files[path], null],
      ["lệch pin", async (path) => files[path], `sha256:${"0".repeat(64)}`],
      ["lỗi mạng lookup-ja.json", offline(["data/lookup-ja.json"]), pin],
      ["lỗi mạng lookup-manifest.json", offline(["data/lookup-manifest.json"]), pin],
    ];
    for (const [label, loader, casePin] of cases) {
      const resolver = await loadRawNameResolver(loader, "ja", { pin: casePin });
      assert.equal(localName(tactic.viet, resolver, "ja"), "固若金湯", label);
      assert.equal(localName(hero.viet, resolver, "ja"), "SP 荀彧", label);
      assert.equal(localName("Chuyển · Ám Tàng Huyền Cơ", resolver, "ja"), "転・暗蔵玄機", label);
      assert.equal(resolver.fromRaw("暗藏玄機"), "暗蔵玄機", label);
    }
    // Bảng tự dạng cũng không nạp được: vẫn là chữ Hán nguồn nguyên dạng, không phải tên Việt.
    const bare = await loadRawNameResolver(offline(["data/lookup-ja.json", "data/ja-kanji-variants.json"]), "ja", { pin });
    assert.equal(localName(json("data/tactics.json").find((record) => record.id === TACTIC).viet, bare, "ja"), "暗藏玄機");
    // Không có từ điển thì không có gì để tra: nơi gọi tự xử lý lỗi như trước.
    await assert.rejects(loadRawNameResolver(offline(["data/tactics.json"]), "ja", { pin }));
  });
}
