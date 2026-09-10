// Registers the resolver in the loader thread. Passed to node with --import.
import { register } from "node:module";
register("./alias-resolver.mjs", import.meta.url);
