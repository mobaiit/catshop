// @ts-expect-error Tests run with Bun, while this project intentionally omits Bun's global type package.
import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDrizzleDb } from "../../database/drizzle";
import { schema } from "../../database/drizzle/schema";
import { reserveEmailChangeRequest } from "../../server/email-change-rate-limit";
import { createTestDatabase } from "../helpers/sqlite-d1";

describe("email change rate limiting", () => {
  test("stores D1-compatible timestamps and enforces resend and change intervals", async () => {
    const { database, close } = createTestDatabase();
    const db = createDrizzleDb(database);
    const requestedAt = new Date("2026-10-15T10:00:00.000Z");

    try {
      await db.insert(schema.user).values({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        emailVerified: true,
        createdAt: requestedAt,
        updatedAt: requestedAt,
      });

      expect(await reserveEmailChangeRequest(db, {
        userId: "user-1",
        newEmail: "next@example.com",
        requestedAt,
      })).toBe(true);

      expect(await reserveEmailChangeRequest(db, {
        userId: "user-1",
        newEmail: "again@example.com",
        requestedAt: new Date(requestedAt.getTime() + 30_000),
      })).toBe(false);

      expect(await reserveEmailChangeRequest(db, {
        userId: "user-1",
        newEmail: "again@example.com",
        requestedAt: new Date(requestedAt.getTime() + 60_000),
      })).toBe(true);

      await db.update(schema.user)
        .set({ emailChangeRequestedAt: requestedAt, emailChangeLastSentAt: null })
        .where(eq(schema.user.id, "user-1"));

      expect(await reserveEmailChangeRequest(db, {
        userId: "user-1",
        newEmail: "blocked@example.com",
        requestedAt: new Date(requestedAt.getTime() + 23 * 60 * 60 * 1000),
      })).toBe(false);

      expect(await reserveEmailChangeRequest(db, {
        userId: "user-1",
        newEmail: "allowed@example.com",
        requestedAt: new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000),
      })).toBe(true);
    } finally {
      close();
    }
  });
});
