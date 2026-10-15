<template>
  <canvas ref="canvas" class="mx-auto rounded-md bg-white p-2" :aria-label="props.label" role="img" />
</template>

<script lang="ts" setup>
import QRCode from "qrcode";
import { onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{ value: string; label?: string }>(), { label: "支付二维码" });
const canvas = ref<HTMLCanvasElement | null>(null);

async function renderCode() {
  if (!canvas.value || !props.value) return;
  await QRCode.toCanvas(canvas.value, props.value, { errorCorrectionLevel: "M", margin: 1, width: 224, color: { dark: "#111827", light: "#ffffff" } });
}

onMounted(() => { void renderCode(); });
watch(() => props.value, () => { void renderCode(); });
</script>
