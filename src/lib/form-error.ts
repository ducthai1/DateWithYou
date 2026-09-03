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
  caption: "Lời kể",
  photos: "Ảnh",
  url: "Đường dẫn",
  publicId: "Ảnh",
  date: "Ngày",
  time: "Giờ",
  tags: "Nhãn",
  mentions: "Người được nhắc",
  pin: "Mã PIN",
  email: "Email",
  password: "Mật khẩu",
};

type ZodIssue = { path?: unknown[]; code?: string; message?: string };

function describe(issue: ZodIssue): string {
  /*
   * The LAST string in the path is the field; the ones before it are its
   * container. Taking the first instead turned ["photos", 0, "caption"] into a
   * complaint about "photos", which points at the wrong box to fix.
   */
  const names = (issue.path ?? []).filter((p): p is string => typeof p === "string");
  const key = names[names.length - 1];
  const label = (key && FIELD_LABELS[key]) || key;
  if (!label) return issue.message ?? "";
  // A numeric step means the field sits in a list, so say which entry.
  const index = (issue.path ?? []).find((p): p is number => typeof p === "number");
  const at = typeof index === "number" ? ` (mục thứ ${index + 1})` : "";
  switch (issue.code) {
    case "too_small":
      return `Thiếu ${label.toLowerCase()}${at}`;
    case "too_big":
      return `${label} dài quá${at}`;
    case "invalid_format":
    case "invalid_string":
      return `${label} không đúng định dạng${at}`;
    default:
      return `${label} chưa hợp lệ${at}`;
  }
}

/** Human-readable reason for a failed save. Never returns raw JSON. */
export function readableFormError(message: string | undefined, fallback = "Thử lại nhé"): string {
  const raw = (message ?? "").trim();
  if (!raw) return fallback;
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
