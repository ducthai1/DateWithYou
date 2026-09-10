import { z } from "zod";

/**
 * The input schema for an update, built from the schema used to create.
 *
 * Use this instead of `.partial()`. zod keeps a field's `.default()` when an
 * object is made partial, so a key the client never sent still arrives as its
 * default value — and a handler that spreads the parsed input into `$set`
 * then writes that default over whatever was stored. A patch meaning "just
 * these two fields" silently resets every defaulted one.
 *
 * It cost real data: deleting one photo from a memory sends only
 * `{ id, photos }`, and the omitted `tags`, `embeds` and `mentions` arrived as
 * `[]`, so the memory lost its tags and links. Saving a blog post's title sent
 * no `status`, which arrived as `"draft"` — the post unpublished itself, body
 * and excerpt blanked with it.
 *
 * Taking the defaults off means an omitted key stays `undefined` and is never
 * written. Every other rule on the field — length, enum, regex — is untouched,
 * and `create` keeps its defaults because it uses the original schema.
 */
/** The schema a wrapper like `.optional()` or `.default()` wraps. */
function inner(field: z.ZodTypeAny): z.ZodTypeAny {
  return (field.def as unknown as { innerType: z.ZodTypeAny }).innerType;
}

/**
 * The same field with every `.default()` taken out of its wrapper chain.
 *
 * A default can sit under an `.optional()` — `.default(0).optional()` reads as
 * "optional" from the outside, and zod still fills the default in when the key
 * is missing — so it is not enough to look at the outermost wrapper. The
 * `.optional()` and `.nullable()` layers are rebuilt as they were, because a
 * field that accepts null must go on accepting it.
 */
function withoutDefaults(field: z.ZodTypeAny): z.ZodTypeAny {
  switch (field.def?.type) {
    case "default":
    case "prefault":
      return withoutDefaults(inner(field));
    case "optional":
      return withoutDefaults(inner(field)).optional();
    case "nullable":
      return withoutDefaults(inner(field)).nullable();
    default:
      return field;
  }
}

export function patchOf<T extends z.ZodObject>(schema: T): ReturnType<T["partial"]> {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const patched: Record<string, z.ZodTypeAny> = {};

  for (const key of Object.keys(shape)) {
    patched[key] = withoutDefaults(shape[key]).optional();
  }

  // Statically identical to `schema.partial()` — every field optional — so
  // handlers and their types are unchanged. Only the runtime differs.
  return z.object(patched) as unknown as ReturnType<T["partial"]>;
}
