/*
 * The wheel must never land on a place nobody chose.
 *
 * Confirming a day plan can save a place Google found. Those rows live in the
 * same collection the wheel spins over, and the wheel's whole promise is that
 * whatever it lands on is somewhere the two of them already liked the look of.
 * One stranger in the wheel and that promise is gone — silently, with no error
 * anywhere.
 *
 * The filter is server-side, so this is the check that proves the wiring
 * end-to-end rather than just the query. It reads the wheel itself: the hub
 * counts what is in play and every wedge carries its name, so a suggestion
 * that is being excluded is simply absent from the page.
 *
 * Nothing here touches Google or Stadia. Places are written straight into
 * Mongo — `location.create` reverse-geocodes over the network.
 */
import { launchChrome, openPage } from "./cdp.mjs";
import { signIn } from "./session.mjs";

export const name = "Quán gợi ý: vòng quay không bao giờ quay trúng";

const OURS = ["Cà phê Của Mình A", "Cà phê Của Mình B", "Cà phê Của Mình C"];
const THEIRS = "Cà phê Máy Gợi Ý";

export async function run({ base, profileDir, port, db, shotDir }) {
  const chrome = await launchChrome(`${profileDir}`, port, { width: 430, height: 900 });
  const page = await openPage(port);
  const results = [];
  const ok = (name, pass, detail = "") => results.push({ ok: pass, name, detail });
  let spaceId = null;

  try {
    await page.viewport(430, 900, true);
    const me = await signIn(page, base, db);
    spaceId = me.spaceId;

    // A clean slate for this suite only: these four names, nothing else.
    const names = [...OURS, THEIRS];
    await db.collection("locations").deleteMany({ spaceId, name: { $in: names } });
    await db.collection("locations").insertMany(
      names.map((name, i) => ({
        spaceId,
        name,
        district: "Phường Sài Gòn",
        category: "Cà phê",
        geo: { lat: 10.776 + i / 10_000, lng: 106.70 + i / 10_000 },
        status: "want_to_go",
        // Open all day, so the wheel's opening-hours filter cannot be what
        // removes a place and make this suite pass for the wrong reason.
        openTime: "00:00",
        closeTime: "23:59",
        source: name === THEIRS ? "suggested" : "user",
        ...(name === THEIRS ? { externalId: "ChIJ-e2e-suggested-0001" } : {}),
        createdBy: me.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );

    /* ——— the wheel ——————————————————————————————————————————— */
    await page.goto(`${base}/wheel`);
    await page.until(
      `[...document.querySelectorAll('span')].some(s => /Của Mình A/.test(s.textContent||''))`,
      { timeout: 60000 },
    );

    const wheel = JSON.parse(await page.eval(`(() => {
      const text = document.body.innerText;
      return JSON.stringify({
        ours: ${JSON.stringify(OURS)}.filter((n) => text.includes(n)).length,
        theirs: text.includes(${JSON.stringify(THEIRS)}),
      });
    })()`));
    ok(`cả ${OURS.length} quán của mình đều có trên vòng quay`, wheel.ours === OURS.length,
      `thấy ${wheel.ours}/${OURS.length}`);
    ok("quán gợi ý chưa giữ KHÔNG có trên vòng quay", wheel.theirs === false,
      wheel.theirs ? "nó đang nằm trong vòng quay — đúng lỗi phải chặn" : "");

    // And a real spin, because the wedges being right is not the same claim as
    // the winner coming from them.
    await page.eval(`[...document.querySelectorAll('button')].find(b => /Quay!/.test(b.textContent||''))?.click()`);
    const won = await page.until(
      `/Tụi mình đi/.test(document.body.innerText)`, { timeout: 30000 },
    ).then(() => true).catch(() => false);
    ok("quay xong có kết quả", won);
    if (won) {
      const winner = await page.eval(`document.body.innerText`);
      ok("kết quả không phải quán gợi ý", !winner.includes(THEIRS));
    }
    if (shotDir) await page.shot(`${shotDir}/suggested-wheel.png`);

    /* ——— the list ————————————————————————————————————————————— */
    await page.goto(`${base}/map`);
    await page.until(`document.body.innerText.includes(${JSON.stringify(THEIRS)})`, { timeout: 60000 });
    const list = JSON.parse(await page.eval(`(() => {
      const text = document.body.innerText;
      return JSON.stringify({
        shows: text.includes(${JSON.stringify(THEIRS)}),
        badged: /Gợi ý — chưa phải chỗ của mình/.test(text),
        keepable: [...document.querySelectorAll('button')].some(b => /Giữ lại/.test(b.textContent||'')),
      });
    })()`));
    ok("danh sách VẪN hiện quán gợi ý", list.shows);
    ok("và có dấu nhận biết trên DOM", list.badged);
    ok("và có nút Giữ lại", list.keepable);
    if (shotDir) await page.shot(`${shotDir}/suggested-list.png`);

    /* ——— keeping it ——————————————————————————————————————————— */
    await page.eval(`[...document.querySelectorAll('button')].find(b => /Giữ lại/.test(b.textContent||''))?.click()`);
    const kept = await page.until(
      `document.body.innerText.includes("giờ nó là chỗ của mình")`, { timeout: 30000 },
    ).then(() => true).catch(() => false);
    ok("bấm Giữ lại báo đã giữ", kept);

    const row = await db.collection("locations").findOne({ spaceId, name: THEIRS });
    ok("và trong DB nó thành chỗ của mình", row?.source === "user", `source=${row?.source}`);

    await page.goto(`${base}/wheel`);
    await page.until(
      `[...document.querySelectorAll('span')].some(s => /Của Mình A/.test(s.textContent||''))`,
      { timeout: 60000 },
    );
    const after = await page.eval(`document.body.innerText.includes(${JSON.stringify(THEIRS)})`);
    ok("giữ lại rồi thì vòng quay mới nhận nó", after === true);
  } finally {
    if (spaceId) {
      await db.collection("locations")
        .deleteMany({ spaceId, name: { $in: [...OURS, THEIRS] } })
        .catch(() => {});
    }
    page.close();
    chrome.kill();
  }
  return results;
}
