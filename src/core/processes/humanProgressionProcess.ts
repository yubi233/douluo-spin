import { signalId, type PoolId } from '../ids'
import { legacyFactionStoryId, legacyFactionStoryStage, legacyFlow, legacyOptionPool, legacyOptionSemantic, legacyPoolsForRole } from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

export const humanProgressionProcess: ProcessManager = {
  id: 'human-progression',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.sea-god-island-selected'))) return []
    if (hasSignal(events, signalId('signal.sea-god-plan-selected'))) return []
    if (isActiveSeaGodTrial(state) && (
      hasSignal(events, signalId('signal.human.growth-completed'))
      || hasSignal(events, signalId('signal.sea-god-reward-completed'))
      || hasSignal(events, signalId('signal.sea-god-completion-gate-selected'))
    )) return []
    if (hasSignal(events, signalId('signal.god-trial-entry-selected'))) return []
    if (hasSignal(events, signalId('signal.god-offer.resolved')) || hasSignal(events, signalId('signal.god-tier-selected')) || hasSignal(events, signalId('signal.god-deity-selected'))) return []
    if ((hasSignal(events, signalId('signal.god-trial.started')) || hasSignal(events, signalId('signal.god-trial.progressed'))) && isHumanAdventure(state)) {
      if (state.progression.godTrial?.origin === 'self-created') return []
      return afterHumanGrowth(state, state.progression.growthCycles + 1)
    }
    if (hasSignal(events, signalId('signal.god-trial.exam-completed')) && state.progression.godTrial?.origin === 'self-created') return []
    if (hasSignal(events, signalId('signal.god-trial.training-completed')) && state.progression.godTrial) {
      return afterHumanGrowth(state, state.progression.growthCycles + 1)
    }
    if (hasSignal(events, signalId('signal.special-growth-chance-selected')) && isHumanAdventure(state)) {
      const option = selectedOption(events)
      const kind = option ? legacyOptionPool(option)?.auxiliaryKind : undefined
      if (!kind) return []
      const stage = `human.special-growth.${kind}.${state.progression.growthCycles}`
      const result: DomainEvent[] = [{ type: 'flow.stage-completed', stage }]
      if (option && legacyOptionSemantic(option)?.accepted === true) {
        const hasFirearm = state.entities['martial-soul'].some((martialSoul) =>
          legacyFlow.progression.martialSoul.firearmMartialSoulEntityIds.includes(martialSoul),
        )
        const poolId = hasFirearm
          ? legacyFlow.progression.martialSoul.firearmStoryPoolId
          : legacyPoolsForRole('special-growth').find((candidate) => candidate.auxiliaryKind === kind)?.activePoolId
        if (poolId) result.push({ type: 'task.scheduled', task: task(stage, poolId, 'human-progression') })
      }
      return result
    }
    if (hasSignal(events, signalId('signal.killing-city-selected')) && isHumanAdventure(state)) {
      const stage = 'human.killing-city'
      const result: DomainEvent[] = [{ type: 'flow.stage-completed', stage }]
      const option = selectedOption(events)
      if (option && legacyOptionSemantic(option)?.accepted === true) {
        const pool = legacyPoolsForRole('domain').find((candidate) => candidate.auxiliaryKind === 'killing-city')
        if (pool) result.push({ type: 'task.scheduled', task: task('human.killing-city.domain', pool.activePoolId, 'human-progression') })
      }
      return result
    }
    const enteredAdventure = events.some((event) => event.type === 'phase.changed' && (event.to === 'adventure.human' || event.to === 'adventure.transformed'))
    if (enteredAdventure) {
      return afterHumanGrowth(state, state.progression.growthCycles + 1)
    }
    if (hasSignal(events, signalId('signal.setup.faction-selected')) && isHumanAdventure(state) && state.agenda.length === 0) {
      return [{ type: 'task.scheduled', task: task(`${state.route}.growth.${state.progression.growthCycles + 1}`, humanGrowthPool(state), 'human-progression') }]
    }
    if (hasSignal(events, signalId('signal.story.completed')) && isHumanAdventure(state) && state.agenda.length === 0) {
      const factionStoryStage = selectedFactionStoryStage(events)
      return [
        ...(factionStoryStage ? [{ type: 'faction-story.stage-completed' as const, ...factionStoryStage }] : []),
        ...afterHumanGrowth(state, state.progression.growthCycles + 1),
      ]
    }
    if (selectedLegacyRole(events) === 'human-encounter' && isHumanAdventure(state) && state.agenda.length === 0) {
      return afterHumanGrowth(state, state.progression.growthCycles + 1)
    }
    if (selectedLegacyRole(events) === 'special-growth' && isHumanAdventure(state)) {
      const option = selectedOption(events)
      if (option && legacyOptionSemantic(option)?.completeDomain === true) {
        const domain = legacyPoolsForRole('domain').find((pool) => pool.auxiliaryKind === 'complete-domain')
        if (domain) {
          return [{ type: 'task.scheduled', task: task(`human.domain.${state.progression.growthCycles}`, domain.activePoolId, 'human-progression') }]
        }
      }
    }
    if (!hasSignal(events, signalId('signal.human.growth-completed'))) {
      // Auxiliary chains (rings, species, bones and rewards) may outlive the
      // encounter or faction-story task that normally advances the journey.
      // Resume from the settled state once their final task drains the agenda.
      return isHumanAdventure(state) && state.agenda.length === 0 && !hasSignal(events, signalId('signal.god-trial.exam-completed')) && events.some((event) => event.type === 'task.completed' || event.type === 'flow.stage-completed')
        ? afterHumanGrowth(state, state.progression.growthCycles + 1)
        : []
    }
    const cycle = state.progression.growthCycles + 1
    const completed: DomainEvent = { type: 'growth.completed', route: state.route ?? 'human', cycle }
    const encounters = humanEncounterTasks(state, cycle)
    return encounters.length > 0 ? [completed, ...encounters] : [completed, ...afterHumanGrowth(state, cycle + 1)]
  },
}

function afterHumanGrowth(state: GameState, nextCycle: number): readonly DomainEvent[] {
    const nextFactionStage = legacyFlow.progression.factionByAge
      .map((entry) => entry.age)
      .find((stage) => stage > 6 && state.stats.age >= stage && !state.progression.factionStages.includes(stage))
    if (nextFactionStage != null) {
      return [
        { type: 'task.scheduled', task: task(`faction.stage.${nextFactionStage}`, factionPool(nextFactionStage), 'human-progression') },
      ]
    }
    const factionStory = nextFactionStoryTask(state)
    if (factionStory) return [{ type: 'task.scheduled', task: factionStory }]
    const godEntry = nextGodEntryTask(state)
    if (godEntry) return godEntry
    const godContinuation = nextGodTrialTask(state, nextCycle)
    if (godContinuation) return [{ type: 'task.scheduled', task: godContinuation }]
    const auxiliary = nextHumanAuxiliaryTask(state)
    if (auxiliary) return [{ type: 'task.scheduled', task: auxiliary }]
    const godOffer = nextGodOfferTask(state)
    if (godOffer) return [{ type: 'task.scheduled', task: godOffer }]
    if (state.stats.level >= 99) {
      const branch = state.progression.storyBranch
      const storyPlan = legacyFlow.progression.storyPlan.find((entry) => entry.branch === branch)
      const hasPendingStoryMilestone = Boolean(storyPlan?.milestones.some((milestone) =>
        state.stats['tang-age'] >= milestone.atTangAge
        && !state.progression.scheduledStoryMilestones.includes(`${storyPlan.branch}@${milestone.atTangAge}`),
      ))
      if (hasPendingStoryMilestone) {
        return [
          { type: 'task.scheduled', task: task(`${state.route}.growth.${nextCycle}`, humanGrowthPool(state), 'human-progression') },
        ]
      }
      return [
        { type: 'task.scheduled', task: task('god.trigger.99', legacyGodTriggerPool(), 'god-trial') },
      ]
    }
    return [
      { type: 'task.scheduled', task: task(`${state.route}.growth.${nextCycle}`, humanGrowthPool(state), 'human-progression') },
    ]
}

function nextHumanAuxiliaryTask(state: GameState) {
  const cycle = state.progression.growthCycles
  const standardGrowthStage = `human.special-growth.standard.${cycle}`
  if (cycle > 0 && !state.progression.completedFlowStages.includes(standardGrowthStage)) {
    const pool = legacyPoolsForRole('special-growth-chance').find((candidate) => candidate.auxiliaryKind === 'standard')
    if (pool) return task(standardGrowthStage, pool.activePoolId, 'human-progression')
  }
  if (state.stats.age >= 16 && state.stats.age <= 22 && !state.progression.completedFlowStages.includes('human.killing-city')) {
    const pool = legacyPoolsForRole('killing-city')[0]
    if (pool) return task('human.killing-city', pool.activePoolId, 'human-progression')
  }
  const titledGrowthStage = `human.special-growth.titled.${cycle}`
  if (state.stats.level >= 90 && !state.progression.completedFlowStages.includes(titledGrowthStage)) {
    const pool = legacyPoolsForRole('special-growth-chance').find((candidate) => candidate.auxiliaryKind === 'titled')
    if (pool) return task(titledGrowthStage, pool.activePoolId, 'human-progression')
  }
  return undefined
}

function nextGodOfferTask(state: GameState) {
  if (state.progression.godTrial) return undefined
  // v0.2 only began its random inheritance checks at 70, then retried at 80
  // and 99. The lower offer pools were a v0.3 expansion and let ordinary
  // mid-level characters enter a god trial far too early.
  const threshold = [70, 80, 99].find((value) => state.stats.level >= value && !state.progression.completedFlowStages.includes(`human.god-offer.${value}`))
  return threshold == null ? undefined : task(`human.god-offer.${threshold}`, `pool.god-offer.${threshold}` as PoolId, 'god-trial')
}

function nextGodEntryTask(state: GameState): readonly DomainEvent[] | undefined {
  if (state.progression.godTrial) return undefined
  const entry = (['general', 'ninety-nine', 'self-created'] as const).find((candidate) =>
    state.progression.completedFlowStages.includes(`god.entry.${candidate}`)
    && !state.progression.completedFlowStages.includes(`god.entry.${candidate}.dispatched`),
  )
  if (!entry) return undefined
  const poolId = entry === 'general'
    ? legacyFlow.progression.god.generalTriggerPoolId
    : entry === 'ninety-nine'
      ? legacyFlow.progression.god.ninetyNineTriggerPoolId
      : legacyFlow.progression.god.selfCreatedPoolId
  return [
    { type: 'flow.stage-completed', stage: `god.entry.${entry}.dispatched` },
    { type: 'task.scheduled', task: task(`god.entry.${entry}`, poolId, 'god-trial') },
  ]
}

function nextGodTrialTask(state: GameState, nextCycle: number) {
  const trial = state.progression.godTrial
  if (!trial) return undefined
  const tier = trial.tierId.replace('entity.legacy.god-tier.', '')
  const reward = legacyFlow.progression.godRewards.find((entry) => entry.tier === tier && entry.exam === trial.completed + 1)
  if (reward && state.stats.level >= reward.minLevel) return task(`god.reward.${reward.exam}`, reward.poolId, 'god-trial')
  if (trial.deityId === legacyFlow.progression.seaGod.inheritanceDeityId) {
    return task(`sea-god.training.${trial.completed + 1}.${nextCycle}`, legacyFlow.progression.seaGod.trainingPoolId, 'sea-god')
  }
  return task(`god.training.${trial.completed + 1}.${nextCycle}`, 'pool.god-trial.training' as PoolId, 'god-trial')
}

function isActiveSeaGodTrial(state: GameState) {
  const trial = state.progression.seaGodTrial
  return trial != null
    && trial.grade !== 'sea-god'
    && trial.planned != null
    && !state.progression.completedFlowStages.includes(`sea-god.${trial.grade}.completed`)
}

function selectedFactionStoryStage(events: readonly DomainEvent[]) {
  const option = events.find((event): event is Extract<DomainEvent, { type: 'option.selected' }> => event.type === 'option.selected')?.optionId
  return option ? legacyFactionStoryStage(option) : undefined
}

function selectedLegacyRole(events: readonly DomainEvent[]) {
  const option = events.find((event): event is Extract<DomainEvent, { type: 'option.selected' }> => event.type === 'option.selected')?.optionId
  return option ? legacyOptionPool(option)?.role : undefined
}

function nextFactionStoryTask(state: GameState) {
  const factionEntityId = state.entities.faction.at(-1)
  if (!factionEntityId) return undefined
  const factionId = legacyFactionStoryId(factionEntityId)
  const story = factionId ? legacyFlow.progression.factionStories.find((entry) => entry.id === factionId) : undefined
  if (!story) return undefined
  const stage = story.stages.find((entry) => {
    const key = `${story.id}:${entry.id}`
    return state.stats.age >= entry.minAge
      && (entry.maxAge == null || state.stats.age <= entry.maxAge)
      && (entry.minLevel == null || state.stats.level >= entry.minLevel)
      && !state.progression.factionStoryStages.includes(key)
  })
  return stage
    ? task(`faction-story.${story.id}.${stage.id}`, story.poolId, 'human-progression', undefined, stage.optionIds)
    : undefined
}

function legacyGodTriggerPool(): PoolId {
  return legacyFlow.progression.god.ninetyNineTriggerPoolId
}

function humanGrowthPool(state: GameState) {
  const factionEntityId = state.entities.faction.at(-1)
  const hasFactionStory = factionEntityId != null && legacyFactionStoryId(factionEntityId) != null
  if (!hasFactionStory) {
    const level = state.stats.level
    const levelPool = legacyFlow.progression.humanGrowthByLevel.find((entry) => level >= entry.minLevel && level <= entry.maxLevel)
    if (levelPool) return levelPool.poolId
  }
  const age = state.stats.age
  return legacyFlow.progression.humanGrowthByAge.find((entry) => age >= entry.minAge && (entry.maxAge == null || age <= entry.maxAge))?.poolId
    ?? legacyFlow.progression.humanGrowthByAge.at(-1)!.poolId
}

function humanEncounterTasks(state: GameState, cycle: number): readonly DomainEvent[] {
  const level = state.stats.level
  const encounter = legacyFlow.progression.humanEncounterByLevel
    .find((entry) => level >= entry.minLevel && level <= entry.maxLevel)
  return encounter
    ? [{ type: 'task.scheduled', task: task(`${state.route}.encounter.${cycle}`, encounter.poolId, 'human-progression') }]
    : []
}

function isHumanAdventure(state: GameState) {
  return state.phase === 'adventure.human' || state.phase === 'adventure.transformed' || state.phase === 'god-trial'
}

function factionPool(stage: number): PoolId {
  const pool = legacyFlow.progression.factionByAge.find((entry) => entry.age === stage)?.poolId
  if (!pool) throw new Error(`Missing legacy faction pool for age ${stage}`)
  return pool
}
