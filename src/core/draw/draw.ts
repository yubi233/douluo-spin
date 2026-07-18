import type { OptionId } from '../ids'
import type { GameState, MechanicsPool } from '../model/contracts'
import { NoEligibleOptionError } from '../model/errors'
import { nextRandom } from '../random/random'
import { evaluateNumber, evaluatePredicate, type PolicyRegistry } from '../rules/evaluate'

export interface Candidate {
  readonly optionId: OptionId
  readonly weight: number
  readonly probability: number
  readonly startAngle: number
  readonly endAngle: number
}

export interface DrawResult {
  readonly candidate: Candidate
  readonly nextRng: number
  readonly candidates: readonly Candidate[]
}

export function candidateDistribution(pool: MechanicsPool, state: GameState, policies: PolicyRegistry): readonly Candidate[] {
  const weighted = pool.options.flatMap((option) => {
    if (!option.enabled) return []
    if (option.availableWhen && !evaluatePredicate(option.availableWhen, state, policies)) return []
    const modifier = option.weightModifier ? evaluateNumber(option.weightModifier, state, policies) : 1
    const weight = option.baseWeight * Math.max(0, modifier)
    return Number.isFinite(weight) && weight > 0 ? [{ optionId: option.id, weight }] : []
  })
  const total = weighted.reduce((sum, option) => sum + option.weight, 0)
  if (total <= 0) throw new NoEligibleOptionError(pool.id)
  let angle = 0
  return weighted.map((option) => {
    const probability = option.weight / total
    const startAngle = angle
    angle += probability * Math.PI * 2
    return { ...option, probability, startAngle, endAngle: angle }
  })
}

export function draw(pool: MechanicsPool, state: GameState, policies: PolicyRegistry): DrawResult {
  const candidates = candidateDistribution(pool, state, policies)
  const random = nextRandom(state.random.state)
  let cursor = 0
  const candidate = candidates.find((item) => {
    cursor += item.probability
    return random.value < cursor
  }) ?? candidates[candidates.length - 1]!
  return { candidate, nextRng: random.state, candidates }
}
