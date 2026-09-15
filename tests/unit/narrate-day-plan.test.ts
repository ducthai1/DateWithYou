/*
 * What happens when the model is slow, broken, absent, or lying.
 *
 * Those four are the normal cases, not the edge cases — a free tier has no
 * SLA and can vanish between one afternoon and the next. Every one of them has
 * to end the same way: no narration, and a plan that is still whole.
 *
 * The "network" here is a server this test starts on the loopback interface
 * and shuts down again. No third party is called and no quota is spent, which
 * is the rule these suites keep; a real timeout cannot be demonstrated any
 * other way, and a timeout that is never exercised is a timeout nobody knows
 * the value of.
 */
import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import {
  narrateDayPlan,
  __clearNarrationCache,
} from "../../src/server/lib/narrate-day-plan.ts";
import type { NarrationFact } from "../../src/lib/day-plan-narration.ts";

const FACTS: NarrationFact[] = [
  { title: "Cà phê Vợt", kind: "cafe", reason: "Chỗ hai người lưu mà chưa ghé lần nào." },
  { title: "Quán Nướng Lá Chuối", kind: "meal", reason: "Bạn chấm 5 sao cho chỗ này." },
];

const servers: Server[] = [];
after(() => { for (const s of servers) s.close(); });

/** A stand-in for whichever provider gets chosen, speaking the same shape. */
async function fakeProvider(handler: (respond: (status: number, body: unknown) => void) => void) {
  const server = createServer((_req, res) => {
    handler((status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  process.env.DAY_PLAN_LLM_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
  process.env.DAY_PLAN_LLM_KEY = "test-key";
  process.env.DAY_PLAN_LLM_MODEL = "test-model";
  __clearNarrationCache();
}

const said = (content: unknown) => ({ choices: [{ message: { content } }] });

function unsetProvider() {
  delete process.env.DAY_PLAN_LLM_URL;
  delete process.env.DAY_PLAN_LLM_KEY;
  delete process.env.DAY_PLAN_LLM_MODEL;
  __clearNarrationCache();
}

describe("with nobody to ask", () => {
  test("it says so at once, and that is a supported state", async () => {
    // Today's normal case: no provider has been chosen, on purpose, and the
    // feature ships anyway.
    unsetProvider();
    const out = await narrateDayPlan(FACTS);
    assert.equal(out.narration, null);
    assert.equal(out.reason, "no-provider");
  });
});

describe("with a provider", () => {
  test("a good answer comes through", async () => {
    await fakeProvider((respond) =>
      respond(200, said(JSON.stringify({
        dayName: "Chiều lười",
        whys: ["Ngồi ngắm phố một lúc đã.", "Rồi ăn tối thật no."],
      }))),
    );
    const out = await narrateDayPlan(FACTS);
    assert.equal(out.reason, "ok");
    assert.equal(out.narration?.dayName, "Chiều lười");
  });

  test("the second ask for the same places costs nothing", async () => {
    let calls = 0;
    await fakeProvider((respond) => {
      calls++;
      respond(200, said(JSON.stringify({ dayName: "Chiều lười", whys: ["Một.", "Hai."] })));
    });
    await narrateDayPlan(FACTS);
    await narrateDayPlan(FACTS);
    assert.equal(calls, 1, "swapping a stop must not re-ask for sentences already written");
  });

  test("a made-up place is refused, and the plan keeps its own words", async () => {
    await fakeProvider((respond) =>
      respond(200, said(JSON.stringify({
        dayName: "Chiều lười",
        whys: ['Ghé "Quán Ốc Cô Ba" trước đã.', "Rồi ăn tối."],
      }))),
    );
    const out = await narrateDayPlan(FACTS);
    assert.equal(out.narration, null);
    assert.equal(out.reason, "rejected");
  });

  test("an answer that invents opening hours is refused", async () => {
    await fakeProvider((respond) =>
      respond(200, said(JSON.stringify({
        dayName: "Chiều lười",
        whys: ["Mở tới 22h nên cứ thong thả.", "Rồi ăn tối."],
      }))),
    );
    assert.equal((await narrateDayPlan(FACTS)).reason, "rejected");
  });

  test("an error from the provider is not an error for the rider", async () => {
    await fakeProvider((respond) => respond(429, { error: "rate limited" }));
    const out = await narrateDayPlan(FACTS);
    assert.equal(out.narration, null);
    assert.equal(out.reason, "http");
  });

  test("prose instead of JSON is refused", async () => {
    await fakeProvider((respond) => respond(200, said("Chào bạn! Kế hoạch của bạn đây nhé:")));
    assert.equal((await narrateDayPlan(FACTS)).reason, "rejected");
  });

  test("slower than two seconds and we stop waiting", async () => {
    /*
     * The number that matters. Somebody is looking at a spinner, and the plan
     * behind it has been ready the whole time — waiting on prose past this
     * point is spending their patience on decoration.
     */
    await fakeProvider((respond) => {
      setTimeout(() => respond(200, said(JSON.stringify({ dayName: "Muộn", whys: ["a", "b"] }))), 5_000);
    });
    const started = Date.now();
    const out = await narrateDayPlan(FACTS);
    const waited = Date.now() - started;
    assert.equal(out.narration, null);
    assert.equal(out.reason, "timeout");
    assert.ok(waited < 3_000, `waited ${waited}ms, which is past the point of giving up`);
  });
});
