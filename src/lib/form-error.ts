/**
 * Turn a failed mutation into a sentence a person can act on.
 *
 * tRPC forwards a Zod failure as its raw `issues` JSON, and showing that
 * straight to someone produced the toast this exists to prevent:
 *
 *   Lưu thất bại: [ { "origin": "string", "code": "too_small", "minimum": 1,
 *   "inclusive": true, "path": [ "district" ], "message": "Too small: expected
 *   string to have >=1 characters" } ]
 *
 * Every part of that is true and none of it tells the reader that an area was
 * missing. The field names below are the labels they can actually see on the
 * form, so the message points at the box to fix.
 */

const FIELD_LABELS: Record<string, string> = {
  name: "Tên quán",
  district: "Khu vực",
  category: "Loại địa điểm",
  googleMapsUrl: "Link Google Maps",
  socialUrl: "Link TikTok/Instagram",
  mustTry: "Món must-try",
  openTime: "Giờ mở cửa",
  closeTime: "Giờ đóng cửa",
  rating: "Đánh giá",
  note: "Ghi chú",
  title: "Tiêu đề",
  content: "Nội dung",
  startDate: "Ngày bắt đầu",
  endDate: "Ngày kết thúc",
  budget: "Ngân sách",
};

type ZodIssue = { path?: unknown[]; code?: string; message?: string };

function describe(issue: ZodIssue): string {
  const key = issue.path?.find((p): p is string => typeof p === "string");
  const label = (key && FIELD_LABELS[key]) || key;
  if (!label) return issue.message ?? "";
  switch (issue.code) {
    case "too_small":
      return `Thiếu ${label.toLowerCase()}`;
    case "too_big":
      return `${label} dài quá`;
    case "invalid_format":
    case "invalid_string":
      return `${label} không đúng định dạng`;
    default:
      return `${label} chưa hợp lệ`;
  }
}

/** Human-readable reason for a failed save. Never returns raw JSON. */
export function readableFormError(message: string | undefined): string {
  const raw = (message ?? "").trim();
  if (!raw) return "Thử lại nhé";
  // Zod arrives as a JSON array of issues; anything else is already prose.
  if (!raw.startsWith("[")) return raw;
  try {
    const issues = JSON.parse(raw) as ZodIssue[];
    const parts = issues.map(describe).filter(Boolean);
    if (!parts.length) return "Có ô chưa hợp lệ";
    // Dedupe: the same field can raise more than one issue at once.
    return [...new Set(parts)].join(" · ");
  } catch {
    return "Có ô chưa hợp lệ";
  }
}
