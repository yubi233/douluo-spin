import { describe, expect, it } from 'vitest'
import { candidateDistribution } from '@/core/draw/draw'
import { entityId, optionId, poolId } from '@/core/ids'
import type { MechanicsPool, Predicate } from '@/core/model/contracts'
import { NoEligibleOptionError } from '@/core/model/errors'
import { createInitialGameState } from '@/core/reducer/reducer'
import { evaluatePredicate } from '@/core/rules/evaluate'
import { v03Content, v03Policies } from '@/content/v03/content'

const state = createInitialGameState(v03Content.manifest.contentVersion)

describe('v0.3 structured rules and distribution', () => {
  it('evaluates all, any, not, compare and contains without property paths', () => {
    const withTrait = {
      ...state,
      stats: { ...state.stats, level: 20 },
      entities: { ...state.entities, trait: [entityId('tag.setup')] },
    }
    const predicate: Predicate = {
      type: 'all',
      items: [
        { type: 'compare', fact: 'actor.level', op: 'gte', value: 20 },
        { type: 'contains', fact: 'actor.traits', value: entityId('tag.setup') },
        { type: 'not', item: { type: 'compare', fact: 'actor.level', op: 'lt', value: 20 } },
        { type: 'any', items: [
          { type: 'compare', fact: 'actor.level', op: 'eq', value: 20 },
          { type: 'compare', fact: 'actor.level', op: 'eq', value: 99 },
        ] },
      ],
    }
    expect(evaluatePredicate(predicate, withTrait, v03Policies)).toBe(true)
  })

  it('normalizes 1:3:6 into matching probabilities and angles', () => {
    const pool: MechanicsPool = {
      id: poolId('pool.test.weight'),
      tags: [],
      options: [1, 3, 6].map((weight, index) => ({
        id: optionId(`option.test.weight-${index}`), enabled: true, baseWeight: weight, effects: [],
      })),
    }
    const distribution = candidateDistribution(pool, state, v03Policies)
    expect(distribution.map((candidate) => candidate.probability)).toEqual([0.1, 0.3, 0.6])
    expect(distribution[0]).toMatchObject({ startAngle: 0, endAngle: Math.PI * 0.2 })
    expect(distribution[2]?.endAngle).toBeCloseTo(Math.PI * 2)
  })

  it('excludes ineligible options and never retries while ignoring conditions', () => {
    const pool: MechanicsPool = {
      id: poolId('pool.test.eligibility'),
      tags: [],
      options: [{
        id: optionId('option.test.ineligible'),
        enabled: true,
        baseWeight: 1,
        availableWhen: { type: 'compare', fact: 'actor.level', op: 'gte', value: 99 },
        effects: [],
      }],
    }
    expect(() => candidateDistribution(pool, state, v03Policies)).toThrow(NoEligibleOptionError)
  })

  it('changes only options that explicitly declare a dynamic weight policy', () => {
    const pool: MechanicsPool = {
      id: poolId('pool.test.dynamic-weight'),
      tags: [],
      options: [{
        id: optionId('option.test.dynamic'), enabled: true, baseWeight: 1,
        weightModifier: { type: 'policy', policyId: 'policy.combat-power-growth' as never }, effects: [],
      }, {
        id: optionId('option.test.static'), enabled: true, baseWeight: 1, effects: [],
      }],
    }
    const novice = candidateDistribution(pool, state, v03Policies)
    const veteran = candidateDistribution(pool, { ...state, stats: { ...state.stats, level: 100 } }, v03Policies)
    expect(novice.map((candidate) => candidate.probability)).toEqual([1 / 3, 2 / 3])
    expect(veteran.map((candidate) => candidate.probability)).toEqual([2 / 3, 1 / 3])
  })
})
