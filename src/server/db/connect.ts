import "server-only";
import mongoose from "mongoose";
import { requireEnv } from "@/lib/env";

/**
 * Cached Mongoose connection.
 *
 * Reused across dev hot-reloads and warm serverless invocations so we don't
 * open a new pool per request. maxPoolSize is kept small because each
 * serverless instance handles few concurrent requests, and many instances ×
 * a large pool would exhaust Atlas M0's ~500-connection cap.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  _mongooseCache?: MongooseCache;
};

const cache: MongooseCache =
  globalForMongoose._mongooseCache ?? { conn: null, promise: null };
globalForMongoose._mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = requireEnv("MONGODB_URI");
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 30000,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
