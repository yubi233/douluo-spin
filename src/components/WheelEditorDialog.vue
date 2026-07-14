<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, RotateCcw, Trash2, X } from 'lucide-vue-next'
import { candidateDistribution } from '@/domain/engine'
import { validateOverride } from '@/domain/overrides'
import type { GameContext, RollTask, WheelOption, WheelPool } from '@/domain/types'

const props = defineProps<{
  open: boolean
  pool: WheelPool | null
  task: RollTask | null
  context: GameContext
  originalOptionIds: string[]
  modified: boolean
}>()
const emit = defineEmits<{ close: []; apply: [options: WheelOption[]]; reset: [] }>()
const draft = ref<WheelOption[]>([])
const error = ref('')
const dialog = ref<HTMLElement | null>(null)
const returnFocus = ref<HTMLElement | null>(null)
const originals = computed(() => new Set(props.originalOptionIds))
const temporaryPool = computed(() => props.pool ? { ...props.pool, options: draft.value } : null)
const distribution = computed(() => temporaryPool.value && props.task ? candidateDistribution(temporaryPool.value, props.task, props.context) : [])
const probabilities = computed(() => new Map(distribution.value.map((item) => [item.option.id, item.probability])))

watch(() => props.open, (open) => {
  if (!open || !props.pool) return
  draft.value = props.pool.options.map((option) => ({ ...option, enabled: option.enabled !== false, weight: option.weight ?? 1 }))
  error.value = ''
  returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void nextTick(() => dialog.value?.focus())
})

function localId() {
  return `local-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function add() { draft.value.push({ id: localId(), name: '', enabled: true, weight: 1 }) }
function remove(index: number) { draft.value.splice(index, 1) }
function requestClose() {
  const changed = JSON.stringify(draft.value) !== JSON.stringify(props.pool?.options ?? [])
  if (!changed || window.confirm('未应用的修改将丢失，确定关闭吗？')) close()
}
function close() {
  emit('close')
  void nextTick(() => returnFocus.value?.focus())
}
function apply() {
  if (!props.pool) return
  const options = draft.value.map((option) => ({ ...option, name: option.name.trim(), weight: Number(option.weight) }))
  error.value = validateOverride(props.pool, options) ?? ''
  if (!error.value) {
    emit('apply', options)
    void nextTick(() => returnFocus.value?.focus())
  }
}
function reset() {
  if (props.modified && window.confirm('恢复默认值会清除当前转盘的本地修改，确定继续吗？')) {
    emit('reset')
    void nextTick(() => returnFocus.value?.focus())
  }
}
</script>

<template>
  <div v-if="open" class="modal-backdrop editor-backdrop" @mousedown.self="requestClose">
    <section ref="dialog" class="wheel-editor" role="dialog" aria-modal="true" aria-labelledby="wheel-editor-title" tabindex="-1" @keydown.esc="requestClose">
      <header class="editor-header">
        <div><p class="eyebrow">当前转盘修改</p><h2 id="wheel-editor-title">{{ pool?.name }}</h2><span>{{ draft.length }} 个事件 · 有效候选 {{ distribution.length }}</span></div>
        <button class="icon-button" type="button" title="关闭修改器" aria-label="关闭修改器" @click="requestClose"><X :size="18" /></button>
      </header>
      <p class="editor-note">文本效果仍由既有事件解析规则决定；自定义文本会作为普通事件记录。</p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
      <div class="editor-list">
        <article v-for="(option, index) in draft" :key="option.id" class="editor-row" :class="{ disabled: option.enabled === false }">
          <label class="editor-enabled"><input v-model="option.enabled" type="checkbox" />启用</label>
          <label class="editor-text"><span class="sr-only">事件文本</span><textarea v-model="option.name" rows="2" placeholder="事件文本" /></label>
          <label class="editor-weight"><span>权重</span><input v-model.number="option.weight" type="number" min="0.01" max="1000000" step="0.01" /></label>
          <span class="editor-probability">{{ probabilities.has(option.id) ? `${(probabilities.get(option.id)! * 100).toFixed(2)}%` : '当前不可抽' }}</span>
          <button v-if="!originals.has(option.id)" class="icon-button danger" type="button" title="移除新增事件" aria-label="移除新增事件" @click="remove(index)"><Trash2 :size="17" /></button>
          <span v-else class="editor-original">原始事件</span>
        </article>
      </div>
      <footer class="editor-footer">
        <button class="button" type="button" @click="add"><Plus :size="17" />增加事件</button>
        <button class="button" type="button" :disabled="!modified" @click="reset"><RotateCcw :size="17" />恢复默认</button>
        <span />
        <button class="button" type="button" @click="requestClose">取消</button>
        <button class="button primary" type="button" @click="apply">应用修改</button>
      </footer>
    </section>
  </div>
</template>
