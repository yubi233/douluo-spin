<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WheelOptionView as WheelOption } from '@/application/gameViewModel'
import { advanceWheelRotation, targetRotationForSegment } from '@/utils/wheelGeometry'

const props = defineProps<{
  options: readonly WheelOption[]
  selectedIndex: number
  spinNonce: number
  resetNonce: number
  duration: number
  disabled: boolean
  awaitingAdvance: boolean
}>()

defineEmits<{ spin: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const particleCanvas = ref<HTMLCanvasElement | null>(null)
const rotation = ref(0)
const reducedMotion = ref(false)
const resetInProgress = ref(false)
const inspected = ref<{ index: number; x: number; y: number } | null>(null)
let observer: ResizeObserver | null = null
let resetFrame: number | null = null
const minLabelAngle = 8 * (Math.PI / 180)
const optionWeight = (option: WheelOption) => option.weight

// 粒子系统
interface Particle {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; color: string; alpha: number
}
const particles = ref<Particle[]>([])
let particleFrame: number | null = null
let particleActive = false

const visibleOptions = computed(() => props.options.length > 0
  ? props.options
  : ['斗罗大陆', '命运', '武魂', '魂兽', '神考', '雷劫'].map((name, index) => ({ id: String(index), name, enabled: true, weight: 1, probability: 1 / 6, effects: [] })))
const inspectedOption = computed(() => inspected.value ? visibleOptions.value[inspected.value.index] : null)
const inspectedProbability = computed(() => {
  const option = inspectedOption.value
  if (!option) return 0
  const totalWeight = visibleOptions.value.reduce((sum, candidate) => sum + optionWeight(candidate), 0)
  return totalWeight > 0 ? optionWeight(option) / totalWeight : 0
})

function cleanLabel(value: string) {
  return value.replace(/（.*?）/g, '')
}

function fitLabel(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const clean = cleanLabel(value)
  if (context.measureText(clean).width <= maxWidth) return clean

  const suffix = '…'
  let fitted = ''
  for (const char of clean) {
    const next = `${fitted}${char}`
    if (context.measureText(`${next}${suffix}`).width > maxWidth) break
    fitted = next
  }
  return fitted ? `${fitted}${suffix}` : ''
}

function visualRandom() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1)
    cryptoApi.getRandomValues(values)
    return (values[0] ?? 0) / 0x100000000
  }
  return Math.random()
}

function draw() {
  const element = canvas.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const size = Math.max(320, Math.round(rect.width * window.devicePixelRatio))
  if (element.width !== size || element.height !== size) {
    element.width = size
    element.height = size
  }
  const context = element.getContext('2d')
  if (!context) return
  const options = visibleOptions.value
  const center = size / 2
  const radius = center - 8 * window.devicePixelRatio
  const totalWeight = options.reduce((sum, option) => sum + optionWeight(option), 0)
  const palette = ['#294e50', '#755f2d', '#3e475e', '#6f3e42', '#315a46', '#544367']
  context.clearRect(0, 0, size, size)

  let startAngle = -Math.PI / 2
  options.forEach((option, index) => {
    const angle = (optionWeight(option) / totalWeight) * Math.PI * 2
    const start = startAngle
    context.beginPath()
    context.moveTo(center, center)
    context.arc(center, center, radius, start, start + angle)
    context.closePath()
    context.fillStyle = palette[index % palette.length] ?? '#3e475e'
    context.fill()
    if (inspected.value?.index === index) {
      context.fillStyle = '#e5ca7044'
      context.fill()
      context.strokeStyle = '#fff1a8'
      context.lineWidth = 4 * window.devicePixelRatio
      context.stroke()
    }
    context.strokeStyle = '#d8c47a55'
    context.lineWidth = Math.max(1, window.devicePixelRatio)
    context.stroke()

    {
      const fontSize = 12 * window.devicePixelRatio
      const labelRadius = radius - 24 * window.devicePixelRatio
      const innerPadding = 68 * window.devicePixelRatio
      const maxLabelWidth = Math.max(0, labelRadius - innerPadding)
      const arcLength = angle * labelRadius
      if (angle < minLabelAngle || arcLength < fontSize * 1.35 || maxLabelWidth < 24 * window.devicePixelRatio) {
        startAngle += angle
        return
      }

      context.save()
      context.translate(center, center)
      context.rotate(start + angle / 2)
      context.textAlign = 'right'
      context.textBaseline = 'middle'
      context.fillStyle = '#f8f5e9'
      context.font = `${fontSize}px system-ui`
      const label = fitLabel(context, option.name, maxLabelWidth)
      if (label) context.fillText(label, labelRadius, 0)
      context.restore()
    }
    startAngle += angle
  })

  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.strokeStyle = '#e5ca70'
  context.lineWidth = 3 * window.devicePixelRatio
  context.stroke()
}

// 粒子效果系统
function spawnParticles(count: number) {
  const el = particleCanvas.value
  if (!el) return
  const size = el.width
  const center = size / 2
  const dpr = window.devicePixelRatio
  const pointerRadius = center * 0.92
  const goldColors = ['#d8bc69', '#e8cc79', '#f0d88a', '#c4a54a', '#fff1a8']
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
    const dist = pointerRadius + (Math.random() - 0.5) * 20 * dpr
    particles.value.push({
      x: center + Math.cos(angle) * dist,
      y: center + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 2 * dpr,
      vy: (Math.random() - 0.5) * 2 * dpr - 1.5 * dpr,
      life: 0,
      maxLife: 30 + Math.random() * 40,
      size: (1.5 + Math.random() * 2.5) * dpr,
      color: goldColors[Math.floor(Math.random() * goldColors.length)]!,
      alpha: 0.8 + Math.random() * 0.2,
    })
  }
}

function drawParticles() {
  const el = particleCanvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, el.width, el.height)
  const alive: Particle[] = []
  for (const p of particles.value) {
    p.life++
    if (p.life >= p.maxLife) continue
    p.x += p.vx
    p.y += p.vy
    p.vy -= 0.02 * window.devicePixelRatio
    const progress = p.life / p.maxLife
    const fade = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8
    ctx.globalAlpha = p.alpha * fade
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2)
    ctx.fill()
    alive.push(p)
  }
  ctx.globalAlpha = 1
  particles.value = alive
  if (alive.length > 0 || particleActive) {
    particleFrame = window.requestAnimationFrame(drawParticles)
  }
}

function startParticles() {
  particleActive = true
  spawnParticles(6)
  const burstInterval = setInterval(() => {
    if (!particleActive) { clearInterval(burstInterval); return }
    spawnParticles(3)
  }, 80)
  setTimeout(() => {
    clearInterval(burstInterval)
    particleActive = false
  }, props.duration + 200)
  drawParticles()
}

function optionIndexAt(event: MouseEvent) {
  const element = canvas.value
  if (!element) return -1
  const width = element.clientWidth || element.width
  const height = element.clientHeight || element.height
  const x = event.offsetX - width / 2
  const y = event.offsetY - height / 2
  const distance = Math.hypot(x, y)
  if (distance > Math.min(width, height) / 2 || distance < 40) return -1

  const totalWeight = visibleOptions.value.reduce((sum, option) => sum + optionWeight(option), 0)
  if (totalWeight <= 0) return -1
  const contentAngle = Math.atan2(y, x)
  const offset = ((contentAngle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
  let cursor = 0
  for (let index = 0; index < visibleOptions.value.length; index += 1) {
    cursor += (optionWeight(visibleOptions.value[index]!) / totalWeight) * Math.PI * 2
    if (offset <= cursor) return index
  }
  return visibleOptions.value.length - 1
}

function inspect(event: MouseEvent) {
  const index = optionIndexAt(event)
  if (index < 0) {
    inspected.value = null
  } else {
    const element = canvas.value
    const shellRect = element?.parentElement?.getBoundingClientRect()
    const width = shellRect?.width || 1
    const height = shellRect?.height || 1
    inspected.value = {
      index,
      x: Math.min(76, Math.max(24, ((event.clientX - (shellRect?.left ?? 0)) / width) * 100)),
      y: Math.min(78, Math.max(22, ((event.clientY - (shellRect?.top ?? 0)) / height) * 100)),
    }
  }
  void nextTick(draw)
}

watch(visibleOptions, () => {
  inspected.value = null
  void nextTick(draw)
}, { deep: false })
watch(() => props.spinNonce, () => {
  inspected.value = null
  const options = visibleOptions.value
  if (props.selectedIndex < 0 || options.length === 0) return
  const weights = options.map(optionWeight)
  const target = targetRotationForSegment(weights, props.selectedIndex, visualRandom())
  const fullTurns = 5 + Math.floor(visualRandom() * 4)
  rotation.value = advanceWheelRotation(rotation.value, target, fullTurns)
  // 触发粒子效果
  if (!reducedMotion.value) startParticles()
})

function resetRotation() {
  if (resetFrame != null) window.cancelAnimationFrame(resetFrame)
  resetInProgress.value = true
  rotation.value = 0
  void nextTick(() => {
    // Force the no-transition transform to take effect before re-enabling spins.
    void canvas.value?.offsetWidth
    resetFrame = window.requestAnimationFrame(() => {
      resetInProgress.value = false
      resetFrame = null
    })
  })
}

watch(() => props.resetNonce, resetRotation)

onMounted(() => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = query.matches
  query.addEventListener('change', (event) => { reducedMotion.value = event.matches })
  observer = new ResizeObserver(() => {
    draw()
    // 同步粒子 canvas 尺寸
    const pc = particleCanvas.value
    const mc = canvas.value
    if (pc && mc) { pc.width = mc.width; pc.height = mc.height }
  })
  if (canvas.value) observer.observe(canvas.value)
  draw()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (resetFrame != null) window.cancelAnimationFrame(resetFrame)
  if (particleFrame != null) window.cancelAnimationFrame(particleFrame)
  particleActive = false
})
</script>

<template>
  <div class="wheel-shell">
    <div class="wheel-pointer" aria-hidden="true" />
    <canvas
      ref="canvas"
      class="wheel-canvas"
      :style="{ transform: `rotate(${rotation}deg)`, transitionDuration: `${resetInProgress ? 0 : reducedMotion ? Math.min(duration, 100) : duration}ms` }"
      @click="inspect"
    />
    <canvas
      ref="particleCanvas"
      class="wheel-particles"
      aria-hidden="true"
    />
    <div
      v-if="inspected && inspectedOption"
      class="wheel-tooltip"
      :style="{ left: `${inspected.x}%`, top: `${inspected.y}%` }"
    >
      <strong>{{ inspectedOption.name }}</strong>
      <span>概率 {{ (inspectedProbability * 100).toFixed(2) }}% · 权重 {{ optionWeight(inspectedOption) }}</span>
    </div>
    <button class="wheel-trigger" :disabled="disabled" :aria-busy="disabled" :aria-label="awaitingAdvance ? '进入下一项' : '转动命运轮盘'" @click="$emit('spin')">
      <span>{{ awaitingAdvance ? '继续' : '转动' }}</span>
      <small>{{ awaitingAdvance ? 'NEXT' : 'SPIN' }}</small>
    </button>
  </div>
</template>
