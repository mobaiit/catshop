<template>
  <img v-if="imageUrl" :src="imageUrl" width="240" height="240" class="mx-auto rounded-md bg-white p-2" :alt="props.label" />
</template>

<script lang="ts" setup>
import QRCode from "qrcode";
import { onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{ value: string; label?: string }>(), { label: "支付二维码" });
const imageUrl = ref("");

async function renderCode() {
  if (!props.value) { imageUrl.value = ""; return; }
  imageUrl.value = await QRCode.toDataURL(props.value, { errorCorrectionLevel: "M", margin: 1, width: 224, color: { dark: "#111827", light: "#ffffff" } });
}

onMounted(() => { void renderCode(); });
watch(() => props.value, () => { void renderCode(); });
</script>
