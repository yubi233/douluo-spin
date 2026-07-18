<script setup lang="ts">
import { computed, ref } from 'vue'
import { FastForward, Gauge, Monitor, Pause, Pencil, Play, RotateCcw, Settings2, Smartphone, Sparkles } from 'lucide-vue-next'
import CharacterPanel from '@/components/CharacterPanel.vue'
import ChroniclePanel from '@/components/ChroniclePanel.vue'
import FateWheel from '@/components/FateWheel.vue'
import MobileTabs, { type MobileTab } from '@/components/MobileTabs.vue'
import OverflowMenu from '@/components/OverflowMenu.vue'
import PoolBrowser from '@/components/PoolBrowser.vue'
import StartDialog from '@/components/StartDialog.vue'
import WheelEditorDialog from '@/components/WheelEditorDialog.vue'
import type { WheelOptionView } from '@/application/gameViewModel'
import { useGameStore } from '@/composables/useGameStore'

const store = useGameStore()
const importSaveInput = ref<HTMLInputElement | null>(null)
const importOverridesInput = ref<HTMLInputElement | null>(null)
const importStatus = ref('')
const mobileTab = ref<MobileTab>('stage')
const editorOpen = ref(false)
const editorError = ref('')
const layoutMode = ref<'desktop' | 'mobile'>(typeof window !== 'undefined' && window.innerWidth <= 760 ? 'mobile' : 'desktop')

const currentTask = computed(() => store.displayTask.value)
const currentOptions = computed<readonly WheelOptionView[]>(() => [...store.wheelOptions.value])
const editorModified = computed(() => Boolean(store.activePool.value && store.isPoolModified(store.activePool.value.id)))
const recentLogs = computed(() => store.displayLogs.value.slice(-3).reverse())
const statusText = computed(() => {
  if (store.isBusy.value) return `命运转动中 · 第 ${store.context.value.step + 1} 步`
  if (store.isAuto.value) return store.isTurbo.value ? '极速推进中' : '自动推进中'
  if (store.awaitingAdvance.value) return '查看本次命运'
  if (store.machine.value.value === 'ending') return '命运已完结'
  return store.isStarted.value ? '待命' : '尚未开始'
})
const resultTone = computed(() => {
  const tone = recentLogs.value[0]?.tone
  return tone === 'major' ? 'rare' : tone ?? 'normal'
})
const summaryPower = computed(() => store.context.value.beast ? `${store.context.value.beast.cultivation}年` : `${store.context.value.level}级`)

async function handleSaveImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const success = store.importSave(await file.text())
  importStatus.value = success ? '存档导入成功' : '无法读取该存档'
  input.value = ''
  window.setTimeout(() => { importStatus.value = '' }, 2200)
}

async function handleOverridesImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const error = store.importWheelOverrides(await file.text())
  importStatus.value = error ? `转盘修改导入失败：${error}` : '转盘修改导入成功'
  input.value = ''
  window.setTimeout(() => { importStatus.value = '' }, 3200)
}

function openEditor() {
  if (!store.activePool.value || store.isBusy.value || store.awaitingAdvance.value) return
  store.stopAuto()
  editorError.value = ''
  editorOpen.value = true
}

function advanceOrSpin() {
  if (store.awaitingAdvance.value) store.advance()
  else void store.spin()
}

function applyEditor(options: typeof currentOptions.value) {
  const pool = store.activePool.value
  if (!pool) return
  const error = store.applyWheelOverride(pool, options)
  editorError.value = error ?? ''
  if (!error) editorOpen.value = false
}

function resetEditor() {
  if (!store.activePool.value) return
  store.resetWheelOverride(store.activePool.value.id)
  editorOpen.value = false
}

function clearOverrides() {
  if (window.confirm('清除全部转盘修改后无法恢复，确定继续吗？')) store.clearWheelOverrides()
}

function setLayoutMode(mode: 'desktop' | 'mobile') {
  layoutMode.value = mode
}

</script>

<template>
  <div class="app-shell" :data-layout="layoutMode">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark"><Sparkles :size="22" /></span>
        <div><h1>斗罗大陆 · 命运轮盘</h1><p>自动剧情与肉鸽成长模拟器</p></div>
      </div>
      <div class="top-actions">
        <span class="status"><i :class="{ active: store.isBusy.value || store.isAuto.value }" />{{ statusText }}</span>
        <div class="layout-switch" role="group" aria-label="界面布局">
          <button class="icon-button" type="button" title="切换为 PC 布局" aria-label="切换为 PC 布局" :aria-pressed="layoutMode === 'desktop'" @click="setLayoutMode('desktop')"><Monitor :size="18" /></button>
          <button class="icon-button" type="button" title="切换为移动端布局" aria-label="切换为移动端布局" :aria-pressed="layoutMode === 'mobile'" @click="setLayoutMode('mobile')"><Smartphone :size="18" /></button>
        </div>
        <button class="icon-button labeled undo-button" :disabled="!store.canUndo.value" title="返回上一转盘" @click="store.undo"><RotateCcw :size="17" />返回</button>
        <OverflowMenu
          :overrides="store.overrideCount.value"
          @save="store.persist"
          @restore="store.restoreLocal"
          @export-overrides="store.exportWheelOverrides"
          @import-overrides="importOverridesInput?.click()"
          @export-save="store.exportSave"
          @import-save="importSaveInput?.click()"
          @export-chronicle="store.exportChronicle"
          @clear-overrides="clearOverrides"
        />
        <button class="button primary" @click="store.openStart"><Sparkles :size="17" />新命运</button>
      </div>
    </header>
    <p v-if="importStatus" class="import-toast" role="status">{{ importStatus }}</p>

    <section class="character-summary" aria-label="角色摘要">
      <strong>{{ store.context.value.name }}</strong><span>{{ store.routeLabel.value }}</span><span>{{ store.context.value.age == null ? '年龄未定' : `${store.context.value.age}岁` }} · {{ store.context.value.gender || '性别未定' }}</span><span>{{ summaryPower }}</span><span>{{ store.context.value.faction || store.context.value.beast?.area || '自由' }}</span><span>{{ store.context.value.alive ? store.context.value.godTrial ? '神考中' : '存活' : '已陨落' }}</span><span>{{ store.phaseLabel.value }}</span>
    </section>

    <MobileTabs v-model="mobileTab" />
    <main class="main-grid">
      <section class="panel stage-panel" :class="{ 'mobile-hidden': mobileTab !== 'stage' }">
        <header class="task-header">
          <div><p class="eyebrow">{{ store.phaseLabel.value }}</p><h2>{{ store.taskTitle.value }}</h2><span>{{ store.activePool.value ? `${currentOptions.length} 个当前候选结果` : '命运尚未展开' }}</span></div>
          <button class="button editor-entry" :disabled="!store.activePool.value || store.isBusy.value || store.awaitingAdvance.value" @click="openEditor"><Pencil :size="16" />修改</button>
        </header>
        <div class="stage-content">
          <FateWheel
            :options="currentOptions"
            :selected-index="store.wheelSelectedIndex.value"
            :spin-nonce="store.wheelSpinNonce.value"
            :reset-nonce="store.wheelResetNonce.value"
            :duration="store.isTurbo.value ? 40 : store.context.value.settings.spinDuration"
            :disabled="!store.isStarted.value || store.isBusy.value || store.isAuto.value || store.machine.value.value === 'ending'"
            :awaiting-advance="store.awaitingAdvance.value"
            @spin="advanceOrSpin"
          />
          <div class="stage-feedback">
            <div class="result-panel" :data-tone="resultTone">
              <span>本次命运</span><p>{{ store.displayResult.value }}</p>
              <small v-if="store.context.value.lastPool">{{ store.context.value.lastPool }} · 第 {{ store.context.value.step }} 次投掷<template v-if="store.context.value.lastProbability != null"> · 概率 {{ (store.context.value.lastProbability * 100).toFixed(2) }}%</template></small>
            </div>
            <section class="recent-log"><header><span>最近经历</span><small>{{ recentLogs.length }} 条</small></header><p v-for="entry in recentLogs" :key="entry.id"><strong>{{ entry.title }}</strong>{{ entry.text }}</p><p v-if="!recentLogs.length" class="empty">转动命运轮盘后，这里会显示最近经历。</p></section>
          </div>
        </div>
        <div class="play-controls" aria-label="命运推进操作">
          <button class="button gold" :disabled="!store.isStarted.value || store.isBusy.value || store.isAuto.value || store.machine.value.value === 'ending'" @click="advanceOrSpin"><Play :size="17" />{{ store.awaitingAdvance.value ? '进入下一项' : '继续剧情' }}</button>
          <button class="button primary" :disabled="store.isBusy.value || store.machine.value.value === 'ending'" @click="store.toggleAuto(false)"><Pause v-if="store.isAuto.value && !store.isTurbo.value" :size="17" /><Play v-else :size="17" />{{ store.isAuto.value && !store.isTurbo.value ? '暂停自动' : '自动推进' }}</button>
          <button class="button" :disabled="store.isBusy.value || store.machine.value.value === 'ending'" @click="store.toggleAuto(true)"><Pause v-if="store.isAuto.value && store.isTurbo.value" :size="17" /><FastForward v-else :size="17" />{{ store.isAuto.value && store.isTurbo.value ? '暂停极速' : '极速结算' }}</button>
        </div>
      </section>

      <aside class="sidebar">
        <CharacterPanel :class="{ 'mobile-hidden': mobileTab !== 'character' }" :context="store.context.value" :route-label="store.routeLabel.value" :phase-label="store.phaseLabel.value" />
        <ChroniclePanel :class="{ 'mobile-hidden': mobileTab !== 'chronicle' }" :entries="store.displayLogs.value" :copy-status="store.copyStatus.value" @export="store.exportChronicle" @copy="store.copyChronicle" />
      </aside>
    </main>

    <details class="advanced-section">
      <summary><Settings2 :size="18" />高级工具与设置</summary>
      <div class="advanced-grid">
        <PoolBrowser />
        <section class="settings-panel">
          <header><div><p class="eyebrow">本地偏好</p><h2>模拟设置</h2></div><Gauge :size="20" /></header>
          <label class="toggle-row"><span><strong>柔化措辞</strong><small>替换少量粗俗或露骨文本</small></span><input type="checkbox" :checked="store.context.value.settings.softenText" @change="store.setSoftenText(($event.target as HTMLInputElement).checked)" /></label>
          <label class="range-row"><span><strong>轮盘时长</strong><small>{{ (store.context.value.settings.spinDuration / 1000).toFixed(1) }} 秒</small></span><input type="range" min="100" max="4000" step="100" :value="store.context.value.settings.spinDuration" @input="store.setSpinDuration(Number(($event.target as HTMLInputElement).value))" /></label>
        </section>
      </div>
    </details>
  </div>

  <input ref="importSaveInput" class="sr-only" type="file" accept="application/json,.json" aria-label="导入存档文件" @change="handleSaveImport" />
  <input ref="importOverridesInput" class="sr-only" type="file" accept="application/json,.json" aria-label="导入转盘覆盖文件" @change="handleOverridesImport" />
  <StartDialog :open="store.isStartOpen.value || !store.isStarted.value" :cancellable="store.isStarted.value" @start="store.start" @cancel="store.cancelStart" />
  <WheelEditorDialog :open="editorOpen" :pool="store.activePool.value" :modified="editorModified" :external-error="editorError" :catalog="store.editorCatalog.value" :preview="store.previewWheelOverride" @close="editorOpen = false" @apply="applyEditor" @reset="resetEditor" />
  <div v-if="store.machine.value.value === 'ending'" class="ending-banner" role="status"><div><span>{{ store.context.value.alive ? '命运终章' : '命运断绝' }}</span><strong>{{ store.context.value.ending }}</strong></div><button class="button primary" @click="store.openStart"><Sparkles :size="17" />再来一局</button></div>
</template>
