<template>
  <main class="min-h-screen bg-muted/30">
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div class="mx-auto flex min-h-16 max-w-2xl items-center justify-between px-5"><StorefrontBrand /><PublicNav /></div>
    </header>
    <section class="mx-auto max-w-2xl px-5 pb-12 pt-26">
      <Card>
        <CardHeader><CardTitle>订单支付</CardTitle><CardDescription>{{ order ? `订单号：${order.orderNo}` : "正在确认订单信息..." }}</CardDescription></CardHeader>
        <CardContent class="flex flex-col gap-6">
          <Alert v-if="error" variant="destructive"><AlertTitle>无法继续支付</AlertTitle><AlertDescription>{{ error }}</AlertDescription></Alert>
          <template v-else-if="order">
            <dl class="grid grid-cols-2 gap-x-6 gap-y-5 text-sm sm:grid-cols-3">
              <div><dt class="text-xs text-muted-foreground">商品</dt><dd class="mt-1 font-medium">{{ order.productName }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">订单金额</dt><dd class="mt-1 font-medium">¥{{ order.amount }}</dd></div>
              <div v-if="payableAmount !== null"><dt class="text-xs text-muted-foreground">实际应付</dt><dd class="mt-1 font-medium">¥{{ formatCentsAsYuan(payableAmount) }}</dd></div>
              <div><dt class="text-xs text-muted-foreground">支付状态</dt><dd class="mt-1 font-medium">{{ paymentStatusLabel(order.paymentStatus) }}</dd></div>
            </dl>
            <div v-if="order.paymentStatus === 'UNPAID'" class="grid justify-items-center gap-4 border-t pt-6 text-center">
              <template v-if="isQrPaymentOrder(order)">
                <div v-if="payableAmount !== null" class="w-full rounded-xl border-2 border-primary/35 px-5 py-4 shadow-sm" aria-live="polite">
                  <p class="text-4xl font-bold tracking-tight text-primary sm:text-5xl"><span class="text-2xl sm:text-3xl">¥</span>{{ formatCentsAsYuan(payableAmount) }}</p>
                  <p class="mt-3 text-sm font-medium leading-6">请严格按此金额付款</p>
                </div>
                <p class="font-medium">请使用{{ paymentChannelLabel }}扫码付款</p>
                <div class="w-full max-w-72">
                  <img v-if="qrImageUrl" :src="qrImageUrl" class="aspect-square w-full rounded-lg border bg-white object-contain p-2" alt="支付二维码" />
                  <PaymentQrCode v-else-if="qrCode" :value="qrCode" />
                  <p v-else class="py-16 text-sm text-muted-foreground">正在准备收款二维码...</p>
                </div>
                <p v-if="expiresAt" class="text-sm font-medium" role="timer">二维码将在 {{ countdownLabel }} 后失效</p>
                <p class="text-xs text-muted-foreground">支付完成后，页面会自动更新订单状态。</p>
              </template>
              <p v-else class="text-sm text-muted-foreground">该订单不使用站内扫码支付，请返回订单页继续支付。</p>
            </div>
            <Alert v-else><AlertTitle>{{ order.paymentStatus === "PAID" ? "支付成功" : "订单已结束" }}</AlertTitle><AlertDescription>{{ order.paymentStatus === "PAID" ? "支付已确认，可返回订单查看发货进度。" : "该订单当前无法继续支付。" }}</AlertDescription></Alert>
          </template>
          <p v-else class="py-16 text-center text-sm text-muted-foreground">正在加载订单...</p>
        </CardContent>
        <CardFooter v-if="order" class="flex-wrap justify-end gap-3 border-t pt-5">
          <Button v-if="order.paymentStatus === 'UNPAID' && order.paymentProvider === 'OWNPAY'" variant="destructive" :disabled="cancelling" @click="cancelOrder">{{ cancelling ? "正在取消..." : "取消订单并返回商店" }}</Button>
          <Button v-if="order.paymentStatus === 'UNPAID' && isQrPaymentOrder(order)" variant="outline" :disabled="resuming" @click="resumePayment">{{ resuming ? "正在生成..." : "重新生成二维码" }}</Button>
          <Button as-child><a :href="orderHref">查看订单</a></Button>
        </CardFooter>
      </Card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import PaymentQrCode from "@/components/PaymentQrCode.vue";
import PublicNav from "@/components/storefront/PublicNav.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCentsAsYuan } from "@/lib/payment-utils";
import { getLocalOrderGroups } from "@/lib/local-orders";
import { runTelefunc, userErrorMessage } from "@/lib/telefunc-client";
import { onCancelOrder, onQueryOrder, onResumeOrderPayment, type PublicOrder } from "@/server/order/public.telefunc";

const pageContext = usePageContext() as ReturnType<typeof usePageContext> & { user?: { id: string } | null };
const rawOrderNo = pageContext.urlParsed.search.orderNo;
const orderNo = (typeof rawOrderNo === "string" ? rawOrderNo : "").trim();
const guestEmail = ref<string | undefined>();
const order = ref<PublicOrder | null>(null);
const qrCode = ref("");
const qrImageUrl = ref("");
const payableAmount = ref<number | null>(null);
const expiresAt = ref<number | null>(null);
const now = ref(Date.now());
const error = ref<string | null>(null);
const resuming = ref(false);
const cancelling = ref(false);
const orderHref = computed(() => `${guestEmail.value ? "/order" : "/account/order"}${orderNo ? `?orderNo=${encodeURIComponent(orderNo)}` : ""}`);
const paymentChannelLabel = computed(() => order.value?.paymentChannel === "alipay" ? "支付宝" : order.value?.paymentChannel === "wechat" ? "微信" : "对应应用");
const countdownLabel = computed(() => {
  const seconds = Math.max(0, Math.ceil(((expiresAt.value ?? now.value) - now.value) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
});
let pollTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
  if (!orderNo) { error.value = "缺少订单号，请返回商店重新下单。"; return; }
  guestEmail.value = Object.entries(getLocalOrderGroups()).find(([, orders]) => orders.some(item => item.orderNo === orderNo))?.[0];
  if (!guestEmail.value && !pageContext.user) { error.value = "未找到本机订单，请返回订单查询页。"; return; }
  void loadOrder();
});
onBeforeUnmount(() => { stopPolling(); if (clockTimer) clearInterval(clockTimer); });

function queryInput() { return { orderNo, ...(guestEmail.value ? { email: guestEmail.value } : {}) }; }

async function loadOrder() {
  try {
    const record = await runTelefunc(() => onQueryOrder(queryInput()), { notifyError: false });
    if (!record) { error.value = "订单不存在，或订单身份信息不匹配。"; return; }
    order.value = record;
    if (record.paymentStatus === "UNPAID" && isQrPaymentOrder(record)) {
      restorePaymentSession(record.orderNo);
      if ((!qrCode.value && !qrImageUrl.value) || (expiresAt.value !== null && expiresAt.value <= Date.now())) await resumePayment();
      startPolling();
    }
  } catch (cause) { error.value = userErrorMessage(cause); }
}

function startPolling() { stopPolling(); pollTimer = setInterval(() => { void refreshOrder(); }, 5000); }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; } }
async function refreshOrder() {
  if (!order.value || order.value.paymentStatus !== "UNPAID") return;
  try {
    const record = await runTelefunc(() => onQueryOrder(queryInput()), { notifyError: false });
    if (!record) return;
    order.value = record;
    if (record.paymentStatus !== "UNPAID") { stopPolling(); clearPaymentSession(record.orderNo); }
  } catch { /* The next poll retries. */ }
}

async function resumePayment() {
  if (!order.value || resuming.value) return;
  resuming.value = true;
  error.value = null;
  try {
    const result = await runTelefunc(() => onResumeOrderPayment(queryInput()), { notifyError: false });
    const payment = result.payment;
    if (payment?.mode === "qr" && (payment.qrCode || payment.qrImageUrl)) {
      qrCode.value = payment.qrCode ?? "";
      qrImageUrl.value = payment.qrImageUrl ?? "";
      payableAmount.value = payment.payableAmount ?? null;
      expiresAt.value = payment.expiresAt ?? null;
      persistPaymentSession(result.orderNo);
      return;
    }
    error.value = "当前支付系统繁忙，预计 1 分钟后恢复。";
  } catch (cause) { error.value = userErrorMessage(cause, "当前支付系统繁忙，预计 1 分钟后恢复。"); } finally { resuming.value = false; }
}

async function cancelOrder() {
  if (!order.value || cancelling.value) return;
  cancelling.value = true;
  error.value = null;
  try {
    const result = await runTelefunc(() => onCancelOrder(queryInput()), { notifyError: false });
    if (result.paid) { await refreshOrder(); return; }
    if (result.cancelled) { clearPaymentSession(order.value.orderNo); window.location.assign("/"); return; }
    error.value = "订单未能取消，请稍后重试。";
  } catch (cause) { error.value = userErrorMessage(cause, "订单未能取消，请稍后重试。"); } finally { cancelling.value = false; }
}

function restorePaymentSession(value: string) {
  try {
    qrCode.value = sessionStorage.getItem(`payment-qr:${value}`) ?? "";
    qrImageUrl.value = sessionStorage.getItem(`payment-qr-image:${value}`) ?? "";
    const amount = Number(sessionStorage.getItem(`payment-payable:${value}`));
    payableAmount.value = Number.isSafeInteger(amount) && amount > 0 ? amount : null;
    const expiry = Number(sessionStorage.getItem(`payment-expires:${value}`));
    expiresAt.value = Number.isSafeInteger(expiry) && expiry > 0 ? expiry : null;
  } catch { clearPaymentSession(value); }
}
function persistPaymentSession(value: string) {
  try {
    if (qrCode.value) sessionStorage.setItem(`payment-qr:${value}`, qrCode.value); else sessionStorage.removeItem(`payment-qr:${value}`);
    if (qrImageUrl.value) sessionStorage.setItem(`payment-qr-image:${value}`, qrImageUrl.value); else sessionStorage.removeItem(`payment-qr-image:${value}`);
    if (payableAmount.value) sessionStorage.setItem(`payment-payable:${value}`, String(payableAmount.value)); else sessionStorage.removeItem(`payment-payable:${value}`);
    if (expiresAt.value) sessionStorage.setItem(`payment-expires:${value}`, String(expiresAt.value)); else sessionStorage.removeItem(`payment-expires:${value}`);
  } catch { /* Session storage is optional. */ }
}
function clearPaymentSession(value: string) {
  qrCode.value = ""; qrImageUrl.value = ""; payableAmount.value = null; expiresAt.value = null;
  try { for (const key of ["payment-qr", "payment-qr-image", "payment-payable", "payment-expires"]) sessionStorage.removeItem(`${key}:${value}`); } catch { /* Session storage is optional. */ }
}

function paymentStatusLabel(status: PublicOrder["paymentStatus"]) { return { UNPAID: "待支付", PAID: "已支付", FAILED: "支付失败" }[status]; }
function isQrPaymentOrder(record: PublicOrder) { return record.paymentProvider === "OWNPAY" || record.paymentProvider === "PERPAY" || (record.paymentProvider === "ALIPAY" && record.paymentChannel === "face_to_face"); }
</script>
