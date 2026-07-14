<script setup lang="ts">
import { computed } from 'vue'
import { Shield, Sparkles, Swords } from 'lucide-vue-next'
import type { GameContext } from '@/domain/types'

const props = defineProps<{
  context: GameContext
  routeLabel: string
  phaseLabel: string
}>()

const powerValue = computed(() => props.context.beast?.cultivation ?? props.context.level)
const powerLabel = computed(() => props.context.beast ? '年限修为' : '魂力等级')
const timeLabel = computed(() => {
  const age = props.context.tangAge
  if (age == null) return '未确定'
  return age < 0 ? `唐三出生前 ${Math.abs(age)} 年` : `唐三 ${age} 岁`
})
const soulValues = computed(() => props.context.beast
  ? [props.context.beast.species, ...props.context.beast.bloodlines].filter(Boolean)
  : [...props.context.martialSoulTypes, ...props.context.martialSouls])
const traitValues = computed(() => [...props.context.talents, ...props.context.traits, ...props.context.domains])
const gearValues = computed(() => [
  ...props.context.rings.map((ring) => `第${ring.index}魂环 · ${ring.years || '未知'}年`),
  ...props.context.soulBones,
  ...(props.context.godTrial
    ? [`${props.context.godTrial.deity || '未知神祇'}${props.context.godTrial.tier}神考 ${props.context.godTrial.completed}/${props.context.godTrial.total}`]
    : []),
])
</script>

<template>
  <section class="panel character-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">角色命盘</p>
        <h2>{{ context.name }}</h2>
      </div>
      <span class="phase-badge">{{ phaseLabel }}</span>
    </header>

    <div class="identity-row">
      <div class="avatar" aria-hidden="true">{{ context.beast ? '兽' : context.route === 'transformed' ? '化' : '魂' }}</div>
      <div class="identity-copy">
        <strong>{{ routeLabel }}</strong>
        <span>{{ context.seed ? `种子 ${context.seed}` : '等待命运启封' }}</span>
      </div>
      <div class="power-value">
        <strong>{{ powerValue }}</strong>
        <span>{{ powerLabel }}</span>
      </div>
    </div>

    <dl class="stat-grid">
      <div><dt>时间坐标</dt><dd>{{ timeLabel }}</dd></div>
      <div><dt>年龄与性别</dt><dd>{{ context.age == null ? '未确定' : `${context.age}岁` }} · {{ context.gender || '未确定' }}</dd></div>
      <div><dt>阵营与区域</dt><dd>{{ context.faction || context.beast?.area || '自由' }}</dd></div>
      <div><dt>核心状态</dt><dd>{{ context.alive ? context.godTrial ? '神考中' : '存活' : '已陨落' }}</dd></div>
    </dl>

    <div class="chip-section">
      <h3><Swords :size="15" /> 武魂与血脉</h3>
      <div class="chips"><span v-for="value in soulValues" :key="value" class="chip">{{ value }}</span><span v-if="!soulValues.length" class="empty">暂无</span></div>
    </div>
    <div class="chip-section">
      <h3><Sparkles :size="15" /> 天赋、称号与领域</h3>
      <div class="chips"><span v-for="value in traitValues" :key="value" class="chip accent">{{ value }}</span><span v-if="!traitValues.length" class="empty">暂无</span></div>
    </div>
    <div class="chip-section">
      <h3><Shield :size="15" /> 魂环、魂骨与神考</h3>
      <div class="chips"><span v-for="value in gearValues" :key="value" class="chip gold">{{ value }}</span><span v-if="!gearValues.length" class="empty">暂无</span></div>
    </div>
  </section>
</template>
