import { and, eq, isNull, lte, or } from "drizzle-orm";
import type { AppDb } from "@/database/drizzle";
import { schema } from "@/database/drizzle/schema";

const EMAIL_CHANGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const EMAIL_CHANGE_RESEND_INTERVAL_MS = 60 * 1000;

export async function reserveEmailChangeRequest(db: AppDb, input: {
  userId: string;
  newEmail: string;
  requestedAt: Date;
}) {
  const changeCutoff = new Date(input.requestedAt.getTime() - EMAIL_CHANGE_INTERVAL_MS);
  const resendCutoff = new Date(input.requestedAt.getTime() - EMAIL_CHANGE_RESEND_INTERVAL_MS);
  const result = await db
    .update(schema.user)
    .set({ emailChangePendingEmail: input.newEmail, emailChangeLastSentAt: input.requestedAt })
    .where(and(
      eq(schema.user.id, input.userId),
      or(isNull(schema.user.emailChangeRequestedAt), lte(schema.user.emailChangeRequestedAt, changeCutoff)),
      or(isNull(schema.user.emailChangeLastSentAt), lte(schema.user.emailChangeLastSentAt, resendCutoff)),
    ))
    .returning({ id: schema.user.id });

  return result.length > 0;
}
