/*
 * Imported FIRST by the fail-closed blog test, before the harness pulls in
 * `@/lib/env`, so that module parses an empty allowlist. Import order inside
 * an ES module is source order, which is the whole mechanism here.
 */
process.env.TEST_ADMIN_EMAILS = "";
