import type { ZodError } from "zod";

/**
 * Đường dẫn field vi phạm để agent tự sửa request thay vì bỏ cuộc.
 *
 * Chỉ tên field, không bao giờ giá trị: payload lỗi đi thẳng vào context LLM và
 * vào trace, còn giá trị có thể chứa dữ liệu người dùng dán vào. Tên field vốn
 * đã công khai trong tool definition nên không lộ thêm thông tin nào.
 */

/** Số field tối đa nêu trong một lỗi, để response không phình khi input sai hàng loạt. */
const MAX_REPORTED_FIELDS = 5;

/** Ký tự hợp lệ của một khoá do schema định nghĩa. */
const SAFE_SEGMENT = /^[A-Za-z0-9_]+$/u;

/**
 * `["heroes", 0, "tacticIds"]` -> `heroes[0].tacticIds`.
 *
 * Trả chuỗi rỗng nếu gặp segment không do schema định nghĩa. Schema hiện đều là
 * object `.strict()` với khoá cố định, nhưng ràng buộc này khiến việc rò một
 * khoá do client đặt tên trở thành bất khả thi chứ không chỉ là khó xảy ra.
 */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  let rendered = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      rendered += `[${segment}]`;
      continue;
    }
    const key = String(segment);
    if (!SAFE_SEGMENT.test(key)) return "";
    rendered = rendered === "" ? key : `${rendered}.${key}`;
  }
  return rendered;
}

/** Field báo cho key lạ ở cấp gốc của request (zod trả path rỗng). */
const ROOT_FIELD = "input";

/**
 * Tên field duy nhất, giữ thứ tự zod báo cáo, chặn trần.
 *
 * Key lạ (`unrecognized_keys`) được báo bằng đường dẫn object chứa nó (do schema định nghĩa),
 * không phải tên key client tự đặt; ở gốc thì báo `input`.
 */
export function invalidRequestFields(error: ZodError): string[] {
  const fields = new Set<string>();
  for (const issue of error.issues) {
    const rendered = formatIssuePath(issue.path);
    if (rendered !== "") fields.add(rendered);
    else if (issue.code === "unrecognized_keys" && issue.path.length === 0) fields.add(ROOT_FIELD);
    if (fields.size >= MAX_REPORTED_FIELDS) break;
  }
  return [...fields];
}

/** Nối danh sách field vào thông báo công khai; field `input` nghĩa là có key ngoài schema ở gốc. */
export function withFieldNames(
  message: string,
  fields: readonly string[],
): string {
  if (fields.length === 0) return message;
  const named = `${message} Trường sai: ${fields.join(", ")}.`;
  return fields.includes(ROOT_FIELD)
    ? `${named} Có trường không có trong schema; chỉ gửi các trường được khai báo.`
    : named;
}
