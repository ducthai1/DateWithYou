import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_BYTES, MAX_VIDEO_BYTES,
  endpointFor, maxBytesFor, tooLargeMessage, uploadKindOf, videoPosterUrl,
} from "@/lib/upload-kind";

/*
 * Ảnh đi một đường, video đi đường khác.
 *
 * Bài đáng giá nhất ở đây là bài về trần dung lượng: hai loại có hai trần khác
 * nhau ở nhà cung cấp (10 MB và 100 MB). Dùng chung một con số thì hoặc chặn
 * oan mọi video, hoặc để một video 60 MB bay lên hết một phút rồi mới bị từ
 * chối — và người dùng không biết vì sao.
 */

describe("nhận loại theo MIME", () => {
  test("video", () => {
    assert.equal(uploadKindOf({ type: "video/mp4", name: "a.mp4" }), "video");
    assert.equal(uploadKindOf({ type: "video/quicktime", name: "IMG_0001.MOV" }), "video");
  });
  test("ảnh", () => {
    assert.equal(uploadKindOf({ type: "image/jpeg", name: "a.jpg" }), "image");
    assert.equal(uploadKindOf({ type: "image/heic", name: "IMG.HEIC" }), "image");
  });
  test("MIME thắng đuôi tên khi hai thứ đá nhau", () => {
    // Đuôi là thứ người dùng đổi được; `type` là thứ trình duyệt tự đọc.
    assert.equal(uploadKindOf({ type: "video/mp4", name: "clip.jpg" }), "video");
  });
});

describe("máy Android đôi khi không trả MIME", () => {
  test("thì lùi về đuôi tên", () => {
    assert.equal(uploadKindOf({ type: "", name: "quay.mp4" }), "video");
    assert.equal(uploadKindOf({ type: "", name: "anh.HEIC" }), "image");
  });
  test("không có gì để dựa thì trả null, không đoán bừa", () => {
    assert.equal(uploadKindOf({ type: "", name: "khongcoduoi" }), null);
    assert.equal(uploadKindOf({ type: "application/pdf", name: "a.pdf" }), null);
    assert.equal(uploadKindOf({}), null);
  });
});

describe("hai trần khác nhau, và không được lẫn", () => {
  test("video rộng gấp mười ảnh", () => {
    assert.equal(maxBytesFor("image"), MAX_IMAGE_BYTES);
    assert.equal(maxBytesFor("video"), MAX_VIDEO_BYTES);
    assert.ok(MAX_VIDEO_BYTES > MAX_IMAGE_BYTES * 5, "video phải rộng hơn hẳn");
  });

  test("một video 60 MB KHÔNG được đo bằng trần của ảnh", () => {
    // Đây đúng là ca sẽ hỏng nếu ai đó dùng lại MAX_UPLOAD_BYTES cho cả hai.
    const sixtyMB = 60 * 1024 * 1024;
    assert.ok(sixtyMB > maxBytesFor("image"), "tiền đề của bài");
    assert.ok(sixtyMB < maxBytesFor("video"), "60 MB phải lọt qua trần video");
  });

  test("lời từ chối nói đúng loại và đúng con số", () => {
    assert.match(tooLargeMessage("video"), /100 MB/);
    assert.match(tooLargeMessage("image"), /10 MB/);
    assert.notEqual(tooLargeMessage("video"), tooLargeMessage("image"));
  });
});

describe("đường gửi lên", () => {
  test("mỗi loại một endpoint", () => {
    assert.equal(endpointFor("image"), "image");
    assert.equal(endpointFor("video"), "video");
  });
});

describe("ảnh đại diện của video", () => {
  test("đổi đuôi sang .jpg", () => {
    assert.equal(
      videoPosterUrl("https://res.cloudinary.com/x/video/upload/v1/a/b.mp4"),
      "https://res.cloudinary.com/x/video/upload/v1/a/b.jpg",
    );
    assert.equal(
      videoPosterUrl("https://res.cloudinary.com/x/video/upload/v1/a/b.MOV"),
      "https://res.cloudinary.com/x/video/upload/v1/a/b.jpg",
    );
  });
  test("giữ nguyên nếu không nhận ra đuôi, không bịa ra URL hỏng", () => {
    const odd = "https://res.cloudinary.com/x/video/upload/v1/a/b";
    assert.equal(videoPosterUrl(odd), odd);
  });
});

/*
 * Link tự tải lên phải được nhận là "của mình", không phải "link lạ".
 *
 * Phân biệt bằng host CỘNG đường dẫn `/video/upload/`, không bằng đuôi `.mp4`:
 * một file .mp4 nằm trên máy chủ người khác vẫn là link đi mượn, không chắc
 * phát nhúng được, và gắn nhầm nhãn "của mình" thì trình phát sẽ cố phát thẳng
 * một thứ có thể bị chặn CORS.
 */
import { parseEmbed } from "@/lib/embed";

describe("nhận ra video của chính mình", () => {
  test("URL kho của mình → provider upload, kèm ảnh đại diện", () => {
    const e = parseEmbed("https://res.cloudinary.com/demo/video/upload/v1/a/b.mp4");
    assert.equal(e.provider, "upload");
    assert.equal(e.thumbnailUrl, "https://res.cloudinary.com/demo/video/upload/v1/a/b.jpg");
  });

  test("ẢNH trên cùng kho thì KHÔNG phải video", () => {
    // /image/upload/ chứ không phải /video/upload/ — gắn nhầm là ra ô đen.
    assert.notEqual(
      parseEmbed("https://res.cloudinary.com/demo/image/upload/v1/a/b.jpg").provider,
      "upload",
    );
  });

  test("file .mp4 ở máy chủ khác vẫn là link thường", () => {
    assert.notEqual(parseEmbed("https://vidu.com/phim/a.mp4").provider, "upload");
  });

  test("YouTube không bị nhận nhầm", () => {
    assert.equal(parseEmbed("https://youtu.be/abc123").provider, "youtube");
  });
});
