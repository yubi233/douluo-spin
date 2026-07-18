<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dices, PawPrint, UserRound, X } from 'lucide-vue-next'
import type { StartRoute } from '@/core/model/contracts'

function createSeed() {
  const value = new Uint32Array(1)
  globalThis.crypto?.getRandomValues(value)
  return `${Date.now().toString(36)}-${(value[0] ?? 0).toString(36)}`
}

const props = defineProps<{ open: boolean; cancellable: boolean }>()
const emit = defineEmits<{ start: [route: StartRoute, seed: string]; cancel: [] }>()
const seed = ref(createSeed())

watch(() => props.open, (open) => {
  if (open) seed.value = createSeed()
})

function choose(route: StartRoute) {
  emit('start', route, seed.value.trim() || createSeed())
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" role="presentation" @click.self="cancellable && emit('cancel')">
    <section class="start-dialog" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <button v-if="cancellable" class="dialog-close icon-button" title="关闭" @click="emit('cancel')"><X :size="19" /></button>
      <p class="eyebrow">新命运</p>
      <h2 id="start-title">选择起始路线</h2>
      <div class="route-list">
        <button @click="choose('random')"><Dices /><span><strong>完全随机</strong><small>按原始种族权重决定路线</small></span></button>
        <button @click="choose('human')"><UserRound /><span><strong>人类魂师</strong><small>武魂、势力、魂环、主线与神考</small></span></button>
        <button @click="choose('beast')"><PawPrint /><span><strong>魂兽肉鸽</strong><small>血脉、进化、雷劫、化形与兽神结局</small></span></button>
      </div>
      <label class="seed-field"><span>命运种子</span><input v-model="seed" /><button type="button" @click="seed = createSeed()"><Dices :size="17" /><span class="sr-only">随机种子</span></button></label>
    </section>
  </div>
</template>
