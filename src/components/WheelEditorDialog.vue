<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import type { EditorCatalog } from '@/application/editorCatalog'
import type { WheelOptionView, WheelPoolView } from '@/application/gameViewModel'
import type { EffectSpec, NumberExpression, Predicate } from '@/core/model/contracts'
import EffectSpecEditor from './EffectSpecEditor.vue'
import NumberExpressionEditor from './NumberExpressionEditor.vue'
import PredicateEditor from './PredicateEditor.vue'

const props = defineProps<{
  open: boolean
  pool: WheelPoolView | null
  modified: boolean
  externalError?: string
  catalog: EditorCatalog
  preview: (pool: WheelPoolView | null, options: readonly WheelOptionView[]) => { probabilities: Record<string, number>; error: string }
}>()
const emit = defineEmits<{ close: []; apply: [options: WheelOptionView[]]; reset: [] }>()
const draft = ref<WheelOptionView[]>([])
const error = ref('')
const dialog = ref<HTMLElement | null>(null)
const returnFocus = ref<HTMLElement | null>(null)
const previewResult = computed(() => props.preview(props.pool, draft.value))
const probabilities = computed(() => new Map(Object.entries(previewResult.value.probabilities)))

watch(() => props.open, (open) => {
  if (!open || !props.pool) return
  draft.value = structuredClone(props.pool.options) as WheelOptionView[]
  error.value = ''
  returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  void nextTick(() => dialog.value?.focus())
})

function localId() { return `option.local.${crypto.randomUUID().toLowerCase()}` }
function add() { draft.value.push({ id: localId(), name: '', enabled: true, weight: 1, probability: 0, effects: [] }) }
function remove(index: number) { draft.value.splice(index, 1) }
function setPredicate(option: WheelOptionView, value?: Predicate) { (option as { availableWhen?: Predicate }).availableWhen = value }
function setWeightModifier(option: WheelOptionView, value?: NumberExpression) { (option as { weightModifier?: NumberExpression }).weightModifier = value }
function setEffect(option: WheelOptionView, index: number, value: EffectSpec) { (option.effects as EffectSpec[])[index] = value }
function removeEffect(option: WheelOptionView, index: number) { (option.effects as EffectSpec[]).splice(index, 1) }
function addEffect(option: WheelOptionView) { (option.effects as EffectSpec[]).push({ type: 'stat.change', stat: 'level', delta: { type: 'constant', value: 1 } }) }
function close() { emit('close'); void nextTick(() => returnFocus.value?.focus()) }
function requestClose() { if (!props.pool || JSON.stringify(draft.value) === JSON.stringify(props.pool.options) || window.confirm('未应用的修改将丢失，确定关闭吗？')) close() }
function apply() {
  if (draft.value.some((option) => !option.name.trim() || !Number.isFinite(option.weight) || option.weight <= 0)) {
    error.value = '标题不能为空，权重必须是大于零的有限数。'
    return
  }
  emit('apply', draft.value.map((option) => ({ ...option, name: option.name.trim(), weight: Number(option.weight) })))
}
function reset() { if (!props.modified || window.confirm('恢复默认值会清除当前转盘的本地修改，确定继续吗？')) emit('reset') }
function mechanismSummary(option: WheelOptionView) {
  const condition = option.availableWhen ? `条件 ${option.availableWhen.type}` : '始终可用'
  const effects = option.effects.length ? option.effects.map((effect) => effect.type).join('、') : '纯叙事'
  return `${condition} · ${effects}`
}
</script>

<template>
  <div v-if="open" class="modal-backdrop editor-backdrop" @mousedown.self="requestClose">
    <section ref="dialog" class="wheel-editor" role="dialog" aria-modal="true" aria-labelledby="wheel-editor-title" tabindex="-1" @keydown.esc="requestClose">
      <header class="editor-header">
        <div><p class="eyebrow">结构化转盘修改</p><h2 id="wheel-editor-title">{{ pool?.name }}</h2><span>{{ draft.length }} 个事件 · {{ probabilities.size }} 个有效候选</span></div>
        <button class="icon-button" type="button" title="关闭修改器" aria-label="关闭修改器" @click="requestClose"><X :size="18" /></button>
      </header>
      <p class="editor-note">展示文案与机制字段独立保存；新增事件默认为纯叙事，不会从文本推导效果。</p>
      <p v-if="error || externalError || previewResult.error" class="editor-error" role="alert">{{ error || externalError || previewResult.error }}</p>
      <div class="editor-list">
        <article v-for="(option, index) in draft" :key="option.id" class="editor-row" :class="{ disabled: !option.enabled }">
          <label class="editor-enabled"><input v-model="option.enabled" type="checkbox" />启用</label>
          <label class="editor-text"><span class="sr-only">展示文案</span><textarea v-model="option.name" rows="2" placeholder="展示文案" /></label>
          <label class="editor-weight"><span>权重</span><input v-model.number="option.weight" type="number" min="0.01" max="1000000" step="0.01" /></label>
          <span class="editor-probability">{{ probabilities.has(option.id) ? `${(probabilities.get(option.id)! * 100).toFixed(2)}%` : '当前不可抽' }}</span>
          <button class="icon-button danger" type="button" title="移除事件" aria-label="移除事件" @click="remove(index)"><Trash2 :size="17" /></button>
          <small class="editor-original">{{ mechanismSummary(option) }}</small>
          <details class="mechanics-editor">
            <summary><SlidersHorizontal :size="15" />条件、动态权重与效果</summary>
            <section>
              <header><strong>资格条件</strong><button v-if="!option.availableWhen" class="button compact" type="button" @click="setPredicate(option, { type: 'compare', fact: 'actor.level', op: 'gte', value: 1 })"><Plus :size="14" />增加条件</button><button v-else class="button compact danger" type="button" @click="setPredicate(option)">移除条件</button></header>
              <PredicateEditor v-if="option.availableWhen" :model-value="option.availableWhen" :catalog="catalog" @update:model-value="setPredicate(option, $event)" />
            </section>
            <section>
              <header><strong>动态权重</strong><button v-if="!option.weightModifier" class="button compact" type="button" @click="setWeightModifier(option, { type: 'constant', value: 1 })"><Plus :size="14" />增加表达式</button><button v-else class="button compact danger" type="button" @click="setWeightModifier(option)">移除表达式</button></header>
              <NumberExpressionEditor v-if="option.weightModifier" :model-value="option.weightModifier" :catalog="catalog" @update:model-value="setWeightModifier(option, $event)" />
            </section>
            <section>
              <header><strong>结构化效果</strong><button class="button compact" type="button" @click="addEffect(option)"><Plus :size="14" />增加效果</button></header>
              <p v-if="!option.effects.length" class="mechanics-empty">纯叙事选项，不产生领域效果。</p>
              <div v-for="(effect, effectIndex) in option.effects" :key="effectIndex" class="effect-row">
                <EffectSpecEditor :model-value="effect" :catalog="catalog" @update:model-value="setEffect(option, effectIndex, $event)" />
                <button class="icon-button danger" type="button" title="移除效果" aria-label="移除效果" @click="removeEffect(option, effectIndex)"><Trash2 :size="15" /></button>
              </div>
            </section>
          </details>
        </article>
      </div>
      <footer class="editor-footer">
        <button class="button" type="button" @click="add"><Plus :size="17" />增加纯叙事事件</button>
        <button class="button" type="button" :disabled="!modified" @click="reset"><RotateCcw :size="17" />恢复默认</button>
        <span />
        <button class="button" type="button" @click="requestClose">取消</button>
        <button class="button primary" type="button" @click="apply">校验并应用</button>
      </footer>
    </section>
  </div>
</template>
