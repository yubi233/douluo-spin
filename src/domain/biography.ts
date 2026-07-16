import type { GameContext, Route, SoulRing } from './types'

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
        `主武魂：${valueOrNone(context.martialSouls)}`,
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
      ]
  const godTrial = context.godTrial
    ? `${context.godTrial.deity || '神祇未定'}｜${context.godTrial.tier}神考｜${context.godTrial.completed}/${context.godTrial.total}`
    : '无'
  const rings = context.rings.length ? context.rings.map(ringLine) : ['- 暂无魂环记录']

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
    `命运状态：${status}`,
    `阵营履历：${factionHistory(context)}`,
    '',
    '【人物身份】',
    ...identity,
    '',
    '【能力与机缘】',
    ...abilityLines,
    `魂骨：${valueOrNone(context.soulBones)}`,
    `神考：${godTrial}`,
    '',
    '【魂环明细】',
    ...rings,
    '',
    '【命运纪事】',
    ...(context.logs.length
      ? context.logs.map((entry) => `${entry.time}｜${entry.title}｜${entry.text}`)
      : ['尚未产生命运纪事。']),
  ].join('\n')
}
