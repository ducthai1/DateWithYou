import { z } from "zod";
import { TRPCError } from "@trpc/server";

/** Input pieces both notebook routers share. */
export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const slotKey = z.string().min(1).max(60);

export const notFound = () => new TRPCError({ code: "NOT_FOUND" });
