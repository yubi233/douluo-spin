import type {
  CollectionFactKey,
  CompiledContent,
  ContentRegistries,
  EntityType,
  FactKey,
  NumericFactKey,
  StatId,
} from '@/core/model/contracts'

export const numericFacts: readonly NumericFactKey[] = [
  'actor.age', 'actor.level', 'actor.max-level', 'beast.cultivation',
  'timeline.tang-age', 'progression.ring-count', 'progression.combat-power',
]

export const collectionFacts: readonly CollectionFactKey[] = [
  'actor.martial-souls', 'actor.traits', 'actor.domains', 'actor.soul-bones',
  'actor.beast-types', 'actor.beast-species', 'actor.beast-areas', 'story.completed-nodes',
]

export const scalarFacts: readonly FactKey[] = [
  ...numericFacts, 'actor.route', 'actor.gender', 'actor.alive', 'actor.faction',
  'timeline.canon-phase', 'god-trial.active',
]

export const statIds: readonly StatId[] = ['age', 'level', 'max-level', 'appearance-rank', 'beast-cultivation', 'tang-age']

export const entityTypes: readonly EntityType[] = [
  'gender', 'appearance', 'martial-soul-type', 'martial-soul', 'trait', 'domain', 'soul-bone',
  'faction', 'godhood', 'beast-species', 'beast-bloodline', 'beast-type', 'beast-area',
  'soul-ring', 'story-node',
]

export interface EditorCatalog {
  readonly facts: readonly string[]
  readonly policies: readonly string[]
  readonly signals: readonly string[]
  readonly entities: readonly { readonly id: string; readonly type: EntityType; readonly title: string }[]
  readonly endings: readonly { readonly id: string; readonly title: string }[]
}

export function createEditorCatalog(content: CompiledContent, registries: ContentRegistries): EditorCatalog {
  return {
    facts: [...registries.facts].sort(),
    policies: [...registries.policies].sort(),
    signals: [...registries.signals].sort(),
    entities: [...content.mechanics.entities].map(([id, type]) => ({
      id,
      type,
      title: content.presentation.entities.get(id)?.title ?? id,
    })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')),
    endings: [...content.mechanics.endings.keys()].map((id) => ({
      id,
      title: content.presentation.endings.get(id)?.title ?? id,
    })).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN')),
  }
}
