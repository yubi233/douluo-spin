import { endingId, entityId, optionId, policyId, poolId, signalId } from '@/core/ids'
import type { EffectSpec, EndingSource, EntitySource, EntityType, PoolSource, Predicate } from '@/core/model/contracts'

const progressionTag = entityId('tag.progression')
const beastTag = entityId('tag.beast')
const storyTag = entityId('tag.story')
const godTag = entityId('tag.god-trial')

export const progressionEntities: readonly EntitySource[] = [
  { id: progressionTag, entityType: 'trait', presentation: { title: '成长' } },
  { id: beastTag, entityType: 'trait', presentation: { title: '魂兽' } },
  { id: storyTag, entityType: 'trait', presentation: { title: '剧情' } },
  { id: godTag, entityType: 'trait', presentation: { title: '神考' } },
  { id: entityId('entity.faction.shrek'), entityType: 'faction', presentation: { title: '史莱克学院' } },
  { id: entityId('entity.faction.spirit-hall'), entityType: 'faction', presentation: { title: '武魂殿' } },
  { id: entityId('entity.faction.free'), entityType: 'faction', presentation: { title: '自由魂师' } },
  { id: entityId('entity.faction.tang'), entityType: 'faction', presentation: { title: '唐门' } },
  { id: entityId('entity.faction.spirit-hall-remnants'), entityType: 'faction', presentation: { title: '武魂殿残部' } },
  { id: entityId('entity.soul-ring.hundred'), entityType: 'soul-ring', presentation: { title: '百年魂环' } },
  { id: entityId('entity.soul-ring.thousand'), entityType: 'soul-ring', presentation: { title: '千年魂环' } },
  { id: entityId('entity.soul-ring.ten-thousand'), entityType: 'soul-ring', presentation: { title: '万年魂环' } },
  ...[1, 2, 3, 4].map((index) => ({
    id: entityId(`entity.story-node.${index}`), entityType: 'story-node' as const,
    presentation: { title: ['初入魂师界', '学院争锋', '大陆风云', '嘉陵关终章'][index - 1]! },
  })),
  { id: entityId('entity.beast-type.land'), entityType: 'beast-type', presentation: { title: '陆生魂兽' } },
  { id: entityId('entity.beast-type.sea'), entityType: 'beast-type', presentation: { title: '海魂兽' } },
  { id: entityId('entity.beast-species.wind-wolf'), entityType: 'beast-species', presentation: { title: '疾风魔狼' } },
  { id: entityId('entity.beast-species.spirit-whale'), entityType: 'beast-species', presentation: { title: '灵潮鲸' } },
  { id: entityId('entity.beast-bloodline.wind-wolf'), entityType: 'beast-bloodline', presentation: { title: '疾风魔狼血脉' } },
  { id: entityId('entity.beast-bloodline.spirit-whale'), entityType: 'beast-bloodline', presentation: { title: '灵潮鲸血脉' } },
  { id: entityId('entity.beast-area.forest'), entityType: 'beast-area', presentation: { title: '星斗大森林' } },
  { id: entityId('entity.beast-area.ocean'), entityType: 'beast-area', presentation: { title: '无尽海域' } },
  { id: entityId('entity.martial-soul.beast-form'), entityType: 'martial-soul', presentation: { title: '魂兽本体武魂' } },
  { id: entityId('entity.god-tier.sea'), entityType: 'trait', presentation: { title: '海神九考' } },
  { id: entityId('entity.godhood.sea'), entityType: 'godhood', presentation: { title: '海神' } },
  { id: entityId('entity.godhood.beast'), entityType: 'godhood', presentation: { title: '兽域神' } },
]

export const progressionEndings: readonly EndingSource[] = [
  { id: endingId('ending.death'), alive: false, presentation: { title: '命运断绝', description: '在成长旅途中陨落。' } },
  { id: endingId('ending.god-ascension'), alive: true, presentation: { title: '百级成神', description: '完成神考，踏入神界。' } },
  { id: endingId('ending.beast-ascension'), alive: true, presentation: { title: '兽域飞升', description: '渡过百万年神劫，凝聚兽域权柄。' } },
  { id: endingId('ending.beast-immortal'), alive: true, presentation: { title: '百万年长生', description: '渡过百万年神劫，但未能自创兽神神位。' } },
]

interface OptionDefinition {
  id: string
  title: string
  weight?: number
  enabled?: boolean
  availableWhen?: Predicate
  weightModifier?: ReturnType<typeof combatWeight>
  effects: readonly EffectSpec[]
}

function combatWeight() {
  return { type: 'policy' as const, policyId: policyId('policy.combat-power-growth') }
}

function pool(id: string, title: string, tag: ReturnType<typeof entityId>, options: readonly OptionDefinition[]): PoolSource {
  return {
    id: poolId(id),
    presentation: { title },
    tags: [tag],
    options: options.map((option) => ({
      id: optionId(option.id),
      presentation: { title: option.title },
      mechanics: {
        enabled: option.enabled ?? true,
        baseWeight: option.weight ?? 1,
        availableWhen: option.availableWhen,
        weightModifier: option.weightModifier,
        effects: option.effects,
      },
    })),
  }
}

const emit = (value: string): EffectSpec => ({ type: 'signal.emit', signalId: signalId(value) })
const emitGodOffer = (threshold: number, accepted: boolean): EffectSpec => ({
  type: 'signal.emit',
  signalId: signalId('signal.god-offer.resolved'),
  payload: { threshold, accepted },
})
const change = (stat: 'age' | 'level' | 'beast-cultivation', delta: number): EffectSpec => ({
  type: 'stat.change', stat, delta: { type: 'constant', value: delta },
})
const advance = (years: number): EffectSpec => ({ type: 'time.advance', years: { type: 'constant', value: years } })
const grant = (entityType: EntityType, value: string): EffectSpec => ({ type: 'entity.grant', entityType, entityId: entityId(value) })

export const progressionPools: readonly PoolSource[] = [
  pool('pool.god-trial.training', '神考修行', godTag, [
    { id: 'option.god-trial.training.steady', title: '以神考压力淬炼魂力', weight: 49, effects: [change('age', 2), advance(2), change('level', 10), emit('signal.god-trial.training-completed')] },
    { id: 'option.god-trial.training.breakthrough', title: '借神性突破魂力瓶颈', weight: 49, effects: [change('age', 2), advance(2), change('level', 12), emit('signal.god-trial.training-completed')] },
    { id: 'option.god-trial.training.failure', title: '神考反噬，试炼中陨落', weight: 2, effects: [{ type: 'run.finish', endingId: endingId('ending.death') }] },
  ]),
  ...[20, 30, 40, 50, 60, 70, 80, 99].map((threshold) => pool(`pool.god-offer.${threshold}`, `${threshold}级神位感召`, godTag, [
    { id: `option.god-offer.${threshold}.accepted`, title: '接受神位感召', weight: 1, effects: [emitGodOffer(threshold, true)] },
    { id: `option.god-offer.${threshold}.declined`, title: '神位感召未至', weight: 1, effects: [emitGodOffer(threshold, false)] },
  ])),
  pool('pool.setup.age', '基础设定7:你的年龄', progressionTag, [
    { id: 'option.age.six', title: '六岁觉醒武魂', weight: 8, effects: [change('age', 6), emit('signal.setup.age-selected')] },
    { id: 'option.age.twelve', title: '十二岁踏入魂师界', weight: 2, effects: [change('age', 12), emit('signal.setup.age-selected')] },
  ]),
  pool('pool.setup.period', '基础设定8:穿越时期', progressionTag, [
    { id: 'option.period.before-tang', title: '唐三出生前六年', effects: [advance(-6), emit('signal.setup.period-selected')] },
    { id: 'option.period.tang-six', title: '唐三六岁', effects: [advance(6), emit('signal.setup.period-selected')] },
    { id: 'option.period.postwar', title: '唐三成神后的战后时代', weight: 1, effects: [advance(30), emit('signal.setup.period-selected')] },
  ]),
  pool('pool.setup.initial-power', '先天魂力', progressionTag, [
    { id: 'option.power.ten', title: '先天满魂力', weight: 5, effects: [change('level', 9), emit('signal.setup.initial-power-selected')] },
    { id: 'option.power.twenty', title: '先天二十级', weight: 1, effects: [change('level', 19), emit('signal.setup.initial-power-selected')] },
  ]),
  pool('pool.setup.faction', '人物背景与势力', progressionTag, [
    { id: 'option.faction.shrek', title: '加入史莱克学院', weight: 5, effects: [grant('faction', 'entity.faction.shrek'), emit('signal.setup.faction-selected')] },
    { id: 'option.faction.spirit-hall', title: '加入武魂殿', weight: 3, effects: [grant('faction', 'entity.faction.spirit-hall-remnants'), emit('signal.setup.faction-selected')] },
    { id: 'option.faction.free', title: '成为自由魂师', weight: 2, effects: [grant('faction', 'entity.faction.wanderers'), emit('signal.setup.faction-selected')] },
    { id: 'option.faction.tang', title: '加入唐门', weight: 2, effects: [grant('faction', 'entity.faction.tang'), emit('signal.setup.faction-selected')] },
    { id: 'option.faction.spirit-hall-remnants', title: '带领武魂殿残部赎罪', weight: 1, effects: [grant('faction', 'entity.faction.spirit-hall-remnants'), emit('signal.setup.faction-selected')] },
  ]),
  pool('pool.human.growth', '两年后的成长与遭遇', progressionTag, [
    { id: 'option.growth.steady', title: '稳步修炼，魂力提升二十四级', weight: 8, effects: [change('age', 2), advance(2), change('level', 24), emit('signal.human.growth-completed')] },
    { id: 'option.growth.breakthrough', title: '越级胜敌，魂力提升三十级', weight: 2, weightModifier: combatWeight(), effects: [change('age', 2), advance(2), change('level', 30), emit('signal.human.growth-completed')] },
    { id: 'option.growth.death', title: '遭遇封号斗罗追杀，最终战死', weight: 0.25, effects: [{ type: 'run.finish', endingId: endingId('ending.death') }] },
  ]),
  pool('pool.human.soul-ring', '魂环吸收', progressionTag, [
    { id: 'option.ring.hundred', title: '吸收百年魂环', weight: 5, effects: [emit('signal.soul-ring.selected')] },
    { id: 'option.ring.thousand', title: '越级吸收千年魂环', weight: 3, effects: [emit('signal.soul-ring.selected')] },
    { id: 'option.ring.ten-thousand', title: '吸收万年魂环', weight: 1, availableWhen: { type: 'compare', fact: 'actor.level', op: 'gte', value: 50 }, effects: [emit('signal.soul-ring.selected')] },
  ]),
  ...[1, 2, 3, 4].map((index) => pool(`pool.story.${index}`, `剧情${index}`, storyTag, [
    { id: `option.story.${index}.participate`, title: ['进入学院赛场', '参与全大陆精英赛', '卷入帝国风云', '直面嘉陵关决战'][index - 1]!, weight: 3, effects: [emit('signal.story.completed')] },
    { id: `option.story.${index}.observe`, title: ['在场外积累经验', '护送同伴安全撤离', '守护所属势力', '在战后重建秩序'][index - 1]!, weight: 1, effects: [emit('signal.story.completed')] },
  ])),
  pool('pool.beast.setup.period', '魂兽穿越时期', beastTag, [
    { id: 'option.beast.period.early', title: '唐三出生前百年', effects: [advance(-100), emit('signal.beast.period-selected')] },
    { id: 'option.beast.period.current', title: '唐三六岁时期', effects: [advance(6), emit('signal.beast.period-selected')] },
  ]),
  pool('pool.beast.setup.gender', '魂兽性别', beastTag, [
    { id: 'option.beast.gender.male', title: '雄性', effects: [grant('gender', 'entity.gender.male'), emit('signal.beast.gender-selected')] },
    { id: 'option.beast.gender.female', title: '雌性', effects: [grant('gender', 'entity.gender.female'), emit('signal.beast.gender-selected')] },
  ]),
  pool('pool.beast.setup.realm', '初始魂兽修为', beastTag, [
    { id: 'option.beast.realm.ten-thousand', title: '一万年魂兽', weight: 4, effects: [change('beast-cultivation', 10_000), emit('signal.beast.realm-selected')] },
    { id: 'option.beast.realm.hundred-thousand', title: '十万年魂兽', weight: 1, effects: [change('beast-cultivation', 100_000), emit('signal.beast.realm-selected')] },
  ]),
  pool('pool.beast.setup.type', '魂兽类型', beastTag, [
    { id: 'option.beast.type.land', title: '陆生魂兽', effects: [grant('beast-type', 'entity.beast-type.land'), emit('signal.beast.type-selected')] },
    { id: 'option.beast.type.sea', title: '海魂兽', effects: [grant('beast-type', 'entity.beast-type.sea'), emit('signal.beast.type-selected')] },
  ]),
  pool('pool.beast.setup.species', '魂兽种族', beastTag, [
    { id: 'option.beast.species.wind-wolf', title: '疾风魔狼', availableWhen: { type: 'contains', fact: 'actor.beast-types', value: entityId('entity.beast-type.land') }, effects: [grant('beast-species', 'entity.beast-species.wind-wolf'), grant('beast-bloodline', 'entity.beast-bloodline.wind-wolf'), emit('signal.beast.species-selected')] },
    { id: 'option.beast.species.spirit-whale', title: '灵潮鲸', availableWhen: { type: 'contains', fact: 'actor.beast-types', value: entityId('entity.beast-type.sea') }, effects: [grant('beast-species', 'entity.beast-species.spirit-whale'), grant('beast-bloodline', 'entity.beast-bloodline.spirit-whale'), emit('signal.beast.species-selected')] },
  ]),
  pool('pool.beast.setup.area', '魂兽生存区域', beastTag, [
    { id: 'option.beast.area.forest', title: '星斗大森林', availableWhen: { type: 'contains', fact: 'actor.beast-species', value: entityId('entity.beast-species.wind-wolf') }, effects: [grant('beast-area', 'entity.beast-area.forest'), emit('signal.beast.area-selected')] },
    { id: 'option.beast.area.ocean', title: '无尽海域', availableWhen: { type: 'contains', fact: 'actor.beast-species', value: entityId('entity.beast-species.spirit-whale') }, effects: [grant('beast-area', 'entity.beast-area.ocean'), emit('signal.beast.area-selected')] },
  ]),
  pool('pool.beast.growth', '魂兽十年成长', beastTag, [
    { id: 'option.beast.growth.absorb', title: '吸收天地精华，修为增加二十五万年', weight: 5, effects: [change('beast-cultivation', 250_000), advance(10), emit('signal.beast.growth-completed')] },
    { id: 'option.beast.growth.hunt', title: '吞噬强敌血脉，修为增加三十万年', weight: 2, effects: [change('beast-cultivation', 300_000), advance(10), emit('signal.beast.growth-completed')] },
  ]),
  pool('pool.beast.tribulation', '魂兽雷劫', beastTag, [
    { id: 'option.beast.tribulation.success', title: '以血脉与法则渡过雷劫', weight: 9, effects: [emit('signal.beast.tribulation-success')] },
    { id: 'option.beast.tribulation.death', title: '雷劫击碎本源，当场陨落', weight: 1, effects: [{ type: 'run.finish', endingId: endingId('ending.death') }] },
  ]),
  pool('pool.beast.route-choice', '十万年魂兽路线', beastTag, [
    { id: 'option.beast.route.transform', title: '选择化形，重走人类修炼之路', weight: 1, effects: [emit('signal.beast.transform')] },
    { id: 'option.beast.route.remain', title: '保持魂兽本体，继续渡劫进化', weight: 1, effects: [emit('signal.beast.remain')] },
  ]),
  pool('pool.god-trial.exam', '海神考核', godTag, [
    { id: 'option.god-trial.exam.success', title: '完成考核，获得海神亲和度', weight: 9, effects: [emit('signal.god-trial.exam-completed')] },
    { id: 'option.god-trial.exam.costly', title: '付出重伤代价完成考核', weight: 1, effects: [emit('signal.god-trial.exam-completed')] },
  ]),
]
