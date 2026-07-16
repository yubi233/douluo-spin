<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Download, Search } from 'lucide-vue-next'
import type { ChronicleEntry } from '@/domain/types'

const props = defineProps<{ entries: ChronicleEntry[]; copyStatus: 'idle' | 'success' | 'failed' }>()
const emit = defineEmits<{ export: []; copy: [] }>()

const query = ref('')
const majorOnly = ref(false)
const filtered = computed(() => props.entries.filter((entry) => {
  const matchesQuery = !query.value || `${entry.title}${entry.text}`.includes(query.value)
  const matchesTone = !majorOnly.value || entry.tone === 'major' || entry.tone === 'bad'
  return matchesQuery && matchesTone
}).reverse())

const copyTitle = computed(() => {
  if (props.copyStatus === 'success') return '已复制到剪贴板'
  if (props.copyStatus === 'failed') return '复制失败，请手动选择导出'
  return '复制人物传记'
})
</script>

<template>
  <section class="panel chronicle-panel">
    <header class="panel-header">
      <div><p class="eyebrow">历程</p><h2>命运纪事</h2></div>
      <span class="record-count">{{ filtered.length }} 条</span>
    </header>
    <div class="chronicle-tools">
      <label class="search-field"><Search :size="16" /><input v-model="query" placeholder="筛选纪事" /></label>
      <label class="check-field"><input v-model="majorOnly" type="checkbox" />只看重大</label>
      <button
        class="icon-button"
        :class="{ 'is-success': copyStatus === 'success', 'is-failed': copyStatus === 'failed' }"
        :title="copyTitle"
        :aria-label="copyTitle"
        @click="emit('copy')"
      >
        <Copy :size="18" />
      </button>
      <button class="icon-button export-button" title="导出人物传记" :aria-label="copyTitle" @click="emit('export')"><Download :size="18" /></button>
    </div>
    <div class="timeline">
      <article v-for="entry in filtered" :key="entry.id" class="timeline-entry" :data-tone="entry.tone">
        <i aria-hidden="true" />
        <div><header><strong>{{ entry.title }}</strong><time>{{ entry.time }}</time></header><p>{{ entry.text }}</p></div>
      </article>
      <p v-if="!filtered.length" class="empty-state">还没有符合条件的命运纪事。</p>
    </div>
  </section>
</template>
