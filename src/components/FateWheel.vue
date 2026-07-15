<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { optionWeight } from '@/domain/catalog'
import type { WheelOption } from '@/domain/types'

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
let observer: ResizeObserver | null = null
let resetFrame: number | null = null
const minLabelAngle = 8 * (Math.PI / 180)

const visibleOptions = computed(() => props.options.length > 0
  ? props.options
  : ['斗罗大陆', '命运', '武魂', '魂兽', '神考', '雷劫'].map((name, index) => ({ id: String(index), name })))

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

function shorten(value: string, max = 11) {
  const clean = cleanLabel(value)
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
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
    context.strokeStyle = '#d8c47a55'
    context.lineWidth = Math.max(1, window.devicePixelRatio)
    context.stroke()

    if (options.length <= 28) {
      const fontSize = Math.max(10, Math.min(15, 260 / options.length)) * window.devicePixelRatio
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
      const label = fitLabel(context, shorten(option.name), maxLabelWidth)
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

watch(visibleOptions, () => nextTick(draw), { deep: false })
watch(() => props.spinNonce, () => {
  const options = visibleOptions.value
  if (props.selectedIndex < 0 || options.length === 0) return
  const totalWeight = options.reduce((sum, option) => sum + optionWeight(option), 0)
  const previousWeight = options.slice(0, props.selectedIndex).reduce((sum, option) => sum + optionWeight(option), 0)
  const selectedWeight = optionWeight(options[props.selectedIndex]!)
  const normalized = ((rotation.value % 360) + 360) % 360
  const target = 360 - ((previousWeight + selectedWeight / 2) / totalWeight) * 360
  rotation.value += 2160 + ((target - normalized + 360) % 360)
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
    />
    <button class="wheel-trigger" :disabled="disabled" :aria-busy="disabled" :aria-label="awaitingAdvance ? '进入下一项' : '转动命运轮盘'" @click="$emit('spin')">
      <span>{{ awaitingAdvance ? '继续' : '转动' }}</span>
      <small>{{ awaitingAdvance ? 'NEXT' : 'SPIN' }}</small>
    </button>
  </div>
</template>
