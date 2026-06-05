import { router, publicProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";

export const healthRouter = router({
  check: publicProcedure.query(async () => {
    let dbConnected = false;
    try {
      const conn = await connectToDatabase();
      // 1 === connected (mongoose ConnectionStates)
      dbConnected = conn.connection.readyState === 1;
    } catch {
      dbConnected = false;
    }
    return { ok: true, dbConnected };
  }),
});
