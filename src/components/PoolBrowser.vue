<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dices } from 'lucide-vue-next'
import { poolStats, poolsForTag, tagNames } from '@/domain/catalog'
import { optionWeight } from '@/domain/catalog'

const selectedTag = ref(tagNames[0] ?? '')
const availablePools = computed(() => poolsForTag(selectedTag.value))
const selectedPoolId = ref(availablePools.value[0]?.id ?? '')
const result = ref('')

watch(availablePools, (pools) => {
  selectedPoolId.value = pools[0]?.id ?? ''
  result.value = ''
})

const selectedPool = computed(() => availablePools.value.find((pool) => pool.id === selectedPoolId.value) ?? null)
const stats = computed(() => selectedPool.value ? poolStats(selectedPool.value) : null)

function roll() {
  const pool = selectedPool.value
  if (!pool) return
  const options = pool.options.filter((option) => option.enabled !== false)
  const total = options.reduce((sum, option) => sum + optionWeight(option), 0)
  let cursor = Math.random() * total
  const selected = options.find((option) => {
    cursor -= optionWeight(option)
    return cursor <= 0
  }) ?? options[options.length - 1]
  result.value = selected?.name ?? ''
}
</script>

<template>
  <section class="pool-browser">
    <header><div><p class="eyebrow">原始数据</p><h2>自由转盘</h2></div><span>仅查看，不写入主流程</span></header>
    <div class="browser-grid">
      <label><span>标签</span><select v-model="selectedTag"><option v-for="tag in tagNames" :key="tag">{{ tag }}</option></select></label>
      <label><span>转盘</span><select v-model="selectedPoolId"><option v-for="pool in availablePools" :key="pool.id" :value="pool.id">{{ pool.name }}</option></select></label>
      <button class="button primary" :disabled="!selectedPool" @click="roll"><Dices :size="17" />投掷当前池</button>
    </div>
    <p v-if="stats" class="pool-meta">{{ stats.options }} 个启用选项 · 权重总和 {{ stats.totalWeight.toFixed(0) }} · 最高单项 {{ stats.highestWeight.toFixed(0) }}</p>
    <p class="pool-result">{{ result || '选择转盘后可独立查看随机结果。' }}</p>
  </section>
</template>
