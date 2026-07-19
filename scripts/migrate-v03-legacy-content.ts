import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  ANIME_EXPANDED_MARTIAL_SOULS,
  CANONICAL_POOL_ADDITIONS,
  CROSSOVER_BEAST_MARTIAL_SOULS,
  CROSSOVER_BODY_MARTIAL_SOULS,
  FACTION_STORY_CHECKPOINTS,
  FACTION_STORY_DEFINITIONS,
  FIREARM_MARTIAL_SOULS,
  FIREARM_STORY_OPTIONS,
  FIREARM_STORY_POOL_NAME,
  SHREK_MENTOR_ENTRY_OPTIONS,
  SHREK_MENTOR_ENTRY_POOL_NAME,
  SHREK_MENTOR_REUNION_OPTIONS,
  SHREK_MENTOR_REUNION_POOL_NAME,
  SHREK_MENTOR_TOURNAMENT_OPTIONS,
  SHREK_MENTOR_TOURNAMENT_POOL_NAME,
} from '../legacy/v02-source/domain/canonAdditions'
import {
  BEAST_MARTIAL_SOUL_CATEGORIES,
  TOOL_MARTIAL_SOUL_CATEGORIES,
  beastMartialSoulPoolName,
  classifyBeastMartialSoul,
  classifyToolMartialSoul,
  toolMartialSoulPoolName,
} from '../legacy/v02-source/domain/martialSoulCategories'
import { getMartialSoulTier } from '../legacy/v02-source/domain/martialSoulTiers'

type LegacyOption = {
  readonly id: string
  readonly name: string
  readonly enabled?: boolean
  readonly weight?: number
  readonly requirements?: {
    readonly minAge?: number
    readonly maxAge?: number
    readonly minLevel?: number
    readonly maxLevel?: number
    readonly genders?: readonly string[]
    readonly storyStages?: readonly string[]
  }
  readonly availableWhen?: Record<string, unknown>
  readonly additionalEffects?: readonly Record<string, unknown>[]
  readonly martialSoul?: boolean
}

type LegacyPool = {
  readonly id: string
  readonly name: string
  readonly description?: string | null
  readonly options: readonly LegacyOption[]
  readonly tags: readonly string[]
}

type LegacyTag = { readonly id: string; readonly name: string }
type LegacySource = { readonly decisions: readonly LegacyPool[]; readonly tags: readonly LegacyTag[] }
type CategorizedMartialSoul = { readonly kind: 'beast' | 'tool'; readonly category: string; readonly options: readonly LegacyOption[] }

const MARTIAL_SOUL_POOL_NAMES = new Set(['兽武魂', '器武魂', '本体武魂', '变异武魂', '概念型武魂', '极致武魂'])
const SHREK_MENTOR_TRAIT = '史莱克客卿导师'
const DOMAIN_SEED_TRAIT = '领域雏形'
const ROADSIDE_BEAST_TRAIT = '路边'
const SEA_GOD_ISLAND_BEAST_WORSHIPPER_TRAIT = '海神岛魂兽供奉'
const SEA_GOD_GROWTH_POOL_TITLE = '5年后，你的成长（进入海神岛后限定）（无神位最多只能达到99级）'
const SEA_GOD_TRAINING_POOL_TITLE = '海神岛修行（有神考限定）'
const MARTIAL_SOUL_TYPE_BY_POOL: Readonly<Record<string, string>> = {
  兽武魂: 'beast', 器武魂: 'tool', 本体武魂: 'body', 变异武魂: 'mutated', 概念型武魂: 'concept', 极致武魂: 'ultimate',
}
const BEAST_SPECIES_POOL_BY_TYPE: Readonly<Record<string, string>> = {
  '猴子类': '猿猴类魂兽初始池子',
  '猿猴类': '猿猴类魂兽初始池子',
  '蛇类': '蛇类魂兽初始池子',
  '亚龙种': '亚龙种魂兽初始池子',
  '地龙种': '地龙种魂兽初始池子',
  '纯血龙种': '纯血龙种魂兽初始池',
  '翼类': '翼类魂兽初始池子',
  '猫科魂兽': '猫科类魂兽初始池子',
  '犬科魂兽': '犬科魂兽初始池子',
  '精神类魂兽': '精神类魂兽初始池子',
  '虫蛹类': '虫蛹类魂兽初始池子',
  '兔子类': '兔子类魂兽初始池子',
  '植物系魂兽': '植物系魂兽初始池子',
  '海魂兽': '海魂兽初始池子（默认全部带水属性，血脉融合则叠加）',
  '猪类魂兽': '猪类魂兽',
  '熊类': '熊类魂兽池子',
}
const BEAST_SPECIES_POOL_BY_FUSION: Readonly<Record<string, string>> = {
  '纯血龙种': '纯血龙种魂兽初始池', '翼类': '翼类魂兽初始池子', '植物系': '植物系魂兽初始池子',
  '精神系': '精神类魂兽初始池子', '兔子': '兔子类魂兽初始池子', '犬科': '犬科魂兽初始池子',
  '亚龙种血脉': '亚龙种魂兽初始池子', '猫科': '猫科类魂兽初始池子', '蛇类': '蛇类魂兽初始池子',
  '地龙种血脉': '地龙种魂兽初始池子', '熊类': '熊类魂兽池子', '虫蛹类': '虫蛹类魂兽初始池子',
  '猿猴类': '猿猴类魂兽初始池子', '海魂兽': '海魂兽初始池子（默认全部带水属性，血脉融合则叠加）', '猪类': '猪类魂兽',
}
const BEAST_ELEMENT_BY_TITLE: Readonly<Record<string, string>> = {
  '锐金元素': 'metal', '生命元素': 'life', '火元素': 'fire', '空间元素': 'space',
  '月亮元素': 'moon', '岚元素': 'wind', '毁灭元素': 'destruction', '时间元素': 'time',
  '水元素': 'water', '暗元素': 'dark', '冰元素': 'ice', '太阳元素': 'sun',
  '木元素': 'wood', '雷元素': 'lightning', '土元素': 'earth', '死亡元素': 'death',
  '光元素': 'light', '毒元素': 'poison',
}
type BeastTimelineEventSpec = {
  readonly eventId: string
  readonly title: string
  readonly atTangAge?: number
  readonly afterYears?: number
  readonly era?: string
  readonly speciesGroup?: string
}
const BEAST_TIMELINE_EVENT_SPECS: readonly BeastTimelineEventSpec[] = [
  { eventId: 'normal-1', title: '常规时间线限定事件1（唐三刚刚出生时期限定）', atTangAge: 0 },
  { eventId: 'normal-2', title: '常规时间线限定事件2（唐三19岁时期限定，兔类魂兽进入，其余种族可无视）', atTangAge: 19, speciesGroup: 'rabbit' },
  { eventId: 'normal-3', title: '常规时间线限定事件3（唐三24岁时期限定）', atTangAge: 24 },
  { eventId: 'sea-1', title: '海神时期限定事件1（海魂兽时间跳跃经过100年后进入）', era: 'sea-god', afterYears: 100 },
  { eventId: 'sea-2', title: '海神时期限定事件2（海魂兽时间跳跃经过200年后进入）', era: 'sea-god', afterYears: 200 },
  { eventId: 'sea-3', title: '海神时期限定事件3（海魂兽时间跳跃经过300年后进入）', era: 'sea-god', afterYears: 300 },
  { eventId: 'sea-4', title: '海神时期限定事件4（海魂兽自创兽神神位后的最终剧情，传承神位则无法进入该池）', era: 'sea-god' },
  { eventId: 'angel-1', title: '天使时期限定事件（时间跳跃经过300年后进入）', era: 'angel-god', afterYears: 300 },
]
const MARTIAL_SOUL_ATTRIBUTES: readonly [string, RegExp][] = [
  ['fire', /火|炎|焰|烈|赤|焚|灼|阳/], ['water', /水|海|潮|浪|波|涛|冰|雪/], ['lightning', /雷|电|霆/],
  ['ice', /冰|雪|寒|霜|冻/], ['wind', /风|飘|气/], ['light', /光|日|圣|明/], ['dark', /暗|黑|魔|影|幽冥|邪|死|罗刹/],
  ['life', /生命|木|花|草|药|树/], ['destruction', /毁灭|破|灭|崩/], ['sword', /剑/], ['blade', /刀/],
  ['spear', /枪|矛|戟/], ['bow', /弓/], ['dragon', /龙/],
]
const APPEARANCE_RANK_BY_LABEL: Readonly<Record<string, { readonly id: string; readonly rank: number }>> = {
  F: { id: 'f', rank: 0 }, E: { id: 'e', rank: 1 }, D: { id: 'd', rank: 2 }, C: { id: 'c', rank: 3 },
  B: { id: 'b', rank: 4 }, A: { id: 'a', rank: 5 }, S: { id: 's', rank: 6 }, EX: { id: 'ex', rank: 7 },
}
const LEGACY_CATALOG_WEIGHT_CORRECTIONS = new Map([
  ['ae1e4459-b291-420a-a3e8-f18d7a1f874a.19c4fa', {
    activeBaseWeight: 20,
    reason: 'legacy/v02-source/domain/catalog.ts 将“唐三6岁”权重从原始 JSON 的 350 修正为 20。',
  }],
])
const sourcePath = resolve('src/content/v03/legacyContent.source.json')
const generatedPath = resolve('src/content/v03/legacyContent.generated.json')
const legacyFlowPath = resolve('src/content/v03/legacyFlow.generated.json')
const auditPath = resolve('test-results/iterations/v0.3/legacy-migration/audit.json')
const recoveryLedgerPath = resolve('test-results/iterations/v0.3/legacy-migration/pool-recovery-ledger.json')
const expectedSourceSha256 = 'a15531384c18d428622596d1d96b645ded8a8d65e14e3d948c1c33ad1c024b1b'

const sourceText = readFileSync(sourcePath, 'utf8')
const sourceSha256 = checksum(sourceText)
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(`Unexpected original wheel source checksum: ${sourceSha256}`)
}

const source = JSON.parse(sourceText) as LegacySource
const tagById = new Map(source.tags.map((tag) => [tag.id, tag]))
const traitLabels = new Set<string>()
const talentLabels = new Set<string>()
const domainLabels = new Set<string>()
const unsupportedConstraints: Array<{ readonly poolId: string; readonly optionId: string; readonly title: string; readonly reason: string }> = []
const unresolvedStaticRules: Array<{ readonly rule: string; readonly title: string; readonly reason: string }> = []

const catalogDecisions = createCatalogDecisions(source.decisions)
const martialSoulRules = createMartialSoulRules(catalogDecisions)
const martialSoulByTitle = new Map(martialSoulRules.map((rule) => [rule.title, rule]))
const martialSoulCategories = createMartialSoulCategories(catalogDecisions)
const virtualPools = createVirtualPools(catalogDecisions, martialSoulCategories)

const entities = [
  ...source.tags.map((tag) => ({
    id: tagEntityId(tag.id),
    entityType: 'trait',
    presentation: { title: tag.name, description: '原版转盘标签' },
  })),
  ...martialSoulRules.map((rule) => ({
    id: rule.entityId,
    entityType: 'martial-soul',
    presentation: { title: rule.title, description: `原版武魂品阶 T${rule.tier}` },
  })),
  ...source.decisions
    .filter((pool) => pool.tags.some((tagId) => tagById.get(tagId)?.name === '选择势力'))
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyFactionEntityId(pool, option),
      entityType: 'faction',
      presentation: { title: option.name, description: '原版势力选择结果' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'soul-ring')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacySoulRingEntityId(pool, option),
      entityType: 'soul-ring',
      presentation: { title: option.name, description: '原版魂环抽取结果' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'soul-bone')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacySoulBoneEntityId(pool, option),
      entityType: 'soul-bone',
      presentation: { title: option.name, description: '原版魂骨抽取结果' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'beast-type')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyBeastTypeEntityId(pool, option),
      entityType: 'beast-type',
      presentation: { title: option.name, description: '原版魂兽类型' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'beast-species')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyBeastSpeciesEntityId(pool, option),
      entityType: 'beast-species',
      presentation: { title: option.name, description: '原版魂兽种族' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'beast-species')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyBeastBloodlineEntityId(pool, option),
      entityType: 'beast-bloodline',
      presentation: { title: option.name, description: '原版魂兽本体血脉' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'beast-species')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyBeastMartialSoulEntityId(pool, option),
      entityType: 'martial-soul',
      presentation: { title: option.name, description: '原版魂兽化形后的本体武魂' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'beast-area')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyBeastAreaEntityId(pool, option),
      entityType: 'beast-area',
      presentation: { title: option.name, description: '原版魂兽生存区域' },
    }))),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'god-deity')
    .flatMap((pool) => pool.options.map((option) => ({
      id: legacyGodDeityEntityId(pool, option),
      entityType: 'godhood',
      presentation: { title: option.name, description: '原版神位考核目标' },
    }))),
  ...(['king', 'first', 'second', 'third'] as const).map((tier) => ({
    id: legacyGodTierEntityId(tier),
    entityType: 'trait' as const,
    presentation: { title: `${tier}神考` },
  })),
  ...catalogDecisions
    .filter((pool) => legacyRoleForSourcePool(pool) === 'story')
    .map((pool) => ({
      id: legacyStoryNodeEntityId(pool),
      entityType: 'story-node' as const,
      presentation: { title: pool.name, description: '原版剧情节点' },
    })),
]

const pools = [...catalogDecisions, ...virtualPools].map((pool) => ({
  id: pool.id.startsWith('virtual.') ? `pool.legacy.${pool.id}` : `pool.legacy.${pool.id}`,
  presentation: { title: pool.name, ...(pool.description ? { description: pool.description } : {}) },
  tags: pool.tags.flatMap((tagId) => tagById.has(tagId) ? [tagEntityId(tagId)] : []),
  options: pool.options.map((option) => migrateOption(pool, option)),
}))

for (const title of traitLabels) {
  entities.push({ id: traitEntityId(title), entityType: 'trait', presentation: { title, description: '从原版事件【】标记迁移' } })
}
for (const title of talentLabels) {
  entities.push({ id: traitEntityId(`talent:${title}`), entityType: 'trait', presentation: { title, description: '从原版特殊天赋池迁移' } })
}
for (const title of domainLabels) {
  entities.push({ id: domainEntityId(title), entityType: 'domain', presentation: { title, description: '从原版事件领域效果迁移' } })
}

const generated = {
  schemaVersion: 1,
  source: {
    origin: '1338d1b^:src/data/wheels.json',
    sha256: sourceSha256,
    pools: source.decisions.length,
    options: source.decisions.reduce((count, pool) => count + pool.options.length, 0),
    tags: source.tags.length,
  },
  expansion: {
    catalogPools: catalogDecisions.length,
    catalogOptions: catalogDecisions.reduce((count, pool) => count + pool.options.length, 0),
    canonicalOptions: catalogDecisions.reduce((count, pool) => count + pool.options.filter((option) => option.id.startsWith('canon.')).length, 0),
    virtualPools: virtualPools.length,
    virtualOptions: virtualPools.reduce((count, pool) => count + pool.options.length, 0),
    martialSoulRules: martialSoulRules.length,
    correctedWeights: [{ pool: '基础设定8:穿越时期', option: '唐三6岁', weight: 20 }],
  },
  martialSoulTiers: martialSoulRules,
  combatRules: {
    talentTraitIds: [...talentLabels].sort().map((title) => traitEntityId(`talent:${title}`)),
    battleTraitIds: [...traitLabels]
      .filter((title) => /[杀战斗力破斩暴狂怒王]/.test(title))
      .sort()
      .map(traitEntityId),
  },
  martialSoulCategories: martialSoulCategories.map(({ kind, category, options }) => ({
    kind,
    category,
    martialSoulEntityIds: options.map((option) => martialSoulByTitle.get(option.name)?.entityId ?? missingMartialSoul(option.name)),
  })),
  entities,
  pools,
}

// The old machine used display names to find pools.  Build the equivalent
// registry once so runtime Process Managers only consume stable IDs.
const legacyFlow = createLegacyFlow(source, generated.source, virtualPools)

const optionRecords = pools.flatMap((pool) => pool.options)
const effectCounts = Object.fromEntries(
  ['stat.change', 'entity.grant', 'entity.revoke', 'time.advance', 'run.finish']
    .map((type) => [type, optionRecords.reduce((count, option) => count + option.mechanics.effects.filter((effect) => effect.type === type).length, 0)]),
)
const audit = {
  schemaVersion: 1,
  source: generated.source,
  output: {
    pools: pools.length,
    options: optionRecords.length,
    tagEntities: source.tags.length,
    traitEntities: traitLabels.size,
    domainEntities: domainLabels.size,
    martialSoulEntities: martialSoulRules.length,
  },
  expansion: generated.expansion,
  semantics: {
    effectfulOptions: optionRecords.filter((option) => option.mechanics.effects.length > 0).length,
    conditionalOptions: optionRecords.filter((option) => option.mechanics.availableWhen != null).length,
    narrativeOptions: optionRecords.filter((option) => option.mechanics.effects.length === 0 && option.mechanics.availableWhen == null).length,
    effectCounts,
  },
  unsupportedConstraints,
  unresolvedStaticRules,
}

const unresolvedOptionIds = new Set(unsupportedConstraints.map((entry) => entry.optionId))
const recoveryLedger = {
  schemaVersion: 1,
  source: generated.source,
  summary: {
    sourcePools: source.decisions.length,
    sourceOptions: source.decisions.reduce((count, pool) => count + pool.options.length, 0),
    sourceTags: source.tags.length,
    mappedPools: source.decisions.filter((pool) => pools.some((candidate) => candidate.id === `pool.legacy.${pool.id}`)).length,
    mappedOptions: source.decisions.reduce((count, pool) => count + pool.options.filter((option) => (
      pools.find((candidate) => candidate.id === `pool.legacy.${pool.id}`)?.options
        .some((candidate) => candidate.id === `option.legacy.${pool.id}.${option.id}`)
    )).length, 0),
    mappedTags: source.tags.filter((tag) => entities.some((entity) => entity.id === tagEntityId(tag.id))).length,
  },
  tags: source.tags.map((tag) => ({
    sourceTagId: tag.id,
    title: tag.name,
    activeEntityId: tagEntityId(tag.id),
  })),
  pools: source.decisions.map((sourcePool) => {
    const activePool = pools.find((candidate) => candidate.id === `pool.legacy.${sourcePool.id}`)
    const sourceOptionIds = new Set(sourcePool.options.map((option) => `option.legacy.${sourcePool.id}.${option.id}`))
    return {
      sourcePoolId: sourcePool.id,
      title: sourcePool.name,
      activePoolId: activePool?.id ?? null,
      sourceOptionCount: sourcePool.options.length,
      activeOptionCount: activePool?.options.length ?? 0,
      options: sourcePool.options.map((sourceOption) => {
        const activeOptionId = `option.legacy.${sourcePool.id}.${sourceOption.id}`
        const activeOption = activePool?.options.find((candidate) => candidate.id === activeOptionId)
        const sourceWeight = positiveWeight(sourceOption.weight)
        const correction = LEGACY_CATALOG_WEIGHT_CORRECTIONS.get(`${sourcePool.id}.${sourceOption.id}`)
        const expectedActiveWeight = correction?.activeBaseWeight ?? sourceWeight
        return {
          sourceOptionId: sourceOption.id,
          title: sourceOption.name,
          enabled: sourceOption.enabled !== false,
          sourceBaseWeight: sourceWeight,
          expectedActiveBaseWeight: expectedActiveWeight,
          weightCorrection: correction ?? null,
          activeOptionId: activeOption?.id ?? null,
          activeTitle: activeOption?.presentation.title ?? null,
          activeEnabled: activeOption?.mechanics.enabled ?? null,
          activeBaseWeight: activeOption?.mechanics.baseWeight ?? null,
          matches: activeOption?.presentation.title === sourceOption.name
            && activeOption.mechanics.enabled === (sourceOption.enabled !== false)
            && activeOption.mechanics.baseWeight === expectedActiveWeight,
          migrationStatus: unresolvedOptionIds.has(activeOptionId) ? 'pending-rule' : 'compiled',
        }
      }),
      extensions: activePool?.options.filter((option) => !sourceOptionIds.has(option.id)).map((option) => ({
        activeOptionId: option.id,
        title: option.presentation.title,
        enabled: option.mechanics.enabled,
        baseWeight: option.mechanics.baseWeight,
      })) ?? [],
    }
  }),
}

writeJson(generatedPath, generated)
writeJson(legacyFlowPath, legacyFlow)
writeJson(auditPath, audit)
writeJson(recoveryLedgerPath, recoveryLedger)
console.log(JSON.stringify({
  source: audit.source,
  output: audit.output,
  expansion: audit.expansion,
  semantics: audit.semantics,
  unsupportedConstraints: audit.unsupportedConstraints.length,
  unresolvedStaticRules: audit.unresolvedStaticRules.length,
  legacyFlowPath,
  auditPath,
  recoveryLedgerPath,
}, null, 2))

type LegacyFlowRole =
  | 'setup-race'
  | 'setup-timeline'
  | 'setup-gender'
  | 'setup-appearance'
  | 'setup-martial-type'
  | 'setup-special-chance'
  | 'setup-age'
  | 'setup-period'
  | 'martial-soul'
  | 'special-talent'
  | 'initial-power'
  | 'soul-ring'
  | 'ring-species'
  | 'ring-bonus'
  | 'human-time'
  | 'special-growth-chance'
  | 'special-growth'
  | 'faction'
  | 'faction-story'
  | 'soul-bone-chance'
  | 'soul-bone'
  | 'sea-god-tier'
  | 'sea-god-plan'
  | 'sea-god-reward'
  | 'god-tier'
  | 'god-deity'
  | 'god-reward'
  | 'domain'
  | 'killing-city'
  | 'sacrifice'
  | 'story'
  | 'beast-period'
  | 'beast-gender'
  | 'beast-realm'
  | 'beast-type'
  | 'beast-species'
  | 'beast-area'
  | 'beast-route'
  | 'beast-growth'
  | 'beast-encounter'
  | 'beast-timeline-event'
  | 'beast-special-growth-chance'
  | 'beast-special-growth'
  | 'beast-tribulation'
  | 'beast-god-choice'
  | 'beast-evolution'
  | 'human-encounter'

type LegacyGodTier = 'king' | 'first' | 'second' | 'third'
type LegacySeaGodGrade = 'yellow' | 'purple' | 'black' | 'top' | 'sea-god'

type LegacyFlowRoute = 'human' | 'beast' | 'shared'

function createLegacyFlow(
  legacy: LegacySource,
  sourceMeta: { readonly origin: string; readonly sha256: string; readonly pools: number; readonly options: number; readonly tags: number },
  generatedVirtualPools: readonly LegacyPool[],
) {
  const poolByTitle = new Map(legacy.decisions.map((pool) => [pool.name, pool]))
  const tagNames = new Map(legacy.tags.map((tag) => [tag.id, tag.name]))
  const activeId = (pool: LegacyPool) => `pool.legacy.${pool.id}`
  const sourceIdFor = (title: string) => {
    const pool = poolByTitle.get(title)
    if (!pool) throw new Error(`Missing required original flow pool: ${title}`)
    return activeId(pool)
  }
  const tagPools = (tag: string) => legacy.decisions.filter((pool) => pool.tags.some((tagId) => tagNames.get(tagId) === tag))
  const flowPools = (sourcePools: readonly LegacyPool[]) => sourcePools.map((pool) => {
    const tags = pool.tags.flatMap((tagId) => tagNames.get(tagId) ? [tagNames.get(tagId)!] : [])
    const role = legacyFlowRole(pool, tags)
    return {
      sourcePoolId: pool.id,
      activePoolId: activeId(pool),
      title: pool.name,
      tags,
      role,
      ...(role === 'soul-ring' || role === 'ring-species' ? { ringIndex: legacyRingIndex(pool.name) } : {}),
      ...(role === 'soul-bone-chance' ? { soulBoneYears: legacySoulBoneChanceYears(pool.name) } : {}),
      ...(legacyAuxiliaryKind(pool, role) ? { auxiliaryKind: legacyAuxiliaryKind(pool, role) } : {}),
      ...(role === 'story' ? {
        storyNodeEntityId: legacyStoryNodeEntityId(pool),
        canonicalTangAge: tangAgeFromStoryTitle(pool.name),
      } : {}),
      route: legacyFlowRoute(role, tags),
      trigger: legacyFlowTrigger(role),
      sourceOptionCount: pool.options.length,
      options: pool.options.map((option) => ({
        sourceOptionId: option.id,
        activeOptionId: `option.legacy.${pool.id}.${option.id}`,
        semantic: legacyOptionSemantic(pool, option, role),
      })),
    }
  })
  const pools = flowPools(legacy.decisions)
  const virtualPools = flowPools(generatedVirtualPools)
  const seaGodTierPool = pools.find((pool) => pool.role === 'sea-god-tier')
  const seaGodPlanPool = pools.find((pool) => pool.role === 'sea-god-plan')
  const seaGodGrowthPool = pools.find((pool) => pool.title === SEA_GOD_GROWTH_POOL_TITLE)
  const seaGodTrainingPool = pools.find((pool) => pool.title === SEA_GOD_TRAINING_POOL_TITLE)
  const seaGodCompletionGatePool = pools.find((pool) => pool.role === 'sea-god-reward' && pool.options[0]?.semantic.seaGodCompletionGate === true)
  const seaGodInheritanceDeityId = pools
    .filter((pool) => pool.role === 'god-deity')
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.seaGodInheritanceDeity === true)?.semantic.godDeityEntityId
  if (!seaGodTierPool || !seaGodPlanPool || !seaGodGrowthPool || !seaGodTrainingPool || !seaGodCompletionGatePool || !seaGodInheritanceDeityId) {
    throw new Error('Missing original Sea God progression metadata')
  }
  const storyPlan = [
    { branch: 1, tag: '《斗罗大陆》剧情第一分支', milestones: [[12, 1, 3], [14, 4, 9], [19, 10, 13], [20, 14, 15], [21, 16, 16], [24.5, 17, 18.4], [24.8, 19, 20], [25, 21, 25]] },
    { branch: 2, tag: '《斗罗大陆》剧情第二分支', milestones: [[14, 1, 3], [20, 4, 9], [24, 10, 12.4], [24.8, 13, 14], [25, 15, 17]] },
    { branch: 3, tag: '《斗罗大陆》剧情第三分支', milestones: [[12, 1, 2], [14, 3, 6], [20, 7, 7], [24, 8, 10.4], [24.8, 11, 12], [25, 13, 17]] },
  ].map((plan) => ({
    branch: plan.branch,
    tag: plan.tag,
    milestones: plan.milestones.map(([atTangAge, from, to]) => ({
      atTangAge,
      from,
      to,
      poolIds: tagPools(plan.tag)
        .filter((pool) => {
          const number = storyNumberFromTitle(pool.name)
          return number != null && number >= from && number <= to
        })
        .sort((left, right) => (storyNumberFromTitle(left.name) ?? 0) - (storyNumberFromTitle(right.name) ?? 0))
        .map(activeId),
    })),
  }))

  return {
    schemaVersion: 1,
    source: sourceMeta,
    entrypoints: {
      random: sourceIdFor('基础设定1:你的种族是？'),
      human: [
        sourceIdFor('基础设定3:你的性别是？'),
        sourceIdFor('基础设定4:容貌（B级以下无法恋爱）'),
        sourceIdFor('基础设定5:武魂天赋'),
        sourceIdFor('基础设定6:是否拥有特殊天赋'),
        sourceIdFor('基础设定7:你的年龄'),
        sourceIdFor('基础设定8:穿越时期'),
      ],
      beast: [
        sourceIdFor('基础设定1:魂兽穿越时期'),
        sourceIdFor('基础设定2:魂兽性别'),
        sourceIdFor('基础设定3:你是什么级别的魂兽'),
        sourceIdFor('基础设定4:你是什么类型的魂兽'),
      ],
    },
    progression: {
      initialPowerByAge: [6, 8, 10, 12, 14, 16, 18, 50, 80].map((age) => ({
        age,
        poolId: sourceIdFor(age === 6 ? '先天魂力（6岁限定）' : `故事开始时的魂力等级（${age}岁限定）`),
      })),
      ultimateInitialPowerPoolId: sourceIdFor('极致武魂先天魂力（6岁限定）'),
      factionByAge: [6, 12, 18].map((age) => ({
        age,
        poolId: sourceIdFor(age === 6 ? '人物背景or加入的势力（6岁限定）' : `加入的势力（${age}岁限定）`),
      })),
      factionStories: FACTION_STORY_DEFINITIONS.map((definition) => ({
        id: definition.id,
        poolId: `pool.legacy.virtual.faction-story.${definition.id}`,
        stages: FACTION_STORY_CHECKPOINTS.map((checkpoint) => ({
          id: checkpoint.id,
          minAge: checkpoint.minAge,
          ...(checkpoint.maxAge == null ? {} : { maxAge: checkpoint.maxAge }),
          ...(checkpoint.minLevel == null ? {} : { minLevel: checkpoint.minLevel }),
          optionIds: definition.options
            .map((option, index) => ({ option, index }))
            .filter(({ option }) => option.requirements.storyStages?.includes(checkpoint.id))
            .map(({ index }) => `option.legacy.virtual.faction-story.${definition.id}.virtual.faction-story.${definition.id}.${index + 1}`),
        })),
      })),
      soulRingByIndex: [
        ['第一', 1], ['第二', 2], ['第三', 3], ['第四', 4], ['第五', 5], ['第六', 6], ['第七', 7], ['第八', 8], ['第九', 9],
      ].map(([chinese, index]) => ({
        index,
        poolId: sourceIdFor(`魂环吸收（${chinese}魂环）（抽取完魂环后请进入对应的魂骨抽奖池）`),
      })),
      humanGrowthByAge: [
        { minAge: 6, maxAge: 11, title: '2年后，你的成长（6岁-12岁限定，已达12岁则不可再抽取该池）' },
        { minAge: 12, maxAge: 17, title: '2年后，你的成长（12岁-18岁限定，已达18岁不可再抽取该池）（没有神位最多到99级）' },
        { minAge: 18, title: '2年后，你的成长（18岁+的年龄通用池）（无神位最多只能达到99级）' },
      ].map(({ title, ...range }) => ({ ...range, poolId: sourceIdFor(title) })),
      humanGrowthByLevel: [
        { minLevel: 1, maxLevel: 10, title: '2年后，你的成长（1-10级限定池，10级以上不可抽取）' },
        { minLevel: 11, maxLevel: 20, title: '2年后，你的成长（11-20级限定池，20级以上不可抽取）' },
        { minLevel: 21, maxLevel: 30, title: '2年后，你的成长（21-30级限定池，30级以上不可抽取）' },
        { minLevel: 31, maxLevel: 40, title: '2年后，你的成长（31-40级限定池，40级以上不可抽取）' },
        { minLevel: 41, maxLevel: 50, title: '2年后，你的成长（41-50级限定池，50级以上不可抽取）' },
        { minLevel: 51, maxLevel: 60, title: '2年后，你的成长（51-60级限定池，60级以上不可抽取）' },
      ].map(({ title, ...range }) => ({ ...range, poolId: sourceIdFor(title) })),
      humanEncounterByLevel: [
        { minLevel: 1, maxLevel: 10, title: '1-10级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
        { minLevel: 11, maxLevel: 20, title: '11-20级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
        { minLevel: 21, maxLevel: 30, title: '21-30级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
        { minLevel: 31, maxLevel: 40, title: '31-40级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
        { minLevel: 41, maxLevel: 50, title: '41-50级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
        { minLevel: 51, maxLevel: 60, title: '51-60级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）' },
      ].map(({ title, ...range }) => ({ ...range, poolId: sourceIdFor(title) })),
      humanGrowthPoolIds: tagPools('时间跳跃').map(activeId),
      beastGrowthByCultivation: [
        { min: 10, max: 99, title: '10年后，你的成长（十年魂兽限定，已达百年魂兽则不可再抽取该池）' },
        { min: 100, max: 999, title: '10年后，你的成长（百年魂兽限定，已达千年魂兽则不可再抽取该池）' },
        { min: 1_000, max: 9_999, title: '10年后，你的成长（千年魂兽限定，已达万年魂兽则不可再抽取该池）' },
        { min: 10_000, max: 99_999, title: '10年后，你的成长（万年魂兽限定，达到十万年以后无法再抽取，需经历十万年雷劫）' },
        { min: 100_000, max: 999_999, title: '10年后，你的成长（十万年魂兽限定，达到百万年无法再抽取，需突破神劫成神）（每提升十万年，进入雷劫突破池，才可继续提升）' },
      ].map(({ title, ...range }) => ({ ...range, poolId: sourceIdFor(title) })),
      beastGrowthPoolIds: tagPools('魂兽时间跳跃').filter((pool) => /成长/.test(pool.name)).map(activeId),
      beastEncounterByCultivation: [
        { min: 10, max: 99, title: '十年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 100, max: 999, title: '百年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 1_000, max: 9_999, title: '千年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 10_000, max: 99_999, title: '万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 100_000, max: 199_999, title: '十万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 200_000, max: 299_999, title: '二十万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
        { min: 300_000, max: 999_999, title: '30万年-99万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）' },
      ].map(({ title, ...range }) => ({ ...range, poolId: sourceIdFor(title) })),
      beastEncounterPoolIds: tagPools('魂兽时间跳跃').filter((pool) => /遭遇/.test(pool.name)).map(activeId),
      soulRingPoolIds: tagPools('魂环吸收').map(activeId),
      beastSetup: {
        areaPoolId: sourceIdFor('基础设定5:你的生存区域（海魂兽默认大海无需抽取该池）'),
        routeChoicePoolId: sourceIdFor('基础设定6:十万年魂兽路线分歧点（初始十万年魂兽或万年魂兽成功经历十万年雷劫后可选该池）'),
        evolutionPoolId: sourceIdFor('魂兽进化方向选择（十年进阶百年，百年进阶千年，千年进阶万年，万年成功进阶十万年，或十万年魂兽每成功经历雷劫可抽取该池）'),
        specialGrowthChancePoolId: sourceIdFor('是否获得特殊成长经历（每次经过一次进化，可抽取该池，例如十年破百年、百年破千年等，十万年魂兽每成功突破一次雷劫可抽取）'),
        specialGrowthPoolId: sourceIdFor('特殊成长经历'),
        elementalEvolutionPoolId: sourceIdFor('魂兽元素进化抽取池（连续2次抽取到同元素进化为极致属性，3次为法则雏形，4次为完整法则，4次之后无效则重抽）'),
        bloodlineFusionPoolId: sourceIdFor('魂兽血脉融合抽取池（抽完后请进入对应血脉的初始抽取池进行抽取需融合的血脉）（本体血脉固定占50%，其余血脉均分剩下的50%）'),
        dragonBloodlinePoolId: sourceIdFor('三龙血脉融合池（本体为纯血龙发生血脉融合才可进入该池，特殊遭遇可以强行让其他兽融合）（本体占50%其余血脉均分50%）'),
        postGodChoicePoolId: sourceIdFor('成就兽神神位后的选择（非兽神不可进入该池，海魂兽不用抽该池，海魂兽结局在海神限定剧情那里）'),
        timelineEvents: BEAST_TIMELINE_EVENT_SPECS.map((spec) => ({
          eventId: spec.eventId,
          poolId: sourceIdFor(spec.title),
          ...(spec.atTangAge == null ? {} : { atTangAge: spec.atTangAge }),
          ...(spec.afterYears == null ? {} : { afterYears: spec.afterYears }),
          ...(spec.era == null ? {} : { era: spec.era }),
          ...(spec.speciesGroup == null ? {} : { speciesGroup: spec.speciesGroup }),
        })),
        tribulationPoolIds: ([
          [100_000, '万年魂兽突破十万年雷劫池'],
          [200_000, '十万年魂兽突破二十万年雷劫池'],
          [300_000, '二十万年魂兽突破三十万年雷劫池'],
          [400_000, '三十万年魂兽突破四十万年雷劫池'],
          [500_000, '四十万年魂兽突破五十万年雷劫池'],
          [600_000, '五十万年魂兽突破六十万年雷劫池'],
          [700_000, '六十万年魂兽突破七十万年雷劫池'],
          [800_000, '七十万年魂兽突破八十万年雷劫池'],
          [900_000, '八十万年魂兽突破九十万年雷劫池'],
          [1_000_000, '百万年神劫池，突破成功则成就魂兽神位'],
        ] as const).map(([threshold, title]) => ({ threshold, poolId: sourceIdFor(title) })),
      },
      storyPlan,
      god: {
        generalTriggerPoolId: sourceIdFor('神考池子'),
        ninetyNineTriggerPoolId: sourceIdFor('99级神考触发'),
        selfCreatedPoolId: sourceIdFor('自创神位剧情'),
      },
      godRewards: pools
        .filter((pool) => pool.role === 'god-reward')
        .flatMap((pool) => {
          const semantic = pool.options[0]?.semantic
          return semantic?.godTier && semantic.godRewardExam && semantic.requiredLevel != null
            ? [{ tier: semantic.godTier, exam: semantic.godRewardExam, minLevel: semantic.requiredLevel, poolId: pool.activePoolId }]
            : []
        }),
      seaGod: {
        tierPoolId: seaGodTierPool.activePoolId,
        planPoolId: seaGodPlanPool.activePoolId,
        growthPoolId: seaGodGrowthPool.activePoolId,
        trainingPoolId: seaGodTrainingPool.activePoolId,
        completionGatePoolId: seaGodCompletionGatePool.activePoolId,
        inheritanceDeityId: seaGodInheritanceDeityId,
        rewards: pools
          .filter((pool) => pool.role === 'sea-god-reward')
          .flatMap((pool) => {
            const semantic = pool.options[0]?.semantic
            return semantic?.seaGodGrade && semantic.seaGodGrade !== 'sea-god' && semantic.seaGodRewardExam
              ? [{ grade: semantic.seaGodGrade, exam: semantic.seaGodRewardExam, poolId: pool.activePoolId }]
              : []
          }),
      },
    },
    pools,
    virtualPools,
  }
}

function legacyOptionSemantic(pool: LegacyPool, option: LegacyOption, role: LegacyFlowRole) {
  const semantic: Record<string, string | number | boolean> = {}
  if (role === 'setup-race') semantic.route = /魂兽/.test(option.name) ? 'beast' : 'human'
  if (role === 'setup-gender' || role === 'beast-gender') {
    const gender = legacyGender(option.name)
    if (gender) semantic.gender = gender
  }
  if (role === 'setup-appearance') {
    const appearance = legacyAppearance(option.name)
    if (appearance) semantic.appearance = appearance.id
  }
  if (role === 'setup-martial-type') {
    const type = MARTIAL_SOUL_TYPE_BY_POOL[option.name]
    if (type) semantic.martialSoulType = type
  }
  if (role === 'setup-special-chance' || role === 'special-growth-chance' || role === 'beast-special-growth-chance' || role === 'soul-bone-chance' || role === 'killing-city') {
    semantic.accepted = legacyAffirmative(option.name)
  }
  if (role === 'setup-age') semantic.age = legacyFirstNumber(option.name, 6)
  if (role === 'setup-period' || role === 'beast-period') semantic.tangAge = legacyTangAge(option.name)
  if (role === 'setup-timeline' || role === 'beast-period') {
    semantic.timelineEra = legacyTimelineEra(option.name)
    semantic.timelineEraTraitId = traitEntityId(`timeline:${legacyTimelineEra(option.name)}`)
  }
  if (role === 'initial-power') semantic.level = legacyInitialLevel(option.name)
  if (role === 'faction') {
    semantic.factionEntityId = legacyFactionEntityId(pool, option)
    semantic.branch = /史莱克|分支一/.test(option.name) ? 1 : /武魂殿|分支二/.test(option.name) ? 2 : 3
    const factionStory = FACTION_STORY_DEFINITIONS.find((definition) => definition.aliases.some((alias) => option.name.includes(alias)))
    if (factionStory) semantic.factionStoryId = factionStory.id
  }
  if (role === 'faction-story') {
    const factionStory = FACTION_STORY_DEFINITIONS.find((definition) => pool.id === `virtual.faction-story.${definition.id}`)
    const stage = option.requirements?.storyStages?.[0]
    if (factionStory) semantic.factionStoryId = factionStory.id
    if (stage) semantic.factionStoryStage = stage
  }
  if (role === 'human-time') semantic.years = legacyFirstNumber(pool.name, 2)
  const godEntry = legacyGodEntry(pool, option, role)
  if (godEntry) semantic.godEntry = godEntry
  if (role === 'story' && pool.name === '剧情16:七怪打算前往海神岛，你是否前往（唐三21岁限定）') {
    semantic.seaGodEntry = /^(?:是，)?前往海神岛/.test(option.name)
  }
  if (role === 'sea-god-tier') {
    const grade = legacySeaGodGrade(option.name)
    const total = legacySeaGodTotal(option.name)
    if (grade) {
      semantic.seaGodGrade = grade
      if (total != null) semantic.seaGodTotal = total
    }
  }
  if (role === 'sea-god-plan') {
    semantic.seaGodPlanFailed = /失败|驱逐/.test(option.name)
    semantic.seaGodPlanAll = /全部完成/.test(option.name)
    const completed = legacySeaGodPlanCompleted(option.name)
    if (completed != null) semantic.seaGodPlanCompleted = completed
  }
  if (role === 'sea-god-reward') {
    semantic.seaGodCompletionGate = /是否在神战前完成你还剩下的考核/.test(pool.name)
    const grade = legacySeaGodGrade(pool.name)
    const exam = legacySeaGodRewardExam(pool.name)
    if (grade && grade !== 'sea-god') semantic.seaGodGrade = grade
    if (exam != null) semantic.seaGodRewardExam = exam
  }
  if (role === 'soul-ring') semantic.ringYears = legacyCultivation(option.name)
  if (role === 'soul-ring') semantic.ringEntityId = legacySoulRingEntityId(pool, option)
  if (role === 'soul-bone') semantic.soulBoneEntityId = legacySoulBoneEntityId(pool, option)
  if (role === 'beast-type') semantic.beastTypeEntityId = legacyBeastTypeEntityId(pool, option)
  if (role === 'beast-type') {
    const speciesPool = BEAST_SPECIES_POOL_BY_TYPE[option.name]
    const speciesSource = speciesPool ? source.decisions.find((candidate) => candidate.name === speciesPool) : undefined
    if (speciesSource) semantic.speciesPoolId = `pool.legacy.${speciesSource.id}`
    semantic.requiresArea = option.name !== '海魂兽'
    semantic.beastKind = legacyBeastKind(option.name)
  }
  if (role === 'beast-species') semantic.beastSpeciesEntityId = legacyBeastSpeciesEntityId(pool, option)
  if (role === 'beast-species') semantic.beastBloodlineEntityId = legacyBeastBloodlineEntityId(pool, option)
  if (role === 'beast-species') semantic.beastMartialSoulEntityId = legacyBeastMartialSoulEntityId(pool, option)
  if (role === 'beast-species') semantic.beastSpeciesGroup = legacyBeastSpeciesGroup(pool.name)
  if (role === 'beast-area') semantic.beastAreaEntityId = legacyBeastAreaEntityId(pool, option)
  if (role === 'beast-area') semantic.beastAreaKind = legacyBeastAreaKind(option.name)
  if (role === 'beast-realm' || role === 'beast-growth' || role === 'beast-encounter') semantic.cultivation = legacyCultivation(option.name)
  if (role === 'beast-route') semantic.transform = /化形/.test(option.name)
  if (role === 'beast-evolution') {
    const kind = legacyBeastEvolutionKind(option.name)
    if (kind) semantic.beastEvolutionKind = kind
    const action = legacyBeastEvolutionAction(pool, option)
    if (action) semantic.beastEvolutionAction = action
    const targetPoolId = legacyBeastEvolutionTargetPoolId(pool, option)
    if (targetPoolId) semantic.beastEvolutionTargetPoolId = targetPoolId
    const element = legacyBeastElement(option.name)
    if (element) {
      semantic.beastElement = element
      semantic.beastElementTraitId = traitEntityId(`element:${element}`)
      semantic.beastExtremeTraitId = traitEntityId(`extreme-element:${element}`)
      semantic.beastLawSeedTraitId = traitEntityId(`law-seed:${element}`)
      semantic.beastLawTraitId = traitEntityId(`law:${element}`)
    }
  }
  if (role === 'beast-special-growth') {
    const action = legacyBeastSpecialAction(option.name)
    if (action) semantic.beastSpecialAction = action
    const targetPoolId = legacyBeastSpecialTargetPoolId(option)
    if (targetPoolId) semantic.beastEvolutionTargetPoolId = targetPoolId
  }
  if (role === 'beast-timeline-event') {
    const spec = BEAST_TIMELINE_EVENT_SPECS.find((candidate) => candidate.title === pool.name)
    if (spec) {
      semantic.beastTimelineEventId = spec.eventId
      if (spec.atTangAge != null) semantic.beastTimelineAtTangAge = spec.atTangAge
      if (spec.afterYears != null) semantic.beastTimelineAfterYears = spec.afterYears
      if (spec.era != null) semantic.beastTimelineEra = spec.era
      if (spec.speciesGroup != null) semantic.beastTimelineSpeciesGroup = spec.speciesGroup
    }
  }
  if (role === 'beast-tribulation') {
    const outcome = legacyBeastTribulationOutcome(pool, option)
    semantic.tribulationOutcome = outcome
    semantic.tribulationSuccess = outcome === 'success' || outcome === 'ascended'
  }
  if (role === 'god-tier' || role === 'god-deity' || role === 'god-reward') {
    const tier = legacyGodTier(`${pool.name} ${option.name}`)
    if (tier) {
      semantic.godTier = tier
      semantic.godTrialTotal = godTrialTotal(tier)
    }
    if (role === 'god-deity' && tier) {
      semantic.godDeityEntityId = legacyGodDeityEntityId(pool, option)
      if (/海神/.test(option.name)) semantic.seaGodInheritanceDeity = true
    }
    if (role === 'god-reward') {
      const exam = legacyGodRewardExam(pool.name)
      const requiredLevel = legacyGodRewardRequiredLevel(pool.name)
      if (exam != null) semantic.godRewardExam = exam
      if (requiredLevel != null) semantic.requiredLevel = requiredLevel
    }
  }
  return semantic
}

function legacyGodTier(value: string): LegacyGodTier | undefined {
  if (/神王/.test(value)) return 'king'
  if (/一级/.test(value)) return 'first'
  if (/二级/.test(value)) return 'second'
  if (/三级/.test(value)) return 'third'
  return undefined
}

function legacyGodEntry(pool: LegacyPool, option: LegacyOption, role: LegacyFlowRole): 'general' | 'ninety-nine' | 'self-created' | undefined {
  if (role === 'special-talent' && /神明转世/.test(option.name)) return 'general'
  if (role === 'special-growth') {
    if (/自创神位/.test(option.name)) return 'self-created'
    if (/获得神考/.test(option.name)) return /99级限定.*二级或三级/.test(option.name) ? 'ninety-nine' : 'general'
  }
  return role === 'god-tier' && pool.name === '自创神位剧情' ? 'self-created' : undefined
}

function legacyBeastTribulationOutcome(
  pool: LegacyPool,
  option: LegacyOption,
): 'success' | 'ascended' | 'survived' | 'failed' {
  if (!pool.name.startsWith('百万年神劫池')) {
    return /成功|渡过|突破/.test(option.name) ? 'success' : 'failed'
  }
  if (/自创兽神神位/.test(option.name)) return 'ascended'
  if (/^是/.test(option.name)) return 'survived'
  return 'failed'
}

function godTrialTotal(tier: LegacyGodTier) {
  return tier === 'third' ? 7 : tier === 'second' ? 8 : 9
}

function legacyGodRewardExam(title: string) {
  const match = title.match(/第([一二三四五六七八九])考奖励/)
  return match ? '一二三四五六七八九'.indexOf(match[1]!) + 1 : undefined
}

function legacyGodRewardRequiredLevel(title: string) {
  const match = title.match(/要求(\d+)级|要求(\d+)级以上/)
  return match ? Number(match[1] ?? match[2]) : undefined
}

function legacySeaGodGrade(value: string): LegacySeaGodGrade | undefined {
  if (/海神九考/.test(value)) return 'sea-god'
  if (/顶级/.test(value)) return 'top'
  if (/黑级/.test(value)) return 'black'
  if (/紫级/.test(value)) return 'purple'
  if (/黄级/.test(value)) return 'yellow'
  return undefined
}

function legacySeaGodTotal(value: string) {
  const match = value.match(/([一二三四五六七八九])考/)
  return match ? chineseNumber(match[1]!) : undefined
}

function legacySeaGodPlanCompleted(value: string) {
  const match = value.match(/完成([一二三四五六七八九])考/)
  return match ? chineseNumber(match[1]!) : undefined
}

function legacySeaGodRewardExam(value: string) {
  const match = value.match(/第([一二三四五六七八九])考奖励/)
  return match ? chineseNumber(match[1]!) : undefined
}

function chineseNumber(value: string): number {
  const map: Readonly<Record<string, number>> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  return map[value] ?? Number(value)
}

function chineseMagnitude(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  const tens = value.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/)
  if (tens?.[1]) return chineseNumber(tens[1]) * 10 + (tens[2] ? chineseNumber(tens[2]) : 0)
  return chineseNumber(value)
}

function legacyFlowRole(pool: LegacyPool, tags: readonly string[]): LegacyFlowRole {
  if (pool.id.startsWith('virtual.faction-story.')) return 'faction-story'
  const exact: Readonly<Record<string, LegacyFlowRole>> = {
    '基础设定1:你的种族是？': 'setup-race',
    '基础设定2:穿越的时间线': 'setup-timeline',
    '基础设定3:你的性别是？': 'setup-gender',
    '基础设定4:容貌（B级以下无法恋爱）': 'setup-appearance',
    '基础设定5:武魂天赋': 'setup-martial-type',
    '基础设定6:是否拥有特殊天赋': 'setup-special-chance',
    '基础设定7:你的年龄': 'setup-age',
    '基础设定8:穿越时期': 'setup-period',
    '特殊天赋': 'special-talent',
    '基础设定1:魂兽穿越时期': 'beast-period',
    '基础设定2:魂兽性别': 'beast-gender',
    '基础设定3:你是什么级别的魂兽': 'beast-realm',
    '基础设定4:你是什么类型的魂兽': 'beast-type',
    '基础设定5:你的生存区域（海魂兽默认大海无需抽取该池）': 'beast-area',
    '基础设定6:十万年魂兽路线分歧点（初始十万年魂兽或万年魂兽成功经历十万年雷劫后可选该池）': 'beast-route',
    '是否获得杀神领域': 'domain',
    '是否进入杀戮之都（角色在16岁~22岁限定事件，未满足年龄不能抽取）': 'killing-city',
    '完整领域池子': 'domain',
    '神考池子': 'god-tier',
    '99级神考触发': 'god-tier',
    '自创神位剧情': 'god-tier',
    '神王考核抽取池（神王神位一共9考）': 'god-deity',
    '获得的海神考核是（选择完后请先选择“在海神岛五年你将完成几考”后，再选择神考奖励）': 'sea-god-tier',
    '在海神岛的5年内你将完成几考': 'sea-god-plan',
  }
  const direct = exact[pool.name]
  if (direct) return direct
  if (MARTIAL_SOUL_POOL_NAMES.has(pool.name)) return 'martial-soul'
  if (tags.includes('初始等级or先天魂力池')) return 'initial-power'
  if (tags.includes('魂骨抽取池')) return /^是否获得/.test(pool.name) ? 'soul-bone-chance' : 'soul-bone'
  if (tags.includes('魂环吸收')) return /什么类型的魂兽/.test(pool.name) ? 'ring-species' : /得到的成长/.test(pool.name) ? 'ring-bonus' : 'soul-ring'
  // These original pools are level-band progression, despite sharing the
  // generic time-jump tag with age-based growth and encounters.
  if (/^\d+年后，你的成长（\d+-\d+级/.test(pool.name)) return 'human-time'
  if (tags.includes('时间跳跃')) return 'human-time'
  if (tags.includes('特殊成长经历')) return /^是否获得/.test(pool.name) ? 'special-growth-chance' : 'special-growth'
  if (tags.includes('选择势力')) return 'faction'
  if (tags.includes('海神考核奖励池子')) return 'sea-god-reward'
  if (tags.includes('神考抽取池')) return /抽取池（.*神一共/.test(pool.name) ? 'god-deity' : /考奖励/.test(pool.name) ? 'god-reward' : 'god-tier'
  if (tags.includes('完整领域抽取池')) return 'domain'
  if (tags.includes('杀戮之都')) return 'killing-city'
  if (tags.includes('三舞献祭事件')) return 'sacrifice'
  if (tags.some((tag) => /^《斗罗大陆》剧情/.test(tag))) return 'story'
  if (tags.includes('魂兽基础设定')) return 'beast-species'
  if (tags.includes('魂兽种类初始池')) return 'beast-species'
  if (tags.includes('魂兽特殊成长经历')) return /^是否获得/.test(pool.name) ? 'beast-special-growth-chance' : 'beast-special-growth'
  if (tags.includes('魂兽剧情《斗罗大陆》')) return 'beast-timeline-event'
  if (tags.includes('魂兽雷劫池')) return /^成就兽神神位后的选择/.test(pool.name) ? 'beast-god-choice' : 'beast-tribulation'
  if (tags.includes('魂兽进化池')) return 'beast-evolution'
  // Both original growth and encounter pools carry a generic 魂兽 tag.
  // Classify the more specific time-jump tag first so growth keeps its
  // advancement signal instead of being misrouted as an encounter.
  if (tags.includes('魂兽时间跳跃')) return /遭遇/.test(pool.name) ? 'beast-encounter' : 'beast-growth'
  if (tags.some((tag) => tag.includes('魂兽'))) return 'beast-encounter'
  return 'human-encounter'
}

function legacyRoleForSourcePool(pool: LegacyPool): LegacyFlowRole {
  const tags = pool.tags.flatMap((tagId) => tagById.get(tagId)?.name ? [tagById.get(tagId)!.name] : [])
  return legacyFlowRole(pool, tags)
}

function legacyFlowRoute(role: LegacyFlowRole, tags: readonly string[]): LegacyFlowRoute {
  if (role.startsWith('beast-') || tags.some((tag) => tag.includes('魂兽'))) return 'beast'
  if (role === 'setup-race') return 'shared'
  return 'human'
}

function legacyFlowTrigger(role: LegacyFlowRole): string {
  const triggers: Readonly<Record<LegacyFlowRole, string>> = {
    'setup-race': 'run.start:random', 'setup-timeline': 'setup.race:selected', 'setup-gender': 'run.start:human|beast-transform',
    'setup-appearance': 'setup.gender:selected', 'setup-martial-type': 'setup.appearance:selected', 'setup-special-chance': 'setup.martial-soul:selected',
    'setup-age': 'setup.special-talent:resolved', 'setup-period': 'setup.age:selected', 'martial-soul': 'setup.martial-type:selected',
    'special-talent': 'setup.special-chance:yes', 'initial-power': 'setup.period:selected', 'soul-ring': 'progression.level:threshold',
    'ring-species': 'soul-ring:selected', 'ring-bonus': 'soul-ring:selected', 'human-time': 'human.progression:idle',
    'special-growth-chance': 'human-time:selected', 'special-growth': 'special-growth-chance:yes', 'faction': 'setup.period:selected|age-threshold',
    'faction-story': 'human.progression:faction-story-checkpoint',
    'soul-bone-chance': 'soul-ring:selected', 'soul-bone': 'soul-bone-chance:yes|soul-ring:selected',
    'sea-god-tier': 'sea-god-island:selected', 'sea-god-plan': 'sea-god-tier:selected', 'sea-god-reward': 'sea-god-plan:selected',
    'god-tier': 'progression.god-trigger', 'god-deity': 'god-tier:selected', 'god-reward': 'god-trial.level-threshold',
    'domain': 'growth.reward|killing-city:success', 'killing-city': 'human.age:16-22', 'sacrifice': 'story.milestone',
    'story': 'human.story-milestone', 'beast-period': 'run.start:beast', 'beast-gender': 'beast.period:selected',
    'beast-realm': 'beast.gender:selected', 'beast-type': 'beast.realm:selected', 'beast-species': 'beast.type:selected|ring-species:selected',
    'beast-area': 'beast.type:selected', 'beast-route': 'beast.cultivation:100000', 'beast-growth': 'beast.progression:idle',
    'beast-encounter': 'beast.growth:selected', 'beast-timeline-event': 'beast.timeline:milestone',
    'beast-special-growth-chance': 'beast.evolution:completed', 'beast-special-growth': 'beast.special-growth:accepted',
    'beast-tribulation': 'beast.threshold:reached', 'beast-god-choice': 'beast.godhood:created', 'beast-evolution': 'beast.tribulation:success',
    'human-encounter': 'human-time:selected|story.branch',
  }
  return triggers[role]
}

function storyNumberFromTitle(title: string): number | null {
  const match = title.match(/^剧情(\d+(?:\.\d+)?)/)
  return match?.[1] ? Number(match[1]) : null
}

function createCatalogDecisions(decisions: readonly LegacyPool[]): LegacyPool[] {
  return decisions.map((pool) => {
    const corrected = pool.name === '基础设定8:穿越时期'
      ? { ...pool, options: pool.options.map((option) => option.name === '唐三6岁' ? { ...option, weight: 20 } : option) }
      : pool
    const additions: Array<{ readonly name: string; readonly weight?: number }> = [
      ...(CANONICAL_POOL_ADDITIONS[corrected.name] ?? []).map((name) => ({ name })),
      ...(ANIME_EXPANDED_MARTIAL_SOULS[corrected.name] ?? []).map((name) => ({ name })),
      ...(corrected.name === '兽武魂' ? CROSSOVER_BEAST_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(corrected.name === '本体武魂' ? CROSSOVER_BODY_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(corrected.name === '器武魂' ? FIREARM_MARTIAL_SOULS : []),
    ]
    if (additions.length === 0) return corrected
    const existingNames = new Set(corrected.options.map((option) => option.name))
    const appended = additions
      .filter((option) => !existingNames.has(option.name))
      .map((option) => ({
        id: `canon.${shortHash(corrected.name)}.${shortHash(option.name)}`,
        name: option.name,
        ...(option.weight == null ? {} : { weight: option.weight }),
      }))
    return appended.length ? { ...corrected, options: [...corrected.options, ...appended] } : corrected
  })
}

function createMartialSoulRules(pools: readonly LegacyPool[]) {
  const rules = new Map<string, { readonly entityId: string; readonly title: string; readonly tier: number; readonly types: readonly string[]; readonly attributes: readonly string[] }>()
  for (const pool of pools) {
    if (!MARTIAL_SOUL_POOL_NAMES.has(pool.name)) continue
    for (const option of pool.options) {
      const current = rules.get(option.name)
      const type = MARTIAL_SOUL_TYPE_BY_POOL[pool.name]!
      const types = [...new Set([...(current?.types ?? []), type])]
      const attributes = current?.attributes ?? MARTIAL_SOUL_ATTRIBUTES.filter(([, matcher]) => matcher.test(option.name)).map(([attribute]) => attribute)
      rules.set(option.name, {
        entityId: current?.entityId ?? martialSoulEntityId(option.name),
        title: option.name,
        tier: current?.tier ?? getMartialSoulTier(option.name),
        types,
        attributes,
      })
    }
  }
  return [...rules.values()]
}

function createMartialSoulCategories(catalog: readonly LegacyPool[]): readonly CategorizedMartialSoul[] {
  const pool = (name: string) => {
    const found = catalog.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`Required original pool is missing: ${name}`)
    return found
  }
  const categorize = (
    kind: 'beast' | 'tool',
    sourcePool: LegacyPool,
    categories: readonly string[],
    classify: (option: LegacyOption) => string,
  ) => {
    const groups = new Map(categories.map((category) => [category, [] as LegacyOption[]]))
    for (const option of sourcePool.options) groups.get(classify(option))?.push(option)
    return categories
      .map((category) => ({ kind, category, options: groups.get(category) ?? [] }))
      .filter((entry) => entry.options.length > 0)
  }
  return [
    ...categorize('beast', pool('兽武魂'), BEAST_MARTIAL_SOUL_CATEGORIES, classifyBeastMartialSoul),
    ...categorize('tool', pool('器武魂'), TOOL_MARTIAL_SOUL_CATEGORIES, classifyToolMartialSoul),
  ]
}

function createVirtualPools(catalog: readonly LegacyPool[], categories: readonly CategorizedMartialSoul[]): LegacyPool[] {
  const pool = (name: string) => {
    const found = catalog.find((candidate) => candidate.name === name)
    if (!found) throw new Error(`Required original pool is missing: ${name}`)
    return found
  }
  const beastSource = pool('兽武魂')
  const toolSource = pool('器武魂')
  const growthSource = pool('特殊成长经历')
  const shrekStorySource = pool('剧情1:是否参与入学剧情（史莱克学院限定）（唐三12岁限定）')
  const factionSource = pool('人物背景or加入的势力（6岁限定）')

  const beastPools = categorizedMartialSoulPools('beast', beastSource, categories.filter((entry) => entry.kind === 'beast'), beastMartialSoulPoolName)
  const toolPools = categorizedMartialSoulPools('tool', toolSource, categories.filter((entry) => entry.kind === 'tool'), toolMartialSoulPoolName)
  const firearmMartialSouls = FIREARM_MARTIAL_SOULS.map((option) => martialSoulEntityId(option.name))
  const firearmRequirement = { type: 'any', items: firearmMartialSouls.map((entityId) => ({ type: 'contains', fact: 'actor.martial-souls', value: entityId })) }
  const mentorRequirement = { type: 'contains', fact: 'actor.traits', value: traitEntityId(SHREK_MENTOR_TRAIT) }
  traitLabels.add(SHREK_MENTOR_TRAIT)

  const staticPools: LegacyPool[] = [
    {
      id: 'virtual.firearm-story',
      name: FIREARM_STORY_POOL_NAME,
      description: '仅枪械类武魂可触发的特殊成长剧情，侧重越级击杀、火力压制与魂导改造。',
      tags: growthSource.tags,
      options: FIREARM_STORY_OPTIONS.map((option, index) => ({
        id: `virtual.firearm-story.${index + 1}`,
        ...option,
        availableWhen: firearmRequirement,
      })),
    },
    {
      id: 'virtual.shrek-mentor.entry',
      name: SHREK_MENTOR_ENTRY_POOL_NAME,
      description: '超过学院大赛参赛年龄的角色，以客卿导师而非学员身份介入史莱克剧情。',
      tags: shrekStorySource.tags,
      options: SHREK_MENTOR_ENTRY_OPTIONS.map((option, index) => ({
        id: `virtual.shrek-mentor.entry.${index + 1}`,
        ...option,
        requirements: { minAge: 25, ...(index === 1 || index === 2 ? { minLevel: 40 } : {}) },
        ...(index < 3 ? { additionalEffects: [{ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(SHREK_MENTOR_TRAIT) }] } : {}),
      })),
    },
    {
      id: 'virtual.shrek-mentor.tournament',
      name: SHREK_MENTOR_TOURNAMENT_POOL_NAME,
      description: '导师只负责教学、带队和保护学员，不占用学院大赛参赛名额。',
      tags: shrekStorySource.tags,
      options: SHREK_MENTOR_TOURNAMENT_OPTIONS.map((option, index) => ({
        id: `virtual.shrek-mentor.tournament.${index + 1}`,
        ...option,
        requirements: { minAge: 25 },
        availableWhen: mentorRequirement,
      })),
    },
    {
      id: 'virtual.shrek-mentor.reunion',
      name: SHREK_MENTOR_REUNION_POOL_NAME,
      description: '七怪重聚阶段沿用导师身份，不重新回到学员或八怪成员位置。',
      tags: shrekStorySource.tags,
      options: SHREK_MENTOR_REUNION_OPTIONS.map((option, index) => ({
        id: `virtual.shrek-mentor.reunion.${index + 1}`,
        ...option,
        requirements: { minAge: 25 },
        availableWhen: mentorRequirement,
      })),
    },
    ...FACTION_STORY_DEFINITIONS.map((definition) => ({
        id: `virtual.faction-story.${definition.id}`,
        name: definition.poolName,
        description: definition.description,
        tags: factionSource.tags,
        options: definition.options.map((option, index) => ({
          id: `virtual.faction-story.${definition.id}.${index + 1}`,
          ...option,
        })),
      })),
  ]
  return [...beastPools, ...toolPools, ...staticPools]
}

function categorizedMartialSoulPools(
  kind: 'beast' | 'tool',
  sourcePool: LegacyPool,
  entries: readonly CategorizedMartialSoul[],
  poolName: (category: string) => string,
): LegacyPool[] {
  return [
    {
      id: `virtual.martial-soul.${kind}.category`,
      name: kind === 'beast' ? '兽武魂分类' : '器武魂分类',
      description: `先抽取${kind === 'beast' ? '兽' : '器'}武魂大类，再进入对应子转盘抽取具体武魂。`,
      tags: sourcePool.tags,
      options: entries.map(({ category, options }) => ({
        id: `virtual.martial-soul.${kind}.category.${shortHash(category)}`,
        name: category,
        weight: options.length,
      })),
    },
    ...entries.map(({ category, options }) => ({
      id: `virtual.martial-soul.${kind}.${shortHash(category)}`,
      name: poolName(category),
      description: `${kind === 'beast' ? '兽' : '器'}武魂分类子池：${category}`,
      tags: sourcePool.tags,
      options: options.map((option) => ({
        ...option,
        id: `virtual.martial-soul.${kind}.${shortHash(category)}.${option.id}`,
        martialSoul: true,
      })),
    })),
  ]
}

function legacyProcessEffects(pool: LegacyPool, option: LegacyOption): Array<Record<string, unknown>> {
  const tags = pool.tags.flatMap((tagId) => tagById.get(tagId)?.name ? [tagById.get(tagId)!.name] : [])
  const role = legacyFlowRole(pool, tags)
  const effects: Array<Record<string, unknown>> = []
  const emit = (signalId: string, payload?: Record<string, unknown>) => effects.push({
    type: 'signal.emit', signalId, ...(payload ? { payload } : {}),
  })
  const change = (stat: string, delta: number) => effects.push(statChange(stat, delta))
  const godEntry = legacyGodEntry(pool, option, role)

  if (role === 'human-encounter' || role === 'beast-encounter' || role === 'beast-timeline-event' || role === 'story' || role === 'sacrifice') {
    for (const kind of legacyStoryMetrics(option.name)) emit('signal.story.metric-recorded', { kind })
  }
  if (pool.name === SEA_GOD_TRAINING_POOL_TITLE) emit('signal.god-trial.training-completed')
  if (/成为海神岛魂兽供奉/.test(option.name)) {
    traitLabels.add(SEA_GOD_ISLAND_BEAST_WORSHIPPER_TRAIT)
    effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(SEA_GOD_ISLAND_BEAST_WORSHIPPER_TRAIT) })
  }
  if (/血脉精炼/.test(option.name)) emit('signal.beast.bloodline-refinement-selected')

  switch (role) {
    case 'setup-race':
      emit('signal.setup.race-selected')
      break
    case 'setup-gender': {
      const gender = legacyGender(option.name)
      if (gender) effects.push({ type: 'entity.grant', entityType: 'gender', entityId: `entity.gender.${gender}` })
      emit('signal.setup.gender-selected')
      break
    }
    case 'setup-appearance':
      emit('signal.setup.appearance-selected')
      break
    case 'setup-martial-type': {
      const martialType = MARTIAL_SOUL_TYPE_BY_POOL[option.name]
      if (martialType) effects.push({ type: 'entity.grant', entityType: 'martial-soul-type', entityId: `entity.martial-type.${martialType}` })
      emit('signal.setup.martial-type-selected')
      break
    }
    case 'setup-special-chance':
      emit('signal.setup.special-chance-selected', { accepted: legacyAffirmative(option.name) })
      break
    case 'special-talent':
      talentLabels.add(option.name)
      effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(`talent:${option.name}`) })
      emit('signal.setup.special-talent-selected')
      if (godEntry) emit('signal.god-trial-entry-selected', { entry: godEntry })
      break
    case 'setup-age':
      change('age', legacyFirstNumber(option.name, 6))
      emit('signal.setup.age-selected')
      break
    case 'setup-period':
      effects.push({ type: 'time.advance', years: { type: 'constant', value: legacyTangAge(option.name) } })
      emit('signal.setup.period-selected')
      break
    case 'setup-timeline': {
      const era = legacyTimelineEra(option.name)
      traitLabels.add(`timeline:${era}`)
      effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(`timeline:${era}`) })
      emit('signal.setup.timeline-selected')
      break
    }
    case 'initial-power':
      change('level', Math.max(1, legacyInitialLevel(option.name)) - 1)
      emit('signal.setup.initial-power-selected')
      break
    case 'faction':
      if (!pool.id.startsWith('virtual.')) {
        effects.push({ type: 'entity.grant', entityType: 'faction', entityId: legacyFactionEntityId(pool, option) })
        emit('signal.setup.faction-selected')
      }
      break
    case 'faction-story':
      emit('signal.story.completed')
      break
    case 'human-time': {
      const years = legacyFirstNumber(pool.name, 2)
      change('age', years)
      effects.push({ type: 'time.advance', years: { type: 'constant', value: years } })
      emit('signal.human.growth-completed')
      break
    }
    case 'soul-ring':
      emit('signal.soul-ring.selected')
      break
    case 'soul-bone-chance':
      emit('signal.soul-bone-chance-selected', { accepted: legacyAffirmative(option.name) })
      break
    case 'special-growth-chance':
      emit('signal.special-growth-chance-selected', { accepted: legacyAffirmative(option.name) })
      break
    case 'special-growth':
      if (godEntry) emit('signal.god-trial-entry-selected', { entry: godEntry })
      break
    case 'killing-city':
      emit('signal.killing-city-selected', { accepted: legacyAffirmative(option.name) })
      break
    case 'sea-god-tier': {
      const grade = legacySeaGodGrade(option.name)
      const total = legacySeaGodTotal(option.name)
      if (grade && total != null) emit('signal.sea-god-tier-selected', { grade, total })
      break
    }
    case 'sea-god-plan': {
      const completed = legacySeaGodPlanCompleted(option.name)
      emit('signal.sea-god-plan-selected', {
        failed: /失败|驱逐/.test(option.name),
        all: /全部完成/.test(option.name),
        ...(completed == null ? {} : { completed }),
      })
      break
    }
    case 'sea-god-reward':
      if (/是否在神战前完成你还剩下的考核/.test(pool.name)) {
        emit('signal.sea-god-completion-gate-selected', { accepted: legacyAffirmative(option.name) })
      } else {
        emit('signal.sea-god-reward-completed')
      }
      break
    case 'soul-bone':
      effects.push({ type: 'entity.grant', entityType: 'soul-bone', entityId: legacySoulBoneEntityId(pool, option) })
      break
    case 'beast-type':
      effects.push({ type: 'entity.grant', entityType: 'beast-type', entityId: legacyBeastTypeEntityId(pool, option) })
      emit('signal.beast.type-selected')
      break
    case 'beast-species':
      effects.push(
        { type: 'entity.grant', entityType: 'beast-species', entityId: legacyBeastSpeciesEntityId(pool, option) },
        { type: 'entity.grant', entityType: 'beast-bloodline', entityId: legacyBeastBloodlineEntityId(pool, option) },
      )
      if (/路边/.test(option.name)) {
        traitLabels.add(ROADSIDE_BEAST_TRAIT)
        effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(ROADSIDE_BEAST_TRAIT) })
      }
      emit('signal.beast.species-selected')
      break
    case 'beast-area':
      effects.push({ type: 'entity.grant', entityType: 'beast-area', entityId: legacyBeastAreaEntityId(pool, option) })
      emit('signal.beast.area-selected')
      break
    case 'beast-route':
      emit(/化形/.test(option.name) ? 'signal.beast.transform' : 'signal.beast.remain')
      break
    case 'beast-tribulation':
      switch (legacyBeastTribulationOutcome(pool, option)) {
        case 'success':
        case 'ascended':
          emit('signal.beast.tribulation-success')
          break
        case 'survived':
          emit('signal.beast.tribulation-survived')
          break
        case 'failed':
          emit('signal.beast.tribulation-failed')
          break
      }
      break
    case 'beast-god-choice':
      emit('signal.beast.god-choice-selected')
      break
    case 'beast-special-growth-chance':
      emit('signal.beast.special-growth-chance-selected', { accepted: legacyAffirmative(option.name) })
      break
    case 'beast-special-growth': {
      const action = legacyBeastSpecialAction(option.name)
      const targetPoolId = legacyBeastSpecialTargetPoolId(option)
      const element = legacyBeastElement(option.name)
      if (element) registerBeastElementTraits(element)
      emit('signal.beast.special-growth-selected', {
        ...(action ? { action } : {}),
        ...(targetPoolId ? { targetPoolId } : {}),
      })
      break
    }
    case 'beast-evolution': {
      const element = legacyBeastElement(option.name)
      if (element) registerBeastElementTraits(element)
      emit('signal.beast.evolution-completed')
      break
    }
    case 'god-tier': {
      if (godEntry === 'self-created') {
        emit('signal.god-self-created-selected')
        break
      }
      const tier = legacyGodTier(`${pool.name} ${option.name}`)
      if (tier) emit('signal.god-tier-selected', { tier, total: godTrialTotal(tier) })
      break
    }
    case 'god-deity': {
      const tier = legacyGodTier(pool.name)
      if (tier) emit('signal.god-deity-selected', {
        tier,
        total: godTrialTotal(tier),
        deityId: legacyGodDeityEntityId(pool, option),
      })
      break
    }
    case 'god-reward':
      emit('signal.god-trial.exam-completed')
      break
    case 'story':
      if (pool.name === '剧情16:七怪打算前往海神岛，你是否前往（唐三21岁限定）') {
        emit('signal.sea-god-island-selected', { accepted: /^(?:是，)?前往海神岛/.test(option.name) })
      }
      emit('signal.story.completed')
      break
    case 'beast-period':
      traitLabels.add(`timeline:${legacyTimelineEra(option.name)}`)
      effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(`timeline:${legacyTimelineEra(option.name)}`) })
      effects.push({ type: 'time.advance', years: { type: 'constant', value: legacyTangAge(option.name) } })
      emit('signal.beast.period-selected')
      break
    case 'beast-gender': {
      const gender = legacyGender(option.name)
      if (gender) effects.push({ type: 'entity.grant', entityType: 'gender', entityId: `entity.gender.${gender}` })
      emit('signal.beast.gender-selected')
      break
    }
    case 'beast-realm':
      change('beast-cultivation', legacyCultivation(option.name))
      emit('signal.beast.realm-selected')
      break
    case 'beast-growth':
      effects.push({ type: 'time.advance', years: { type: 'constant', value: 10 } })
      emit('signal.beast.growth-completed')
      break
    default:
      break
  }
  return effects
}

function legacyGender(title: string): 'male' | 'female' | 'none' | null {
  if (/^(男|雄性)/.test(title)) return 'male'
  if (/^(女|雌性)/.test(title)) return 'female'
  if (/无性别/.test(title)) return 'none'
  return null
}

function legacyStoryMetrics(title: string): readonly ('negative' | 'combat')[] {
  const metrics: Array<'negative' | 'combat'> = []
  if (/战死|死亡|被(?:击杀|斩杀|杀死|击败|秒杀|围攻|吞噬|吃得)|重伤|落败|战败|失败|濒死/.test(title)) metrics.push('negative')
  if (/战斗|战胜|击杀|斩杀|对战|单挑|围攻|反杀|获胜|战败|击败/.test(title)) metrics.push('combat')
  return metrics
}

function legacyAffirmative(title: string) { return /^(是|拥有|获得)/.test(title) }

function legacyFirstNumber(title: string, fallback: number) {
  const match = title.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : fallback
}

function legacyTangAge(title: string) {
  const value = legacyFirstNumber(title, 0)
  return /出生前|之前/.test(title) ? -value : value
}

function legacyRingIndex(title: string) {
  const match = title.match(/第([一二三四五六七八九])魂环/)
  return match ? '一二三四五六七八九'.indexOf(match[1]!) + 1 : undefined
}

function legacySoulBoneChanceYears(title: string) {
  if (/十年魂骨/.test(title)) return 10
  if (/百年魂骨/.test(title)) return 100
  if (/千年魂骨/.test(title)) return 1_000
  if (/万年魂骨/.test(title)) return 10_000
  return undefined
}

function legacyAuxiliaryKind(pool: LegacyPool, role: LegacyFlowRole) {
  if (role === 'special-growth-chance' || role === 'special-growth') return /封号斗罗/.test(pool.name) ? 'titled' : 'standard'
  if (role === 'domain') return /杀神/.test(pool.name) ? 'killing-city' : 'complete-domain'
  return undefined
}

function legacyTimelineEra(title: string) {
  if (/绝世唐门/.test(title)) return 'd2'
  if (/龙王传说/.test(title)) return 'd3'
  if (/海神/.test(title)) return 'sea-god'
  if (/天使/.test(title)) return 'angel-god'
  return 'd1'
}

function legacyBeastKind(title: string) {
  if (title === '海魂兽') return 'sea'
  if (/纯血龙/.test(title)) return 'pure-dragon'
  if (/亚龙|地龙/.test(title)) return 'sub-dragon'
  if (/龙/.test(title)) return 'dragon'
  return 'other'
}

function legacyBeastAreaKind(title: string) {
  if (/星斗/.test(title)) return 'star-dou'
  if (/极北/.test(title)) return 'north'
  if (/猎魂/.test(title)) return 'hunting-forest'
  if (/海/.test(title)) return 'ocean'
  return 'other'
}

function legacyBeastEvolutionKind(title: string) {
  if (/^力量方向/.test(title)) return 'strength'
  if (/^精神力方向/.test(title)) return 'mind'
  if (/^体型方向/.test(title)) return 'body'
  if (/^防御方向/.test(title)) return 'defense'
  if (/^速度方向/.test(title)) return 'speed'
  return undefined
}

function legacyBeastElement(title: string) {
  return BEAST_ELEMENT_BY_TITLE[title]
}

function registerBeastElementTraits(element: string) {
  traitLabels.add(`element:${element}`)
  traitLabels.add(`extreme-element:${element}`)
  traitLabels.add(`law-seed:${element}`)
  traitLabels.add(`law:${element}`)
}

function legacyBeastSpeciesGroup(poolTitle: string) {
  if (/兔子/.test(poolTitle)) return 'rabbit'
  if (/海魂兽/.test(poolTitle)) return 'sea'
  if (/纯血龙/.test(poolTitle)) return 'pure-dragon'
  if (/亚龙|地龙/.test(poolTitle)) return 'sub-dragon'
  return 'other'
}

function legacySourcePoolId(title: string) {
  const pool = source.decisions.find((candidate) => candidate.name === title)
  return pool ? `pool.legacy.${pool.id}` : undefined
}

function legacyBeastEvolutionAction(pool: LegacyPool, option: LegacyOption): 'elemental' | 'bloodline' | 'native-bloodline' | undefined {
  if (pool.name !== '魂兽进化方向选择（十年进阶百年，百年进阶千年，千年进阶万年，万年成功进阶十万年，或十万年魂兽每成功经历雷劫可抽取该池）') return undefined
  if (/属性变异/.test(option.name)) return 'elemental'
  if (/血脉变异/.test(option.name)) return 'bloodline'
  if (/血脉提纯/.test(option.name)) return 'native-bloodline'
  return undefined
}

function legacyBeastEvolutionTargetPoolId(pool: LegacyPool, option: LegacyOption) {
  const action = legacyBeastEvolutionAction(pool, option)
  if (action === 'elemental') return legacySourcePoolId('魂兽元素进化抽取池（连续2次抽取到同元素进化为极致属性，3次为法则雏形，4次为完整法则，4次之后无效则重抽）')
  if (action === 'bloodline') return legacySourcePoolId('魂兽血脉融合抽取池（抽完后请进入对应血脉的初始抽取池进行抽取需融合的血脉）（本体血脉固定占50%，其余血脉均分剩下的50%）')
  if (pool.name === '魂兽血脉融合抽取池（抽完后请进入对应血脉的初始抽取池进行抽取需融合的血脉）（本体血脉固定占50%，其余血脉均分剩下的50%）'
    || pool.name === '三龙血脉融合池（本体为纯血龙发生血脉融合才可进入该池，特殊遭遇可以强行让其他兽融合）（本体占50%其余血脉均分50%）') {
    const speciesPool = BEAST_SPECIES_POOL_BY_FUSION[option.name]
    return speciesPool ? legacySourcePoolId(speciesPool) : undefined
  }
  return undefined
}

function legacyBeastSpecialAction(title: string): 'evolution' | 'elemental' | 'bloodline' | 'native-bloodline' | 'dragon-bloodline' | 'domain' | undefined {
  if (/额外获得一次进化方向选择|吃下仙草/.test(title)) return 'evolution'
  if (/额外获得一次元素进化/.test(title)) return 'elemental'
  if (/额外获得一次血脉融合/.test(title)) return 'bloodline'
  if (/本血脉融合/.test(title)) return 'native-bloodline'
  if (/龙族血脉/.test(title)) return 'dragon-bloodline'
  if (/获得完整领域/.test(title)) return 'domain'
  return undefined
}

function legacyBeastSpecialTargetPoolId(option: LegacyOption) {
  const action = legacyBeastSpecialAction(option.name)
  if (action === 'evolution') return legacySourcePoolId('魂兽进化方向选择（十年进阶百年，百年进阶千年，千年进阶万年，万年成功进阶十万年，或十万年魂兽每成功经历雷劫可抽取该池）')
  if (action === 'elemental') return legacySourcePoolId('魂兽元素进化抽取池（连续2次抽取到同元素进化为极致属性，3次为法则雏形，4次为完整法则，4次之后无效则重抽）')
  if (action === 'bloodline') return legacySourcePoolId('魂兽血脉融合抽取池（抽完后请进入对应血脉的初始抽取池进行抽取需融合的血脉）（本体血脉固定占50%，其余血脉均分剩下的50%）')
  if (action === 'dragon-bloodline') return legacySourcePoolId('三龙血脉融合池（本体为纯血龙发生血脉融合才可进入该池，特殊遭遇可以强行让其他兽融合）（本体占50%其余血脉均分50%）')
  return undefined
}

function legacyInitialLevel(title: string) {
  if (/无魂力/.test(title)) return 1
  return legacyFirstNumber(title, 1)
}

function legacyCultivation(title: string) {
  const value = legacyFirstNumber(title, 10)
  if (/百万/.test(title)) return value * 1_000_000
  if (/十万/.test(title) && value <= 10) return value * 100_000
  if (/万年|万修为|万级/.test(title)) return value * 10_000
  if (/千年/.test(title)) return value * 1_000
  if (/百年/.test(title)) return value * 100
  return value
}

function migrateOption(pool: LegacyPool, option: LegacyOption) {
  const title = option.name
  const labels = labelsIn(title)
  const referencedLabels = conditionReferenceLabels(title)
  const revoked = revokedLabels(title)
  const effects: Array<Record<string, unknown>> = []

  effects.push(...legacyProcessEffects(pool, option))

  for (const label of revoked) {
    traitLabels.add(label)
    effects.push({ type: 'entity.revoke', entityType: 'trait', entityId: traitEntityId(label) })
  }
  for (const label of labels) {
    traitLabels.add(label)
    if (referencedLabels.has(label) || revoked.has(label)) continue
    effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(label) })
  }
  if (/摆脱[“"]?路边/.test(title)) {
    traitLabels.add(ROADSIDE_BEAST_TRAIT)
    effects.push({ type: 'entity.revoke', entityType: 'trait', entityId: traitEntityId(ROADSIDE_BEAST_TRAIT) })
  }

  const domain = legacyDomain(title)
  if (domain) {
    domainLabels.add(domain)
    effects.push({ type: 'entity.grant', entityType: 'domain', entityId: domainEntityId(domain) })
  }
  if (/获得领域雏形/.test(title)) {
    traitLabels.add(DOMAIN_SEED_TRAIT)
    effects.push({ type: 'entity.grant', entityType: 'trait', entityId: traitEntityId(DOMAIN_SEED_TRAIT) })
  }

  const levelDelta = signedNumber(title, /等级\s*([+-])\s*(\d+(?:\.\d+)?)/)
  if (levelDelta != null) effects.push(statChange('level', levelDelta))

  const appearanceDelta = signedNumber(title, /容貌\s*([+-])\s*(\d+(?:\.\d+)?)/)
  if (appearanceDelta != null && !/ex级?无法提升/i.test(title)) effects.push(statChange('appearance-rank', appearanceDelta))

  const cultivationDelta = signedNumber(title, /修为\s*([+-])\s*(\d+(?:\.\d+)?)(万|亿)?/)
    ?? negativeCultivation(title)
  if (cultivationDelta != null) effects.push(statChange('beast-cultivation', cultivationDelta))

  const martialSoul = option.martialSoul || MARTIAL_SOUL_POOL_NAMES.has(pool.name)
  if (martialSoul) {
    const rule = martialSoulByTitle.get(title)
    if (!rule) throw new Error(`Missing martial soul metadata for ${title}`)
    effects.push({ type: 'entity.grant', entityType: 'martial-soul', entityId: rule.entityId })
    if (MARTIAL_SOUL_POOL_NAMES.has(pool.name)) {
      effects.push({ type: 'signal.emit', signalId: 'signal.setup.martial-soul-selected' })
    }
  }

  const appearance = pool.name === '基础设定4:容貌（B级以下无法恋爱）' ? legacyAppearance(option.name) : undefined
  if (appearance) effects.push({ type: 'entity.grant', entityType: 'appearance', entityId: `entity.appearance.${appearance.id}` })

  effects.push(...(option.additionalEffects ?? []))

  if (isLegacyLethal(title)) effects.push({ type: 'run.finish', endingId: 'ending.death' })

  const availableWhen = eligibility(pool, option, labels)
  return {
    id: `option.legacy.${pool.id}.${option.id}`,
    presentation: { title },
    mechanics: {
      enabled: option.enabled !== false,
      baseWeight: positiveWeight(option.weight),
      ...(availableWhen ? { availableWhen } : {}),
      effects,
    },
  }
}

function eligibility(pool: LegacyPool, option: LegacyOption, labels: readonly string[]) {
  const title = option.name
  const predicates: Array<Record<string, unknown>> = []
  const requiredLabels = [...title.matchAll(/要求(?:拥有|有)【([^】]+)】/g)].map((match) => match[1]!).filter(Boolean)
  for (const label of requiredLabels) {
    traitLabels.add(label)
    predicates.push({ type: 'contains', fact: 'actor.traits', value: traitEntityId(label) })
  }

  if (/男性限定|要求男性/.test(title)) predicates.push({ type: 'compare', fact: 'actor.gender', op: 'eq', value: 'entity.gender.male' })
  if (/女性限定|要求女性/.test(title)) predicates.push({ type: 'compare', fact: 'actor.gender', op: 'eq', value: 'entity.gender.female' })

  const levelRange = levelRangeFrom(`${pool.name} ${title}`)
  if (levelRange.min != null) predicates.push({ type: 'compare', fact: 'actor.level', op: 'gte', value: levelRange.min })
  if (levelRange.max != null) predicates.push({ type: 'compare', fact: 'actor.level', op: 'lte', value: levelRange.max })

  const rerollLevel = title.match(/(\d+)\s*\+?\s*级?(?:以上)?\s*(?:则\s*)?(?:可以|能)?重抽/)
  if (rerollLevel?.[1]) predicates.push({ type: 'compare', fact: 'actor.level', op: 'lt', value: Number(rerollLevel[1]) })
  const requiredAgeUpperBound = title.match(/要求\s*(\d+)\s*岁以下/)
  if (requiredAgeUpperBound?.[1]) predicates.push({ type: 'compare', fact: 'actor.age', op: 'lt', value: Number(requiredAgeUpperBound[1]) })
  const requiredAgeLowerBound = title.match(/要求\s*(\d+)\s*岁以上/)
  if (requiredAgeLowerBound?.[1]) predicates.push({ type: 'compare', fact: 'actor.age', op: 'gte', value: Number(requiredAgeLowerBound[1]) })

  // A faction stage is selected by the setup/progression process.  Its pool
  // title names the stage (for example "6 岁限定"), but original execution
  // intentionally kept using that stage pool for entrants aged 7-11.  Turning
  // the title into an option predicate makes the entire original pool empty.
  const eligibilityText = legacyFlowRole(pool, pool.tags.flatMap((tagId) => tagById.get(tagId)?.name ? [tagById.get(tagId)!.name] : [])) === 'faction'
    ? title
    : `${pool.name} ${title}`
  // Canonical "唐三 N 岁" labels are task scheduling metadata. The old
  // machine schedules the matching story milestone once its time has passed,
  // then draws every queued story pool even if the exact year has elapsed.
  // They must not become a second option-level gate.
  const ageRange = ageRangeFrom(eligibilityText.replace(/唐三\s*\d+(?:\.\d+)?\s*岁/g, ''))
  if (ageRange.min != null) predicates.push({ type: 'compare', fact: 'actor.age', op: 'gte', value: ageRange.min })
  if (ageRange.max != null) predicates.push({ type: 'compare', fact: 'actor.age', op: 'lte', value: ageRange.max })

  const cultivationRange = cultivationRangeFrom(`${pool.name} ${title}`)
  if (cultivationRange.min != null) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'gte', value: cultivationRange.min })
  if (cultivationRange.max != null) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'lte', value: cultivationRange.max })

  const requirements = option.requirements
  if (requirements?.minAge != null) predicates.push({ type: 'compare', fact: 'actor.age', op: 'gte', value: requirements.minAge })
  if (requirements?.maxAge != null) predicates.push({ type: 'compare', fact: 'actor.age', op: 'lte', value: requirements.maxAge })
  if (requirements?.minLevel != null) predicates.push({ type: 'compare', fact: 'actor.level', op: 'gte', value: requirements.minLevel })
  if (requirements?.maxLevel != null) predicates.push({ type: 'compare', fact: 'actor.level', op: 'lte', value: requirements.maxLevel })
  for (const gender of requirements?.genders ?? []) {
    if (gender === '男') predicates.push({ type: 'compare', fact: 'actor.gender', op: 'eq', value: 'entity.gender.male' })
    if (gender === '女') predicates.push({ type: 'compare', fact: 'actor.gender', op: 'eq', value: 'entity.gender.female' })
  }

  for (const [pattern, type] of [
    [/极致武魂限定/, 'ultimate'], [/兽武魂限定/, 'beast'], [/器武魂限定/, 'tool'], [/本体武魂限定/, 'body'], [/概念(?:型)?武魂限定/, 'concept'],
  ] as const) {
    if (pattern.test(title)) predicates.push({ type: 'policy', policyId: 'policy.martial-soul-type', args: { type } })
  }
  const attributeRequirements: readonly [RegExp, string | readonly string[]][] = [
    [/火属性武魂限定/, 'fire'], [/水属性武魂限定/, 'water'], [/雷属性武魂限定/, 'lightning'], [/冰属性武魂限定/, 'ice'],
    [/风属性武魂限定/, 'wind'], [/光属性武魂限定/, 'light'], [/暗属性武魂限定/, 'dark'], [/生命属性武魂限定/, 'life'],
    [/毁灭属性武魂限定/, 'destruction'], [/剑类武魂限定/, 'sword'], [/刀类武魂限定/, 'blade'], [/枪类武魂限定/, 'spear'],
    [/弓类武魂限定/, 'bow'], [/龙族武魂限定/, 'dragon'], [/刀类或剑类武魂限定/, ['blade', 'sword']],
  ]
  for (const [pattern, attributes] of attributeRequirements) {
    if (!pattern.test(title)) continue
    const required = Array.isArray(attributes) ? attributes : [attributes]
    const attributePredicates = required.map((attribute) => ({ type: 'policy', policyId: 'policy.martial-soul-attribute', args: { attribute } }))
    predicates.push(attributePredicates.length === 1 ? attributePredicates[0]! : { type: 'any', items: attributePredicates })
  }

  if (/要求有神考|需要神考/.test(title)) {
    predicates.push({ type: 'compare', fact: 'god-trial.active', op: 'eq', value: true })
  }
  if (/要求[^，。]*领域|拥有[^，。]*领域/.test(title)) {
    const namedDomain = title.match(/(?:要求|拥有)[^，。]*?([\u4e00-\u9fa5]{2,}领域)/)?.[1]
    if (namedDomain) {
      domainLabels.add(namedDomain)
      predicates.push({ type: 'contains', fact: 'actor.domains', value: domainEntityId(namedDomain) })
    } else {
      predicates.push({ type: 'policy', policyId: 'policy.has-domain' })
    }
  }
  if (/B级以上容貌限定/.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.appearance-min-rank', args: { rank: 4 } })
  }
  if (/S级以上容貌限定|容貌s及以上/i.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.appearance-min-rank', args: { rank: 6 } })
  }
  if (/容貌(?:等级)?\+\d+[^。]*(?:ex|EX)级[^。]*(?:无法提升|重抽)/.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.appearance-max-rank', args: { rank: 6 } })
  }
  if (/A级或Ex级容貌限定/.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.appearance-rank-in', args: { ranks: [5, 7] } })
  }
  if (/E级、F级容貌限定/.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.appearance-rank-in', args: { ranks: [0, 1] } })
  }
  if (/获得领域雏形/.test(title)) {
    traitLabels.add(DOMAIN_SEED_TRAIT)
    predicates.push({ type: 'not', item: { type: 'contains', fact: 'actor.traits', value: traitEntityId(DOMAIN_SEED_TRAIT) } })
  }
  if (/有神考情况获得/.test(title)) {
    predicates.push({ type: 'compare', fact: 'god-trial.active', op: 'eq', value: true })
  }
  if (/要求(?:已经)?成神|要求神级|非神级参加/.test(title)) {
    predicates.push({ type: 'policy', policyId: 'policy.has-godhood' })
  }
  if (/神级可以重抽/.test(title)) {
    predicates.push({ type: 'not', item: { type: 'policy', policyId: 'policy.has-godhood' } })
  }

  const beastKind = /纯血龙族/.test(title) ? ['pure-dragon']
    : /亚龙种及以上/.test(title) ? ['sub-dragon-or-above']
      : /龙族专属|非龙族|本体龙族/.test(title) ? ['dragon']
        : /海魂兽专属/.test(title) ? ['sea']
          : null
  if (beastKind) predicates.push({ type: 'policy', policyId: 'policy.beast-kind', args: { kinds: beastKind } })
  if (/星斗大森林/.test(title)) predicates.push({ type: 'policy', policyId: 'policy.beast-area', args: { area: 'star-dou' } })
  if (/极北之地/.test(title)) predicates.push({ type: 'policy', policyId: 'policy.beast-area', args: { area: 'north' } })
  if (/绝世唐门(?:之后|时期)/.test(title)) predicates.push({ type: 'policy', policyId: 'policy.timeline-era', args: { era: 'd2' } })
  if (/猎魂森林无(?:万|十万)?年(?:以上)?魂兽则重抽/.test(title)) {
    predicates.push({ type: 'not', item: { type: 'policy', policyId: 'policy.beast-area', args: { area: 'hunting-forest' } } })
  }
  if (/带路边前缀的百年魂兽重抽/.test(title)) {
    traitLabels.add(ROADSIDE_BEAST_TRAIT)
    predicates.push({ type: 'not', item: { type: 'all', items: [
      { type: 'contains', fact: 'actor.traits', value: traitEntityId(ROADSIDE_BEAST_TRAIT) },
      { type: 'compare', fact: 'beast.cultivation', op: 'gte', value: 100 },
    ] } })
  }
  if (/海神岛供奉可以重抽/.test(title)) {
    traitLabels.add(SEA_GOD_ISLAND_BEAST_WORSHIPPER_TRAIT)
    predicates.push({ type: 'not', item: { type: 'contains', fact: 'actor.traits', value: traitEntityId(SEA_GOD_ISLAND_BEAST_WORSHIPPER_TRAIT) } })
  }
  if (/仅唐三\s*30岁之前/.test(title)) predicates.push({ type: 'compare', fact: 'timeline.tang-age', op: 'lt', value: 30 })

  const tribulationRange = title.match(/仅在\s*(\d+)(?:\s*[-~至]\s*(\d+))?万年雷劫池/)
  if (tribulationRange?.[1]) {
    predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'gte', value: Number(tribulationRange[1]) * 10_000 })
    if (tribulationRange[2]) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'lte', value: Number(tribulationRange[2]) * 10_000 })
  }
  const beastEra = title.match(/仅在(十|百|千|万)年魂兽时期/)
  if (beastEra?.[1]) {
    const range = { 十: [10, 99], 百: [100, 999], 千: [1_000, 9_999], 万: [10_000, 99_999] }[beastEra[1]]!
    predicates.push({ type: 'all', items: [
      { type: 'compare', fact: 'beast.cultivation', op: 'gte', value: range[0] },
      { type: 'compare', fact: 'beast.cultivation', op: 'lte', value: range[1] },
    ] })
  }
  const requiredBeastCultivation = title.match(/要求\s*(\d+|[一二三四五六七八九十]+)\s*万(?:年)?(?:以上)?/)
  if (requiredBeastCultivation?.[1]) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'gte', value: chineseMagnitude(requiredBeastCultivation[1]) * 10_000 })
  if (/十万年以下没资格/.test(title)) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'gte', value: 100_000 })
  const beastEscapeThreshold = title.match(/(\d+)\s*万年(?:以上)?(?:可以|可)(?:逃走|拒绝|重抽)/)
  if (beastEscapeThreshold?.[1]) predicates.push({ type: 'compare', fact: 'beast.cultivation', op: 'lt', value: Number(beastEscapeThreshold[1]) * 10_000 })

  // God-tier pools select the trial that a character is about to enter. A
  // generic "second god" predicate on those selectors would require the
  // selected trial before it can be started, making the original second-tier
  // route unreachable. Tier predicates still apply to rewards and narrative
  // choices that explicitly require an already active or completed godhood.
  const isGodTierSelector = legacyFlowRole(pool, pool.tags.flatMap((tagId) => tagById.get(tagId)?.name ? [tagById.get(tagId)!.name] : [])) === 'god-tier'
  const requiredGodTier = isGodTierSelector
    ? null
    : /神王神位/.test(title) ? 4 : /一级神位/.test(title) ? 3 : /二级神/.test(title) ? 2 : null
  if (requiredGodTier != null) {
    const qualified = { type: 'policy', policyId: 'policy.god-tier-at-least', args: { rank: requiredGodTier } }
    const dualGodhood = { type: 'policy', policyId: 'policy.godhood-count-at-least', args: { minimum: 2 } }
    const qualification = /双神位/.test(title) ? { type: 'any', items: [qualified, dualGodhood] } : qualified
    predicates.push(/(?:可以|能)重抽/.test(title) ? { type: 'not', item: qualification } : qualification)
  }

  const namedRequiredTrait = title.match(/要求拥有([^，。】]+)称号/)
  if (namedRequiredTrait?.[1]) {
    const label = namedRequiredTrait[1].replace(/和领域$/, '')
    traitLabels.add(label)
    predicates.push({ type: 'contains', fact: 'actor.traits', value: traitEntityId(label) })
  }
  const requiredRankLabel = title.match(/没有【([^】]+)】字后缀/)
  if (requiredRankLabel?.[1]) {
    traitLabels.add(requiredRankLabel[1])
    predicates.push({ type: 'contains', fact: 'actor.traits', value: traitEntityId(requiredRankLabel[1]) })
  }
  if (/其中(?:的)?2个.*获得【主宰】/.test(title)) {
    const labels = ['侯', '王', '皇', '帝']
    labels.forEach((label) => traitLabels.add(label))
    predicates.push({ type: 'policy', policyId: 'policy.trait-count-at-least', args: { entityIds: labels.map(traitEntityId), minimum: 2 } })
  }

  const evolutionKind = legacyBeastEvolutionKind(title)
  if (evolutionKind) predicates.push({ type: 'policy', policyId: 'policy.beast-evolution-below', args: { kind: evolutionKind, maximum: 4 } })
  const beastElement = legacyBeastElement(title)
  if (beastElement) predicates.push({ type: 'policy', policyId: 'policy.beast-element-below', args: { element: beastElement, maximum: 4 } })
  const lawRequirement = title.match(/(?:没|拥有|至少拥有|要求(?:至少拥有)?)([一二三四五12345])(?:条|个)完整法则/)
  if (lawRequirement?.[1]) {
    const minimum = chineseNumber(lawRequirement[1])
    const qualified = { type: 'policy', policyId: 'policy.beast-law-count-at-least', args: { minimum } }
    predicates.push(/(?:可以|能)重抽/.test(title) ? { type: 'not', item: qualified } : qualified)
  }
  if (/获得过4次体型进化/.test(title)) predicates.push({ type: 'policy', policyId: 'policy.beast-evolution-at-least', args: { kind: 'body', minimum: 4 } })
  if (/血脉精炼/.test(title)) predicates.push({ type: 'policy', policyId: 'policy.beast-bloodline-count-at-least', args: { minimum: 2 } })
  const negativeStoryRequirement = title.match(/负面剧情触发大于(\d+)次限定/)
  if (negativeStoryRequirement?.[1]) predicates.push({ type: 'compare', fact: 'progression.negative-story-count', op: 'gt', value: Number(negativeStoryRequirement[1]) })
  const combatStoryRequirement = title.match(/战斗剧情触发大于(\d+)次限定/)
  if (combatStoryRequirement?.[1]) predicates.push({ type: 'compare', fact: 'progression.combat-story-count', op: 'gt', value: Number(combatStoryRequirement[1]) })
  if (/杀神领域限定/.test(title)) {
    domainLabels.add('杀神领域')
    predicates.push({ type: 'contains', fact: 'actor.domains', value: domainEntityId('杀神领域') })
  }
  if (/武魂极致进化/.test(title)) predicates.push({ type: 'not', item: { type: 'policy', policyId: 'policy.martial-soul-type', args: { type: 'ultimate' } } })
  if (/若已是变异武魂/.test(title)) predicates.push({ type: 'not', item: { type: 'policy', policyId: 'policy.martial-soul-type', args: { type: 'mutated' } } })

  if (/无法重复(?:获得)?|已拥有则重抽|无法叠加(?:则)?/.test(title)) {
    for (const label of labels.filter((label) => !requiredLabels.includes(label))) {
      traitLabels.add(label)
      predicates.push({ type: 'not', item: { type: 'contains', fact: 'actor.traits', value: traitEntityId(label) } })
    }
  }

  const hasUncompiledConstraint = /限定|要求|重抽|无法重复|已拥有/.test(title)
    && predicates.length === 0
  if (hasUncompiledConstraint) {
    unsupportedConstraints.push({
      poolId: `pool.legacy.${pool.id}`,
      optionId: `option.legacy.${pool.id}.${option.id}`,
      title,
      reason: '原版条件依赖武魂属性、领域数量、剧情计数或专用流程，不能安全降级为通用 predicate。',
    })
  }

  const structural = predicates.length === 0 ? undefined : predicates.length === 1 ? predicates[0] : { type: 'all', items: predicates }
  return combinePredicates(structural, option.availableWhen)
}

function combinePredicates(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
) {
  if (!left) return right
  if (!right) return left
  return { type: 'all', items: [left, right] }
}

function levelRangeFrom(text: string) {
  const range = text.match(/(\d+)\s*[-~至]\s*(\d+)\s*级[^。]*?(?:限定|不可抽取)/)
  if (range) return { min: Number(range[1]), max: Number(range[2]) }
  const max = text.match(/(\d+)\s*级(?:以上)?不可(?:再)?抽取|(?:超过|高于)(\d+)\s*级/)
  if (max) return { max: Number(max[1] ?? max[2]) }
  const min = text.match(/(?:要求(?:先天魂力)?\s*|限定\s*)(\d+)\s*(?:\+\s*)?级(?:以上)?/)
    ?? text.match(/(\d+)\s*\+\s*级?\s*(?:限定|否则重抽)/)
    ?? text.match(/(?:要求|达到)\s*(\d+)\s*级以上/)
  return min ? { min: Number(min[1]) } : {}
}

function ageRangeFrom(text: string) {
  const range = text.match(/(\d+)\s*岁\s*[-~至]\s*(\d+)\s*岁[^。]*?(?:限定|不可抽取)/)
  if (range) return { min: Number(range[1]), max: Number(range[2]) }
  const exact = text.match(/(\d+)\s*岁限定/)
  return exact ? { min: Number(exact[1]), max: Number(exact[1]) } : {}
}

function tangAgeFromStoryTitle(text: string) {
  const match = text.match(/唐三\s*(\d+(?:\.\d+)?)\s*岁(半)?[^。]*?限定/)
  return match ? Number(match[1]) + (match[2] ? 0.5 : 0) : undefined
}

function cultivationRangeFrom(text: string) {
  const min = text.match(/(?:要求|需要|达到|拥有|非)\s*(\d+)\s*\+?\s*万年(?:以上)?|(?:\b|\D)(\d+)\s*\+\s*万年限定|(?:\b|\D)(\d+)\s*万年(?:以上|魂兽)?限定/)
  const max = text.match(/(\d+)\s*万年以下/)
  const minimum = min?.[1] ?? min?.[2] ?? min?.[3]
  return {
    ...(minimum ? { min: Number(minimum) * 10_000 } : {}),
    ...(max?.[1] ? { max: Number(max[1]) * 10_000 } : {}),
  }
}

function signedNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern)
  if (!match) return null
  const multiplier = match[3] === '亿' ? 100_000_000 : match[3] === '万' ? 10_000 : 1
  return Number(match[2]) * multiplier * (match[1] === '-' ? -1 : 1)
}

function negativeCultivation(text: string) {
  const match = text.match(/修为掉落\s*(\d+(?:\.\d+)?)(万|亿)?/)
  if (!match) return null
  const multiplier = match[2] === '亿' ? 100_000_000 : match[2] === '万' ? 10_000 : 1
  return -Number(match[1]) * multiplier
}

function legacyDomain(text: string) {
  if (!/获得.*领域|领悟.*领域/.test(text) || /获得(?:完整)?领域|领域雏形|抽取池/.test(text)) return undefined
  return text.match(/【([^】]*领域[^】]*)】/)?.[1] ?? text.match(/([\u4e00-\u9fa5]{2,8}领域)/)?.[1]
}

function labelsIn(text: string) {
  return [...new Set([...text.matchAll(/【([^】]+)】/g)].map((match) => match[1]!.trim()).filter(Boolean))]
}

function conditionReferenceLabels(text: string): ReadonlySet<string> {
  const references = new Set<string>()
  if (/若曾拥有过/.test(text)) {
    const condition = text.split(/则获得/)[0] ?? text
    for (const match of condition.matchAll(/【([^】]+)】/g)) references.add(match[1]!.trim())
  }
  return references
}

function revokedLabels(text: string) {
  return new Set([...text.matchAll(/(?:失去|剥夺|移除)[^。！？]*?【([^】]+)】/g)].map((match) => match[1]!.trim()).filter(Boolean))
}

function isLegacyLethal(text: string) {
  return /你被[^，。]*(?:杀死|击杀|砍死|打死|秒杀|吞噬|斩杀)|当场死亡|最终战死|变成魂环/.test(text)
}

function positiveWeight(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 1
}

function statChange(stat: string, delta: number) {
  return { type: 'stat.change', stat, delta: { type: 'constant', value: delta } }
}

function tagEntityId(id: string) { return `entity.legacy.tag.${id}` }
function traitEntityId(title: string) { return `entity.legacy.trait.${shortHash(title)}` }
function domainEntityId(title: string) { return `entity.legacy.domain.${shortHash(title)}` }
function martialSoulEntityId(title: string) { return `entity.legacy.martial-soul.${shortHash(title)}` }
function legacyFactionEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.faction.${pool.id}.${option.id}` }
function legacySoulRingEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.soul-ring.${pool.id}.${option.id}` }
function legacySoulBoneEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.soul-bone.${pool.id}.${option.id}` }
function legacyBeastTypeEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.beast-type.${pool.id}.${option.id}` }
function legacyBeastSpeciesEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.beast-species.${pool.id}.${option.id}` }
function legacyBeastBloodlineEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.beast-bloodline.${pool.id}.${option.id}` }
function legacyBeastMartialSoulEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.martial-soul.beast-form.${pool.id}.${option.id}` }
function legacyBeastAreaEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.beast-area.${pool.id}.${option.id}` }
function legacyGodDeityEntityId(pool: LegacyPool, option: LegacyOption) { return `entity.legacy.godhood.${pool.id}.${option.id}` }
function legacyGodTierEntityId(tier: LegacyGodTier) { return `entity.legacy.god-tier.${tier}` }
function legacyStoryNodeEntityId(pool: LegacyPool) { return `entity.legacy.story-node.${pool.id}` }
function missingMartialSoul(title: string): never { throw new Error(`Missing martial soul metadata for ${title}`) }
function legacyAppearance(title: string) {
  const label = Object.keys(APPEARANCE_RANK_BY_LABEL).sort((left, right) => right.length - left.length).find((candidate) => new RegExp(`^${candidate}级`).test(title))
  return label ? APPEARANCE_RANK_BY_LABEL[label] : undefined
}
function shortHash(value: string) { return checksum(value).slice(0, 16) }
function checksum(value: string) { return createHash('sha256').update(value).digest('hex') }

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
