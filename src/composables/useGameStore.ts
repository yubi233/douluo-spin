import { computed, readonly, ref, shallowRef } from 'vue'
import { ContentService } from '@/application/contentService'
import { createEditorCatalog } from '@/application/editorCatalog'
import { GameService } from '@/application/gameService'
import { formatBiography, projectGameView, projectPool, type TaskView, type WheelOptionView, type WheelPoolView } from '@/application/gameViewModel'
import { parseSave, serializeSave } from '@/application/persistence'
import { v03Policies, v03Registries } from '@/content/v03/content'
import { candidateDistribution } from '@/core/draw/draw'
import type { StartRoute } from '@/core/model/contracts'
import { downloadText, safeFileName, soften } from '@/utils/text'

const STORAGE_KEY = 'douluo-spin-vue-v3'
const OVERRIDE_KEY = 'douluo-wheel-overrides-v3'
const SETTINGS_KEY = 'douluo-spin-settings-v3'

const contentService = new ContentService()
let gameService = new GameService(contentService.content, v03Policies)
const revision = shallowRef(0)
const isBusy = shallowRef(false)
const isAuto = shallowRef(false)
const isTurbo = shallowRef(false)
const isStartOpen = shallowRef(true)
const awaitingAdvance = shallowRef(false)
const wheelPool = shallowRef<WheelPoolView | null>(null)
const wheelTask = shallowRef<TaskView | null>(null)
const wheelOptions = shallowRef<readonly WheelOptionView[]>([])
const wheelSelectedIndex = shallowRef(-1)
const wheelSpinNonce = shallowRef(0)
const wheelResetNonce = shallowRef(0)
const copyStatus = ref<'idle' | 'success' | 'failed'>('idle')
const settings = ref({ softenText: false, spinDuration: 900 })
let autoTimer: number | null = null
let copyStatusTimer: number | null = null

function touch() { revision.value += 1 }

function createSeed(): string {
  const values = new Uint32Array(2)
  globalThis.crypto?.getRandomValues(values)
  return `${Date.now().toString(36)}-${[...values].map((value) => value.toString(36)).join('')}`
}

function currentTask() { return gameService.state.agenda[0] ?? null }

function refreshWheel(reset = true) {
  const task = currentTask()
  if (!task) {
    wheelTask.value = null
    wheelPool.value = null
    wheelOptions.value = []
    wheelSelectedIndex.value = -1
    if (reset) wheelResetNonce.value += 1
    return
  }
  const mechanics = contentService.content.mechanics.pools.get(task.poolId)
  const candidates = mechanics ? candidateDistribution(mechanics, gameService.state, v03Policies) : []
  const projected = projectPool(contentService.content, task.poolId, candidates)
  wheelTask.value = projected ? { id: task.id, poolId: task.poolId, pool: projected.name, process: task.process } : null
  wheelPool.value = projected
  wheelOptions.value = projected?.options.filter((option) => option.enabled && option.probability > 0) ?? []
  wheelSelectedIndex.value = -1
  if (reset) wheelResetNonce.value += 1
}

function openStart() {
  stopAuto()
  isStartOpen.value = true
}

function cancelStart() { if (gameService.state.phase !== 'idle') isStartOpen.value = false }

function start(route: StartRoute, seed = createSeed()) {
  stopAuto()
  gameService = new GameService(contentService.content, v03Policies)
  gameService.dispatch({ type: 'run.start', route, seed })
  awaitingAdvance.value = false
  isStartOpen.value = false
  touch()
  persist()
  refreshWheel()
}

function advance() {
  if (!awaitingAdvance.value || isBusy.value) return false
  awaitingAdvance.value = false
  refreshWheel()
  return true
}

async function spin() {
  if (isBusy.value || gameService.state.phase === 'ended' || gameService.state.phase === 'idle') return
  if (awaitingAdvance.value) advance()
  const displayedPool = wheelPool.value
  const receipt = gameService.dispatch({ type: 'turn.spin' })
  touch()
  persist()
  if (displayedPool && receipt.draw) {
    wheelSelectedIndex.value = displayedPool.options.filter((option) => option.enabled && option.probability > 0).findIndex((option) => option.id === receipt.draw?.optionId)
  }
  wheelSpinNonce.value += 1
  isBusy.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, isTurbo.value ? 40 : settings.value.spinDuration))
  } finally {
    isBusy.value = false
  }
  const ended = gameService.state.ending != null
  awaitingAdvance.value = !ended
  if (isAuto.value && !ended) scheduleAutoSpin()
  else if (ended) stopAuto()
}

function scheduleAutoSpin() {
  if (!isAuto.value || gameService.state.phase === 'ended') return
  autoTimer = window.setTimeout(() => {
    autoTimer = null
    advance()
    if (isAuto.value) void spin()
  }, isTurbo.value ? 50 : 1_000)
}

function toggleAuto(turbo = false) {
  if (isAuto.value) return stopAuto()
  if (turbo && !window.confirm('确定开启极速结算？将自动快速完成所有命运步骤。')) return
  isAuto.value = true
  isTurbo.value = turbo
  void spin()
}

function stopAuto() {
  isAuto.value = false
  isTurbo.value = false
  if (autoTimer != null) window.clearTimeout(autoTimer)
  autoTimer = null
}

function undo() {
  if (isBusy.value || !canUndo.value) return
  stopAuto()
  gameService.dispatch({ type: 'turn.undo' })
  awaitingAdvance.value = false
  touch()
  persist()
  refreshWheel()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSave(contentService.content.manifest.contentVersion, gameService.eventLog))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
  } catch { /* localStorage may be unavailable */ }
}

function restoreValue(value: string): boolean {
  try {
    const save = parseSave(value, contentService.content.manifest.contentVersion)
    const restored = new GameService(contentService.content, v03Policies)
    restored.restore(save.batches)
    gameService = restored
    awaitingAdvance.value = false
    isStartOpen.value = restored.state.phase === 'idle'
    touch()
    refreshWheel()
    return true
  } catch { return false }
}

function restoreLocal(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? restoreValue(value) : false
  } catch { return false }
}

function importSave(content: string): boolean {
  stopAuto()
  const restored = restoreValue(content)
  if (restored) persist()
  return restored
}

function exportSave() {
  downloadText(`斗罗大陆命运存档_${safeFileName(context.value.seed)}.json`, serializeSave(contentService.content.manifest.contentVersion, gameService.eventLog), 'application/json')
}

function biography() { return formatBiography(context.value) }
function exportChronicle() { downloadText(`斗罗大陆人物传记_${safeFileName(context.value.seed)}.txt`, biography()) }

async function copyChronicle() {
  try {
    await navigator.clipboard.writeText(biography())
    copyStatus.value = 'success'
  } catch { copyStatus.value = 'failed' }
  if (copyStatusTimer != null) window.clearTimeout(copyStatusTimer)
  copyStatusTimer = window.setTimeout(() => { copyStatus.value = 'idle' }, 2_000)
}

function replaceContent() {
  const restored = new GameService(contentService.content, v03Policies)
  restored.restore(gameService.eventLog)
  gameService = restored
  touch()
  refreshWheel()
}

function applyWheelOverride(pool: WheelPoolView, options: readonly WheelOptionView[]): string | null {
  try {
    contentService.apply(pool.id, options)
    replaceContent()
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(contentService.exportDocument()))
    return null
  } catch (error) { return error instanceof Error ? error.message : '内容校验失败' }
}

function previewWheelOverride(pool: WheelPoolView | null, options: readonly WheelOptionView[]) {
  if (!pool) return { probabilities: {} as Record<string, number>, error: '当前没有可预览的转盘。' }
  try {
    const content = contentService.preview(pool.id, options)
    const mechanics = content.mechanics.pools.get(pool.id as never)
    if (!mechanics) throw new Error(`Unknown pool ${pool.id}`)
    const candidates = candidateDistribution(mechanics, gameService.state, v03Policies)
    return { probabilities: Object.fromEntries(candidates.map((candidate) => [candidate.optionId, candidate.probability])), error: '' }
  } catch (error) {
    return { probabilities: {} as Record<string, number>, error: error instanceof Error ? error.message : '内容预览失败' }
  }
}

function resetWheelOverride(poolId: string) {
  contentService.reset(poolId)
  replaceContent()
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(contentService.exportDocument()))
}

function clearWheelOverrides() {
  contentService.clear()
  replaceContent()
  localStorage.removeItem(OVERRIDE_KEY)
}

function exportWheelOverrides() {
  downloadText('douluo-wheel-overrides-v3.json', JSON.stringify(contentService.exportDocument(), null, 2), 'application/json')
}

function importWheelOverrides(value: string): string | null {
  try {
    contentService.importDocument(JSON.parse(value))
    replaceContent()
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(contentService.exportDocument()))
    return null
  } catch (error) {
    return error instanceof Error ? error.message : '转盘修改文件无效'
  }
}

function setSoftenText(value: boolean) { settings.value = { ...settings.value, softenText: value }; persist() }
function setSpinDuration(value: number) { settings.value = { ...settings.value, spinDuration: Math.max(100, Math.min(4_000, value)) }; persist() }

const serviceState = computed(() => { revision.value; return gameService.state })
const context = computed(() => projectGameView(serviceState.value, gameService.eventLog, contentService.content, settings.value))
const machine = computed(() => ({ value: serviceState.value.phase === 'ended' ? 'ending' : serviceState.value.phase }))
const isStarted = computed(() => serviceState.value.phase !== 'idle')
const canUndo = computed(() => {
  revision.value
  return gameService.eventLog.some((batch) => batch.command === 'turn.spin') && !isBusy.value
})
const routeLabel = computed(() => ({ human: '人类魂师', beast: '魂兽', transformed: '化形魂师' })[context.value.route ?? 'human'])
const phaseLabel = computed(() => ({ idle: '尚未启封', 'setup.human': '人类基础设定', 'setup.beast': '魂兽基础设定', 'setup.transformed': '化形重塑', 'adventure.human': '人类命运推进', 'adventure.beast': '魂兽命运推进', 'adventure.transformed': '化形命运推进', 'god-trial': '神考进行中', ended: '命运终章' })[serviceState.value.phase])
const taskTitle = computed(() => wheelTask.value?.pool ?? (serviceState.value.phase === 'ended' ? '本轮旅程已经结束' : '展开下一段命运'))
const displayResult = computed(() => soften(context.value.lastResult || '等待第一次转动。', settings.value.softenText))
const displayLogs = computed(() => context.value.logs.map((entry) => ({ ...entry, text: soften(entry.text, settings.value.softenText) })))
const overrideCount = computed(() => { revision.value; return contentService.count })
const editorCatalog = computed(() => { revision.value; return createEditorCatalog(contentService.content, v03Registries) })
function isPoolModified(poolId: string) { return contentService.isPatched(poolId) }

try {
  const rawSettings = localStorage.getItem(SETTINGS_KEY)
  if (rawSettings) settings.value = { ...settings.value, ...JSON.parse(rawSettings) }
  const rawOverrides = localStorage.getItem(OVERRIDE_KEY)
  if (rawOverrides) contentService.importDocument(JSON.parse(rawOverrides))
  restoreLocal()
} catch { /* ignore invalid local state */ }

export function useGameStore() {
  return {
    machine, context, isBusy: readonly(isBusy), isAuto: readonly(isAuto), isTurbo: readonly(isTurbo), awaitingAdvance: readonly(awaitingAdvance),
    isStarted, isStartOpen: readonly(isStartOpen), canUndo, routeLabel, phaseLabel, activePool: wheelPool, displayTask: wheelTask,
    taskTitle, displayResult, displayLogs, wheelPool, wheelOptions, wheelSelectedIndex: readonly(wheelSelectedIndex),
    wheelSpinNonce: readonly(wheelSpinNonce), wheelResetNonce: readonly(wheelResetNonce), overrideCount,
    needsCustomGodName: computed(() => false), resolveCustomGod: () => {}, openStart, cancelStart, start, spin, advance, toggleAuto, stopAuto, undo,
    persist, restoreLocal, importSave, exportSave, exportChronicle, copyChronicle, copyStatus: readonly(copyStatus), applyWheelOverride, previewWheelOverride, editorCatalog,
    resetWheelOverride, clearWheelOverrides, exportWheelOverrides, importWheelOverrides, setSoftenText, setSpinDuration, isPoolModified,
  }
}
