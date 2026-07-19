import { endingId, entityId, signalId } from '../ids'
import {
  legacyBeastKind,
  legacyBeastSpeciesPoolId,
  legacyBeastSpeciesSemantic,
  legacyFlow,
  legacyOptionPool,
  legacyOptionSemantic,
  legacyPoolsForRole,
  legacyTimelineEraTraitId,
} from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

export const beastCultivationProcess: ProcessManager = {
  id: 'beast-cultivation',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.beast.growth-completed'))) {
      const cycle = state.progression.growthCycles + 1
      const nextThreshold = legacyFlow.progression.beastSetup.tribulationPoolIds
        .map((entry) => entry.threshold)
        .find((value) => value <= state.stats['beast-cultivation'] && !state.progression.resolvedTribulations.includes(value))
      const result: DomainEvent[] = [{ type: 'growth.completed', route: 'beast', cycle }]
      if (nextThreshold && state.progression.pendingTribulation == null) {
        const pool = tribulationPool(nextThreshold)
        if (!pool) throw new Error(`Missing legacy tribulation pool for ${nextThreshold}`)
        result.push(
          { type: 'beast.tribulation-requested', threshold: nextThreshold },
          { type: 'task.scheduled', task: task(`beast.tribulation.${nextThreshold}`, pool, 'beast-cultivation') },
        )
      } else {
        result.push(...nextBeastCycleTasks(state, cycle + 1))
      }
      return result
    }
    if (hasSignal(events, signalId('signal.beast.tribulation-survived'))) {
      const threshold = state.progression.pendingTribulation
      if (threshold == null) return []
      if (threshold >= 1_000_000) {
        return [
          { type: 'beast.tribulation-resolved', threshold },
          { type: 'run.finished', endingId: endingId('ending.beast-immortal'), alive: true },
        ]
      }
      return [
        { type: 'beast.tribulation-resolved', threshold },
        ...nextBeastCycleTasks(state, state.progression.growthCycles + 1),
      ]
    }
    if (hasSignal(events, signalId('signal.beast.tribulation-failed'))) {
      const threshold = state.progression.pendingTribulation
      if (threshold == null) return []
      return [
        { type: 'beast.tribulation-resolved', threshold },
        ...nextBeastCycleTasks(state, state.progression.growthCycles + 1),
      ]
    }
    if (hasSignal(events, signalId('signal.beast.tribulation-success'))) {
      const threshold = state.progression.pendingTribulation
      if (threshold == null) return []
      if (threshold >= 1_000_000) {
        const godhood = { type: 'entity.granted' as const, entityType: 'godhood' as const, entityId: entityId('entity.godhood.beast') }
        if (isSeaGodTimeline(state)) {
          const seaFinale = legacyFlow.progression.beastSetup.timelineEvents.find((entry) => entry.eventId === 'sea-4')
          if (seaFinale) {
            return [
              { type: 'beast.tribulation-resolved', threshold },
              godhood,
              { type: 'task.scheduled', task: task('beast.god.sea-finale', seaFinale.poolId, 'beast-cultivation') },
            ]
          }
        }
        return [
          { type: 'beast.tribulation-resolved', threshold },
          godhood,
          { type: 'task.scheduled', task: task('beast.god.choice', legacyFlow.progression.beastSetup.postGodChoicePoolId, 'beast-cultivation') },
        ]
      }
      const result: DomainEvent[] = [{ type: 'beast.tribulation-resolved', threshold }]
      if (threshold === 100_000 && !state.progression.beastRouteChoiceResolved) {
        result.push({ type: 'task.scheduled', task: task('beast.route-choice', legacyFlow.progression.beastSetup.routeChoicePoolId, 'beast-cultivation') })
      } else {
        result.push(
          { type: 'task.scheduled', task: task(`beast.evolution.${threshold}`, legacyFlow.progression.beastSetup.evolutionPoolId, 'beast-cultivation') },
          ...nextBeastCycleTasks(state, state.progression.growthCycles + 1),
        )
      }
      return result
    }
    if (hasSignal(events, signalId('signal.beast.transform'))) {
      return [
        { type: 'beast.route-choice-resolved', transformed: true },
        { type: 'route.changed', from: 'beast', to: 'transformed' },
        { type: 'stat.changed', stat: 'age', before: state.stats.age, after: 6 },
        { type: 'stat.changed', stat: 'level', before: state.stats.level, after: 10 },
        { type: 'entity.granted', entityType: 'martial-soul-type', entityId: entityId('entity.martial-type.beast') },
        ...(beastMartialSoul(state) ? [{ type: 'entity.granted' as const, entityType: 'martial-soul' as const, entityId: beastMartialSoul(state)! }] : []),
        { type: 'phase.changed', from: state.phase, to: 'setup.transformed' },
        { type: 'task.scheduled', task: task('setup.transformed.gender', legacyFlow.entrypoints.human[0]!, 'character-setup') },
      ]
    }
    if (hasSignal(events, signalId('signal.beast.remain'))) {
      return [
        { type: 'beast.route-choice-resolved', transformed: false },
        ...nextBeastCycleTasks(state, state.progression.growthCycles + 1),
      ]
    }
    if (hasSignal(events, signalId('signal.beast.evolution-completed'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      if (!semantic) return []
      if (semantic.beastElement) {
        const before = state.progression.beastElements[semantic.beastElement]
        const tierTrait = before === 0
          ? semantic.beastElementTraitId
          : before === 1
            ? semantic.beastExtremeTraitId
            : before === 2
              ? semantic.beastLawSeedTraitId
              : semantic.beastLawTraitId
        return [
          { type: 'beast.element-advanced', element: semantic.beastElement, before, after: before + 1 },
          ...(tierTrait ? [{ type: 'entity.granted' as const, entityType: 'trait' as const, entityId: tierTrait }] : []),
          ...beastSpecialGrowthChanceTask(),
        ]
      }
      if (semantic.beastEvolutionAction === 'elemental') {
        return semantic.beastEvolutionTargetPoolId
          ? [{ type: 'task.scheduled', task: task('beast.evolution.elemental', semantic.beastEvolutionTargetPoolId, 'beast-cultivation') }]
          : []
      }
      if (semantic.beastEvolutionAction === 'bloodline') {
        const targetPoolId = legacyBeastKind(state.entities['beast-type'][0]!) === 'pure-dragon'
          ? legacyFlow.progression.beastSetup.dragonBloodlinePoolId
          : semantic.beastEvolutionTargetPoolId
        return targetPoolId
          ? [{ type: 'task.scheduled', task: task('beast.evolution.bloodline', targetPoolId, 'beast-cultivation') }]
          : []
      }
      if (semantic.beastEvolutionAction === 'native-bloodline') {
        const targetPoolId = nativeSpeciesPool(state)
        return targetPoolId
          ? [
              { type: 'task.scheduled', task: task('beast.evolution.native-bloodline', targetPoolId, 'beast-cultivation') },
              ...beastSpecialGrowthChanceTask(),
            ]
          : []
      }
      if (semantic.beastEvolutionTargetPoolId) {
        return [
          { type: 'task.scheduled', task: task('beast.evolution.fusion', semantic.beastEvolutionTargetPoolId, 'beast-cultivation') },
          ...beastSpecialGrowthChanceTask(),
        ]
      }
      if (semantic.beastEvolutionKind) {
        const before = state.progression.beastEvolution[semantic.beastEvolutionKind]
        return [
          { type: 'beast.evolution-advanced', kind: semantic.beastEvolutionKind, before, after: before + 1 },
          ...beastSpecialGrowthChanceTask(),
        ]
      }
      return beastSpecialGrowthChanceTask()
    }
    if (hasSignal(events, signalId('signal.beast.special-growth-chance-selected'))) {
      const accepted = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.beast.special-growth-chance-selected'))?.payload?.accepted
      return accepted === true
        ? [{ type: 'task.scheduled', task: task(`beast.special-growth.${state.progression.growthCycles}`, legacyFlow.progression.beastSetup.specialGrowthPoolId, 'beast-cultivation') }]
        : []
    }
    if (hasSignal(events, signalId('signal.beast.special-growth-selected'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      if (!semantic?.beastSpecialAction) return []
      if (semantic.beastSpecialAction === 'native-bloodline') {
        const targetPoolId = nativeSpeciesPool(state)
        return targetPoolId ? [{ type: 'task.scheduled', task: task('beast.special.native-bloodline', targetPoolId, 'beast-cultivation') }] : []
      }
      if (semantic.beastSpecialAction === 'domain') {
        const pool = legacyPoolsForRole('domain').find((candidate) => candidate.auxiliaryKind === 'complete-domain')
        return pool ? [{ type: 'task.scheduled', task: task('beast.special.domain', pool.activePoolId, 'beast-cultivation') }] : []
      }
      return semantic.beastEvolutionTargetPoolId
        ? [{ type: 'task.scheduled', task: task(`beast.special.${semantic.beastSpecialAction}`, semantic.beastEvolutionTargetPoolId, 'beast-cultivation') }]
        : []
    }
    if (hasSignal(events, signalId('signal.beast.bloodline-refinement-selected'))) {
      const nativeSpecies = state.entities['beast-species'][0]
      const nativeBloodline = nativeSpecies ? legacyBeastSpeciesSemantic(nativeSpecies)?.beastBloodlineEntityId : undefined
      const refinedBloodline = state.entities['beast-bloodline'].find((bloodline) => bloodline !== nativeBloodline)
      return refinedBloodline
        ? [{ type: 'entity.revoked', entityType: 'beast-bloodline', entityId: refinedBloodline }]
        : []
    }
    if (hasSignal(events, signalId('signal.beast.god-choice-selected'))) {
      return [{ type: 'run.finished', endingId: endingId('ending.beast-ascension'), alive: true }]
    }
    const selected = selectedOption(events)
    if (selected && legacyOptionPool(selected)?.role === 'beast-timeline-event' && legacyOptionSemantic(selected)?.beastTimelineEventId === 'sea-4') {
      return [{ type: 'run.finished', endingId: endingId('ending.beast-ascension'), alive: true }]
    }
    return []
  },
}

function beastMartialSoul(state: GameState) {
  const species = state.entities['beast-species'][0]
  return species ? legacyBeastSpeciesSemantic(species)?.beastMartialSoulEntityId : undefined
}

function tribulationPool(threshold: number) {
  return legacyFlow.progression.beastSetup.tribulationPoolIds.find((entry) => entry.threshold === threshold)?.poolId
}

function nativeSpeciesPool(state: GameState) {
  const species = state.entities['beast-species'][0]
  return species ? legacyBeastSpeciesPoolId(species) : undefined
}

function beastSpecialGrowthChanceTask(): readonly DomainEvent[] {
  return [{ type: 'task.scheduled', task: task('beast.special-growth.chance', legacyFlow.progression.beastSetup.specialGrowthChancePoolId, 'beast-cultivation') }]
}

function isSeaGodTimeline(state: GameState) {
  const seaTrait = legacyTimelineEraTraitId('sea-god')
  return seaTrait != null && state.entities.trait.includes(seaTrait)
}

function nextBeastCycleTasks(state: GameState, cycle: number): readonly DomainEvent[] {
  const cultivation = state.stats['beast-cultivation']
  const growth = legacyFlow.progression.beastGrowthByCultivation.find((entry) => cultivation >= entry.min && cultivation <= entry.max)
  const encounter = legacyFlow.progression.beastEncounterByCultivation.find((entry) => cultivation >= entry.min && cultivation <= entry.max)
  if (!growth || !encounter) return []
  const timeline = legacyFlow.progression.beastSetup.timelineEvents.find((event) => timelineEligible(state, event, cycle))
  return [
    ...(timeline ? [
      { type: 'flow.stage-completed' as const, stage: `beast.timeline.${timeline.eventId}` },
      { type: 'task.scheduled' as const, task: task(`beast.timeline.${timeline.eventId}`, timeline.poolId, 'beast-cultivation') },
    ] : []),
    { type: 'task.scheduled', task: task(`beast.growth.${cycle}`, growth.poolId, 'beast-cultivation') },
    { type: 'task.scheduled', task: task(`beast.encounter.${cycle}`, encounter.poolId, 'beast-cultivation') },
  ]
}

function timelineEligible(
  state: GameState,
  event: (typeof legacyFlow.progression.beastSetup.timelineEvents)[number],
  cycle: number,
) {
  if (event.eventId === 'sea-4' || state.progression.completedFlowStages.includes(`beast.timeline.${event.eventId}`)) return false
  if (event.era && legacyTimelineEraTraitId(event.era) && !state.entities.trait.includes(legacyTimelineEraTraitId(event.era)!)) return false
  if (event.atTangAge != null && state.stats['tang-age'] < event.atTangAge) return false
  if (event.afterYears != null && cycle * 10 < event.afterYears) return false
  if (!event.speciesGroup) return true
  const nativeSpecies = state.entities['beast-species'][0]
  return nativeSpecies != null && legacyBeastSpeciesSemantic(nativeSpecies)?.beastSpeciesGroup === event.speciesGroup
}
