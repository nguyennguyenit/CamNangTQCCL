// Token API cá nhân trên trang Theo dõi chiêu mộ: tạo (token thô hiện đúng một lần), liệt kê, thu hồi.
// Tool ngoài trình duyệt (vd. tqkh) dùng token gọi `POST /api/recruit/pulls` để ghi lượt quay gói Danh tướng PK.

import { el } from "./render.js";
import { L, LOCALE_INTL, currentLocale } from "./i18n.js";
import { api as defaultApi, describeError } from "./community-api.js";

const ENDPOINT = "/api/tokens";
/** Hạn chọn khi tạo (ngày); "" = không hạn. Khớp API_TOKEN_TTL_DAYS của community-worker. */
export const TOKEN_TTL_OPTIONS = [
  { value: "30", label: () => L("30 ngày", "30 天", "30 日") },
  { value: "90", label: () => L("90 ngày", "90 天", "90 日") },
  { value: "365", label: () => L("365 ngày", "365 天", "365 日") },
  { value: "", label: () => L("Không hạn", "永不过期", "無期限") },
];
const DEFAULT_TTL = "90";
const NAME_MAX = 40;

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(LOCALE_INTL[currentLocale()], { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Dòng hiển thị của một token: trạng thái (còn hiệu lực / hết hạn / đã thu hồi) và lần dùng cuối. */
export function tokenRowView(item, now = Date.now()) {
  let status = "active";
  if (item.revokedAt !== null) status = "revoked";
  else if (item.expiresAt !== null && item.expiresAt <= now) status = "expired";
  let statusText;
  if (status === "revoked") statusText = L(`Đã thu hồi ${formatDate(item.revokedAt)}`, `已于 ${formatDate(item.revokedAt)} 撤销`, `${formatDate(item.revokedAt)} に無効化済み`);
  else if (status === "expired") statusText = L(`Hết hạn ${formatDate(item.expiresAt)}`, `已于 ${formatDate(item.expiresAt)} 过期`, `${formatDate(item.expiresAt)} に期限切れ`);
  else if (item.expiresAt === null) statusText = L("Không hạn", "永不过期", "無期限");
  else statusText = L(`Hạn đến ${formatDate(item.expiresAt)}`, `有效期至 ${formatDate(item.expiresAt)}`, `有効期限 ${formatDate(item.expiresAt)}`);
  return {
    id: item.id,
    name: item.name,
    hint: `…${item.hint}`,
    status,
    statusText,
    lastUsedText: item.lastUsedAt === null ? L("Chưa dùng", "尚未使用", "未使用") : L(`Dùng lần cuối ${formatDate(item.lastUsedAt)}`, `最后使用 ${formatDate(item.lastUsedAt)}`, `最終使用 ${formatDate(item.lastUsedAt)}`),
    revocable: status === "active",
  };
}

/**
 * Nội dung hộp thoại quản lý token (một `<form>` dùng class hộp thoại của tracker). `closeIcon` lấy từ tracker
 * để nút ✕ giống các hộp thoại khác; `data-rt-dialog-close` do `<dialog>` của tracker xử lý.
 */
export function createTokenPanel({ api = defaultApi, closeIcon, now = () => Date.now(), clipboard = globalThis.navigator?.clipboard } = {}) {
  const status = el("p", { class: "rt-field-help rt-token-status", role: "status", "aria-live": "polite" });
  const say = (text) => {
    status.textContent = text;
  };

  const secretInput = el("input", { id: "rt-token-secret", class: "cm-input rt-input-readonly", type: "text", readonly: "readonly", "aria-describedby": "rt-token-secret-help" });
  const copyButton = el("button", {
    class: "ana-btn",
    type: "button",
    onclick: async () => {
      try {
        await clipboard.writeText(secretInput.value);
        say(L("Đã sao chép token.", "已复制令牌。", "トークンをコピーしました。"));
      } catch {
        secretInput.select();
        say(L("Không sao chép được, hãy chọn và sao chép thủ công.", "无法复制，请手动选择并复制。", "コピーできませんでした。手動で選択してコピーしてください。"));
      }
    },
  }, L("Sao chép", "复制", "コピー"));
  const reveal = el("div", { class: "cm-field rt-token-reveal", hidden: "" }, [
    el("label", { class: "cm-label", for: "rt-token-secret" }, L("Token mới", "新令牌", "新しいトークン")),
    el("div", { class: "rt-token-secret-row" }, [secretInput, copyButton]),
    el("p", { id: "rt-token-secret-help", class: "rt-field-help" }, L(
      "Sao chép ngay: token chỉ hiện một lần. Lưu vào nơi an toàn (vd. trình quản lý mật khẩu), không dán lên chat hay repo.",
      "请立即复制：令牌只显示一次。请保存到安全位置（如密码管理器），不要粘贴到聊天或代码库中。",
      "今すぐコピーしてください。トークンは一度しか表示されません。安全な場所（パスワードマネージャーなど）に保存し、チャットやリポジトリに貼り付けないでください。",
    )),
  ]);

  const nameInput = el("input", { id: "rt-token-name", name: "name", class: "cm-input", type: "text", value: "tqkh", maxlength: String(NAME_MAX), required: "required", autocomplete: "off" });
  const ttlSelect = el("select", { id: "rt-token-ttl", name: "ttl", class: "cm-select" }, TOKEN_TTL_OPTIONS.map((option) => el("option", {
    value: option.value,
    selected: option.value === DEFAULT_TTL ? "selected" : null,
  }, option.label())));
  const createButton = el("button", { class: "ana-btn primary", type: "submit" }, L("Tạo token", "创建令牌", "トークンを作成"));

  const list = el("ul", { class: "rt-token-list", "aria-label": L("Token đã tạo", "已创建的令牌", "作成済みのトークン") });

  function paint(items) {
    if (!items.length) {
      list.replaceChildren(el("li", { class: "rt-field-help" }, L("Chưa có token nào.", "还没有令牌。", "トークンはまだありません。")));
      return;
    }
    list.replaceChildren(...items.map((item) => {
      const row = tokenRowView(item, now());
      const revoke = row.revocable ? el("button", {
        class: "tool-text-action rt-menu-danger",
        type: "button",
        "aria-label": L(`Thu hồi token ${row.name}`, `撤销令牌 ${row.name}`, `トークン ${row.name} を無効化`),
        onclick: (event) => revokeToken(row, event.currentTarget),
      }, L("Thu hồi", "撤销", "無効化")) : null;
      return el("li", { class: "rt-token-item", "data-status": row.status }, [
        el("div", { class: "rt-token-main" }, [
          el("strong", {}, row.name),
          el("code", {}, row.hint),
        ]),
        el("span", { class: "rt-field-help" }, `${row.statusText} · ${row.lastUsedText}`),
        revoke,
      ]);
    }));
  }

  async function refresh() {
    try {
      const body = await api(ENDPOINT);
      paint(Array.isArray(body?.items) ? body.items : []);
    } catch (error) {
      say(describeError(error));
    }
  }

  /** Bấm lần đầu chuyển nút thành "Xác nhận thu hồi"; bấm lần hai mới gọi API. */
  async function revokeToken(row, button) {
    if (button.dataset.confirm !== "1") {
      button.dataset.confirm = "1";
      button.textContent = L("Xác nhận thu hồi", "确认撤销", "無効化を確定");
      return;
    }
    button.disabled = true;
    try {
      await api(`${ENDPOINT}/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      say(L(`Đã thu hồi token ${row.name}.`, `已撤销令牌 ${row.name}。`, `トークン ${row.name} を無効化しました。`));
      await refresh();
    } catch (error) {
      button.disabled = false;
      say(describeError(error));
    }
  }

  const form = el("form", { class: "rt-dialog-form rt-token-panel" }, [
    el("div", { class: "rt-dialog-head" }, [
      el("div", { class: "rt-dialog-heading" }, [
        el("span", { class: "rt-dialog-kicker" }, L("Công cụ tự động", "自动化工具", "自動化ツール")),
        el("h2", { id: "rt-dialog-title", class: "rt-dialog-title" }, L("Token API", "API 令牌", "APIトークン")),
      ]),
      el("button", { class: "rt-icon-btn rt-dialog-close", type: "button", "data-rt-dialog-close": "", "aria-label": L("Đóng", "关闭", "閉じる") }, [closeIcon?.()]),
    ]),
    el("p", { class: "rt-dialog-lead" }, L(
      ["Cho công cụ tự động ghi lượt quay gói Danh tướng PK vào Theo dõi chiêu mộ của bạn qua ", el("code", {}, "POST /api/recruit/pulls"), ". Token chỉ có quyền ghi lượt quay."],
      ["允许自动化工具通过 ", el("code", {}, "POST /api/recruit/pulls"), " 将 PK 名将招募的抽卡次数写入你的招募记录。令牌仅有写入抽卡次数的权限。"],
      ["自動化ツールが ", el("code", {}, "POST /api/recruit/pulls"), " 経由で PK名将登用の回数をあなたの登用記録に書き込めるようにします。トークンには登用回数を書き込む権限しかありません。"],
    )),
    reveal,
    el("div", { class: "rt-field-row" }, [
      el("div", { class: "cm-field" }, [el("label", { class: "cm-label", for: "rt-token-name" }, L("Tên", "名称", "名前")), nameInput]),
      el("div", { class: "cm-field" }, [el("label", { class: "cm-label", for: "rt-token-ttl" }, L("Hạn dùng", "有效期", "有効期限")), ttlSelect]),
    ]),
    el("div", { class: "rt-dialog-actions" }, [createButton]),
    list,
    status,
  ]);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    createButton.disabled = true;
    try {
      const ttl = ttlSelect.value;
      const body = await api(ENDPOINT, { method: "POST", json: { name: nameInput.value.trim(), expiresInDays: ttl ? Number(ttl) : null } });
      secretInput.value = body.token;
      reveal.hidden = false;
      say(L("Đã tạo token.", "已创建令牌。", "トークンを作成しました。"));
      secretInput.focus();
      secretInput.select();
      await refresh();
    } catch (error) {
      say(describeError(error));
    } finally {
      createButton.disabled = false;
    }
  });

  list.replaceChildren(el("li", { class: "rt-field-help" }, L("Đang tải…", "加载中…", "読み込み中…")));
  refresh();
  return form;
}
