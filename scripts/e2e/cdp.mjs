// Minimal Chrome DevTools Protocol harness — no puppeteer. Node 22 (global WebSocket).
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const DEFAULT_PORT = 9333;
const hostFor = (port) => `http://127.0.0.1:${port}`;

export async function launchChrome(profileDir, port = DEFAULT_PORT, { width = 1400, height = 900, extraArgs = [] } = {}) {
  mkdirSync(profileDir, { recursive: true });
  const child = spawn("google-chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${width},${height}`, "--force-color-profile=srgb", ...extraArgs, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${hostFor(port)}/json/version`); if (r.ok) return child; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error("Chrome did not open its debugging port");
}

/**
 * @param {number} port
 * @param {{ existing?: boolean }} [opts] `existing: true` nối vào TAB ĐANG MỞ
 *   thay vì mở tab mới. Cần cho cửa sổ `--app=`: chỉ tab gốc của nó mới báo
 *   `display-mode: standalone`, còn tab mở thêm là tab thường — nên đo chế độ
 *   "app đã cài" trên một tab mới là đo nhầm chế độ.
 */
export async function openPage(port = DEFAULT_PORT, opts = {}) {
  let webSocketDebuggerUrl;
  if (opts.existing) {
    const list = await fetch(`${hostFor(port)}/json/list`).then((r) => r.json());
    const tab = list.find((t) => t.type === "page");
    if (!tab) throw new Error("không thấy tab nào đang mở để nối vào");
    webSocketDebuggerUrl = tab.webSocketDebuggerUrl;
  } else {
    const res = await fetch(`${hostFor(port)}/json/new?about:blank`, { method: "PUT" });
    ({ webSocketDebuggerUrl } = await res.json());
  }
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 30000);
  });
  const waitForEvent = (method, timeout = 20000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${method}`)), timeout);
    const l = (msg) => { if (msg.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(msg.params); } };
    listeners.push(l);
  });
  await send("Page.enable"); await send("Runtime.enable");
  /*
   * Treat the tab as focused and visible.
   *
   * Two headless pages are two unfocused windows, and React Query's polling
   * intervals do not run in an unfocused window — so a two-device check would
   * sit waiting for news that the app had decided not to fetch. On two real
   * phones both apps are in the foreground; this makes the harness match that
   * instead of testing a state no user is in.
   */
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  const page = {
    send, waitForEvent,
    on(method, fn) { const l = (m) => { if (m.method === method) fn(m.params); }; listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
    close: () => ws.close(),
    async viewport(width, height, mobile, deviceScaleFactor = mobile ? 3 : 1) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile });
    },
    async goto(url) { const loaded = waitForEvent("Page.loadEventFired", 60000); await send("Page.navigate", { url }); await loaded.catch(() => {}); },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error(`${d.text}: ${d.exception?.description ?? d.exception?.value ?? ""}`); }
      return r.result?.value;
    },
    async until(expression, { timeout = 20000 } = {}) {
      const started = Date.now();
      while (Date.now() - started < timeout) { try { if (await page.eval(expression)) return true; } catch {} await new Promise((r) => setTimeout(r, 150)); }
      throw new Error(`timed out waiting for: ${expression.slice(0, 120)}`);
    },
    /*
     * Thanh cuộn ngang, đo ở ĐÚNG phần tử đang cuộn.
     *
     * `document.documentElement.scrollWidth <= innerWidth` là phép kiểm sai
     * trong app này và nó im lặng suốt: PageShell lồng một div
     * `overflow-x: auto` bên trong, nên chính div đó cuộn còn documentElement
     * thì không bao giờ rộng ra. Một trang tràn 56px vẫn cho qua.
     * Trả về null nếu sạch, còn không thì mô tả kẻ tràn để người đọc biết sửa ở đâu.
     */
    async horizontalOverflow() {
      const raw = await page.eval(`(() => {
        const bad = [document.documentElement, ...document.querySelectorAll('*')].find(el => {
          if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth === 0) return false;
          const ox = getComputedStyle(el).overflowX;
          return el === document.documentElement ? true : (ox === "auto" || ox === "scroll");
        });
        if (!bad) return "null";
        const widest = [...bad.querySelectorAll('*')]
          .map(el => ({ r: Math.round(el.getBoundingClientRect().right), tag: el.tagName.toLowerCase(),
                        cls: (el.className||"").toString().slice(0,60), txt: (el.textContent||"").trim().slice(0,32) }))
          .filter(x => x.r > bad.clientWidth + 1).sort((a,b) => b.r - a.r)[0];
        return JSON.stringify({
          by: bad.scrollWidth - bad.clientWidth,
          scroller: (bad.className||bad.tagName||"").toString().slice(0,60),
          widest: widest ? '<' + widest.tag + '> ' + widest.cls + ' "' + widest.txt + '"' : null,
        });
      })()`);
      if (raw === "null") return null;
      const o = JSON.parse(raw);
      return `tràn ${o.by}px ở [${o.scroller}]${o.widest ? " — rộng nhất: " + o.widest : ""}`;
    },
    async shot(file, { fullPage = false } = {}) {
      let clip;
      if (fullPage) {
        const m = await page.eval(`JSON.stringify({w: document.documentElement.scrollWidth, h: Math.min(document.documentElement.scrollHeight, 6000)})`);
        const { w, h } = JSON.parse(m);
        clip = { x: 0, y: 0, width: w, height: h, scale: 1 };
      }
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
  };
  return page;
}
