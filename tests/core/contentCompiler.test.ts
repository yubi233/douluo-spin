import { describe, expect, it } from 'vitest'
import { endingId, entityId, optionId, policyId, poolId, signalId } from '@/core/ids'
import type { ContentRegistries, ContentSource, EffectSpec, NumberExpression, Predicate } from '@/core/model/contracts'
import { ContentValidationError } from '@/core/model/errors'
import { compileContent } from '@/content/compiler/compileContent'

const registries: ContentRegistries = {
  facts: new Set(['actor.level', 'actor.traits']),
  policies: new Set([policyId('policy.test')]),
  signals: new Set([signalId('signal.setup.completed')]),
  effects: new Set(['stat.change', 'entity.grant', 'entity.revoke', 'time.advance', 'signal.emit', 'run.finish']),
  maxExpressionDepth: 4,
}

interface MutableMechanics {
  enabled: boolean
  baseWeight: number
  availableWhen?: Predicate
  weightModifier?: NumberExpression
  effects: EffectSpec[]
}

function validSource(): ContentSource {
  return {
    manifest: { schemaVersion: 3, contentVersion: 'v0.3-test', files: ['test'] },
    entities: [{ id: entityId('tag.setup'), entityType: 'trait', presentation: { title: '基础设定' } }],
    endings: [{ id: endingId('ending.test'), alive: true, presentation: { title: '测试终局' } }],
    pools: [{
      id: poolId('pool.setup.test'),
      presentation: { title: '测试池' },
      tags: [entityId('tag.setup')],
      options: [{
        id: optionId('option.setup.test'),
        presentation: { title: '测试选项' },
        mechanics: {
          enabled: true,
          baseWeight: 1,
          availableWhen: { type: 'compare', fact: 'actor.level', op: 'gte', value: 1 },
          weightModifier: { type: 'policy', policyId: policyId('policy.test') },
          effects: [{ type: 'signal.emit', signalId: signalId('signal.setup.completed') }],
        },
      }],
    }],
  }
}

function mutableSource(): ContentSource {
  return structuredClone(validSource())
}

function mutableMechanics(source: ContentSource): MutableMechanics {
  return source.pools[0]!.options[0]!.mechanics as MutableMechanics
}

function expectIssue(source: ContentSource, code: string) {
  try {
    compileContent(source, registries)
    throw new Error('Expected content compilation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError)
    expect((error as ContentValidationError).issues.some((issue) => issue.code === code)).toBe(true)
  }
}

describe('v0.3 content compiler', () => {
  it('physically separates presentation text from mechanics', () => {
    const compiled = compileContent(validSource(), registries)
    expect(compiled.presentation.options.get(optionId('option.setup.test'))?.title).toBe('测试选项')
    expect(JSON.stringify([...compiled.mechanics.pools.values()])).not.toMatch(/title|description|测试选项/)
  })

  it('keeps the mechanics fingerprint stable when presentation changes', () => {
    const original = validSource()
    const renamed = mutableSource();
    (renamed.pools[0]!.presentation as { title: string }).title = '改名后的池';
    (renamed.pools[0]!.options[0]!.presentation as { title: string }).title = '改名后的选项';
    expect(compileContent(renamed, registries).mechanics.fingerprint)
      .toBe(compileContent(original, registries).mechanics.fingerprint)
  })

  it('rejects duplicate and broken references', () => {
    const duplicated = mutableSource();
    (duplicated.pools[0]!.options[0] as { id: ReturnType<typeof optionId> }).id = duplicated.pools[0]!.id as unknown as ReturnType<typeof optionId>
    expectIssue(duplicated, 'id.duplicate')

    const broken = mutableSource();
    (broken.pools[0] as unknown as { tags: ReturnType<typeof entityId>[] }).tags = [entityId('tag.missing')]
    expectIssue(broken, 'reference.entity')

    const invalid = mutableSource();
    (invalid.pools[0] as { id: ReturnType<typeof poolId> }).id = '中文池名' as ReturnType<typeof poolId>
    expectIssue(invalid, 'id.invalid')
  })

  it('rejects entity references whose declared type does not match the mechanism', () => {
    const source = mutableSource()
    mutableMechanics(source).effects = [{ type: 'entity.grant', entityType: 'faction', entityId: entityId('tag.setup') }]
    expectIssue(source, 'reference.entity-type')

    const predicate = mutableSource()
    mutableMechanics(predicate).availableWhen = { type: 'contains', fact: 'actor.traits', value: entityId('tag.setup') }
    expect(() => compileContent(predicate, registries)).not.toThrow()
    mutableMechanics(predicate).availableWhen = { type: 'contains', fact: 'actor.martial-souls', value: entityId('tag.setup') }
    expectIssue(predicate, 'reference.entity-type')
  })

  it('rejects unregistered facts, policies, effects and signals', () => {
    const source = mutableSource()
    const mechanics = mutableMechanics(source)
    mechanics.availableWhen = { type: 'compare', fact: 'actor.age', op: 'gte', value: 6 }
    mechanics.weightModifier = { type: 'policy', policyId: policyId('policy.missing') }
    mechanics.effects = [
      { type: 'signal.emit', signalId: signalId('signal.missing') },
      { type: 'unknown.effect' } as never,
    ]
    try {
      compileContent(source, registries)
      throw new Error('Expected content compilation to fail')
    } catch (error) {
      const codes = (error as ContentValidationError).issues.map((issue) => issue.code)
      expect(codes).toEqual(expect.arrayContaining(['registry.fact', 'registry.policy', 'registry.signal', 'registry.effect']))
    }
  })

  it('rejects invalid weights, non-finite numbers and excessive expression depth', () => {
    const source = mutableSource()
    const mechanics = mutableMechanics(source)
    mechanics.baseWeight = Number.NaN
    let expression: NumberExpression = { type: 'constant', value: Number.POSITIVE_INFINITY }
    for (let index = 0; index < 5; index += 1) expression = { type: 'add', items: [expression] }
    mechanics.weightModifier = expression
    try {
      compileContent(source, registries)
      throw new Error('Expected content compilation to fail')
    } catch (error) {
      const codes = (error as ContentValidationError).issues.map((issue) => issue.code)
      expect(codes).toEqual(expect.arrayContaining(['weight.invalid', 'expression.depth']))
    }
  })

  it('requires effects to be explicit even for narrative options', () => {
    const source = mutableSource()
    delete (source.pools[0]!.options[0]!.mechanics as unknown as Record<string, unknown>).effects
    expectIssue(source, 'effects.missing')

    const narrative = mutableSource()
    mutableMechanics(narrative).effects = []
    expect(() => compileContent(narrative, registries)).not.toThrow()
  })
})
