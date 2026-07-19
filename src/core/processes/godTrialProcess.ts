import { endingId, signalId } from '../ids'
import { legacyGodDeityPool, legacyFlow, legacyOptionSemantic } from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

type LegacyGodTier = 'king' | 'first' | 'second' | 'third'

export const godTrialProcess: ProcessManager = {
  id: 'god-trial',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    // A beast that remains in its original form never participates in human
    // inheritance or self-created god trials. Its only ascension is handled
    // by beastCultivationProcess after the million-year tribulation.
    if (state.route === 'beast') return []
    if (hasSignal(events, signalId('signal.god-trial-entry-selected'))) {
      const entry = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.god-trial-entry-selected'))?.payload?.entry
      return entry === 'general' || entry === 'ninety-nine' || entry === 'self-created'
        ? [{ type: 'flow.stage-completed', stage: `god.entry.${entry}` }]
        : []
    }
    if (hasSignal(events, signalId('signal.god-self-created-selected'))) {
      if (state.progression.godTrial) return []
      return [
        {
          type: 'god-trial.started',
          tierId: 'entity.god-tier.self-created' as never,
          deityId: 'entity.godhood.self-created' as never,
          total: 3,
          origin: 'self-created',
        },
        { type: 'stat.changed', stat: 'max-level', before: state.stats['max-level'], after: 159 },
        { type: 'signal.emitted', signalId: signalId('signal.god-trial.started') },
        { type: 'task.scheduled', task: task('god-trial.self-created.1', 'pool.god-trial.exam' as never, 'god-trial') },
      ]
    }
    if (hasSignal(events, signalId('signal.god-offer.resolved'))) {
      const offer = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.god-offer.resolved'))
      const threshold = offer?.payload?.threshold
      const accepted = offer?.payload?.accepted
      if (typeof threshold !== 'number' || typeof accepted !== 'boolean') return []
      const result: DomainEvent[] = [{ type: 'flow.stage-completed', stage: `human.god-offer.${threshold}` }]
      if (accepted) result.push({ type: 'task.scheduled', task: task(`god.trigger.${threshold}`, legacyGodTriggerPool(), 'god-trial') })
      return result
    }
    if (hasSignal(events, signalId('signal.god-tier-selected'))) {
      const semantic = selectedSemantic(events)
      const tier = semantic?.godTier as LegacyGodTier | undefined
      if (!tier) return []
      const deityPool = legacyGodDeityPool(tier)
      if (!deityPool) throw new Error(`Missing original deity pool for ${tier} god trial`)
      return [{ type: 'task.scheduled', task: task(`god.deity.${tier}`, deityPool, 'god-trial') }]
    }
    if (hasSignal(events, signalId('signal.god-deity-selected'))) {
      const semantic = selectedSemantic(events)
      const tier = semantic?.godTier as LegacyGodTier | undefined
      const deityId = semantic?.godDeityEntityId
      const total = semantic?.godTrialTotal
      if (!tier || !deityId || !total || state.progression.godTrial) return []
      return [
        { type: 'god-trial.started', tierId: (`entity.legacy.god-tier.${tier}` as never), deityId, total, origin: 'inheritance' },
        { type: 'stat.changed', stat: 'max-level', before: state.stats['max-level'], after: maxLevelForTier(tier) },
        { type: 'signal.emitted', signalId: signalId('signal.god-trial.started') },
      ]
    }
    if (!hasSignal(events, signalId('signal.god-trial.exam-completed'))) return []
    const trial = state.progression.godTrial
    if (!trial) return []
    const after = trial.completed + 1
    const result: DomainEvent[] = [
      { type: 'god-trial.progressed', before: trial.completed, after },
      { type: 'signal.emitted', signalId: signalId('signal.god-trial.progressed') },
    ]
    if (after >= trial.total) {
      const ending = trial.origin === 'self-created' ? endingId('ending.self-created-ascension') : endingId('ending.god-ascension')
      result.push(
        { type: 'entity.granted', entityType: 'godhood', entityId: trial.deityId },
        { type: 'stat.changed', stat: 'level', before: state.stats.level, after: 100 },
        { type: 'run.finished', endingId: ending, alive: true },
      )
    } else if (trial.origin === 'self-created') {
      result.push({ type: 'task.scheduled', task: task(`god-trial.self-created.${after + 1}`, 'pool.god-trial.exam' as never, 'god-trial') })
    }
    return result
  },
}

function legacyGodTriggerPool() {
  return legacyFlow.progression.god.ninetyNineTriggerPoolId
}

function selectedSemantic(events: readonly DomainEvent[]) {
  const option = selectedOption(events)
  return option ? legacyOptionSemantic(option) : undefined
}

function tierFromEntity(entity: string): LegacyGodTier {
  const tier = entity.replace('entity.legacy.god-tier.', '')
  if (tier === 'king' || tier === 'first' || tier === 'second' || tier === 'third') return tier
  throw new Error(`Unknown legacy god tier entity: ${entity}`)
}

function maxLevelForTier(tier: LegacyGodTier) {
  return tier === 'king' ? 159 : tier === 'first' ? 139 : tier === 'second' ? 119 : 109
}

function godRewardPool(tier: LegacyGodTier, exam: number) {
  const pool = legacyFlow.progression.godRewards.find((entry) => entry.tier === tier && entry.exam === exam)?.poolId
  if (!pool) throw new Error(`Missing original ${tier} god reward pool for exam ${exam}`)
  return pool
}
