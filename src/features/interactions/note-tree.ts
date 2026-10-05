/**
 * Dựng cây bình luận từ danh sách phẳng máy chủ trả về.
 *
 * Tách khỏi component vì đây là chỗ dễ sai mà giao diện không kêu: một bình
 * luận mồ côi (cha đã bị xoá, hoặc dữ liệu cũ) mà bị bỏ quên thì nó biến mất
 * khỏi màn trong khi vẫn nằm trong cơ sở dữ liệu — không có lỗi nào hiện ra,
 * chỉ là người ta không thấy câu mình vừa viết nữa.
 */

export type FlatNote = {
  id: string;
  parentId: string | null;
  createdAt: Date | string;
};

export type NoteNode<T extends FlatNote> = T & {
  /** 1 là bình luận gốc. */
  depth: number;
  children: NoteNode<T>[];
};

/** Sâu nhất mà giao diện còn thụt lề; khớp `NOTE_MAX_DEPTH` của máy chủ. */
export const MAX_DEPTH = 3;

/**
 * Cây theo thứ tự đọc: gốc cũ nhất trước, con cũng cũ nhất trước.
 *
 * Bình luận có `parentId` trỏ vào một id không có trong danh sách được NÂNG
 * LÊN LÀM GỐC chứ không bị bỏ. Trường hợp này có thật: xoá bình luận cha có
 * cuốn theo nhánh con, nhưng một client đang mở sẵn vẫn giữ bản cũ trong bộ
 * nhớ cho tới lần làm mới kế tiếp.
 */
export function buildNoteTree<T extends FlatNote>(notes: T[]): NoteNode<T>[] {
  const byId = new Map<string, NoteNode<T>>();
  for (const n of notes) byId.set(n.id, { ...n, depth: 1, children: [] });

  const roots: NoteNode<T>[] = [];
  for (const n of notes) {
    const node = byId.get(n.id);
    if (!node) continue;
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  /*
   * Độ sâu tính SAU khi nối xong, không tính lúc nối: danh sách phẳng không
   * hứa con đứng sau cha, nên tính dọc đường thì một con đến trước cha sẽ nhận
   * độ sâu sai và không bao giờ được sửa lại.
   */
  const stamp = (nodes: NoteNode<T>[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      stamp(node.children, depth + 1);
    }
  };
  stamp(roots, 1);

  const time = (n: NoteNode<T>) => new Date(n.createdAt).getTime();
  const sortTree = (nodes: NoteNode<T>[]) => {
    nodes.sort((a, b) => time(a) - time(b));
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);
  return roots;
}

/** Đếm cả cây, để nút "x bình luận" không chỉ đếm bình luận gốc. */
export function countNotes<T extends FlatNote>(nodes: NoteNode<T>[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNotes(n.children), 0);
}

/**
 * Trả lời `node` thì bình luận mới treo vào đâu.
 *
 * Ở cấp sâu nhất thì treo vào chính cha của nó — giống máy chủ, giống
 * Facebook: luồng phẳng lại ở cấp 3 thay vì thụt lề mãi. Hai bên phải cùng một
 * luật, nếu không thì chỗ vừa hiện ra khác chỗ sau khi tải lại.
 */
export function replyParentId<T extends FlatNote>(node: NoteNode<T>): string {
  return node.depth >= MAX_DEPTH ? (node.parentId ?? node.id) : node.id;
}
