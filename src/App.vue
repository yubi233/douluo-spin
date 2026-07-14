<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArchiveRestore,
  Download,
  FastForward,
  FileDown,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Upload,
} from 'lucide-vue-next'
import CharacterPanel from '@/components/CharacterPanel.vue'
import ChroniclePanel from '@/components/ChroniclePanel.vue'
import FateWheel from '@/components/FateWheel.vue'
import PoolBrowser from '@/components/PoolBrowser.vue'
import StartDialog from '@/components/StartDialog.vue'
import { useGameStore } from '@/composables/useGameStore'

const store = useGameStore()
const importInput = ref<HTMLInputElement | null>(null)
const importStatus = ref('')

const currentOptions = computed(() => store.wheelOptions.value.length > 0
  ? store.wheelOptions.value
  : store.activePool.value?.options.filter((option) => option.enabled !== false) ?? [])

const statusText = computed(() => {
  if (store.isBusy.value) return `命运转动中 · 第 ${store.context.value.step + 1} 步`
  if (store.isAuto.value) return store.isTurbo.value ? '极速推进中' : '自动推进中'
  if (store.machine.value.value === 'ending') return '命运已完结'
  return store.isStarted.value ? '待命' : '尚未开始'
})

const resultTone = computed(() => {
  const text = store.context.value.lastResult
  if (/死亡|失败|重伤|失去|反噬/.test(text)) return 'bad'
  if (/神|十万年|领域|法则|进化|觉醒/.test(text)) return 'rare'
  if (/获得|成功|胜利|提升|等级\+/.test(text)) return 'good'
  return 'normal'
})

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const success = store.importSave(await file.text())
  importStatus.value = success ? '存档导入成功' : '无法读取该存档'
  input.value = ''
  window.setTimeout(() => { importStatus.value = '' }, 2200)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark"><Sparkles :size="22" /></span>
        <div><h1>斗罗大陆 · 命运轮盘</h1><p>自动剧情与肉鸽成长模拟器</p></div>
      </div>
      <div class="top-actions">
        <span class="status"><i :class="{ active: store.isBusy.value || store.isAuto.value }" />{{ statusText }}</span>
        <button class="icon-button labeled" :disabled="!store.canUndo.value" title="撤销上一步" @click="store.undo"><RotateCcw :size="17" />撤销</button>
        <button class="icon-button" :disabled="!store.isStarted.value" title="保存到浏览器" @click="store.persist"><Save :size="18" /></button>
        <button class="icon-button" title="读取浏览器存档" @click="store.restoreLocal"><ArchiveRestore :size="18" /></button>
        <button class="button primary" @click="store.openStart"><Sparkles :size="17" />新命运</button>
      </div>
    </header>

    <main class="main-grid">
      <section class="panel wheel-panel">
        <header class="task-header">
          <p class="eyebrow">{{ store.phaseLabel.value }}</p>
          <h2>{{ store.taskTitle.value }}</h2>
          <span>{{ store.activePool.value ? `${store.activePool.value.options.length} 个候选结果` : '命运尚未展开' }}</span>
        </header>

        <FateWheel
          :options="currentOptions"
          :selected-index="store.wheelSelectedIndex.value"
          :spin-nonce="store.wheelSpinNonce.value"
          :duration="store.isTurbo.value ? 40 : store.context.value.settings.spinDuration"
          :disabled="!store.isStarted.value || store.isBusy.value || store.isAuto.value || store.machine.value.value === 'ending'"
          @spin="store.spin"
        />

        <div class="result-panel" :data-tone="resultTone">
          <span>本次命运</span>
          <p>{{ store.displayResult.value }}</p>
          <small v-if="store.context.value.lastPool">
            {{ store.context.value.lastPool }} · 第 {{ store.context.value.step }} 次投掷
            <template v-if="store.context.value.lastProbability != null"> · 概率 {{ (store.context.value.lastProbability * 100).toFixed(2) }}%</template>
          </small>
        </div>

        <div class="play-controls">
          <button class="button gold" :disabled="!store.isStarted.value || store.isBusy.value || store.isAuto.value || store.machine.value.value === 'ending'" @click="store.spin"><Play :size="17" />继续剧情</button>
          <button class="button primary" :disabled="store.isBusy.value || store.machine.value.value === 'ending'" @click="store.toggleAuto(false)">
            <Pause v-if="store.isAuto.value && !store.isTurbo.value" :size="17" /><Play v-else :size="17" />{{ store.isAuto.value && !store.isTurbo.value ? '暂停自动' : '自动推进' }}
          </button>
          <button class="button" :disabled="store.isBusy.value || store.machine.value.value === 'ending'" @click="store.toggleAuto(true)">
            <Pause v-if="store.isAuto.value && store.isTurbo.value" :size="17" /><FastForward v-else :size="17" />{{ store.isAuto.value && store.isTurbo.value ? '暂停极速' : '极速结算' }}
          </button>
        </div>
      </section>

      <CharacterPanel :context="store.context.value" :route-label="store.routeLabel.value" :phase-label="store.phaseLabel.value" />
      <ChroniclePanel :entries="store.displayLogs.value" @export="store.exportChronicle" />
    </main>

    <details class="advanced-section">
      <summary><Settings2 :size="18" />高级工具与设置</summary>
      <div class="advanced-grid">
        <PoolBrowser />
        <section class="settings-panel">
          <header><div><p class="eyebrow">本地偏好</p><h2>模拟设置</h2></div><Gauge :size="20" /></header>
          <label class="toggle-row"><span><strong>柔化措辞</strong><small>替换少量粗俗或露骨文本</small></span><input type="checkbox" :checked="store.context.value.settings.softenText" @change="store.setSoftenText(($event.target as HTMLInputElement).checked)" /></label>
          <label class="range-row"><span><strong>轮盘时长</strong><small>{{ (store.context.value.settings.spinDuration / 1000).toFixed(1) }} 秒</small></span><input type="range" min="100" max="4000" step="100" :value="store.context.value.settings.spinDuration" @input="store.setSpinDuration(Number(($event.target as HTMLInputElement).value))" /></label>
          <div class="file-actions">
            <button class="button" :disabled="!store.isStarted.value" @click="store.exportSave"><FileDown :size="17" />导出存档</button>
            <button class="button" @click="importInput?.click()"><Upload :size="17" />导入存档</button>
            <button class="button" :disabled="!store.isStarted.value" @click="store.exportChronicle"><Download :size="17" />导出传记</button>
            <input ref="importInput" class="sr-only" type="file" accept="application/json,.json" @change="handleImport" />
          </div>
          <p v-if="importStatus" class="import-status">{{ importStatus }}</p>
        </section>
      </div>
    </details>
  </div>

  <StartDialog :open="store.isStartOpen.value || !store.isStarted.value" :cancellable="store.isStarted.value" @start="store.start" @cancel="store.cancelStart" />

  <div v-if="store.machine.value.value === 'ending'" class="ending-banner" role="status">
    <div><span>{{ store.context.value.alive ? '命运终章' : '命运断绝' }}</span><strong>{{ store.context.value.ending }}</strong></div>
    <button class="button primary" @click="store.openStart"><Sparkles :size="17" />再来一局</button>
  </div>
</template>
