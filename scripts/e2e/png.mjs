/*
 * Đọc pixel của ảnh chụp màn hình, để đo được thứ chỉ nhìn mới thấy.
 *
 * CDP trả ảnh PNG; máy này không có ImageMagick và bộ e2e cố ý không kéo thêm
 * thư viện nào. PNG của Chrome luôn là 8-bit RGB/RGBA, không xen dòng, nên
 * phần cần hiện thực chỉ là giải nén zlib rồi gỡ 5 bộ lọc dòng quét.
 *
 * Có cái này thì mới kiểm được những lỗi mà DOM hoàn toàn không biết: một
 * đường vẽ trên canvas WebGL bắt đầu ở đâu, một mảng màu có thật sự hiện ra
 * hay không. `getBoundingClientRect` không trả lời được câu nào trong số đó.
 */
import { inflateSync } from "node:zlib";

/** Minimal PNG reader for CDP screenshots: 8-bit RGB/RGBA, no interlace. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let off = 8, width = 0, height = 0, depth = 0, colour = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colour = data[9];
      if (depth !== 8 || (colour !== 2 && colour !== 6)) throw new Error(`unsupported png ${depth}/${colour}`);
      if (data[12] !== 0) throw new Error("interlaced png");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const bpp = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return {
    width, height, bpp, data: out,
    at(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const i = y * stride + x * bpp;
      return { r: out[i], g: out[i + 1], b: out[i + 2] };
    },
  };
}
