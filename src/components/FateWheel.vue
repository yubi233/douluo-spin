<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WheelOption } from '@/domain/types'

const props = defineProps<{
  options: readonly WheelOption[]
  selectedIndex: number
  spinNonce: number
  duration: number
  disabled: boolean
}>()

defineEmits<{ spin: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const rotation = ref(0)
let observer: ResizeObserver | null = null

const visibleOptions = computed(() => props.options.length > 0
  ? props.options
  : ['斗罗大陆', '命运', '武魂', '魂兽', '神考', '雷劫'].map((name, index) => ({ id: String(index), name })))

function shorten(value: string, max = 11) {
  const clean = value.replace(/（.*?）/g, '')
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
  const angle = Math.PI * 2 / options.length
  const palette = ['#294e50', '#755f2d', '#3e475e', '#6f3e42', '#315a46', '#544367']
  context.clearRect(0, 0, size, size)

  options.forEach((option, index) => {
    const start = -Math.PI / 2 + index * angle
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
      context.save()
      context.translate(center, center)
      context.rotate(start + angle / 2)
      context.textAlign = 'right'
      context.textBaseline = 'middle'
      context.fillStyle = '#f8f5e9'
      context.font = `${Math.max(10, Math.min(15, 260 / options.length)) * window.devicePixelRatio}px system-ui`
      context.fillText(shorten(option.name), radius - 24 * window.devicePixelRatio, 0)
      context.restore()
    }
  })

  context.beginPath()
  context.arc(center, center, radius, 0, Math.PI * 2)
  context.strokeStyle = '#e5ca70'
  context.lineWidth = 3 * window.devicePixelRatio
  context.stroke()
}

watch(visibleOptions, () => nextTick(draw), { deep: false })
watch(() => props.spinNonce, () => {
  const count = visibleOptions.value.length
  if (props.selectedIndex < 0 || count === 0) return
  const segment = 360 / count
  const normalized = ((rotation.value % 360) + 360) % 360
  const target = 360 - (props.selectedIndex + 0.5) * segment
  rotation.value += 2160 + ((target - normalized + 360) % 360)
})

onMounted(() => {
  observer = new ResizeObserver(draw)
  if (canvas.value) observer.observe(canvas.value)
  draw()
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="wheel-shell">
    <div class="wheel-pointer" aria-hidden="true" />
    <canvas
      ref="canvas"
      class="wheel-canvas"
      :style="{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }"
    />
    <button class="wheel-trigger" :disabled="disabled" aria-label="转动命运轮盘" @click="$emit('spin')">
      <span>转动</span>
      <small>SPIN</small>
    </button>
  </div>
</template>
