import { entityId, optionId, poolId, signalId } from '@/core/ids'
import type { EntitySource, PoolSource } from '@/core/model/contracts'

const tag = entityId('tag.setup')

export const setupEntities: readonly EntitySource[] = [
  { id: tag, entityType: 'trait', presentation: { title: '基础设定' } },
  ...['male', 'female', 'none'].map((id, index) => ({
    id: entityId(`entity.gender.${id}`), entityType: 'gender' as const,
    presentation: { title: ['男', '女', '无性别'][index]! },
  })),
  ...[
    ['f', 'F级（丑到发瘟）'], ['e', 'E级（有点丑）'], ['d', 'D级（平平无奇）'],
    ['c', 'C级（比较耐看）'], ['b', 'B级（7分帅哥美女）'], ['a', 'A级（顶帅顶美）'],
    ['s', 'S级（与千仞雪或唐三同级）'], ['ex', 'EX级容貌（魅魔转世）'],
  ].map(([id, title]) => ({ id: entityId(`entity.appearance.${id}`), entityType: 'appearance' as const, presentation: { title: title! } })),
  ...[
    ['mutated', '变异武魂'], ['beast', '兽武魂'], ['concept', '概念型武魂'],
    ['tool', '器武魂'], ['body', '本体武魂'], ['ultimate', '极致武魂'],
  ].map(([id, title]) => ({ id: entityId(`entity.martial-type.${id}`), entityType: 'martial-soul-type' as const, presentation: { title: title! } })),
]

function selectionPool(
  id: string,
  title: string,
  signal: string,
  entityType: 'gender' | 'appearance' | 'martial-soul-type' | 'martial-soul',
  options: readonly { id: string; entity: string; title: string; weight: number }[],
): PoolSource {
  return {
    id: poolId(id),
    presentation: { title },
    tags: [tag],
    options: options.map((option) => ({
      id: optionId(option.id),
      presentation: { title: option.title },
      mechanics: {
        enabled: true,
        baseWeight: option.weight,
        effects: [
          { type: 'entity.grant', entityType, entityId: entityId(option.entity) },
          { type: 'signal.emit', signalId: signalId(signal) },
        ],
      },
    })),
  }
}

const genderOptions = [
  { id: 'option.gender.male', entity: 'entity.gender.male', title: '男', weight: 10 },
  { id: 'option.gender.female', entity: 'entity.gender.female', title: '女', weight: 10 },
  { id: 'option.gender.none', entity: 'entity.gender.none', title: '无性别', weight: 1 },
]

const appearanceWeights: Record<string, number> = { f: 5, e: 10, d: 15, c: 20, b: 15, a: 10, s: 5, ex: 1 }
const appearanceOptions = setupEntities.filter((entity) => entity.entityType === 'appearance').map((entity) => {
  const rank = entity.id.split('.').at(-1)!
  return { id: `option.appearance.${rank}`, entity: entity.id, title: entity.presentation.title, weight: appearanceWeights[rank]! }
})

const martialTypeWeights: Record<string, number> = { mutated: 15, beast: 65, concept: 10, tool: 65, body: 15, ultimate: 10 }
const martialTypeOptions = setupEntities.filter((entity) => entity.entityType === 'martial-soul-type').map((entity) => {
  const type = entity.id.split('.').at(-1)!
  return { id: `option.martial-type.${type}`, entity: entity.id, title: entity.presentation.title, weight: martialTypeWeights[type]! }
})

export const setupPools: readonly PoolSource[] = [
  selectionPool('pool.setup.gender', '基础设定3:你的性别是？', 'signal.setup.gender-selected', 'gender', genderOptions),
  selectionPool('pool.setup.appearance', '基础设定4:容貌', 'signal.setup.appearance-selected', 'appearance', appearanceOptions),
  selectionPool('pool.setup.martial-type', '基础设定5:武魂天赋', 'signal.setup.martial-type-selected', 'martial-soul-type', martialTypeOptions),
]
