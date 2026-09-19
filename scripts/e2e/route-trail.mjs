/*
 * Chỗ CẮT đường phải nằm ngay dưới chân người đi, không cách một quãng.
 *
 * Người dùng báo: "từ avatar người dùng đến vạch màu xanh ở trước bị trống 1
 * khoảng". Phần số học thì đúng — đo trên tuyến thật 11.6km, điểm cắt tính ra
 * chỉ lệch 1–8m so với vị trí đã bám đường. Cái sai nằm ở chỗ VẼ.
 *
 * `line-gradient` được MapLibre nướng thành một tấm ảnh 1 chiều. Với biểu thức
 * `interpolate` tấm ấy **luôn rộng 256 texel cho cả tuyến** và được lấy mẫu
 * LINEAR (maplibre-gl 5.24, `updateGradientTexture`). Trên tuyến 11.6km thì một
 * texel là 45m, và ở mức phóng lúc đang đi (18.5) 45m là ~110px — nên chỗ
 * chuyển từ trong suốt sang xanh bị nhoè hết chừng ấy. Đổi sang `step`, cùng
 * hàm đó nâng độ phân giải theo chiều dài tuyến và lấy mẫu NEAREST.
 *
 * Bài này đo bằng PIXEL vì DOM không biết gì về canvas WebGL: chụp màn hình
 * thật, dò từ tâm avatar ngược lên trên tìm điểm xanh đầu tiên.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn, signInAs, PARTNER_EMAIL } from "./session.mjs";
import { decodePng } from "./png.mjs";

export const name = "Đường xanh bắt đầu ngay tại chân người đi";

/*
 * Tuyến DÀI là điều kiện gây lỗi.
 *
 * Tấm ảnh chuyển màu rộng cố định 256 texel cho cả tuyến, nên tuyến càng dài
 * thì một texel càng nhiều mét. Tuyến 1.6km của bộ `nav` chỉ cho 6m/texel —
 * không ai thấy. 11.6km cho 45m, và đó là quãng đi làm bình thường.
 */
const START = { lat: 10.7769, lng: 106.7009 };
const LENGTH_M = 11_600;
const DEST = { lat: START.lat + LENGTH_M / 110_574, lng: START.lng };
/** Người đi đang ở 40% quãng đường, ngay TRÊN đường. */
const RIDER = { lat: START.lat + (DEST.lat - START.lat) * 0.4, lng: START.lng };

const line = (n = 60) =>
  Array.from({ length: n }, (_, i) => [START.lng, START.lat + ((DEST.lat - START.lat) * i) / (n - 1)]);

/**
 * Ngưỡng: chỗ cắt được phép nằm trong bán kính chạm của avatar.
 *
 * Avatar 32px CSS; cộng thêm sai số một nhịp GPS. Trước khi sửa, đo được hơn
 * 100px — tức là một khoảng trống to bằng một phần ba màn hình.
 */
const MAX_GAP_CSS_PX = 40;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chromeA = await launchChrome(`${profileDir}-a`, port, { width: 390, height: 844 });
  const A = await openPage(port);
  const chromeB = await launchChrome(`${profileDir}-b`, port + 100, { width: 390, height: 844 });
  const B = await openPage(port + 100);

  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    for (const [page, geo] of [[A, START], [B, RIDER]]) {
      await page.viewport(390, 844, true, 2);
      await page.send("Emulation.setGeolocationOverride", {
        latitude: geo.lat,
        longitude: geo.lng,
        accuracy: 6,
      });
      await page.send("Browser.grantPermissions", { permissions: ["geolocation"] }).catch(() => {});
    }

    const host = await signIn(A, base, db);
    spaceId = host.spaceId;
    const guest = await signInAs(B, base, db, { email: PARTNER_EMAIL, name: "Ban doi", spaceId });

    await db.collection("navigationinvites").deleteMany({ spaceId });
    await db.collection("locations").deleteMany({ spaceId, name: "E2E Cuoi duong" });
    const loc = await db.collection("locations").insertOne({
      spaceId,
      name: "E2E Cuoi duong",
      district: "Phường Sài Gòn",
      category: "Cà phê",
      geo: DEST,
      status: "want_to_go",
      createdBy: host.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const locId = String(loc.insertedId);

    for (const page of [A, B]) {
      await page.send("Network.enable");
      await page.send("Network.setBlockedURLs", { urls: ["*location.getRoute*"] });
      await page.goto(`${base}/map`);
      await page.until(`!!document.querySelector('[aria-label="Tìm địa điểm"]')`, { timeout: 60000 });
      await page.eval(`localStorage.setItem("vivu.ride.route", JSON.stringify({
        locationId: ${JSON.stringify(locId)},
        savedAt: Date.now(),
        geometry: { type: "LineString", coordinates: ${JSON.stringify(line())} },
        legs: [],
        distanceMeters: ${LENGTH_M}, durationSeconds: 1800, multiLeg: false
      }))`);
    }

    await db.collection("navigationinvites").insertOne({
      spaceId,
      initiatorId: host.uid,
      targetId: guest.uid,
      locationId: locId,
      locationName: "E2E Cuoi duong",
      waypoints: [],
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    const asked = await B.until(`document.body.innerText.includes("Đi liền")`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("lời mời tới được máy người đi", asked);
    if (!asked) return results;

    await B.eval(`[...document.querySelectorAll('button')].find(x => /Đi liền/.test(x.textContent||'')).click()`);
    const riding = await B.until(`!!document.querySelector('[aria-label="Nóng quá!"]')`, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    ok("vào được màn hình đang đi", riding);
    if (!riding) return results;

    /*
     * Chờ đúng thứ chứng minh đường đã bị cắt, không chờ theo đồng hồ.
     *
     * Chỗ cắt chỉ tồn tại khi bộ điều hướng đã bám được vị trí vào tuyến và
     * báo ra quãng còn lại — trước lúc ấy đường được vẽ nguyên vẹn và phép đo
     * sẽ nói "không có khoảng trống" một cách vô nghĩa.
     */
    await B.until(`/\\d/.test(document.body.innerText) && !!document.querySelector('.maplibregl-canvas')`, {
      timeout: 30000,
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3500));

    const marker = JSON.parse(
      await B.eval(`(() => {
        /* Dấu vị trí của mình = marker chứa vòng nhịp. Không dò theo ảnh đại
           diện: tài khoản chưa đặt ảnh thì chỗ đó là một chấm, không phải <img>. */
        const ping = document.querySelector('.maplibregl-marker .animate-ping');
        const el = ping ? ping.closest('.maplibregl-marker') : null;
        if (!el) return "null";
        const r = el.getBoundingClientRect();
        return JSON.stringify({ cx: r.x + r.width / 2, cy: r.y + r.height / 2 });
      })()`),
    );
    ok("thấy được dấu vị trí của mình trên bản đồ", marker !== null);
    if (!marker) return results;

    /*
     * Giấu lớp phủ điều hướng trước khi chụp.
     *
     * Nó có một tấm mờ chuyển dần xuống thanh điều khiển, và tấm ấy làm nhạt
     * luôn bản đồ bên dưới. Lần đo đầu tôi đã đo nhầm chính tấm mờ đó và đọc ra
     * "đường nhoè dần 90px" — trong khi đường thì không liên quan. Đo chỗ cắt
     * thì phải còn mỗi bản đồ trên màn.
     */
    await B.eval(`[...document.querySelectorAll('body *')].forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && Number(cs.zIndex) >= 50) el.style.visibility = "hidden";
    })`);
    await new Promise((r) => setTimeout(r, 400));

    const { data } = await B.send("Page.captureScreenshot", { format: "png" });
    const img = decodePng(Buffer.from(data, "base64"));
    const dsf = img.width / 390;
    const cx = Math.round(marker.cx * dsf);
    const cy = Math.round(marker.cy * dsf);
    const half = Math.round(24 * dsf);

    /*
     * Quét dọc, vì lúc đang đi camera xoay theo hướng chạy nên đường luôn đổ
     * dọc màn hình: phía trước ở trên, đoạn đã đi ở dưới.
     *
     * `r < 120` là thứ tách xanh-của-tuyến khỏi xanh-của-bản-đồ: nước trong
     * nền là (158,189,255) — cũng lệch xanh, nhưng đỏ cao gấp đôi.
     */
    const scan = (y, test) => {
      for (let x = cx - half; x <= cx + half; x++) { const p = img.at(x, y); if (p && test(p)) return true; }
      return false;
    };
    const solid = (p) => p.b > 230 && p.b - p.r > 170;
    const trace = (p) => p.r < 120 && p.b > 130 && p.b - p.r > 40;

    let ahead = null;
    for (let y = cy; y >= 0; y--) if (scan(y, solid)) { ahead = cy - y; break; }
    let tail = 0;
    for (let y = cy; y < img.height; y++) if (scan(y, trace)) tail = y - cy;

    const aheadCss = ahead === null ? null : Math.round(ahead / dsf);
    const tailCss = Math.round(tail / dsf);

    /*
     * Hai chiều, vì một chiều thì bài này rỗng.
     *
     * Chỉ đo phía trước: cả tuyến vẽ nguyên (chỗ cắt hỏng hẳn) cũng cho 0px và
     * vẫn xanh. Chỉ đo phía sau: xoá sạch cả tuyến cũng cho 0px và vẫn xanh.
     */
    ok(
      `đường phía trước có ngay tại chân người đi (${aheadCss}px, cho phép ${MAX_GAP_CSS_PX}px)`,
      aheadCss !== null && aheadCss <= MAX_GAP_CSS_PX,
      aheadCss === null ? "không thấy đường xanh nào phía trước" : "",
    );
    ok(
      `đoạn đã đi hết ngay sau lưng (${tailCss}px, cho phép ${MAX_GAP_CSS_PX}px)`,
      tailCss <= MAX_GAP_CSS_PX,
      tailCss <= MAX_GAP_CSS_PX ? "" : `đường còn kéo dài ${tailCss}px phía sau rồi mới nhoè hết`,
    );

    if (shotDir) await B.shot(`${shotDir}/route-trail.png`);
  } finally {
    if (spaceId) {
      await db.collection("navigationinvites").deleteMany({ spaceId }).catch(() => {});
      await db.collection("locations").deleteMany({ spaceId, name: "E2E Cuoi duong" }).catch(() => {});
    }
    A.close();
    B.close();
    chromeA.kill();
    chromeB.kill();
  }
  return results;
}
