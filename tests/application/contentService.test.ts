import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { ContentService, type ContentPatchDocument } from '@/application/contentService'
import { projectPool, type WheelOptionView } from '@/application/gameViewModel'

function pool(service: ContentService, id: string) {
  const projected = projectPool(service.content, id, [])
  if (!projected) throw new Error(`Missing test pool ${id}`)
  return projected
}

describe('ContentService v0.3 patches', () => {
  it('separates presentation edits from the mechanics fingerprint', () => {
    const service = new ContentService()
    const original = pool(service, 'pool.setup.gender')
    const fingerprint = service.content.mechanics.fingerprint
    service.apply(original.id, original.options.map((option, index) => ({ ...option, name: index === 0 ? '只改展示名称' : option.name })))
    expect(service.content.mechanics.fingerprint).toBe(fingerprint)
    expect(service.content.presentation.options.get(original.options[0]!.id as never)?.title).toBe('只改展示名称')
  })

  it('accepts reactive editor data and preserves explicit narrative effects', () => {
    const service = new ContentService()
    const original = pool(service, 'pool.setup.appearance')
    const options = reactive([...original.options, {
      id: 'option.local.reactive-narrative', name: '等级+99并死亡，但只是文案', enabled: true,
      weight: 2, probability: 0, effects: [],
    } satisfies WheelOptionView])
    expect(() => service.apply(original.id, options)).not.toThrow()
    const added = service.content.mechanics.pools.get(original.id as never)?.options.at(-1)
    expect(added).toMatchObject({ id: 'option.local.reactive-narrative', effects: [] })
  })

  it('previews structured conditions and effects without committing the patch', () => {
    const service = new ContentService()
    const original = pool(service, 'pool.setup.gender')
    const options = original.options.map((option, index) => index ? option : {
      ...option,
      availableWhen: { type: 'all', items: [{ type: 'compare', fact: 'actor.level', op: 'gte', value: 1 }] } as const,
      weightModifier: { type: 'policy', policyId: 'policy.identity' as never } as const,
      effects: [{ type: 'stat.change', stat: 'level', delta: { type: 'constant', value: 2 } }] as const,
    })
    const preview = service.preview(original.id, options)
    expect(preview.mechanics.pools.get(original.id as never)?.options[0]).toMatchObject({
      availableWhen: { type: 'all' }, weightModifier: { type: 'policy' }, effects: [{ type: 'stat.change' }],
    })
    expect(service.count).toBe(0)
    expect(service.content.mechanics.pools.get(original.id as never)?.options[0]?.availableWhen).toBeUndefined()
  })

  it('round-trips two pool patches by stable pool and option IDs', () => {
    const source = new ContentService()
    for (const id of ['pool.setup.gender', 'pool.setup.appearance']) {
      const current = pool(source, id)
      source.apply(id, current.options.map((option, index) => ({ ...option, name: index === 0 ? `${id}-patched` : option.name })))
    }
    const document = source.exportDocument()
    const restored = new ContentService()
    restored.importDocument(document)
    expect(restored.count).toBe(2)
    expect(pool(restored, 'pool.setup.gender').options[0]?.name).toBe('pool.setup.gender-patched')
    expect(pool(restored, 'pool.setup.appearance').options[0]?.name).toBe('pool.setup.appearance-patched')
  })

  it('atomically rejects incompatible, unknown, duplicate and invalid patches', () => {
    const service = new ContentService()
    const original = pool(service, 'pool.setup.gender')
    service.apply(original.id, original.options.map((option, index) => ({ ...option, name: index === 0 ? '保留修改' : option.name })))
    const baseline = service.exportDocument()
    const expectRejected = (value: unknown, message: RegExp) => {
      expect(() => service.importDocument(value as ContentPatchDocument)).toThrow(message)
      expect(service.exportDocument()).toEqual(baseline)
    }

    expectRejected({ ...baseline, contentVersion: 'v0.2' }, /Invalid v0\.3 content patch/)
    expectRejected({ ...baseline, patches: [{ poolId: 'pool.unknown', options: [] }] }, /Unknown pool/)
    expectRejected({ ...baseline, patches: [baseline.patches[0], baseline.patches[0]] }, /Duplicate patch/)
    const invalid = structuredClone(baseline) as unknown as { patches: { options: { effects: unknown[] }[] }[] }
    invalid.patches[0]!.options[0]!.effects = [{ type: 'effect.unknown' }]
    expectRejected(invalid, /Content validation failed/)
  })
})
