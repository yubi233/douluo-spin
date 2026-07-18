<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dices } from 'lucide-vue-next'
import { v03Content } from '@/content/v03/content'

const categories = ['主流程', '历史纯叙事'] as const
const selectedTag = ref<(typeof categories)[number]>('主流程')
const pools = [...v03Content.mechanics.pools.values()].map((pool) => ({
  id: pool.id,
  name: v03Content.presentation.pools.get(pool.id)?.title ?? pool.id,
  category: pool.id.startsWith('pool.legacy.') ? '历史纯叙事' as const : '主流程' as const,
  options: pool.options.map((option) => ({
    id: option.id,
    name: v03Content.presentation.options.get(option.id)?.title ?? option.id,
    enabled: option.enabled,
    weight: option.baseWeight,
  })),
}))
const availablePools = computed(() => pools.filter((pool) => pool.category === selectedTag.value))
const selectedPoolId = ref(availablePools.value[0]?.id ?? '')
const result = ref('')

watch(availablePools, (items) => { selectedPoolId.value = items[0]?.id ?? ''; result.value = '' })
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
  result.value = selected?.name ?? ''
}
</script>

<template>
  <section class="pool-browser">
    <header><div><p class="eyebrow">结构化内容</p><h2>自由转盘</h2></div><span>仅查看，不写入主流程</span></header>
    <div class="browser-grid">
      <label><span>内容域</span><select v-model="selectedTag"><option v-for="tag in categories" :key="tag">{{ tag }}</option></select></label>
      <label><span>转盘</span><select v-model="selectedPoolId"><option v-for="pool in availablePools" :key="pool.id" :value="pool.id">{{ pool.name }}</option></select></label>
      <button class="button primary" :disabled="!selectedPool" @click="roll"><Dices :size="17" />投掷当前池</button>
    </div>
    <p class="pool-meta">{{ stats.options }} 个启用选项 · 权重总和 {{ stats.totalWeight.toFixed(0) }} · 最高单项 {{ stats.highestWeight.toFixed(0) }}</p>
    <p class="pool-result">{{ result || '选择转盘后可独立查看随机结果。' }}</p>
  </section>
</template>
