/*
 * Notebook templates must be accepted by the server as they are: a template
 * with a seventh column, or a comma inside a column name (the columns box is
 * split on commas), would turn "Tạo sổ" into an error on the first tap.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { NOTEBOOK_SPANS, NOTEBOOK_TEMPLATES, templateFits } from "@/lib/notebook-templates";
import { NOTEBOOK_LIMITS } from "@/lib/notebook";

test("every template fits the server's limits", () => {
  for (const t of NOTEBOOK_TEMPLATES) assert.ok(templateFits(t), t.name);
});

test("the check itself catches what would break", () => {
  const base = NOTEBOOK_TEMPLATES[0];
  assert.ok(!templateFits({ ...base, slots: Array(NOTEBOOK_LIMITS.slots + 1).fill("Cột") }));
  assert.ok(!templateFits({ ...base, slots: ["Trưa, tối"] }));
  assert.ok(!templateFits({ ...base, slots: ["x".repeat(NOTEBOOK_LIMITS.slotLabel + 1)] }));
  assert.ok(!templateFits({ ...base, days: NOTEBOOK_LIMITS.days + 1 }));
});

test("spans are within the day limit", () => {
  for (const s of NOTEBOOK_SPANS) assert.ok(s.days > 0 && s.days <= NOTEBOOK_LIMITS.days, s.label);
});
