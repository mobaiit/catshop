<template>
  <main class="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.10),transparent_36%)] bg-muted/25">
    <div class="pointer-events-none absolute -left-24 top-24 size-72 rounded-full bg-pink-400/8 blur-3xl" aria-hidden="true" />
    <div class="pointer-events-none absolute -right-28 bottom-8 size-80 rounded-full bg-violet-500/8 blur-3xl" aria-hidden="true" />
    <header class="fixed inset-x-0 top-0 z-50 border-b bg-background/90 backdrop-blur-xl">
      <div class="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div @click.capture="handleBrandNavigation"><StorefrontBrand /></div>
        <div class="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
          <ShieldCheck class="size-4 text-violet-500" aria-hidden="true" />
          安全收银台
        </div>
      </div>
    </header>
    <section class="relative mx-auto max-w-5xl px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
      <Card class="overflow-hidden border-border/70 bg-card/95 shadow-[0_24px_80px_-32px_rgba(76,29,149,0.28)] backdrop-blur">
        <CardContent class="p-0">
          <Alert v-if="error" variant="destructive" class="m-4 sm:m-6"><AlertTitle>无法继续支付</AlertTitle><AlertDescription>{{ error }}</AlertDescription></Alert>

          <div v-else-if="order" class="grid lg:grid-cols-[minmax(0,0.82fr)_minmax(25rem,1.18fr)]">
            <section class="order-2 flex min-w-0 flex-col bg-muted/35 p-6 sm:p-8 lg:order-1 lg:border-r lg:p-10" aria-labelledby="checkout-order-title">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase dark:text-violet-300">Catshop Checkout</p>
                  <h1 id="checkout-order-title" class="mt-3 text-2xl font-semibold tracking-tight">确认订单</h1>
                </div>
                <span class="shrink-0 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">{{ paymentStatusLabel(order.paymentStatus) }}</span>
              </div>

              <div class="mt-8 rounded-2xl border bg-background/90 p-5 shadow-sm">
                <p class="text-xs font-medium text-muted-foreground">购买商品</p>
                <p class="mt-2 text-lg font-semibold leading-7">{{ order.productName }}</p>
                <dl class="mt-6 grid gap-4 border-t pt-5 text-sm">
                  <div class="flex items-center justify-between gap-4"><dt class="text-muted-foreground">订单金额</dt><dd class="font-semibold tabular-nums">¥{{ order.amount }}</dd></div>
                  <div class="flex items-start justify-between gap-4"><dt class="shrink-0 text-muted-foreground">订单号</dt><dd class="min-w-0 break-all text-right font-mono text-xs leading-5">{{ order.orderNo }}</dd></div>
                  <div class="flex items-center justify-between gap-4"><dt class="text-muted-foreground">支付方式</dt><dd class="font-medium">{{ paymentChannelLabel }}</dd></div>
                </dl>
              </div>

              <div class="mt-6 grid gap-3 text-sm text-muted-foreground">
                <div class="flex items-start gap-3"><ShieldCheck class="mt-0.5 size-4 shrink-0 text-violet-500" aria-hidden="true" /><span>支付信息经过安全校验，请确认金额后付款。</span></div>
                <div class="flex items-start gap-3"><CircleCheckBig class="mt-0.5 size-4 shrink-0 text-violet-500" aria-hidden="true" /><span>支付完成后自动确认，无需手动刷新页面。</span></div>
              </div>
            </section>

            <section class="order-1 flex min-h-[34rem] min-w-0 flex-col items-center justify-center p-6 text-center sm:p-10 lg:order-2 lg:p-12" aria-labelledby="checkout-payment-title">
              <template v-if="order.paymentStatus === 'UNPAID' && !isEndedPayment && isQrPaymentOrder(order)">
                <div
                  class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
                  :class="isWechatPayment ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300'"
                >
                  <ScanLine class="size-4" aria-hidden="true" />
                  {{ paymentChannelLabel }}扫码支付
                </div>
                <p class="mt-7 text-sm font-medium text-muted-foreground">实际应付</p>
                <p id="checkout-payment-title" class="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                  <span class="mr-1 text-2xl font-semibold text-muted-foreground sm:text-3xl">¥</span>{{ payableAmount !== null ? formatCentsAsYuan(payableAmount) : order.amount }}
                </p>
                <p v-if="payableAmount !== null" class="mt-3 text-sm text-muted-foreground">请严格按照此金额付款</p>

                <div
                  class="mt-7 w-full max-w-72 rounded-[1.75rem] border p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]"
                  :class="isWechatPayment ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-500/30 bg-blue-500/5'"
                >
                  <div class="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-white p-2">
                    <img v-if="qrImageUrl" :src="qrImageUrl" width="256" height="256" class="aspect-square w-full object-contain" :alt="`${paymentChannelLabel}支付二维码`" />
                    <PaymentQrCode v-else-if="qrCode" :value="qrCode" :label="`${paymentChannelLabel}支付二维码`" />
                    <div v-else class="grid size-full place-items-center" role="status">
                      <div class="grid gap-3 text-sm text-slate-500"><ScanLine class="mx-auto size-8 animate-pulse motion-reduce:animate-none" aria-hidden="true" /><span>正在准备收款二维码...</span></div>
                    </div>
                  </div>
                </div>

                <div class="mt-4 flex w-full max-w-72 flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" class="min-h-11 flex-1" @click="saveQrCode">
                    <Download class="size-4" aria-hidden="true" />保存二维码
                  </Button>
                  <Button v-if="alipayLaunchUrl" as-child class="min-h-11 flex-1 bg-blue-600 text-white hover:bg-blue-600/90">
                    <a :href="alipayLaunchUrl">打开支付宝</a>
                  </Button>
                </div>
                <p class="mt-3 max-w-72 text-xs leading-5 text-muted-foreground sm:hidden">{{ mobilePaymentHint }}</p>

                <div
                  v-if="expiresAt"
                  class="mt-6 inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold tabular-nums"
                  :class="countdownUrgent ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : isWechatPayment ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300' : 'border-blue-500/20 bg-blue-500/8 text-blue-700 dark:text-blue-300'"
                  role="timer"
                  aria-live="off"
                ><Clock3 class="size-4" aria-hidden="true" />{{ countdownLabel }} 后失效</div>
                <p class="mt-4 text-xs leading-5 text-muted-foreground">请勿重复付款，到账后页面会自动更新。</p>
              </template>

              <div v-else-if="order.paymentStatus === 'PAID'" class="grid max-w-sm justify-items-center gap-4" aria-live="polite">
                <div class="grid size-20 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"><CircleCheckBig class="size-10" aria-hidden="true" /></div>
                <h2 id="checkout-payment-title" class="text-2xl font-semibold">支付成功</h2>
                <p class="leading-7 text-muted-foreground">支付已确认，可以前往订单页面查看发货进度和交付内容。</p>
              </div>

              <div v-else-if="isEndedPayment" class="grid max-w-sm justify-items-center gap-4" aria-live="polite">
                <div class="grid size-20 place-items-center rounded-full bg-muted text-muted-foreground"><Clock3 class="size-9" aria-hidden="true" /></div>
                <h2 id="checkout-payment-title" class="text-2xl font-semibold">支付已结束</h2>
                <p class="leading-7 text-muted-foreground">该支付订单已结束，无法继续支付，请返回商店重新下单。</p>
              </div>

              <div v-else class="grid max-w-sm justify-items-center gap-4">
                <div class="grid size-20 place-items-center rounded-full bg-muted text-muted-foreground"><ScanLine class="size-9" aria-hidden="true" /></div>
                <h2 id="checkout-payment-title" class="text-xl font-semibold">暂时无法展示二维码</h2>
                <p class="leading-7 text-muted-foreground">该订单不使用站内扫码支付，请返回订单页继续支付。</p>
              </div>
            </section>
          </div>

          <div v-else class="grid min-h-[34rem] place-items-center p-6 text-center" role="status">
            <div class="grid justify-items-center gap-4 text-muted-foreground"><div class="size-12 animate-pulse rounded-full bg-violet-500/15 motion-reduce:animate-none" /><p>正在确认订单信息...</p></div>
          </div>
        </CardContent>
        <CardFooter v-if="order" class="min-h-20 flex-wrap justify-center gap-3 border-t bg-background/80 px-6 py-4 sm:justify-end">
          <Button v-if="order.paymentStatus === 'UNPAID' && order.paymentProvider === 'OWNPAY'" variant="outline" class="min-h-11 w-full text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive sm:w-auto" :disabled="cancelling" @click="cancelOrder">{{ cancelling ? "正在取消..." : isEndedPayment ? "返回商店重新下单" : "取消订单并返回商店" }}</Button>
          <Button v-else-if="order.status === 'PENDING' && order.paymentStatus === 'UNPAID' && isQrPaymentOrder(order)" variant="outline" class="min-h-11 w-full sm:w-auto" :disabled="resuming" @click="resumePayment">{{ resuming ? "正在生成..." : "重新生成二维码" }}</Button>
          <Button v-else-if="order.paymentStatus === 'PAID'" as-child class="min-h-11 w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-sm hover:from-pink-500/90 hover:to-violet-600/90 sm:w-auto"><a :href="orderHref">查看订单</a></Button>
          <Button v-else as-child variant="outline" class="min-h-11 w-full sm:w-auto"><a href="/">返回商店重新下单</a></Button>
        </CardFooter>
      </Card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { CircleCheckBig, Clock3, Download, ScanLine, ShieldCheck } from "@lucide/vue";
import QRCode from "qrcode";
import { usePageContext } from "vike-vue/usePageContext";
import PaymentQrCode from "@/components/PaymentQrCode.vue";
import StorefrontBrand from "@/components/storefront/StorefrontBrand.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
const isWechatClient = ref(false);
const isAlipayClient = ref(false);
const orderHref = computed(() => `${guestEmail.value ? "/order" : "/account/order"}${orderNo ? `?orderNo=${encodeURIComponent(orderNo)}` : ""}`);
const paymentChannelLabel = computed(() => order.value?.paymentChannel === "alipay" || order.value?.paymentChannel === "face_to_face" ? "支付宝" : order.value?.paymentChannel === "wechat" || order.value?.paymentChannel === "wxpay" ? "微信" : "对应应用");
const isWechatPayment = computed(() => order.value?.paymentChannel === "wechat" || order.value?.paymentChannel === "wxpay");
const alipayLaunchUrl = computed(() => {
  if (paymentChannelLabel.value !== "支付宝" || !/^https?:\/\//i.test(qrCode.value)) return "";
  return `alipays://platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(qrCode.value)}`;
});
const mobilePaymentHint = computed(() => {
  if (isWechatPayment.value) return isWechatClient.value ? "可长按二维码识别并完成微信支付。" : "请长按或保存二维码，再打开微信扫一扫并从相册选择。";
  if (isAlipayClient.value) return "可长按二维码识别；若浏览器允许，也可使用“打开支付宝”。";
  return alipayLaunchUrl.value ? "可尝试打开支付宝；若被浏览器拦截，请保存二维码后在支付宝扫一扫中从相册选择。" : "请长按或保存二维码，再打开支付宝扫一扫并从相册选择。";
});
const isExpiredOwnpay = computed(() => order.value?.paymentProvider === "OWNPAY" && expiresAt.value !== null && expiresAt.value <= now.value);
const isEndedPayment = computed(() => Boolean(order.value && (order.value.status !== "PENDING" || isExpiredOwnpay.value)));
const countdownUrgent = computed(() => expiresAt.value !== null && expiresAt.value - now.value <= 60_000);
const countdownLabel = computed(() => {
  const seconds = Math.max(0, Math.ceil(((expiresAt.value ?? now.value) - now.value) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
});
let pollTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  isWechatClient.value = /MicroMessenger/i.test(navigator.userAgent);
  isAlipayClient.value = /AlipayClient/i.test(navigator.userAgent);
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
  if (!orderNo) { error.value = "缺少订单号，请返回商店重新下单。"; return; }
  guestEmail.value = Object.entries(getLocalOrderGroups()).find(([, orders]) => orders.some(item => item.orderNo === orderNo))?.[0];
  if (!guestEmail.value && !pageContext.user) { error.value = "未找到本机订单，请返回订单查询页。"; return; }
  void loadOrder();
});
onBeforeUnmount(() => { stopPolling(); if (clockTimer) clearInterval(clockTimer); });

function handleBrandNavigation(event: MouseEvent) {
  if (!order.value || order.value.paymentProvider !== "OWNPAY" || order.value.paymentStatus !== "UNPAID" || isEndedPayment.value) return;
  event.preventDefault();
  event.stopPropagation();
  void cancelOrder();
}

function queryInput() { return { orderNo, ...(guestEmail.value ? { email: guestEmail.value } : {}) }; }

async function loadOrder() {
  try {
    const record = await runTelefunc(() => onQueryOrder(queryInput()), { notifyError: false });
    if (!record) { error.value = "订单不存在，或订单身份信息不匹配。"; return; }
    order.value = record;
    if (record.status === "PENDING" && record.paymentStatus === "UNPAID" && isQrPaymentOrder(record)) {
      restorePaymentSession(record.orderNo);
      if (expiresAt.value === null && record.paymentExpiresAt !== null) expiresAt.value = record.paymentExpiresAt;
      const ownpayExpired = record.paymentProvider === "OWNPAY" && expiresAt.value !== null && expiresAt.value <= Date.now();
      if (!ownpayExpired && ((!qrCode.value && !qrImageUrl.value) || (expiresAt.value !== null && expiresAt.value <= Date.now()))) await resumePayment();
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
  if (order.value.status !== "PENDING") { clearPaymentSession(order.value.orderNo); window.location.assign("/"); return; }
  cancelling.value = true;
  error.value = null;
  try {
    const result = await runTelefunc(() => onCancelOrder(queryInput()), { notifyError: false });
    if (result.paid) { await refreshOrder(); return; }
    if (result.cancelled) { clearPaymentSession(order.value.orderNo); window.location.assign("/"); return; }
    error.value = "订单未能取消，请稍后重试。";
  } catch (cause) { error.value = userErrorMessage(cause, "订单未能取消，请稍后重试。"); } finally { cancelling.value = false; }
}

async function saveQrCode() {
  let href = qrImageUrl.value;
  if (qrCode.value) href = await QRCode.toDataURL(qrCode.value, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  if (!href) return;
  const link = document.createElement("a");
  link.href = href;
  link.download = `${paymentChannelLabel.value}-支付二维码.png`;
  link.rel = "noopener";
  if (/^https?:\/\//i.test(href)) link.target = "_blank";
  document.body.append(link);
  link.click();
  link.remove();
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
