import type { GameContext, Route, SoulRing } from './types'
import { getMartialSoulTier } from './martialSoulTiers'
import { calculateCombatPower } from './engine'

const TIER_LABELS: Record<number, string> = { 1: '废武魂', 2: '一般武魂', 3: '优秀武魂', 4: '顶级武魂', 5: '极品武魂', 6: '神级武魂' }

const ROUTE_LABELS: Record<NonNullable<Route>, string> = {
  human: '人类魂师',
  beast: '魂兽',
  transformed: '化形魂师',
}

function valueOrNone(values: readonly string[]): string {
  return values.filter(Boolean).join('、') || '无'
}

function factionHistory(context: GameContext): string {
  const history = context.flags.factionHistory
  if (typeof history === 'string' && history) return history.split('｜').join(' · ')
  return context.faction || context.beast?.area || '自由'
}

function tangAgeLabel(tangAge: number | null): string {
  if (tangAge == null) return '未确定'
  return tangAge < 0 ? `唐三出生前 ${Math.abs(tangAge)} 年` : `唐三 ${tangAge} 岁`
}

function ringLine(ring: SoulRing): string {
  const years = ring.years > 0 ? `${ring.years}年` : '年限未知'
  return `- 第${ring.index}魂环｜${years}｜${ring.description || '结果未记录'}`
}

export function routeLabel(route: Route | null): string {
  return route ? ROUTE_LABELS[route] : '未确定'
}

export function formatBiography(context: GameContext): string {
  const isBeast = Boolean(context.beast)
  const power = isBeast ? `${context.beast!.cultivation}年修为` : `${context.level}级`
  const status = context.ending || (context.alive ? context.godTrial ? '神考进行中' : '命运尚未完结' : '已陨落')
  const identity = isBeast
    ? [
        `魂兽类型：${context.beast!.type || '未确定'}`,
        `本体种族：${context.beast!.species || '未确定'}`,
        `生存区域：${context.beast!.area || '未确定'}`,
      ]
    : [
        `性别：${context.gender || '未确定'}`,
        `容貌：${context.appearance || '未确定'}`,
        `武魂类型：${valueOrNone(context.martialSoulTypes)}`,
        `主武魂：${context.martialSouls.map((s) => {
          const t = getMartialSoulTier(s)
          return `${s}【${TIER_LABELS[t] ?? ''}】`
        }).join('、') || '无'}`,
        `最高阶位：${context.martialSouls.length > 0 ? TIER_LABELS[Math.max(...context.martialSouls.map((s) => getMartialSoulTier(s)))] ?? '' : '无'}`,
      ]
  const abilityLines = isBeast
    ? [
        `血脉：${valueOrNone(context.beast!.bloodlines)}`,
        `法则：${valueOrNone(context.beast!.laws)}`,
      ]
    : [
        `特殊天赋：${valueOrNone(context.talents)}`,
        `称号与特质：${valueOrNone(context.traits)}`,
        `领域：${valueOrNone(context.domains)}`,
        `魂骨：${valueOrNone(context.soulBones)}（${context.soulBones.length}块）`,
      ]
  const godTrial = context.godTrial
    ? `${context.godTrial.deity || '神祇未定'}｜${context.godTrial.tier}神考｜${context.godTrial.completed}/${context.godTrial.total}`
    : '无'
  const rings = context.rings.length ? context.rings.map(ringLine) : ['- 暂无魂环记录']

  const combatPower = isBeast ? 0 : calculateCombatPower(context)
  const ringCount = context.rings.length
  const domainCount = context.domains.length
  const boneCount = context.soulBones.length
  const soulBoneSummary = isBeast ? '' : `魂环${ringCount}枚 · 领域${domainCount}个 · 魂骨${boneCount}块`
  const combatLines = isBeast
    ? ['战力评估不适用于魂兽路线（魂兽使用修为年限作为实力标准）']
    : [
        `战力值：${combatPower}`,
        `战力构成：等级基础(${Math.round(context.level * context.level / 20)}) + 魂环(${context.rings.reduce((s, r) => {
          const y = r.years
          const v = y < 100 ? Math.round(5 + (y - 10) / 90 * 3) : y < 1000 ? Math.round(9 + (y - 100) / 900 * 2) : y < 10000 ? Math.round(12 + (y - 1000) / 9000 * 3) : y < 100000 ? Math.round(16 + (y - 10000) / 90000 * 4) : y < 1000000 ? Math.round(21 + (y - 100000) / 900000 * 9) : Math.round(31 + Math.min(9, (y - 1000000) / 1000000 * 9))
          return s + v
        }, 0)}) + 武魂阶位(${context.martialSouls.reduce((s, ms) => {
          const t = getMartialSoulTier(ms)
          const tp: Record<number, number> = { 1: 0, 2: 3, 3: 8, 4: 15, 5: 25, 6: 45 }
          return s + (tp[t] ?? 0)
        }, 0)}) + 领域(${domainCount * 15}) + 魂骨(${boneCount * 12})`,
        ...(context.talents.length > 0 ? [`天赋加成：${Math.min(context.talents.length, 10) * 0.5}%（${context.talents.length}个天赋）`] : []),
        ...(context.traits.filter((trait) => /[杀战斗力破斩暴狂怒王]/.test(trait)).length > 0
          ? [`称号加成：${Math.min(context.traits.filter((trait) => /[杀战斗力破斩暴狂怒王]/.test(trait)).length, 10) * 0.5}%（战斗称号加成）`] : []),
      ]

  return [
    '《斗罗大陆 · 命运轮盘人物传记》',
    '',
    '【命运档案】',
    `命运种子：${context.seed || '未启封'}`,
    `姓名：${context.name || '无名旅者'}`,
    `路线：${routeLabel(context.route)}`,
    `时间坐标：${tangAgeLabel(context.tangAge)}`,
    `实际年龄：${context.age == null ? '未确定' : `${context.age}岁`}`,
    `当前境界：${power}${isBeast ? '' : `（上限${context.maxLevel}级）`}`,
    `命运步数：${context.step}`,
    `命运状态：${status}`,
    `阵营履历：${factionHistory(context)}`,
    isBeast ? '' : `战力摘要：${soulBoneSummary}`,
    '',
    '【人物身份】',
    ...identity,
    '',
    '【能力与机缘】',
    ...abilityLines,
    `神考：${godTrial}`,
    '',
    ...(isBeast ? [] : ['【战力评估】', ...combatLines, '']),
    '【魂环明细】',
    ...rings,
    '',
    '【命运纪事】',
    ...(context.logs.length
      ? context.logs.map((entry) => `${entry.time}｜${entry.title}｜${entry.text}`)
      : ['尚未产生命运纪事。']),
  ].join('\n')
}
