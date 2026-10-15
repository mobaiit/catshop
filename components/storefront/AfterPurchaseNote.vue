<template>
  <section class="min-w-0 border-t pt-6">
    <div class="mb-3 flex items-center justify-between gap-3">
      <p class="font-medium">购买后说明</p>
      <Button type="button" variant="outline" size="sm" @click="copyNote">
        <ClipboardIcon data-icon="inline-start" />复制说明
      </Button>
    </div>
    <p class="whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-4 text-sm leading-6">{{ note }}</p>
  </section>
</template>

<script setup lang="ts">
import { ClipboardIcon } from "@lucide/vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";

const props = defineProps<{ note: string }>();

async function copyNote() {
  try {
    await navigator.clipboard.writeText(props.note);
    toast.success("购买后说明已复制。");
  } catch {
    toast.error("复制失败，请手动选择说明内容。");
  }
}
</script>
