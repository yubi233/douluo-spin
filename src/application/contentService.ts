import { compileContent } from '@/content/compiler/compileContent'
import { v03ContentSource, v03Registries } from '@/content/v03/content'
import { optionId, poolId } from '@/core/ids'
import type { CompiledContent, ContentSource } from '@/core/model/contracts'
import type { WheelOptionView } from './gameViewModel'

export interface ContentPatch {
  readonly poolId: string
  readonly options: readonly WheelOptionView[]
}

export interface ContentPatchDocument {
  readonly schemaVersion: 3
  readonly contentVersion: string
  readonly patches: readonly ContentPatch[]
}

function cloneOptions(options: readonly WheelOptionView[]): readonly WheelOptionView[] {
  return JSON.parse(JSON.stringify(options)) as WheelOptionView[]
}

export class ContentService {
  #patches = new Map<string, readonly WheelOptionView[]>()
  #content: CompiledContent

  constructor() {
    this.#content = compileContent(v03ContentSource, v03Registries)
  }

  get content(): CompiledContent { return this.#content }
  get count(): number { return this.#patches.size }
  isPatched(pool: string): boolean { return this.#patches.has(pool) }

  apply(pool: string, options: readonly WheelOptionView[]): void {
    if (!v03ContentSource.pools.some((entry) => entry.id === pool)) throw new TypeError(`Unknown pool ${pool}`)
    this.#compile(new Map(this.#patches).set(pool, cloneOptions(options)))
  }

  preview(pool: string, options: readonly WheelOptionView[]): CompiledContent {
    return this.#build(new Map(this.#patches).set(pool, cloneOptions(options)))
  }

  reset(pool: string): void {
    const next = new Map(this.#patches)
    next.delete(pool)
    this.#compile(next)
  }

  clear(): void { this.#compile(new Map()) }

  exportDocument(): ContentPatchDocument {
    return { schemaVersion: 3, contentVersion: v03ContentSource.manifest.contentVersion, patches: [...this.#patches].map(([poolId, options]) => ({ poolId, options })) }
  }

  importDocument(value: ContentPatchDocument): void {
    if (!value || typeof value !== 'object' || value.schemaVersion !== 3 || value.contentVersion !== v03ContentSource.manifest.contentVersion || !Array.isArray(value.patches)) {
      throw new TypeError('Invalid v0.3 content patch')
    }
    const knownPools = new Set(v03ContentSource.pools.map((pool) => pool.id as string))
    const next = new Map<string, readonly WheelOptionView[]>()
    value.patches.forEach((patch, index) => {
      if (!patch || typeof patch.poolId !== 'string' || !Array.isArray(patch.options)) throw new TypeError(`Invalid patch at patches[${index}]`)
      if (!knownPools.has(patch.poolId)) throw new TypeError(`Unknown pool ${patch.poolId}`)
      if (next.has(patch.poolId)) throw new TypeError(`Duplicate patch for pool ${patch.poolId}`)
      next.set(patch.poolId, cloneOptions(patch.options))
    })
    this.#compile(next)
  }

  #compile(patches: Map<string, readonly WheelOptionView[]>): void {
    this.#content = this.#build(patches)
    this.#patches = patches
  }

  #build(patches: Map<string, readonly WheelOptionView[]>): CompiledContent {
    const source = structuredClone(v03ContentSource) as ContentSource
    const pools = source.pools.map((pool) => {
      const patch = patches.get(pool.id)
      if (!patch) return pool
      return {
        ...pool,
        id: poolId(pool.id),
        options: patch.map((option) => ({
          id: optionId(option.id),
          presentation: { title: option.name },
          mechanics: {
            enabled: option.enabled,
            baseWeight: option.weight,
            availableWhen: option.availableWhen,
            weightModifier: option.weightModifier,
            effects: option.effects,
          },
        })),
      }
    })
    return compileContent({ ...source, pools }, v03Registries)
  }
}
