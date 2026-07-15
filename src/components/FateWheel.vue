<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { optionWeight } from '@/domain/catalog'
import type { WheelOption } from '@/domain/types'
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
const rotation = ref(0)
const reducedMotion = ref(false)
const resetInProgress = ref(false)
const inspected = ref<{ index: number; x: number; y: number } | null>(null)
let observer: ResizeObserver | null = null
let resetFrame: number | null = null
const minLabelAngle = 8 * (Math.PI / 180)

const visibleOptions = computed(() => props.options.length > 0
  ? props.options
  : ['斗罗大陆', '命运', '武魂', '魂兽', '神考', '雷劫'].map((name, index) => ({ id: String(index), name })))
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
  observer = new ResizeObserver(draw)
  if (canvas.value) observer.observe(canvas.value)
  draw()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (resetFrame != null) window.cancelAnimationFrame(resetFrame)
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
