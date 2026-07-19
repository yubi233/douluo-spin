import type { EntityId } from '@/core/ids'
import legacyContent from './legacyContent.generated.json'

type LegacyMartialSoulContent = {
  readonly martialSoulTiers: readonly {
    readonly entityId: string
    readonly title: string
    readonly tier: number
    readonly types: readonly string[]
    readonly attributes: readonly string[]
  }[]
  readonly martialSoulCategories: readonly {
    readonly kind: 'beast' | 'tool'
    readonly category: string
    readonly martialSoulEntityIds: readonly string[]
  }[]
}

const rules = legacyContent as unknown as LegacyMartialSoulContent
const tierByEntity = new Map(rules.martialSoulTiers.map((rule) => [rule.entityId, rule.tier]))
const typeByEntity = new Map(rules.martialSoulTiers.map((rule) => [rule.entityId, new Set(rule.types)]))
const attributesByEntity = new Map(rules.martialSoulTiers.map((rule) => [rule.entityId, new Set(rule.attributes)]))
const categoryByEntity = new Map(
  rules.martialSoulCategories.flatMap((rule) => rule.martialSoulEntityIds.map((entityId) => [entityId, rule] as const)),
)

export function legacyMartialSoulTier(entityId: EntityId): number {
  return tierByEntity.get(entityId) ?? 3
}

export function highestLegacyMartialSoulTier(entityIds: readonly EntityId[]): number {
  if (entityIds.length === 0) return 3
  return entityIds.reduce((highest, entityId) => Math.max(highest, legacyMartialSoulTier(entityId)), 1)
}

export function legacyMartialSoulCategory(entityId: EntityId): { readonly kind: 'beast' | 'tool'; readonly category: string } | null {
  const category = categoryByEntity.get(entityId)
  return category ? { kind: category.kind, category: category.category } : null
}

export function hasLegacyMartialSoulType(entityIds: readonly EntityId[], type: string): boolean {
  return entityIds.some((entityId) => typeByEntity.get(entityId)?.has(type))
}

export function hasLegacyMartialSoulAttribute(entityIds: readonly EntityId[], attribute: string): boolean {
  return entityIds.some((entityId) => attributesByEntity.get(entityId)?.has(attribute))
}
