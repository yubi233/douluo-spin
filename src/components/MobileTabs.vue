<script setup lang="ts">
import { nextTick, ref } from 'vue'

export type MobileTab = 'stage' | 'character' | 'chronicle'

const props = defineProps<{ modelValue: MobileTab }>()
const emit = defineEmits<{ 'update:modelValue': [value: MobileTab] }>()
const tabs = ref<HTMLButtonElement[]>([])
const values: MobileTab[] = ['stage', 'character', 'chronicle']
const labels: Record<MobileTab, string> = { stage: '主舞台', character: '角色', chronicle: '纪事' }

function select(value: MobileTab) {
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + values.length) % values.length
  select(values[next]!)
  void nextTick(() => tabs.value[next]?.focus())
}
</script>

<template>
  <div class="mobile-tabs" role="tablist" aria-label="命运信息视图" :data-tab="modelValue">
    <button
      v-for="(tab, index) in values"
      :key="tab"
      :ref="(element) => { if (element) tabs[index] = element as HTMLButtonElement }"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab"
      :tabindex="modelValue === tab ? 0 : -1"
      @click="select(tab)"
      @keydown="onKeydown($event, index)"
    >{{ labels[tab] }}</button>
  </div>
</template>
