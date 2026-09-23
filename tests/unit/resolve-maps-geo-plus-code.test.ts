import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { resolveGeoFromMapsUrl } from "@/server/lib/resolve-maps-geo";
import { calculateDistance } from "@/lib/maps";

/*
 * Chụp lại nguyên một ca đo thật trên prod: link "Chia sẻ" từ điện thoại của
 * một quán ở Ninh Phước. Link rút gọn 302 sang một trang place KHÔNG có toạ độ
 * và KHÔNG có camera — chỉ có tên chỗ, mà tên chỗ mở đầu bằng plus code.
 */
const SHORT_LINK = "https://maps.app.goo.gl/dCz7PAudfNhKMnVt8";
const FINAL_URL =
  "https://www.google.com/maps/place/HX6G%2B8C4+Tr%E1%BA%A1m+d%E1%BB%ABng+ch%C3%A2n+Thi%C3%AAn+Th%E1%BA%A3o,+Ninh+Ph%C6%B0%E1%BB%9Bc,+Kh%C3%A1nh+H%C3%B2a/data=!4m2!3m1!1s0x3170d100592cfce5:0x73f28ab1c2f4fe2b";

/** Ghim người dùng đã lưu cho chính quán đó. */
const SAVED = { lat: 11.560670314965321, lng: 108.97622918909116 };
/*
 * Autocomplete trả về. Toạ độ là số đo thật; thứ tự thì cố tình xếp cái SAI lên
 * đầu, vì đó mới là rủi ro cần chặn: không có camera thì tìm kiếm không có gì
 * dẫn đường, và cái đứng đầu chỉ là phỏng đoán. Xếp cái đúng lên đầu thì test
 * xanh kể cả khi tầng plus code bị gỡ — đã thử.
 */
const CANDIDATES = [
  { lat: 10.939135, lng: 107.098484 },
  { lat: 11.474042, lng: 107.73585 },
  { lat: 11.56051, lng: 108.97664 },
  { lat: 11.560573, lng: 108.976489 },
];
/** Bộ geocode theo tên trả về — lệch 76km, và tự tin. */
const NAME_GEOCODE = { lat: 12.202537, lng: 109.216983 };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Chặn mạng: link rút gọn 302 một lần sang trang place, rồi dừng. */
function stubRedirect(finalUrl = FINAL_URL) {
  let hop = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (hop++ === 0 && url === SHORT_LINK) {
      return new Response(null, { status: 302, headers: { location: finalUrl } });
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;
}

test("plus code + ứng viên khớp → đúng quán, không phải điểm geocode theo tên", async () => {
  stubRedirect();
  const got = await resolveGeoFromMapsUrl(
    SHORT_LINK,
    async () => NAME_GEOCODE,
    async () => CANDIDATES,
  );
  assert.ok(got);
  const off = calculateDistance(got, SAVED);
  assert.ok(off < 100, `lệch ${Math.round(off)}m so với ghim đã lưu`);
  // Và là điểm plus code giải ra, không phải chính ứng viên: chênh nhau vài
  // chục mét, nhưng chỉ cái này chứng minh tầng plus code đã chạy.
  assert.notDeepEqual(got, CANDIDATES[2]);
});

test("không ứng viên nào khớp plus code → trả null, KHÔNG trả điểm sai", async () => {
  /*
   * Đây là hành vi quan trọng nhất ở đây. Trước khi có tầng này, không có
   * camera thì `believable()` cho qua mọi thứ, nên câu trả lời là điểm geocode
   * theo tên: một chỗ ở Nha Trang cách quán 76km, im lặng và trông như thật.
   * Google đã ghi sẵn toạ độ vào link; mọi ứng viên đều mâu thuẫn với nó thì
   * câu trả lời trung thực là "không biết", để form mời người dùng chạm bản đồ.
   */
  stubRedirect();
  const got = await resolveGeoFromMapsUrl(
    SHORT_LINK,
    async () => NAME_GEOCODE,
    async () => [NAME_GEOCODE, { lat: 10.939135, lng: 107.098484 }],
  );
  assert.equal(got, null);
});

test("không có ứng viên nào → vẫn không bịa ra điểm từ bộ geocode theo tên", async () => {
  stubRedirect();
  const got = await resolveGeoFromMapsUrl(SHORT_LINK, async () => NAME_GEOCODE, async () => []);
  assert.equal(got, null);
});

test("link không có plus code thì đường cũ giữ nguyên", async () => {
  // Cùng trang place, chỉ khác là tên chỗ không mở đầu bằng plus code.
  stubRedirect(
    "https://www.google.com/maps/place/Qu%C3%A1n+G%C3%B3c+Nh%E1%BB%8F,+Qu%E1%BA%ADn+1/data=!4m2!3m1!1s0x31",
  );
  const hit = { lat: 10.7769, lng: 106.7009 };
  const got = await resolveGeoFromMapsUrl(SHORT_LINK, async () => hit, async () => [hit]);
  assert.deepEqual(got, hit);
});
