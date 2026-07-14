<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MoreVertical } from 'lucide-vue-next'

defineProps<{ overrides: number }>()
const emit = defineEmits<{ save: []; restore: []; exportOverrides: []; exportSave: []; importSave: []; exportChronicle: []; clearOverrides: [] }>()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const firstAction = ref<HTMLButtonElement | null>(null)

watch(open, (value) => {
  if (value) void nextTick(() => firstAction.value?.focus())
  else trigger.value?.focus()
})

function close() { open.value = false }
function choose(action: () => void) { action(); close() }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') close() }
function outside(event: MouseEvent) {
  const target = event.target as Node
  if (open.value && !trigger.value?.parentElement?.contains(target)) close()
}
document.addEventListener('keydown', keydown)
document.addEventListener('click', outside)
onBeforeUnmount(() => {
  document.removeEventListener('keydown', keydown)
  document.removeEventListener('click', outside)
})
</script>

<template>
  <div class="overflow-menu">
    <button ref="trigger" class="icon-button" type="button" title="更多操作" aria-label="更多操作" :aria-expanded="open" @click.stop="open = !open"><MoreVertical :size="19" /></button>
    <div v-if="open" class="overflow-popover" role="menu" @click.stop>
      <button ref="firstAction" type="button" role="menuitem" @click="choose(() => emit('save'))">保存到浏览器</button>
      <button type="button" role="menuitem" @click="choose(() => emit('restore'))">读取浏览器存档</button>
      <button type="button" role="menuitem" @click="choose(() => emit('exportSave'))">导出存档</button>
      <button type="button" role="menuitem" @click="choose(() => emit('importSave'))">导入存档</button>
      <button type="button" role="menuitem" @click="choose(() => emit('exportChronicle'))">导出传记</button>
      <button type="button" role="menuitem" :disabled="overrides === 0" @click="choose(() => emit('exportOverrides'))">导出当前修改{{ overrides ? ` (${overrides})` : '（暂无修改）' }}</button>
      <button type="button" role="menuitem" :disabled="overrides === 0" @click="choose(() => emit('clearOverrides'))">清除全部转盘修改</button>
    </div>
  </div>
</template>
