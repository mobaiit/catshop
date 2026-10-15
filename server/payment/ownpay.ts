import { parseOwnpayConfig } from "@/lib/config-schemas";
import type { PaymentAdapter, PaymentNotifyResult } from "./types";

type OwnpayEnvelope = {
  code?: string;
  message?: string;
  data?: Record<string, unknown>;
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index]! ^ b[index]!;
  return difference === 0;
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function status(value: unknown): PaymentNotifyResult["status"] {
  return value === "paid" || value === "paid_manual" ? "PAID" : value === "pending" ? "PENDING" : "FAILED";
}

async function parseResponse(response: Response): Promise<OwnpayEnvelope> {
  let body: OwnpayEnvelope;
  try { body = await response.json<OwnpayEnvelope>(); } catch { throw new Error("OWNPAY_INVALID_RESPONSE"); }
  if (!response.ok || body.code !== "OK" || !body.data) throw new Error(`OWNPAY_REQUEST_FAILED:${body.code ?? response.status}`);
  return body;
}

export function createOwnpayAdapter(configValue: Record<string, unknown>): PaymentAdapter {
  const config = parseOwnpayConfig(JSON.stringify(configValue));

  async function request(method: "GET" | "POST", path: string, payload?: unknown) {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const timestamp = String(Date.now());
    const nonce = base64Url(crypto.getRandomValues(new Uint8Array(18)));
    const canonical = `${method}\n${path}\n${timestamp}\n${nonce}\n${await sha256Hex(body)}`;
    return fetch(`${config.baseUrl}${path}`, {
      method,
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "X-OwnPay-App-Id": config.appId,
        "X-OwnPay-Timestamp": timestamp,
        "X-OwnPay-Nonce": nonce,
        "X-OwnPay-Signature": await hmac(config.apiSecret, canonical),
      },
      ...(body ? { body } : {}),
    });
  }

  function notify(data: Record<string, unknown>, verified: boolean, message: string): PaymentNotifyResult {
    return {
      provider: "OWNPAY",
      verified,
      orderNo: typeof data.out_trade_no === "string" ? data.out_trade_no : undefined,
      paymentOrderNo: typeof data.order_no === "string" ? data.order_no : undefined,
      amount: integer(data.original_amount),
      currency: "CNY",
      status: status(data.status),
      message,
    };
  }

  return {
    async create(input) {
      const channel = input.channel === "alipay" ? "alipay" : "wechat";
      const envelope = await parseResponse(await request("POST", "/api/v1/orders", {
        out_trade_no: input.orderNo,
        original_amount: input.amount,
        pay_type: channel,
        subject: input.subject,
        attach: { source: "catshop" },
        return_url: input.returnUrl,
      }));
      const data = envelope.data!;
      if (typeof data.qr_url !== "string" || typeof data.order_no !== "string" || !integer(data.expires_at)) throw new Error("OWNPAY_INVALID_RESPONSE");
      let qrUrl: URL;
      try { qrUrl = new URL(data.qr_url); } catch { throw new Error("OWNPAY_INVALID_RESPONSE"); }
      if (qrUrl.origin !== new URL(config.baseUrl).origin || integer(data.expires_at)! <= Date.now()) throw new Error("OWNPAY_INVALID_RESPONSE");
      return {
        mode: "qr",
        qrImageUrl: qrUrl.toString(),
        paymentOrderNo: data.order_no,
        payableAmount: integer(data.actual_amount),
        expiresAt: integer(data.expires_at),
      };
    },
    async verify(input) {
      const timestamp = input.headers?.get("X-OwnPay-Timestamp") ?? "";
      const signature = input.headers?.get("X-OwnPay-Signature") ?? "";
      const rawBody = input.rawBody ?? input.payload.__raw_body ?? "";
      const timestampNumber = Number(timestamp);
      const signatureValid = Number.isSafeInteger(timestampNumber)
        && Math.abs(Date.now() - timestampNumber) <= 300_000
        && safeEqual(signature, await hmac(config.callbackSecret, `${timestamp}\n${rawBody}`));
      let event: { event_type?: unknown; data?: unknown } = {};
      try { event = JSON.parse(rawBody) as typeof event; } catch { return notify({}, false, "OWNPAY_CALLBACK_INVALID"); }
      const data = event.data && typeof event.data === "object" && !Array.isArray(event.data) ? event.data as Record<string, unknown> : {};
      const supported = event.event_type === "order.paid" || event.event_type === "order.paid_manual_match" || event.event_type === "order.paid_manual_override";
      return notify(data, signatureValid && supported, typeof event.event_type === "string" ? event.event_type : "OWNPAY_CALLBACK_INVALID");
    },
    async query(input) {
      const envelope = await parseResponse(await request("GET", `/api/v1/orders/${encodeURIComponent(input.orderNo)}`));
      return { ...notify(envelope.data!, true, "OWNPAY_QUERY"), provider: "OWNPAY" };
    },
    async cancel(input) {
      const response = await request("POST", `/api/v1/orders/${encodeURIComponent(input.orderNo)}/cancel`, {});
      let body: OwnpayEnvelope = {};
      try { body = await response.json<OwnpayEnvelope>(); } catch { return { status: "FAILED", message: "OWNPAY_INVALID_RESPONSE" }; }
      if (response.ok && body.code === "OK") return { status: "CANCELLED", message: "OWNPAY_CANCELLED" };
      if (response.status === 409) {
        const queried = await parseResponse(await request("GET", `/api/v1/orders/${encodeURIComponent(input.orderNo)}`));
        const queriedStatus = status(queried.data?.status);
        if (queriedStatus === "PAID") return { status: "PAID", message: "OWNPAY_ALREADY_PAID" };
        if (queriedStatus === "FAILED") return { status: "CANCELLED", message: "OWNPAY_ALREADY_CLOSED" };
        return { status: "FAILED", message: String(body.code ?? "OWNPAY_CANCEL_CONFLICT") };
      }
      return { status: "FAILED", message: String(body.code ?? `OWNPAY_CANCEL_FAILED:${response.status}`) };
    },
  };
}
