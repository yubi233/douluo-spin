import { computed, readonly, shallowRef } from 'vue'
import { previewOptions } from '@/domain/engine'
import { drawActiveTask, createInitialState, transition } from '@/domain/machine'
import { createSeed } from '@/domain/random'
import type { MachineEvent, MachineState, RollTask, StartRoute, WheelOption, WheelPool } from '@/domain/types'
import { downloadText, safeFileName, soften } from '@/utils/text'
import { useWheelOverrides } from './useWheelOverrides'

const STORAGE_KEY = 'douluo-spin-vue-v1'
const machine = shallowRef<MachineState>(createInitialState())
const history = shallowRef<MachineState[]>([])
const isBusy = shallowRef(false)
const isAuto = shallowRef(false)
const isTurbo = shallowRef(false)
const wheelPool = shallowRef<WheelPool | null>(null)
const wheelTask = shallowRef<RollTask | null>(null)
const wheelOptions = shallowRef<WheelOption[]>([])
const wheelSelectedIndex = shallowRef(-1)
const wheelSpinNonce = shallowRef(0)
const wheelResetNonce = shallowRef(0)
const awaitingAdvance = shallowRef(false)
const MAX_REROLL_ATTEMPTS = 250
let autoTimer: number | null = null
let autoFrame: number | null = null
const overrides = useWheelOverrides()

function currentTask() {
  return machine.value.context.activeTask ?? machine.value.context.queue[0] ?? null
}

function refreshWheel(reset = true) {
  const task = currentTask()
  const pool = task ? overrides.resolve(task.pool) ?? null : null
  wheelTask.value = task
  wheelPool.value = pool
  wheelOptions.value = pool && task ? previewOptions(pool, task, machine.value.context) : []
  wheelSelectedIndex.value = -1
  if (reset) wheelResetNonce.value += 1
}

function snapshot() {
  history.value = [...history.value.slice(-49), structuredClone(machine.value)]
}

function apply(event: MachineEvent, remember = false): boolean {
  if (remember) snapshot()
  const result = transition(machine.value, event)
  if (!result.accepted) {
    if (remember) history.value = history.value.slice(0, -1)
    console.warn(result.reason)
    return false
  }
  machine.value = result.state
  persist()
  return true
}

function openStart() {
  stopAuto()
  awaitingAdvance.value = false
  apply({ type: 'OPEN_START' })
}

function cancelStart() {
  apply({ type: 'CANCEL_START' })
}

function start(route: StartRoute, seed = createSeed()) {
  stopAuto()
  history.value = []
  awaitingAdvance.value = false
  apply({ type: 'START', route, seed })
  refreshWheel()
}

function advance() {
  if (!awaitingAdvance.value || isBusy.value) return false
  awaitingAdvance.value = false
  refreshWheel()
  return true
}

function scheduleAutoSpin() {
  if (!isAuto.value || hasEnded()) return
  const delay = isTurbo.value ? 50 : 5_000
  autoTimer = window.setTimeout(() => {
    autoTimer = null
    if (!isAuto.value || hasEnded()) return
    advance()
    // Let the wheel paint at its resting angle before the next spin begins.
    autoFrame = window.requestAnimationFrame(() => {
      autoFrame = null
      if (isAuto.value && !hasEnded()) void spin()
    })
  }, delay)
}

async function spin() {
  if (isBusy.value || machine.value.value === 'ending' || machine.value.value === 'idle') return
  if (awaitingAdvance.value) {
    advance()
    scheduleAutoSpin()
    return
  }
  if (!apply({ type: 'ROLL' }, true)) return

  isBusy.value = true
  try {
    const { pool, draw } = drawActiveTask(machine.value, overrides.resolve)
    const rolling = structuredClone(machine.value)
    rolling.context.rng = draw.nextRng
    machine.value = rolling
    wheelPool.value = pool
    wheelOptions.value = previewOptions(pool, machine.value.context.activeTask!, machine.value.context)
    wheelSelectedIndex.value = wheelOptions.value.findIndex((option) => option.id === draw.option.id)
    wheelSpinNonce.value += 1
    const duration = isTurbo.value ? 40 : machine.value.context.settings.spinDuration
    await new Promise((resolve) => window.setTimeout(resolve, duration))
    apply({ type: 'RESOLVE', option: draw.option, probability: draw.probability })
    awaitingAdvance.value = !hasEnded()
  } finally {
    isBusy.value = false
  }

  if (isAuto.value && !hasEnded()) {
    scheduleAutoSpin()
  } else if (hasEnded()) {
    stopAuto()
  }
}

function toggleAuto(turbo = false) {
  if (isAuto.value) {
    stopAuto()
    return
  }
  isAuto.value = true
  isTurbo.value = turbo
  void spin()
}

function stopAuto() {
  isAuto.value = false
  isTurbo.value = false
  if (autoTimer != null) window.clearTimeout(autoTimer)
  if (autoFrame != null) window.cancelAnimationFrame(autoFrame)
  autoTimer = null
  autoFrame = null
}

function hasEnded() {
  return machine.value.value === 'ending'
}

function retryRng(restored: MachineState, blocked: { pool: string; optionId?: string; result: string }): number {
  let candidateRng = machine.value.context.rng
  if (!blocked.pool || (!blocked.optionId && !blocked.result)) return candidateRng

  for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt += 1) {
    const trial = structuredClone(restored)
    trial.context.rng = candidateRng
    const rolling = transition(trial, { type: 'ROLL' })
    if (!rolling.accepted || rolling.state.value === 'ending') return candidateRng
    if (rolling.state.context.activeTask?.pool !== blocked.pool) return candidateRng

    const { draw } = drawActiveTask(rolling.state, overrides.resolve)
    const repeatsLastResult = blocked.optionId
      ? draw.option.id === blocked.optionId
      : draw.option.name === blocked.result
    if (!repeatsLastResult) return candidateRng
    candidateRng = draw.nextRng
  }
  return candidateRng
}

function undo() {
  if (isBusy.value || history.value.length === 0) return
  stopAuto()
  awaitingAdvance.value = false
  const previous = history.value[history.value.length - 1]
  history.value = history.value.slice(0, -1)
  if (previous) {
    const current = machine.value
    const restored = structuredClone(previous)
    restored.context.rng = retryRng(restored, {
      pool: current.context.lastPool,
      optionId: current.context.lastOptionId,
      result: current.context.lastResult,
    })
    machine.value = restored
    persist()
    refreshWheel()
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(machine.value))
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function restoreLocal(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return false
    const parsed = JSON.parse(value) as MachineState
    machine.value = parsed.value === 'rolling'
      ? { ...parsed, value: parsed.context.resumeState ?? 'idle', context: { ...parsed.context, activeTask: null } }
      : parsed
    awaitingAdvance.value = false
    refreshWheel()
    return true
  } catch {
    return false
  }
}

function importSave(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as MachineState
    if (!parsed.value || !parsed.context?.seed) return false
    stopAuto()
    history.value = []
    awaitingAdvance.value = false
    machine.value = parsed
    persist()
    refreshWheel()
    return true
  } catch {
    return false
  }
}

function exportSave() {
  const seed = safeFileName(machine.value.context.seed)
  downloadText(`斗罗大陆命运存档_${seed}.json`, JSON.stringify(machine.value, null, 2), 'application/json')
}

function exportChronicle() {
  const context = machine.value.context
  const factionHistory = typeof context.flags.factionHistory === 'string'
    ? context.flags.factionHistory.split('｜').join(' · ')
    : context.faction
  const lines = [
    '《斗罗大陆 · 命运轮盘人物传记》',
    '',
    `命运种子：${context.seed}`,
    `路线：${routeLabel.value}`,
    `终局：${context.ending || '尚未完结'}`,
    `等级：${context.beast ? `${context.beast.cultivation}年修为` : `${context.level}级`}`,
    `阵营：${factionHistory || context.beast?.area || '自由'}`,
    '',
    '【命运纪事】',
    ...context.logs.map((entry) => `${entry.time}｜${entry.title}｜${entry.text}`),
  ]
  downloadText(`斗罗大陆人物传记_${safeFileName(context.seed)}.txt`, lines.join('\n'))
}

function applyWheelOverride(pool: WheelPool, options: readonly WheelOption[]): string | null {
  const error = overrides.apply(pool, options)
  if (!error) refreshWheel()
  return error
}

function resetWheelOverride(poolId: string) {
  overrides.reset(poolId)
  refreshWheel()
}

function clearWheelOverrides() {
  overrides.clear()
  refreshWheel()
}

function exportWheelOverrides() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
  downloadText(`douluo-wheel-overrides-${stamp}.json`, overrides.exportJson(), 'application/json')
}

function setSoftenText(value: boolean) {
  const next = structuredClone(machine.value)
  next.context.settings.softenText = value
  machine.value = next
  persist()
}

function setSpinDuration(value: number) {
  const next = structuredClone(machine.value)
  next.context.settings.spinDuration = Math.max(100, Math.min(4000, value))
  machine.value = next
  persist()
}

const needsCustomGodName = computed(() => !!machine.value.context.flags._pendingCustomGod)

function resolveCustomGod(name: string) {
  const ctx = machine.value.context
  const tier = String(ctx.flags._pendingCustomGod || '二级')
  const total = tier === '三级' ? 7 : tier === '二级' ? 8 : 9
  ctx.godTrial = { tier, deity: name + '神', completed: 0, total }
  delete ctx.flags._pendingCustomGod
  const next = structuredClone(machine.value)
  next.context.godTrial = ctx.godTrial
  delete next.context.flags._pendingCustomGod
  machine.value = next
  persist()
  refreshWheel()
}

const context = computed(() => machine.value.context)
const isStarted = computed(() => Boolean(context.value.seed))
const isStartOpen = computed(() => machine.value.value === 'routeSelection')
const canUndo = computed(() => history.value.length > 0 && !isBusy.value)
const routeLabel = computed(() => ({ human: '人类魂师', beast: '魂兽', transformed: '化形魂师' })[context.value.route ?? 'human'])
const phaseLabel = computed(() => ({
  idle: '尚未启封',
  routeSelection: '选择路线',
  humanSetup: '人类基础设定',
  beastSetup: '魂兽基础设定',
  humanAdventure: '人类命运推进',
  beastAdventure: '魂兽命运推进',
  transformedSetup: '化形重塑',
  transformedAdventure: '化形命运推进',
  godTrial: '神考进行中',
  rolling: '命运转动中',
  ending: '命运终章',
})[machine.value.value])
const activePool = computed(() => wheelPool.value)
const displayTask = computed(() => wheelTask.value)
const taskTitle = computed(() => displayTask.value?.pool ?? (machine.value.value === 'ending' ? '本轮旅程已经结束' : '展开下一段命运'))
const displayResult = computed(() => soften(context.value.lastResult || '等待第一次转动。', context.value.settings.softenText))
const displayLogs = computed(() => context.value.logs.map((entry) => ({
  ...entry,
  text: soften(entry.text, context.value.settings.softenText),
})))

restoreLocal()

export function useGameStore() {
  return {
    machine: readonly(machine),
    context,
    isBusy: readonly(isBusy),
    isAuto: readonly(isAuto),
    isTurbo: readonly(isTurbo),
    awaitingAdvance: readonly(awaitingAdvance),
    isStarted,
    isStartOpen,
    canUndo,
    routeLabel,
    phaseLabel,
    activePool,
    displayTask,
    taskTitle,
    displayResult,
    displayLogs,
    wheelPool: readonly(wheelPool),
    wheelOptions: readonly(wheelOptions),
    wheelSelectedIndex: readonly(wheelSelectedIndex),
    wheelSpinNonce: readonly(wheelSpinNonce),
    wheelResetNonce: readonly(wheelResetNonce),
    overrideCount: overrides.count,
    needsCustomGodName,
    resolveCustomGod,
    openStart,
    cancelStart,
    start,
    spin,
    advance,
    toggleAuto,
    stopAuto,
    undo,
    persist,
    restoreLocal,
    importSave,
    exportSave,
    exportChronicle,
    applyWheelOverride,
    resetWheelOverride,
    clearWheelOverrides,
    exportWheelOverrides,
    setSoftenText,
    setSpinDuration,
  }
}
