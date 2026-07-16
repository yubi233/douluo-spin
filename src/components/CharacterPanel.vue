<script setup lang="ts">
import { computed } from 'vue'
import { Shield, Sparkles, Swords } from 'lucide-vue-next'
import type { GameContext } from '@/domain/types'
import { calculateCombatPower } from '@/domain/engine'
import { highestMartialSoulTier } from '@/domain/martialSoulTiers'

const props = defineProps<{
  context: GameContext
  routeLabel: string
  phaseLabel: string
}>()

const TIER_LABELS: Record<number, string> = { 1: '废', 2: '一般', 3: '优秀', 4: '顶级', 5: '极品', 6: '神级' }

const powerValue = computed(() => props.context.beast?.cultivation ?? props.context.level)
const powerLabel = computed(() => props.context.beast ? '年限修为' : '魂力等级')
const combatPower = computed(() => props.context.beast ? 0 : calculateCombatPower(props.context))
const topTier = computed(() => props.context.beast ? 0 : highestMartialSoulTier(props.context))
const topTierLabel = computed(() => TIER_LABELS[topTier.value] ?? '')
const appearanceValue = computed(() => props.context.beast
  ? props.context.beast.type || '未确定'
  : props.context.appearance || '未确定')
const progressValue = computed(() => props.context.beast
  ? props.context.beast.laws.join('、') || '暂无法则'
  : `${props.context.rings.length}枚魂环 · ${props.context.soulBones.length}块魂骨`)
const factionValue = computed(() => {
  const history = props.context.flags.factionHistory
  if (typeof history === 'string' && history) return history.split('｜').join(' · ')
  return props.context.faction || props.context.beast?.area || '自由'
})
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
  ...props.context.soulBones,
  ...(props.context.godTrial
    ? [`${props.context.godTrial.deity || '未知神祇'}${props.context.godTrial.tier}神考 ${props.context.godTrial.completed}/${props.context.godTrial.total}`]
    : []),
])
const ringDetails = computed(() => props.context.rings.map((ring) => ({
  id: `${ring.index}-${ring.description}`,
  title: `第${ring.index}魂环 · ${ring.years ? `${ring.years}年` : '年限未知'}`,
  description: ring.description || '暂无魂环结果描述',
})))
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
      <div><dt>{{ context.beast ? '魂兽类型' : '颜值' }}</dt><dd>{{ appearanceValue }}</dd></div>
      <div><dt>阵营与区域</dt><dd>{{ factionValue }}</dd></div>
      <div><dt>核心状态</dt><dd>{{ context.alive ? context.godTrial ? '神考中' : '存活' : '已陨落' }}</dd></div>
      <div><dt>{{ context.beast ? '法则掌握' : '魂环进度' }}</dt><dd>{{ progressValue }}</dd></div>
      <div v-if="!context.beast"><dt>战力值</dt><dd>{{ combatPower }}</dd></div>
    </dl>

    <div class="chip-section">
      <h3><Swords :size="15" /> 武魂与血脉 <span v-if="topTier > 0" class="tier-badge">阶位：{{ topTierLabel }}{{ topTier }}</span></h3>
      <div class="chips"><span v-for="value in soulValues" :key="value" class="chip">{{ value }}</span><span v-if="!soulValues.length" class="empty">暂无</span></div>
    </div>
    <div class="chip-section">
      <h3><Sparkles :size="15" /> 天赋、称号与领域</h3>
      <div class="chips"><span v-for="value in traitValues" :key="value" class="chip accent">{{ value }}</span><span v-if="!traitValues.length" class="empty">暂无</span></div>
    </div>
    <div class="chip-section">
      <h3><Shield :size="15" /> 魂环与魂技</h3>
      <div class="ring-details">
        <article v-for="ring in ringDetails" :key="ring.id" class="ring-detail">
          <strong>{{ ring.title }}</strong>
          <span>{{ ring.description }}</span>
          <small>魂技：当前数据暂未生成</small>
        </article>
        <p v-if="!ringDetails.length" class="empty-detail">暂无魂环；吸收魂环后将在此显示年限与完整结果。</p>
      </div>
    </div>
    <div class="chip-section">
      <h3><Shield :size="15" /> 魂骨与神考</h3>
      <div class="chips"><span v-for="value in gearValues" :key="value" class="chip gold">{{ value }}</span><span v-if="!gearValues.length" class="empty">暂无</span></div>
    </div>
  </section>
</template>
