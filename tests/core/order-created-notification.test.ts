// @ts-expect-error Tests run with Bun, while this project intentionally omits Bun's global type package.
import { afterEach, describe, expect, test } from "bun:test";
// @ts-expect-error Tests run with Bun, while this project intentionally omits Bun's global type package.
import type { Database } from "bun:sqlite";
import { processOrderEvents } from "../../server/email/order-events.ts";
import { paymentRepository } from "../../server/payment/repository.ts";
import { createTestDatabase } from "../helpers/sqlite-d1.ts";

const databases: Array<ReturnType<typeof createTestDatabase>> = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function insertOrder(sqlite: Database, orderNo: string, amount: number) {
  const now = Date.now();
  sqlite.query("INSERT INTO `order` (orderNo, productNameSnapshot, productSkuNameSnapshot, unitPrice, quantity, amount, contactType, contactValue, paymentProvider, paymentChannel, fulfillmentSourceSnapshot, deliveryTypeSnapshot, status, paymentStatus, deliveryStatus, createdAt, updatedAt) VALUES (?, '音乐会员', '月卡', ?, 1, ?, 'EMAIL', 'buyer@example.com', 'OWNPAY', 'wechat', 'LOCAL', 'MANUAL', 'PENDING', 'UNPAID', 'NOT_DELIVERED', ?, ?)")
    .run(orderNo, amount, amount, now, now);
  return (sqlite.query("SELECT id FROM `order` WHERE orderNo = ?").get(orderNo) as { id: number }).id;
}

function insertAttempt(sqlite: Database, orderId: number) {
  const now = Date.now();
  sqlite.query("INSERT INTO paymentAttempt (orderId, provider, channel, status, createdAt, updatedAt) VALUES (?, 'OWNPAY', 'wechat', 'CREATING', ?, ?)").run(orderId, now, now);
  return Number(sqlite.query("SELECT last_insert_rowid() AS id").get()!.id);
}

describe("order-created notifications", () => {
  test("queues one administrator event after the initial payable attempt is ready", async () => {
    const context = createTestDatabase();
    databases.push(context);
    const now = Date.now();
    const orderId = insertOrder(context.sqlite, "ORDER-CREATED-1", 500);
    const attemptId = insertAttempt(context.sqlite, orderId);

    context.sqlite.query("INSERT INTO user (id, name, email, emailVerified, twoFactorEnabled, createdAt, updatedAt) VALUES ('root', 'Root', 'root@example.com', 1, 0, ?, ?)").run(now, now);
    context.sqlite.query("INSERT INTO adminBootstrap (id, userId, createdAt) VALUES (1, 'root', ?)").run(now);
    context.sqlite.query("INSERT INTO siteSetting (id, siteName, siteUrl, registrationEnabled, timezone, createdAt, updatedAt) VALUES (1, 'Catshop', 'https://catshop.example.com', 0, 'Asia/Shanghai', ?, ?)").run(now, now);
    context.sqlite.query("INSERT INTO pushChannelConfig (channel, provider, name, isEnabled, configJson, createdAt, updatedAt) VALUES ('EMAIL', 'CLOUDFLARE', 'Test Email', 1, ?, ?, ?)")
      .run(JSON.stringify({ schemaVersion: 1, kind: "cloudflare", from: "shop@example.com" }), now, now);
    context.sqlite.query("INSERT INTO emailTemplate (scene, name, templateJson, createdAt, updatedAt) VALUES ('ORDER_CREATED', '新订单', ?, ?, ?)")
      .run(JSON.stringify({ schemaVersion: 1, format: "text", subject: "新订单 {{orderNo}}", body: "{{productName}} {{productSkuName}} {{amount}} {{paymentMethod}} {{createdAt}}" }), now, now);
    context.sqlite.query("INSERT INTO pushPolicy (messageType, scene, channelsJson, isEnabled, createdAt, updatedAt) VALUES ('ADMIN', 'ORDER_CREATED', '[\"EMAIL\"]', 1, ?, ?)").run(now, now);

    const repository = paymentRepository(context.database);
    await repository.completeAttempt(attemptId, "op-1", now + 300_000, orderId);
    await repository.completeAttempt(insertAttempt(context.sqlite, orderId), "op-2", now + 300_000);

    expect(context.sqlite.query("SELECT scene, status FROM orderEvent").all()).toEqual([{ scene: "ORDER_CREATED", status: "PENDING" }]);

    const sent: Array<{ to: string; subject: string; text?: string }> = [];
    expect(await processOrderEvents(context.database, { EMAIL: { async send(message: { to: string; subject: string; text?: string }) { sent.push(message); return { messageId: "created-1" }; } } })).toEqual({ attempted: 1, processed: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "root@example.com", subject: "新订单 ORDER-CREATED-1" });
    expect(sent[0]?.text).toContain("音乐会员 月卡 ¥5.00 OwnPay · 微信");
  });

  test("does not queue the waiting-payment event for a zero-value order", async () => {
    const context = createTestDatabase();
    databases.push(context);
    const orderId = insertOrder(context.sqlite, "ORDER-CREATED-FREE", 0);
    await paymentRepository(context.database).completeAttempt(insertAttempt(context.sqlite, orderId), "free-1", Date.now() + 300_000, orderId);
    expect(context.sqlite.query("SELECT COUNT(*) AS value FROM orderEvent").get()).toEqual({ value: 0 });
  });
});
