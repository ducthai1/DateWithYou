/**
 * Self-declared gender, used for exactly one thing: wording copy addressed to
 * a particular person.
 *
 * Lives in `lib` rather than beside the auth helpers because the client needs
 * the type too (the calendar label and the vault panel both pick their wording
 * from it), and the auth module is `server-only` — importing it from a client
 * component would drag a server module into the browser bundle.
 */
export type Gender = "male" | "female";

/**
 * Narrow whatever is stored on the user document.
 *
 * Anything unexpected — missing, empty, an old value — reads as "not answered"
 * so callers fall back to neutral wording. Nothing is ever inferred from a
 * name or an email: a guess here misgenders a real person, which the neutral
 * default never does.
 */
export function asGender(value: unknown): Gender | null {
  return value === "male" || value === "female" ? value : null;
}
