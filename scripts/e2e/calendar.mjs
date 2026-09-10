/*
 * The calendar's day pictures, at the size the screen actually needs.
 *
 * A month draws up to 31 of these, so each cell asks for a cell-sized
 * picture rather than the photo off the phone. Getting that wrong is
 * invisible on the machine it was written on and obvious on a phone: the
 * previews were blurry for weeks because the URL asked Cloudinary for
 * `dpr_auto`, which answers a client hint no page ever sends, so every
 * thumbnail came back at 1x and was stretched across a 3x screen.
 *
 * The fix is explicit widths in a srcset, and the only honest way to check
 * it is to read `currentSrc` — the candidate the browser CHOSE. naturalWidth
 * lies here: for a `w`-descriptor srcset it reports the layout width, so a
 * blurry image and a sharp one measure the same.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Lịch: ảnh xem trước đúng độ phân giải màn hình";

const PHOTO = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

/** A memory with a photo, on a day of the month now on screen. */
async function seedMemory(db, spaceId, uid) {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
  const existing = await db.collection("memories").findOne({ spaceId, title: "E2E ảnh lịch" });
  if (existing) return day;
  await db.collection("memories").insertOne({
    spaceId,
    title: "E2E ảnh lịch",
    date: day,
    photos: [{ url: PHOTO, publicId: "sample", width: 864, height: 576 }],
    embeds: [],
    tags: [],
    mentions: [],
    createdBy: uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return day;
}

/** Every calendar thumbnail, with the width the browser actually asked for. */
const THUMBS = `(() => {
  const out = [];
  for (const i of document.querySelectorAll('img[srcset*="w_"]')) {
    const chosen = i.currentSrc || i.src;
    // Cloudinary writes the width inside a comma-separated transform list
    // ("c_fill,g_auto,w_256,h_256,..."), so the delimiter is a comma as often
    // as a slash.
    const m = chosen.match(/[/,]w_(\\d+)[,/]/);
    const offered = [...i.srcset.matchAll(/w_(\\d+)/g)].map((x) => Number(x[1]));
    out.push({
      asked: m ? Number(m[1]) : 0,
      offered,
      css: Math.round(i.getBoundingClientRect().width),
      complete: i.complete,
      decoded: i.naturalWidth > 0,
    });
  }
  return JSON.stringify(out);
})()`;

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(profileDir, port, { width: 1440, height: 900 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  const broken = [];

  try {
    await page.send("Network.enable");
    page.on("Network.responseReceived", (e) => {
      if (e.response.status >= 400 && /res\.cloudinary\.com/.test(e.response.url)) {
        broken.push(`${e.response.status} ${e.response.url.slice(-70)}`);
      }
    });

    await page.viewport(1440, 900, false);
    const { uid, spaceId } = await signIn(page, base, db);
    await seedMemory(db, spaceId, uid);

    /*
     * One layout, three densities.
     *
     * The width is held at 1440 on purpose: a phone-width viewport shows the
     * week strip instead of the month grid, so it has no day pictures to
     * measure. Holding the layout still and changing only the density is
     * also the cleaner experiment — the cell is the same 147px in all three,
     * so the only thing that may change is which candidate the browser asks
     * for. If it asks for the same one at 3x as at 1x, the srcset is being
     * ignored and every preview on a dense screen is a stretched 1x image,
     * which is exactly what `dpr_auto` used to do here.
     */
    const asked = {};
    for (const [label, w, h, dpr, mobile] of [
      ["1x", 1440, 900, 1, false],
      ["2x", 1440, 900, 2, false],
      ["3x", 1440, 900, 3, false],
    ]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: h,
        deviceScaleFactor: dpr,
        mobile,
      });
      await page.goto(`${base}/calendar`);
      const appeared = await page
        .until(`document.querySelectorAll('img[srcset*="w_"]').length > 0`, { timeout: 45000 })
        .then(() => true)
        .catch(() => false);
      if (!appeared) {
        const why = await page.eval(
          `JSON.stringify({ path: location.pathname, imgs: document.querySelectorAll('img').length, cloudinary: document.querySelectorAll('img[src*="cloudinary"], img[srcset*="cloudinary"]').length, text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 120) })`,
        );
        ok(`${label}: ô có ảnh của ngày`, false, why);
        continue;
      }
      await new Promise((r) => setTimeout(r, 2200));

      const thumbs = JSON.parse(await page.eval(THUMBS));
      const first = thumbs[0];
      asked[label] = first?.asked ?? 0;

      const enough = thumbs.every((t) => {
        const need = Math.min(t.css * dpr, Math.max(...t.offered));
        return t.asked >= need - 1;
      });
      ok(
        `${label}: ô ${first?.css}px xin ảnh ${first?.asked}px (có ${first?.offered?.join("/")})`,
        thumbs.length > 0 && enough,
        enough ? "" : "ảnh nhỏ hơn mật độ màn hình — sẽ bị mờ",
      );

      const undecoded = thumbs.filter((t) => t.complete && !t.decoded);
      ok(`${label}: ảnh giải mã được`, undecoded.length === 0, undecoded.length ? `${undecoded.length} ảnh lỗi` : "");
      if (shotDir) await page.shot(`${shotDir}/calendar-${label.replace(/\W+/g, "-")}.png`);
    }

    const followsDensity = asked["3x"] > asked["1x"];
    ok(
      `mật độ màn hình quyết định kích thước ảnh (1x ${asked["1x"]}px → 3x ${asked["3x"]}px)`,
      followsDensity,
      followsDensity ? "" : "cùng một kích thước ở mọi mật độ — srcset không được dùng",
    );
    ok("không ảnh Cloudinary nào lỗi tải", broken.length === 0, broken.slice(0, 3).join(" | "));
  } finally {
    page.close();
    chrome.kill();
  }
  return results;
}
