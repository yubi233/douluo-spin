import { endingId, entityId, optionId, poolId, signalId } from '@/core/ids'
import type { EndingSource, EntitySource, PoolSource } from '@/core/model/contracts'

const factions = [
  ['shrek', '史莱克学院'], ['tang', '唐门'], ['spirit-hall-remnants', '武魂殿残部'], ['heaven-dou', '天斗帝国'],
  ['star-luo', '星罗帝国'], ['great-sects', '七宝与昊天宗门'], ['sea-god-island', '海神岛'], ['wanderers', '佣兵与流浪组织'],
] as const
const stages = [
  ['embers', '余烬期', '救助战争遗民并约束复仇'],
  ['reconstruction', '重建期', '重建秩序并公开资源分配'],
  ['ten-year', '十年边界期', '以契约阻止旧战争再次爆发'],
  ['authority', '权柄凝聚期', '放弃既得特权并承担不可逆代价'],
] as const

export const postwarEntities: readonly EntitySource[] = [
  ...factions.slice(3).map(([id, title]) => ({ id: entityId(`entity.faction.${id}`), entityType: 'faction' as const, presentation: { title } })),
  ...stages.map(([id, title]) => ({ id: entityId(`entity.story-node.postwar.${stages.findIndex((stage) => stage[0] === id) + 1}`), entityType: 'story-node' as const, presentation: { title } })),
  { id: entityId('entity.god-tier.self-created'), entityType: 'trait', presentation: { title: '自创神位试炼' } },
  { id: entityId('entity.godhood.self-created'), entityType: 'godhood', presentation: { title: '自创权柄之神' } },
]

export const postwarEndings: readonly EndingSource[] = [
  { id: endingId('ending.self-created-ascension'), alive: true, presentation: { title: '自创权柄成神' } },
]

export const postwarPools: readonly PoolSource[] = stages.map(([stageId, stageTitle, action], stageIndex) => ({
  id: poolId(`pool.postwar.${stageIndex + 1}`),
  presentation: { title: `嘉陵关终战后：${stageTitle}` },
  tags: [],
  options: factions.map(([factionId, factionTitle]) => ({
    id: optionId(`option.postwar.${stageId}.${factionId}`),
    presentation: { title: `【${stageTitle}】你代表${factionTitle}${action}` },
    mechanics: {
      enabled: true,
      baseWeight: 1,
      availableWhen: { type: 'compare' as const, fact: 'actor.faction' as const, op: 'eq' as const, value: `entity.faction.${factionId}` },
      effects: [{ type: 'signal.emit' as const, signalId: signalId('signal.postwar.completed') }],
    },
  })),
}))
