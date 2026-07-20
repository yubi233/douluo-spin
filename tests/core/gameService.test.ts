import { describe, expect, it } from 'vitest'
import { GameService } from '@/application/gameService'
import { v03Content, v03Policies } from '@/content/v03/content'
import { legacyFlow, legacyOptionSemantic, legacyPoolForRole, legacyPoolsForRole } from '@/content/v03/legacyFlow'
import { candidateDistribution, draw } from '@/core/draw/draw'
import { compileEffects } from '@/core/effects/compileEffects'
import { entityId, signalId, turnId } from '@/core/ids'
import type { CompiledContent, DomainEvent, EffectSpec, EventBatch, GameCommand } from '@/core/model/contracts'
import { ProcessCycleError, UnhandledEffectError } from '@/core/model/errors'
import { characterSetupProcess } from '@/core/processes/characterSetupProcess'
import { humanProgressionProcess } from '@/core/processes/humanProgressionProcess'
import { settleProcesses, type ProcessManager } from '@/core/processes/processManager'
import { createInitialGameState, reduceEvents } from '@/core/reducer/reducer'
import { nextRandom } from '@/core/random/random'
import { canExecuteCommand, gameLifecycleMachine } from '@/core/statechart/gameLifecycle'

function createService() {
  return new GameService(v03Content, v03Policies)
}

function start(service: GameService, seed = 'v03-setup-seed') {
  return service.dispatch({ type: 'run.start', route: 'human', seed })
}

function randomSetupReceipt(route: 'human' | 'beast') {
  for (let index = 0; index < 1_000; index += 1) {
    const service = createService()
    const seed = `random-setup-${index}`
    service.dispatch({ type: 'run.start', route: 'random', seed })
    const receipt = service.dispatch({ type: 'turn.spin' })
    if (legacyOptionSemantic(receipt.draw!.optionId)?.route === route) return { service, receipt, seed }
  }
  throw new Error(`Unable to select random ${route} setup within deterministic search range`)
}

describe('v0.3 game lifecycle statechart', () => {
  it('only validates lifecycle command permissions and contains no actions', () => {
    const startCommand: GameCommand = { type: 'run.start', route: 'human', seed: 'statechart' }
    expect(canExecuteCommand('idle', startCommand, 'human')).toBe(true)
    expect(canExecuteCommand('setup.human', startCommand, 'human')).toBe(false)
    expect(canExecuteCommand('setup.human', { type: 'turn.spin' })).toBe(true)
    expect(canExecuteCommand('ended', { type: 'turn.spin' })).toBe(false)
    const actionCounts: number[] = []
    const visited = new WeakSet<object>()
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }
      if (!value || typeof value !== 'object') return
      if (visited.has(value)) return
      visited.add(value)
      for (const [key, child] of Object.entries(value)) {
        if (key === 'actions' && Array.isArray(child)) actionCounts.push(child.length)
        visit(child)
      }
    }
    visit(gameLifecycleMachine.toJSON())
    expect(actionCounts.length).toBeGreaterThan(0)
    expect(actionCounts.every((count) => count === 0)).toBe(true)
  })
})

describe('v0.3 setup walking skeleton', () => {
  it('starts random setup through the original race and timeline pools before human setup', () => {
    const { service, receipt, seed } = randomSetupReceipt('human')
    expect(receipt.draw?.poolId).toBe(legacyFlow.entrypoints.random)
    expect(receipt.batch?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'signal.emitted', signalId: 'signal.setup.race-selected' }),
      expect.objectContaining({ type: 'task.scheduled', task: expect.objectContaining({ poolId: legacyPoolForRole('setup-timeline').activePoolId }) }),
    ]))

    const timeline = service.dispatch({ type: 'turn.spin' })
    expect(timeline.draw?.poolId).toBe(legacyPoolForRole('setup-timeline').activePoolId)
    expect(timeline.batch?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'signal.emitted', signalId: 'signal.setup.timeline-selected' }),
      expect.objectContaining({ type: 'task.scheduled', task: expect.objectContaining({ poolId: legacyFlow.entrypoints.human[0] }) }),
    ]))
    expect(service.eventLog[0]?.events).toContainEqual({ type: 'run.started', route: 'human', requestedRoute: 'random', seed })
  })

  it('starts random beast setup through the original race pool and explicit route transition', () => {
    const { service, receipt } = randomSetupReceipt('beast')
    expect(receipt.draw?.poolId).toBe(legacyFlow.entrypoints.random)
    expect(receipt.batch?.events).toEqual(expect.arrayContaining([
      { type: 'route.changed', from: 'human', to: 'beast' },
      { type: 'phase.changed', from: 'setup.human', to: 'setup.beast' },
      expect.objectContaining({ type: 'task.scheduled', task: expect.objectContaining({ poolId: legacyFlow.entrypoints.beast[0] }) }),
    ]))
    expect(service.state.route).toBe('beast')
    expect(service.state.phase).toBe('setup.beast')
  })

  it('runs human gender, appearance, martial type and martial soul as one vertical slice', () => {
    const service = createService()
    const startReceipt = start(service)

    expect(service.state.phase).toBe('setup.human')
    expect(service.state.agenda.map((task) => task.poolId)).toEqual([legacyFlow.entrypoints.human[0]!])
    expect(startReceipt.batch?.events.map((event) => event.type)).toEqual([
      'run.started', 'phase.changed', 'task.scheduled', 'combat-power.recalculated',
    ])

    const expectedPools = legacyFlow.entrypoints.human.slice(0, 3)
    for (const expectedPool of expectedPools) {
      const receipt = service.dispatch({ type: 'turn.spin' })
      expect(receipt.draw?.poolId).toBe(expectedPool)
      expect(receipt.batch?.events.some((event) => event.type === 'option.selected')).toBe(true)
      expect(receipt.batch?.events.some((event) => event.type === 'entity.granted')).toBe(true)
    }

    const categoryReceipt = service.dispatch({ type: 'turn.spin' })
    expect(categoryReceipt.draw?.poolId).toMatch(/^pool\.legacy\.virtual\.martial-soul\.(beast|tool)\.category$/)
    expect(v03Content.mechanics.pools.get(categoryReceipt.draw?.poolId as never)?.options.length).toBeGreaterThan(1)
    const martialSoulReceipt = service.dispatch({ type: 'turn.spin' })
    expect(martialSoulReceipt.draw?.poolId).toMatch(/^pool\.legacy\.virtual\.martial-soul\.(beast|tool)\./)
    expect(service.state.phase).toBe('setup.human')
    expect(service.state.agenda.map((task) => task.poolId)).toEqual([legacyFlow.entrypoints.human[3]!])
    const specialChance = service.dispatch({ type: 'turn.spin' })
    expect(specialChance.draw?.poolId).toBe(legacyFlow.entrypoints.human[3])
    if (specialChance.draw && legacyOptionSemantic(specialChance.draw.optionId)?.accepted) {
      expect(service.state.agenda.map((task) => task.poolId)).toEqual([legacyPoolForRole('special-talent').activePoolId])
      service.dispatch({ type: 'turn.spin' })
    }
    expect(service.state.agenda.map((task) => task.poolId)).toEqual([legacyFlow.entrypoints.human[4]!])
    expect(service.state.entities.gender).toHaveLength(1)
    expect(service.state.entities.appearance).toHaveLength(1)
    expect(service.state.entities['martial-soul-type']).toHaveLength(1)
    expect(service.state.entities['martial-soul']).toHaveLength(1)
  })

  it('replays the old martial-soul category queue and retains direct pools for the other four types', () => {
    const expectedPools = [
      ['beast', legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === 'beast')!.poolId, 11, true],
      ['tool', legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === 'tool')!.poolId, 16, true],
      ['mutated', 'pool.legacy.16e885e9-96bf-4629-9baa-c57e1cbdf571', 9, false],
      ['concept', 'pool.legacy.ce8c59c8-cd87-487a-b782-4e6587685f63', 13, false],
      ['body', 'pool.legacy.49e3abc8-1361-4348-94aa-b23c68a53720', 13, false],
      ['ultimate', 'pool.legacy.8c589787-e43d-4064-8546-8b5b7b403fe2', 33, false],
    ] as const

    for (const [type, expectedPoolId, optionCount, categorized] of expectedPools) {
      const initial = createInitialGameState(v03Content.manifest.contentVersion)
      const state = {
        ...initial,
        route: 'human' as const,
        phase: 'setup.human' as const,
        entities: { ...initial.entities, 'martial-soul-type': [entityId(`entity.martial-type.${type}`)] },
      }
      const events = characterSetupProcess.react(state, [{
        type: 'signal.emitted', signalId: signalId('signal.setup.martial-type-selected'),
      }])
      expect(events).toContainEqual(expect.objectContaining({
        type: 'task.scheduled', task: expect.objectContaining({ poolId: expectedPoolId }),
      }))

      const pool = v03Content.mechanics.pools.get(expectedPoolId as never)
      expect(pool?.options).toHaveLength(optionCount)
      if (categorized) {
        const optionId = pool!.options[0]!.id
        expect(pool?.options.every((option) => option.effects.some((effect) => (
          effect.type === 'signal.emit' && effect.signalId === 'signal.setup.martial-soul-category-selected'
        )))).toBe(true)
        const categoryEvents = characterSetupProcess.react(state, [{
          type: 'option.selected', poolId: expectedPoolId, optionId, probability: 1,
        }, { type: 'signal.emitted', signalId: signalId('signal.setup.martial-soul-category-selected') }])
        const target = legacyOptionSemantic(optionId)?.martialSoulCategoryTargetPoolId
        expect(categoryEvents).toContainEqual(expect.objectContaining({
          type: 'task.scheduled', task: expect.objectContaining({ poolId: target }),
        }))
        const child = v03Content.mechanics.pools.get(target!)
        expect(child?.options.length).toBeGreaterThan(0)
        expect(child?.options.every((option) => option.effects.some((effect) => (
          effect.type === 'signal.emit' && effect.signalId === 'signal.setup.martial-soul-selected'
        )))).toBe(true)
      } else {
        expect(pool?.options.every((option) => option.effects.some((effect) => (
          effect.type === 'signal.emit' && effect.signalId === 'signal.setup.martial-soul-selected'
        )))).toBe(true)
      }
    }

    expect(v03Content.mechanics.pools.has('pool.setup.martial-soul.tool' as never)).toBe(false)
  })

  it('keeps every special-talent martial-soul branch ahead of age setup', () => {
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const state = { ...initial, route: 'human' as const, phase: 'setup.human' as const }
    const talentPool = legacyPoolForRole('special-talent')
    const talent = (pattern: RegExp) => talentPool.options.find((option) => pattern.test(v03Content.presentation.options.get(option.activeOptionId)?.title ?? ''))!
    const expected = [
      [/双生武魂/, 1, undefined],
      [/三生武魂/, 2, undefined],
      [/人兽混血/, 0, legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === 'beast')!.poolId],
      [/真龙血脉/, 0, 'true-dragon'],
      [/亚龙血脉/, 0, 'sub-dragon'],
      [/地龙血脉/, 0, 'earth-dragon'],
    ] as const

    for (const [pattern, extraSelections, speciesKind] of expected) {
      const option = talent(pattern)
      const events = characterSetupProcess.react(state, [
        { type: 'option.selected', poolId: talentPool.activePoolId, optionId: option.activeOptionId, probability: 1 },
        { type: 'signal.emitted', signalId: signalId('signal.setup.special-talent-selected') },
      ])
      const scheduled = reduceEvents(state, events).agenda
      expect(scheduled.at(-1)?.poolId).toBe(legacyFlow.entrypoints.human[4])
      if (extraSelections > 0) {
        expect(scheduled.filter((task) => task.poolId === legacyFlow.entrypoints.human[2])).toHaveLength(extraSelections)
        expect(scheduled.slice(0, extraSelections).every((task) => task.priority === 'front')).toBe(true)
      }
      if (speciesKind === 'true-dragon' || speciesKind === 'sub-dragon' || speciesKind === 'earth-dragon') {
        const target = legacyFlow.progression.martialSoul.specialTalentTargets.find((entry) => entry.specialTalentOptionId === option.activeOptionId)!
        expect(target.targetPoolId).toContain(speciesKind)
        expect(scheduled[0]?.poolId).toBe(target.targetPoolId)
      }
      if (extraSelections === 0 && (speciesKind == null || speciesKind.startsWith('pool.'))) {
        expect(scheduled[0]?.poolId).toBe(speciesKind ?? legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === 'beast')!.poolId)
      }
    }
  })

  it('does not reroll special chance after an extra special-talent martial soul', () => {
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const state = {
      ...initial,
      route: 'human' as const,
      phase: 'setup.human' as const,
      agenda: [{ id: 'task.age', poolId: legacyFlow.entrypoints.human[4]!, process: 'character-setup' }],
    }
    expect(characterSetupProcess.react(state, [{ type: 'signal.emitted', signalId: signalId('signal.setup.martial-soul-selected') }])).toEqual([])
  })

  it('routes firearm owners through the old firearm special-growth wheel', () => {
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const chance = legacyPoolsForRole('special-growth-chance')
      .find((pool) => pool.auxiliaryKind === 'standard')!
      .options.find((option) => option.semantic.accepted)!
    const state = {
      ...initial,
      route: 'human' as const,
      phase: 'adventure.human' as const,
      entities: {
        ...initial.entities,
        'martial-soul': [legacyFlow.progression.martialSoul.firearmMartialSoulEntityIds[0]!],
      },
    }
    const events = humanProgressionProcess.react(state, [{
      type: 'option.selected', poolId: legacyPoolForRole('special-growth-chance').activePoolId, optionId: chance.activeOptionId, probability: 1,
    }, { type: 'signal.emitted', signalId: signalId('signal.special-growth-chance-selected'), payload: { accepted: true } }])
    expect(events).toContainEqual(expect.objectContaining({
      type: 'task.scheduled', task: expect.objectContaining({ poolId: legacyFlow.progression.martialSoul.firearmStoryPoolId }),
    }))
  })

  it('records the faction stage from the selected original pool rather than delayed actor age', () => {
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const stageTwelve = legacyFlow.progression.factionByAge.find((entry) => entry.age === 12)!
    const optionId = v03Content.mechanics.pools.get(stageTwelve.poolId)!.options[0]!.id
    const state = {
      ...initial,
      route: 'human' as const,
      phase: 'adventure.human' as const,
      stats: { ...initial.stats, age: 80 },
    }
    const events = characterSetupProcess.react(state, [
      { type: 'option.selected', poolId: stageTwelve.poolId, optionId, probability: 1 },
      { type: 'signal.emitted', signalId: signalId('signal.setup.faction-selected') },
    ])
    expect(events).toContainEqual({ type: 'faction.stage-selected', stage: 12 })
  })

  it('schedules one generated faction story stage and restricts the draw to that stage', () => {
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const faction = legacyFlow.pools
      .flatMap((pool) => pool.options)
      .find((option) => option.semantic.factionStoryId === 'wuhun' && option.semantic.factionEntityId)!
    const state = {
      ...initial,
      route: 'human' as const,
      phase: 'adventure.human' as const,
      stats: { ...initial.stats, age: 18, level: 70 },
      entities: { ...initial.entities, gender: [entityId('entity.gender.male')], faction: [faction.semantic.factionEntityId as never] },
      progression: { ...initial.progression, factionStages: [12, 18] },
    }
    const events = humanProgressionProcess.react(state, [{ type: 'signal.emitted', signalId: signalId('signal.human.growth-completed') }])
    const scheduled = events.find((event): event is Extract<DomainEvent, { type: 'task.scheduled' }> => event.type === 'task.scheduled')!
    const story = legacyFlow.progression.factionStories.find((entry) => entry.id === 'wuhun')!
    const adult = story.stages.find((stage) => stage.id === 'adult')!
    expect(scheduled.task).toMatchObject({ poolId: story.poolId, candidateOptionIds: adult.optionIds })
    const pool = v03Content.mechanics.pools.get(story.poolId)!
    expect(candidateDistribution(pool, state, v03Policies, scheduled.task.candidateOptionIds).map((candidate) => candidate.optionId))
      .toEqual([adult.optionIds[0]!, adult.optionIds[1]!])

    const afterAdult = reduceEvents(state, [{ type: 'faction-story.stage-completed', factionId: 'wuhun', stage: 'adult' }])
    const next = humanProgressionProcess.react(afterAdult, [{ type: 'signal.emitted', signalId: signalId('signal.human.growth-completed') }])
    expect(next).toContainEqual(expect.objectContaining({
      type: 'task.scheduled',
      task: expect.objectContaining({ candidateOptionIds: story.stages.find((stage) => stage.id === 'elite')!.optionIds }),
    }))
  })

  it('commits selection, RNG and all effects in one turn batch', () => {
    const service = createService()
    start(service)
    const receipt = service.dispatch({ type: 'turn.spin' })
    const batch = receipt.batch!

    expect(batch.command).toBe('turn.spin')
    expect(batch.rngAfter).not.toBe(batch.rngBefore)
    expect(batch.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'option.selected', poolId: legacyFlow.entrypoints.human[0] }),
      expect.objectContaining({ type: 'entity.granted', entityType: 'gender' }),
      expect.objectContaining({ type: 'signal.emitted', signalId: 'signal.setup.gender-selected' }),
      expect.objectContaining({ type: 'task.scheduled', task: expect.objectContaining({ poolId: legacyFlow.entrypoints.human[1] }) }),
    ]))
    expect(service.eventLog.at(-1)?.turnId).toBe(batch.turnId)
  })

  it('records the structural combat-power breakdown in every active-run batch', () => {
    const service = createService()
    const receipt = start(service, 'combat-snapshot')
    const recalculation = receipt.batch?.events.find((event) => event.type === 'combat-power.recalculated')
    expect(recalculation).toMatchObject({
      type: 'combat-power.recalculated',
      after: service.state.progression.combatPower,
    })
    // The preserved v0.2 formula rounds a level-one, unawakened character to 0.
    // Non-zero combat power becomes a post-awakening/long-run audit invariant.
    expect(service.state.progression.combatPower.total).toBe(0)

    let awakening
    for (let index = 0; index < 6 && service.state.entities['martial-soul'].length === 0; index += 1) {
      awakening = service.dispatch({ type: 'turn.spin' })
    }
    const awakenedSnapshot = awakening?.batch?.events.find((event) => event.type === 'combat-power.recalculated')
    expect(awakenedSnapshot).toMatchObject({
      type: 'combat-power.recalculated',
      after: service.state.progression.combatPower,
    })
    expect(service.state.progression.combatPower.total).toBeGreaterThan(0)
  })

  it('produces byte-identical logs for the same content, seed and commands', () => {
    const run = () => {
      const service = createService()
      start(service, 'deterministic-v03')
      for (let index = 0; index < 4; index += 1) service.dispatch({ type: 'turn.spin' })
      return JSON.stringify(service.eventLog)
    }
    expect(run()).toBe(run())
  })

  it('records undo RNG advancement and redraws a different option when alternatives exist', () => {
    const service = createService()
    start(service, 'undo-v03')
    const originals = Array.from({ length: 3 }, () => service.dispatch({ type: 'turn.spin' }))

    for (let remaining = 2; remaining >= 0; remaining -= 1) {
      const receipt = service.dispatch({ type: 'turn.undo' })
      expect(service.state.turn).toBe(remaining)
      expect(receipt.batch).toMatchObject({ command: 'turn.undo' })
    }
    const redrawn = Array.from({ length: 3 }, () => service.dispatch({ type: 'turn.spin' }))
    expect(redrawn[0]?.draw?.optionId).not.toBe(originals[0]?.draw?.optionId)

    const restored = createService()
    restored.restore(service.eventLog)
    expect(restored.state).toEqual(service.state)
  })

  it('forces a true redraw when the previous option rounds to full probability', () => {
    let service = createService()
    start(service, 'reroll-diagnostic-17')

    for (let step = 0; step < 9; step += 1) {
      service.dispatch({ type: 'turn.spin' })
      const remaining = service.eventLog.slice(0, -1)
      const restored = createService()
      restored.restore(remaining)
      const task = restored.state.agenda[0]!
      const pool = v03Content.mechanics.pools.get(task.poolId)!
      let rngAfter = nextRandom(restored.state.random.state).state
      for (let attempt = 0; attempt < 256; attempt += 1) {
        const preview = draw(pool, { ...restored.state, random: { ...restored.state.random, state: rngAfter } }, v03Policies, task.candidateOptionIds)
        if (preview.candidate.optionId !== service.eventLog.at(-1)?.events.find((event) => event.type === 'option.selected')?.optionId) break
        rngAfter = preview.nextRng
      }
      const undoBatch: EventBatch = {
        turnId: turnId(`turn.${String(remaining.length + 1).padStart(6, '0')}`),
        command: 'turn.undo',
        contentVersion: v03Content.manifest.contentVersion,
        rngBefore: restored.state.random.state,
        rngAfter,
        events: [],
      }
      restored.restore([...remaining, undoBatch])
      restored.dispatch({ type: 'turn.spin' })
      service = restored
    }

    const original = service.dispatch({ type: 'turn.spin' })
    const undo = service.dispatch({ type: 'turn.undo' })
    const redrawn = service.dispatch({ type: 'turn.spin' })

    expect(original.draw?.probability).toBe(1)
    expect(undo.batch?.events).toContainEqual(expect.objectContaining({
      type: 'task.reroll-prepared',
      excludedOptionId: original.draw?.optionId,
    }))
    expect(redrawn.draw?.optionId).not.toBe(original.draw?.optionId)
  })
})

describe('v0.3 transaction failure boundaries', () => {
  it('records clamped stat facts and omits duplicate entity facts', () => {
    const trait = entityId('tag.setup')
    const initial = createInitialGameState(v03Content.manifest.contentVersion)
    const state = {
      ...initial,
      stats: { ...initial.stats, 'max-level': 159 },
    }
    const events = compileEffects([
      { type: 'stat.change', stat: 'level', delta: { type: 'constant', value: 999 } },
      { type: 'stat.change', stat: 'level', delta: { type: 'constant', value: -999 } },
      { type: 'entity.grant', entityType: 'trait', entityId: trait },
      { type: 'entity.grant', entityType: 'trait', entityId: trait },
      { type: 'entity.revoke', entityType: 'trait', entityId: trait },
      { type: 'entity.revoke', entityType: 'trait', entityId: trait },
    ], state, v03Policies)
    expect(events).toEqual([
      { type: 'stat.changed', stat: 'level', before: 1, after: 159 },
      { type: 'stat.changed', stat: 'level', before: 159, after: 1 },
      { type: 'entity.granted', entityType: 'trait', entityId: trait },
      { type: 'entity.revoked', entityType: 'trait', entityId: trait },
    ])
    expect(reduceEvents(state, events).stats.level).toBe(1)
    expect(reduceEvents(state, events).entities.trait).toEqual([])
  })

  it('throws on an unhandled effect without changing the supplied state', () => {
    const state = createInitialGameState(v03Content.manifest.contentVersion)
    const before = structuredClone(state)
    expect(() => compileEffects([{ type: 'effect.unknown' } as unknown as EffectSpec], state, v03Policies))
      .toThrow(UnhandledEffectError)
    expect(state).toEqual(before)
  })

  it('cancels a process chain that does not stabilize', () => {
    const cycle: ProcessManager = {
      id: 'cycle-fixture',
      react: () => [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }],
    }
    const state = createInitialGameState(v03Content.manifest.contentVersion)
    const events: DomainEvent[] = [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }]
    expect(() => settleProcesses(state, events, [cycle], 3)).toThrow(ProcessCycleError)
    expect(state).toEqual(createInitialGameState(v03Content.manifest.contentVersion))
  })

  it('does not commit a spin when effect compilation fails', () => {
    const pools = new Map(v03Content.mechanics.pools)
    const gender = pools.get(legacyFlow.entrypoints.human[0]!)!
    pools.set(gender.id, {
      ...gender,
      options: gender.options.map((option) => ({ ...option, effects: [{ type: 'effect.unknown' } as never] })),
    })
    const content: CompiledContent = { ...v03Content, mechanics: { ...v03Content.mechanics, pools } }
    const service = new GameService(content, v03Policies)
    service.dispatch({ type: 'run.start', route: 'human', seed: 'atomic-effect-failure' })
    const beforeState = service.state
    const beforeLog = service.eventLog
    expect(() => service.dispatch({ type: 'turn.spin' })).toThrow(UnhandledEffectError)
    expect(service.state).toEqual(beforeState)
    expect(service.eventLog).toEqual(beforeLog)
  })

  it('does not commit a command when process settlement cycles', () => {
    const cycle: ProcessManager = {
      id: 'service-cycle-fixture',
      react: () => [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }],
    }
    const service = new GameService(v03Content, v03Policies, [cycle])
    expect(() => service.dispatch({ type: 'run.start', route: 'human', seed: 'atomic-process-cycle' })).toThrow(ProcessCycleError)
    expect(service.state).toEqual(createInitialGameState(v03Content.manifest.contentVersion))
    expect(service.eventLog).toEqual([])
  })
})
