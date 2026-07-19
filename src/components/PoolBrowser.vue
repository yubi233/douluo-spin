<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dices } from 'lucide-vue-next'
import { v03Content } from '@/content/v03/content'
import type { EffectSpec, Predicate } from '@/core/model/contracts'

const categories = ['主流程', '原版迁移内容'] as const
const selectedTag = ref<(typeof categories)[number]>('主流程')
const pools = [...v03Content.mechanics.pools.values()].map((pool) => ({
  id: pool.id,
  name: v03Content.presentation.pools.get(pool.id)?.title ?? pool.id,
  category: pool.id.startsWith('pool.legacy.') ? '原版迁移内容' as const : '主流程' as const,
  options: pool.options.map((option) => ({
    id: option.id,
    name: v03Content.presentation.options.get(option.id)?.title ?? option.id,
    enabled: option.enabled,
    weight: option.baseWeight,
    availableWhen: option.availableWhen,
    effects: option.effects,
  })),
}))
const availablePools = computed(() => pools.filter((pool) => pool.category === selectedTag.value))
const selectedPoolId = ref(availablePools.value[0]?.id ?? '')
const result = ref<{ readonly name: string; readonly mechanics: string } | null>(null)

watch(availablePools, (items) => { selectedPoolId.value = items[0]?.id ?? ''; result.value = null })
const selectedPool = computed(() => availablePools.value.find((pool) => pool.id === selectedPoolId.value) ?? null)
const enabledOptions = computed(() => selectedPool.value?.options.filter((option) => option.enabled) ?? [])
const stats = computed(() => ({
  options: enabledOptions.value.length,
  totalWeight: enabledOptions.value.reduce((sum, option) => sum + option.weight, 0),
  highestWeight: Math.max(0, ...enabledOptions.value.map((option) => option.weight)),
}))

function roll() {
  const total = stats.value.totalWeight
  if (total <= 0) return
  let cursor = Math.random() * total
  const selected = enabledOptions.value.find((option) => { cursor -= option.weight; return cursor <= 0 }) ?? enabledOptions.value.at(-1)
  result.value = selected ? { name: selected.name, mechanics: mechanicSummary(selected.effects, selected.availableWhen) } : null
}

function entityTitle(id: string) { return v03Content.presentation.entities.get(id as never)?.title ?? id }
function effectSummary(effect: EffectSpec) {
  switch (effect.type) {
    case 'stat.change': {
      const label = { level: '等级', age: '年龄', 'appearance-rank': '容貌', 'beast-cultivation': '修为', 'max-level': '等级上限', 'tang-age': '时间线' }[effect.stat]
      const value = effect.delta.type === 'constant' ? effect.delta.value : null
      return value == null ? `${label}变化` : `${label}${value >= 0 ? '+' : ''}${value}`
    }
    case 'entity.grant': return `获得：${entityTitle(effect.entityId)}`
    case 'entity.revoke': return `失去：${entityTitle(effect.entityId)}`
    case 'time.advance': return '推进时间线'
    case 'run.finish': return `结局：${v03Content.presentation.endings.get(effect.endingId)?.title ?? effect.endingId}`
    case 'signal.emit': return '触发后续流程'
  }
}
function predicateSummary(predicate: Predicate) {
  if (predicate.type === 'all') return `需同时满足 ${predicate.items.length} 项条件`
  if (predicate.type === 'any') return `需满足 ${predicate.items.length} 项条件之一`
  if (predicate.type === 'not') return '需满足排除条件'
  if (predicate.type === 'contains') return `需要：${entityTitle(predicate.value)}`
  if (predicate.type === 'compare') return '需要满足属性条件'
  return '需要满足规则条件'
}
function mechanicSummary(effects: readonly EffectSpec[], predicate?: Predicate) {
  const parts = effects.map(effectSummary)
  if (predicate) parts.push(predicateSummary(predicate))
  return parts.length ? parts.join(' · ') : '原版叙事事件，不改变角色数值'
}
</script>

<template>
  <section class="pool-browser">
    <header><div><p class="eyebrow">结构化内容</p><h2>自由转盘</h2></div><span>原版内容保留为独立可审阅转盘</span></header>
    <div class="browser-grid">
      <label><span>内容域</span><select v-model="selectedTag"><option v-for="tag in categories" :key="tag">{{ tag }}</option></select></label>
      <label><span>转盘</span><select v-model="selectedPoolId"><option v-for="pool in availablePools" :key="pool.id" :value="pool.id">{{ pool.name }}</option></select></label>
      <button class="button primary" :disabled="!selectedPool" @click="roll"><Dices :size="17" />投掷当前池</button>
    </div>
    <p class="pool-meta">{{ stats.options }} 个启用选项 · 权重总和 {{ stats.totalWeight.toFixed(0) }} · 最高单项 {{ stats.highestWeight.toFixed(0) }}</p>
    <div class="pool-result">
      <template v-if="result"><strong>{{ result.name }}</strong><small>{{ result.mechanics }}</small></template>
      <span v-else>选择转盘后可独立查看随机结果。</span>
    </div>
  </section>
</template>
