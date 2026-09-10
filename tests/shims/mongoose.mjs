/*
 * Named imports from mongoose, for a plain Node test process.
 *
 * The app writes `import { Schema, model, models } from "mongoose"`, which a
 * bundler resolves happily. Node cannot: mongoose is CommonJS, and Node only
 * exposes the named exports its static lexer can see — `models` is not one of
 * them, so importing any model file failed with "does not provide an export
 * named 'models'".
 *
 * The resolver points every `mongoose` import inside src/ here, and here the
 * default export is unpacked by hand. Nothing in the app changes, and no test
 * runner has to be installed to paper over it.
 */
import mongoose from "mongoose";

export default mongoose;
export const {
  Schema,
  model,
  models,
  connect,
  disconnect,
  connection,
  Types,
  isValidObjectId,
  startSession,
  set,
} = mongoose;
