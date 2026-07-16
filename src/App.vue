<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FastForward, Gauge, Monitor, Pause, Pencil, Play, RotateCcw, Settings2, Smartphone, Sparkles } from 'lucide-vue-next'
import CharacterPanel from '@/components/CharacterPanel.vue'
import ChroniclePanel from '@/components/ChroniclePanel.vue'
import FateWheel from '@/components/FateWheel.vue'
import MobileTabs, { type MobileTab } from '@/components/MobileTabs.vue'
import OverflowMenu from '@/components/OverflowMenu.vue'
import PoolBrowser from '@/components/PoolBrowser.vue'
import StartDialog from '@/components/StartDialog.vue'
import WheelEditorDialog from '@/components/WheelEditorDialog.vue'
import { findPool } from '@/domain/catalog'
import { calculateCombatPower, estimateOpponentLevel } from '@/domain/engine'
import { useGameStore } from '@/composables/useGameStore'

const store = useGameStore()
const importInput = ref<HTMLInputElement | null>(null)
const importStatus = ref('')
const mobileTab = ref<MobileTab>('stage')
const editorOpen = ref(false)
const layoutMode = ref<'desktop' | 'mobile'>(typeof window !== 'undefined' && window.innerWidth <= 760 ? 'mobile' : 'desktop')
const customGodName = ref('')
const showCustomGodDialog = ref(false)

const currentTask = computed(() => store.displayTask.value)
const currentOptions = computed(() => store.wheelOptions.value.length > 0
  ? store.wheelOptions.value
  : store.activePool.value && currentTask.value
    ? store.activePool.value.options.filter((option) => option.enabled !== false)
    : [])
const originalPool = computed(() => store.activePool.value ? findPool(store.activePool.value.name) ?? null : null)
const editorModified = computed(() => Boolean(store.activePool.value && originalPool.value
  && JSON.stringify(store.activePool.value.options) !== JSON.stringify(originalPool.value.options)))
const recentLogs = computed(() => store.displayLogs.value.slice(-3).reverse())
const statusText = computed(() => {
  if (store.isBusy.value) return `命运转动中 · 第 ${store.context.value.step + 1} 步`
  if (store.isAuto.value) return store.isTurbo.value ? '极速推进中' : '自动推进中'
  if (store.awaitingAdvance.value) return '查看本次命运'
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
const summaryPower = computed(() => store.context.value.beast ? `${store.context.value.beast.cultivation}年` : `${store.context.value.level}级`)
const combatPowerValue = computed(() => store.context.value.beast ? 0 : calculateCombatPower(store.context.value))
const combatMultiplier = computed(() => {
  if (!store.displayTask.value || store.context.value.beast) return null
  const handler = store.displayTask.value.handler
  if (handler !== 'story') return null
  const power = combatPowerValue.value
  if (power <= 0) return null
  const pool = store.activePool.value
  if (!pool) return null
  const opts = currentOptions.value
  const opponentLevels = new Set<number>()
  for (const opt of opts) {
    const ol = estimateOpponentLevel(opt.name)
    if (ol > 0) opponentLevels.add(ol)
  }
  const avgOpponentLevel = opponentLevels.size > 0
    ? Math.round([...opponentLevels].reduce((a, b) => a + b, 0) / opponentLevels.size)
    : 0
  const opponentPower = avgOpponentLevel > 0 ? Math.round(avgOpponentLevel * avgOpponentLevel / 20) : 0
  const ratio = opponentPower > 0 ? (power / opponentPower).toFixed(2) : '-'
  const victoryMult = opponentPower > 0
    ? Math.max(0.1, Math.min(10, (power / opponentPower) * 2)).toFixed(2)
    : (1 + Math.min(power / 100, 5)).toFixed(2)
  const defeatMult = opponentPower > 0
    ? Math.max(0.05, Math.min(10, 1 / Math.max(0.1, power / opponentPower) * 2)).toFixed(3)
    : Math.max(0.05, 1 - Math.min(power / 120, 0.95)).toFixed(3)
  return { opponentLevel: avgOpponentLevel, opponentPower, ratio, victory: victoryMult, defeat: defeatMult }
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

function openEditor() {
  if (!store.activePool.value || store.isBusy.value || store.awaitingAdvance.value) return
  store.stopAuto()
  editorOpen.value = true
}

function applyEditor(options: typeof currentOptions.value) {
  const pool = store.activePool.value
  if (!pool) return
  const error = store.applyWheelOverride(pool, options)
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

function submitCustomGodName() {
  const name = customGodName.value.trim()
  if (!name) return
  store.resolveCustomGod(name)
  customGodName.value = ''
  showCustomGodDialog.value = false
}

watch(() => store.needsCustomGodName.value, (val) => {
  if (val) {
    customGodName.value = ''
    showCustomGodDialog.value = true
  }
})
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
          @export-save="store.exportSave"
          @import-save="importInput?.click()"
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
            @spin="store.spin"
          />
          <div class="stage-feedback">
            <div class="result-panel" :data-tone="resultTone">
              <span>本次命运</span><p>{{ store.displayResult.value }}</p>
              <small v-if="store.context.value.lastPool">{{ store.context.value.lastPool }} · 第 {{ store.context.value.step }} 次投掷<template v-if="store.context.value.lastProbability != null"> · 概率 {{ (store.context.value.lastProbability * 100).toFixed(2) }}%</template></small>
              <small v-if="combatMultiplier" class="combat-coeff">
                战力 {{ combatPowerValue }}<template v-if="combatMultiplier.opponentLevel > 0"> · 对手 {{ combatMultiplier.opponentLevel }}级(战力{{ combatMultiplier.opponentPower }}) · 战力比 {{ combatMultiplier.ratio }}x</template>
                 · 胜率乘 {{ combatMultiplier.victory }}x · 败率乘 {{ combatMultiplier.defeat }}x
              </small>
            </div>
            <section class="recent-log"><header><span>最近经历</span><small>{{ recentLogs.length }} 条</small></header><p v-for="entry in recentLogs" :key="entry.id"><strong>{{ entry.title }}</strong>{{ entry.text }}</p><p v-if="!recentLogs.length" class="empty">转动命运轮盘后，这里会显示最近经历。</p></section>
          </div>
        </div>
        <div class="play-controls" aria-label="命运推进操作">
          <button class="button gold" :disabled="!store.isStarted.value || store.isBusy.value || store.isAuto.value || store.machine.value.value === 'ending'" @click="store.spin"><Play :size="17" />{{ store.awaitingAdvance.value ? '进入下一项' : '继续剧情' }}</button>
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

  <input ref="importInput" class="sr-only" type="file" accept="application/json,.json" @change="handleImport" />
  <StartDialog :open="store.isStartOpen.value || !store.isStarted.value" :cancellable="store.isStarted.value" @start="store.start" @cancel="store.cancelStart" />
  <WheelEditorDialog :open="editorOpen" :pool="store.activePool.value" :task="currentTask" :context="store.context.value" :original-option-ids="originalPool?.options.map((option) => option.id) ?? []" :modified="editorModified" @close="editorOpen = false" @apply="applyEditor" @reset="resetEditor" />
  <div v-if="store.machine.value.value === 'ending'" class="ending-banner" role="status"><div><span>{{ store.context.value.alive ? '命运终章' : '命运断绝' }}</span><strong>{{ store.context.value.ending }}</strong></div><button class="button primary" @click="store.openStart"><Sparkles :size="17" />再来一局</button></div>

  <Teleport to="body">
    <div v-if="showCustomGodDialog" class="modal-backdrop custom-god-dialog" @click.self="() => {}">
      <div class="dialog">
        <h2>自创神位</h2>
        <p>五次春秋更迭，你踏遍斗罗大陆的每一个角落——星斗大森林的深处、海神岛的潮汐之间、武魂殿的圣殿之下、杀戮之都的无尽血海。然而无论你如何追寻，神位的感召始终与你无缘。仰望星空，你心中生出一股冲天豪气——若天道不授神位于我，我便逆天而行，燃出一条属于自己的成神之路。</p>
        <form @submit.prevent="submitCustomGodName">
          <label class="god-name-label">
            <span>请为你的神位命名</span>
            <div class="god-name-input-wrap">
              <input v-model="customGodName" type="text" maxlength="6" placeholder="如：剑、战狼、星辰" autofocus />
              <span class="god-name-suffix">神</span>
            </div>
          </label>
          <footer class="dialog-actions">
            <button type="submit" class="button primary" :disabled="!customGodName.trim()">确定</button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
</template>
