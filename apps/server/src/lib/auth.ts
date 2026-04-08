import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "@worknest/db";
import { users, sessions, accounts, verifications } from "@worknest/db";

/**
 * Create the Better Auth instance.
 *
 * Uses email + password provider with DB-backed sessions and httpOnly cookies.
 * Rate limiting for login is handled at the Fastify middleware level
 * (see middleware/rate-limit.ts).
 */
export function createAuth(db: Database) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minute cookie cache
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day — refresh session if older
    },

    advanced: {
      cookiePrefix: "worknest",
    },

    trustedOrigins: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : ["http://localhost:3000"],
  });
}

export type Auth = ReturnType<typeof createAuth>;
