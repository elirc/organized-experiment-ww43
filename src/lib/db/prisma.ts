/**
 * Exposes a singleton Prisma client for repository code and seed scripts.
 * Called by files in src/repositories/*.ts.
 * A junior engineer often instantiates Prisma per request in Next.js, which
 * leaks connections during development and makes production pooling harder.
 */
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// ⚠️ SENIOR NOTE: Reusing the client in development avoids hot-reload
// connection storms, which are easy to miss until the DB starts refusing work.
export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export type DatabaseClient = PrismaClient | Prisma.TransactionClient;
