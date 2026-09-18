/*
 * Ai được báo khi có ghi chú mới dưới một kỷ niệm.
 *
 * Tách khỏi chỗ gửi vì luật ở đây mới là chỗ dễ sai, và sai thì im lặng: gửi
 * cho chính người vừa viết, hoặc rung hai lần vào người vừa bị nhắc tên.
 */
export function noteRecipients({
  members,
  authorId,
  alreadyNotified,
}: {
  members: string[];
  authorId: string;
  /** Ai vừa nhận chuông "được nhắc tên" — họ không nhận thêm chuông thứ hai. */
  alreadyNotified: string[];
}): string[] {
  const skip = new Set([authorId, ...alreadyNotified]);
  // Lọc trùng: một người bị liệt kê hai lần trong space vẫn chỉ nhận một lần.
  return [...new Set(members)].filter((id) => id && !skip.has(id));
}
