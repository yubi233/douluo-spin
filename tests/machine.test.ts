import { describe, expect, it } from 'vitest'
import {
  FACTION_STORY_DEFINITIONS,
  FIREARM_STORY_POOL_NAME,
  SHREK_MENTOR_ENTRY_POOL_NAME,
  SHREK_MENTOR_REUNION_POOL_NAME,
  SHREK_MENTOR_TOURNAMENT_POOL_NAME,
} from '@/domain/canonAdditions'
import { findPool } from '@/domain/catalog'
import { candidateDistribution, previewOptions } from '@/domain/engine'
import { createInitialState, drawActiveTask, machineStates, transition } from '@/domain/machine'
import type { MachineState, RollTask, WheelPool } from '@/domain/types'

function startHuman(seed = 'fixed-seed') {
  const result = transition(createInitialState(), { type: 'START', route: 'human', seed })
  expect(result.accepted).toBe(true)
  return result.state
}

describe('finite state machine', () => {
  it('declares every application state once', () => {
    expect(new Set(machineStates).size).toBe(11)
    expect(machineStates).toContain('rolling')
    expect(machineStates).toContain('godTrial')
    expect(machineStates).toContain('ending')
  })

  it('rejects events that are invalid for the current state', () => {
    const initial = createInitialState()
    const result = transition(initial, {
      type: 'RESOLVE',
      option: { id: 'invalid', name: '不应被处理' },
      probability: 1,
    })
    expect(result.accepted).toBe(false)
    expect(result.state).toBe(initial)
  })

  it('runs a setup task through rolling and back to human setup', () => {
    let state = startHuman()
    expect(state.value).toBe('humanSetup')

    state = transition(state, { type: 'ROLL' }).state
    expect(state.value).toBe('rolling')
    expect(state.context.activeTask?.handler).toBe('gender')

    state = transition(state, {
      type: 'RESOLVE',
      option: { id: 'male', name: '男' },
      probability: 0.5,
    }).state
    expect(state.value).toBe('humanSetup')
    expect(state.context.gender).toBe('男')
    expect(state.context.lastOptionId).toBe('male')
    expect(state.context.step).toBe(1)
  })

  it('reproduces a draw when seed and action order are equal', () => {
    const firstRolling = transition(startHuman('repeatable'), { type: 'ROLL' }).state
    const secondRolling = transition(startHuman('repeatable'), { type: 'ROLL' }).state
    const first = drawActiveTask(firstRolling).draw
    const second = drawActiveTask(secondRolling).draw
    expect(first.option.id).toBe(second.option.id)
    expect(first.nextRng).toBe(second.nextRng)
  })

  it('routes beast martial souls through a category wheel before the concrete soul', () => {
    let state = startHuman('beast-martial-category')
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'male', name: '男' }, probability: 0.5 }).state
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'appearance', name: 'A级' }, probability: 0.1 }).state
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'beast', name: '兽武魂' }, probability: 0.35 }).state

    expect(state.context.martialSoulTypes).toContain('兽武魂')
    expect(state.context.queue[0]?.pool).toBe('兽武魂分类')
    expect(state.context.queue[0]?.handler).toBe('martialSoulCategory')

    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'dragon', name: '龙族' }, probability: 0.4 }).state
    expect(state.context.queue[0]?.pool).toBe('兽武魂：龙族')
    expect(state.context.queue[0]?.handler).toBe('martialSoul')
  })

  it('routes tool martial souls through a category wheel before the concrete soul', () => {
    let state = startHuman('tool-martial-category')
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'male', name: '男' }, probability: 0.5 }).state
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'appearance', name: 'A级' }, probability: 0.1 }).state
    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'tool', name: '器武魂' }, probability: 0.35 }).state

    expect(state.context.martialSoulTypes).toContain('器武魂')
    expect(state.context.queue[0]?.pool).toBe('器武魂分类')
    expect(state.context.queue[0]?.handler).toBe('martialSoulCategory')

    state = transition(state, { type: 'ROLL' }).state
    state = transition(state, { type: 'RESOLVE', option: { id: 'sword', name: '剑类' }, probability: 0.4 }).state
    expect(state.context.flags.toolMartialSoulCategory).toBe('剑类')
    expect(state.context.queue[0]?.pool).toBe('器武魂：剑类')
    expect(state.context.queue[0]?.handler).toBe('martialSoul')
  })

  it('doubles only active overlevel kill outcomes for firearm martial souls', () => {
    const context = createInitialState().context
    context.martialSouls = ['98k狙击枪']
    const combatTask: RollTask = { id: 'firearm-task', tag: 'test', pool: 'firearm', handler: 'story' }
    const combatPool: WheelPool = {
      id: 'firearm', name: 'firearm', tags: [], options: [
        { id: 'kill', name: '你越级斩杀魂圣', weight: 10 },
        { id: 'normal', name: '你获得补给', weight: 10 },
        { id: 'death', name: '你被魂圣击杀', weight: 10 },
      ],
    }

    const distribution = candidateDistribution(combatPool, combatTask, context)
    expect(distribution.map((candidate) => candidate.weight)).toEqual([2, 10, 100])
    expect(previewOptions(combatPool, combatTask, context).map((option) => option.weight)).toEqual([2, 10, 100])
  })

  it('never falls back to an incompatible structured faction outcome', () => {
    const context = createInitialState().context
    context.age = 18
    context.level = 49
    context.gender = '女'
    const factionTask: RollTask = {
      id: 'strict-faction-story',
      tag: '势力专属剧情',
      pool: '严格筛选测试',
      handler: 'story',
      meta: { factionStoryStage: 'elite' },
    }
    const factionPool: WheelPool = {
      id: 'strict-faction-story',
      name: '严格筛选测试',
      tags: [],
      options: [
        { id: 'elite', name: '50级事件', requirements: { minAge: 18, minLevel: 50, storyStages: ['elite'] } },
        { id: 'male', name: '男性精英事件', requirements: { minAge: 18, minLevel: 50, genders: ['男'], storyStages: ['elite'] } },
      ],
    }

    expect(candidateDistribution(factionPool, factionTask, context)).toEqual([])
  })

  it('routes a successful growth event to the firearm-exclusive story pool', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.martialSouls = ['98k狙击枪']
    state.context.queue = [{
      id: 'growth-chance',
      tag: '特殊成长经历',
      pool: '是否获得特殊成长经历（每次经过一次时间跳跃，可抽取该池）',
      handler: 'growthChance',
    }]

    const rolling = transition(state, { type: 'ROLL' }).state
    const resolved = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'yes', name: '是' },
      probability: 0.5,
    }).state

    expect(resolved.context.queue[0]).toMatchObject({
      pool: FIREARM_STORY_POOL_NAME,
      handler: 'growth',
    })
  })

  it('resolves slaughter-city outcomes without treating a failed reward as a domain', () => {
    const compensation = startHuman() as MachineState
    compensation.value = 'humanAdventure'
    compensation.context.queue = [{
      id: 'slaughter-compensation',
      tag: '杀戮之都',
      pool: '是否获得杀神领域',
      handler: 'domain',
    }]

    const compensationRoll = transition(compensation, { type: 'ROLL' }).state
    const compensationResolved = transition(compensationRoll, {
      type: 'RESOLVE',
      option: { id: 'growth-reward', name: '否，获得一次特殊成长经历' },
      probability: 0.33,
    }).state

    expect(compensationResolved.context.domains).not.toContain('否，获得一次特殊成长经历')
    expect(compensationResolved.context.queue[0]).toMatchObject({
      pool: '特殊成长经历',
      handler: 'growth',
    })

    const success = startHuman() as MachineState
    success.value = 'humanAdventure'
    success.context.queue = [{
      id: 'slaughter-domain',
      tag: '杀戮之都',
      pool: '是否获得杀神领域',
      handler: 'domain',
    }]
    const successRoll = transition(success, { type: 'ROLL' }).state
    const successResolved = transition(successRoll, {
      type: 'RESOLVE',
      option: { id: 'domain-reward', name: '是，获得领域' },
      probability: 0.5,
    }).state

    expect(successResolved.context.domains).toContain('杀神领域')
    expect(successResolved.context.domains).not.toContain('是，获得领域')
  })

  it('honors deferred domain and soul-bone follow-up draws from real reward text', () => {
    const domainSeed = startHuman() as MachineState
    domainSeed.value = 'humanAdventure'
    domainSeed.context.level = 57
    domainSeed.context.queue = [{
      id: 'domain-seed',
      tag: '特殊成长经历',
      pool: '特殊成长经历',
      handler: 'growth',
    }]
    const domainSeedRoll = transition(domainSeed, { type: 'ROLL' }).state
    const domainSeedResolved = transition(domainSeedRoll, {
      type: 'RESOLVE',
      option: { id: 'seed', name: '获得领域雏形（领域雏形在90级后变成完整领域，进入完整领域抽取池）' },
      probability: 0.1,
    }).state

    expect(domainSeedResolved.context.traits).toContain('领域雏形')
    expect(domainSeedResolved.context.domains).not.toContain('获得领域')
    expect(domainSeedResolved.context.queue.some((item) => item.pool === '完整领域池子')).toBe(false)

    const ring = startHuman() as MachineState
    ring.value = 'humanAdventure'
    ring.context.queue = [{
      id: 'ring-with-bone',
      tag: '魂环吸收',
      pool: '魂环吸收（第一魂环）（抽取完魂环后请进入对应的魂骨抽奖池）',
      handler: 'ring',
      meta: { index: 1 },
    }]
    const ringRoll = transition(ring, { type: 'ROLL' }).state
    const ringResolved = transition(ringRoll, {
      type: 'RESOLVE',
      option: { id: 'ring-result', name: '300年魂环' },
      probability: 1,
    }).state

    expect(ringResolved.context.queue[0]).toMatchObject({
      pool: '魂骨抽取池（已拥有部位则重抽）',
      handler: 'bone',
      meta: { years: 300 },
    })
    const boneRoll = transition(ringResolved, { type: 'ROLL' }).state
    const boneResolved = transition(boneRoll, {
      type: 'RESOLVE',
      option: { id: 'head', name: '头骨' },
      probability: 1,
    }).state
    expect(boneResolved.context.soulBones).toContain('300年头骨')
  })

  it('schedules a faction-exclusive pool with age, level, and gender-filtered outcomes', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.age = 15
    state.context.tangAge = 0
    state.context.level = 30
    state.context.gender = '女'
    state.context.faction = '武魂殿重点培养学员'
    state.context.branch = 2
    state.context.rings = Array.from({ length: 3 }, (_, index) => ({ index: index + 1, years: 1000, description: '测试魂环' }))
    state.context.flags = { 'faction:6': true, 'faction:12': true, 'faction:18': true, slaughter: true }

    const rolling = transition(state, { type: 'ROLL' }).state
    expect(rolling.context.activeTask?.pool).toBe('势力专属剧情：武魂殿')
    expect(rolling.context.activeTask?.meta?.factionStoryStage).toBe('youth')

    const options = previewOptions(findPool('势力专属剧情：武魂殿')!, rolling.context.activeTask!, rolling.context)
    expect(options.map((option) => option.name)).toHaveLength(2)
    expect(options.every((option) => option.name.includes('成长期·12-17岁'))).toBe(true)
    expect(options.some((option) => option.name.includes('男性路线'))).toBe(false)
    expect(options.some((option) => option.name.includes('女性路线'))).toBe(true)

    const selected = options.find((option) => option.name.includes('女性路线'))!
    const resolved = transition(rolling, { type: 'RESOLVE', option: selected, probability: 0.25 }).state
    expect(resolved.context.flags['factionStory:wuhun:youth']).toBe(true)

    const next = transition(resolved, { type: 'ROLL' }).state
    expect(next.context.activeTask?.pool).not.toBe('势力专属剧情：武魂殿')
  })

  it('maps selected factions to their exclusive story route before generic progression', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.age = 18
    state.context.tangAge = 0
    state.context.level = 52
    state.context.gender = '男'
    state.context.rings = Array.from({ length: 5 }, (_, index) => ({ index: index + 1, years: 1000, description: '测试魂环' }))
    state.context.queue = [{
      id: 'choose-qibao',
      tag: '选择势力',
      pool: '加入的势力（18岁限定）',
      handler: 'faction',
      meta: { stage: 18 },
    }]

    const rolling = transition(state, { type: 'ROLL' }).state
    const resolved = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'qibao', name: '七宝琉璃宗招揽，选择成为其供奉' },
      probability: 0.1,
    }).state

    const qibao = FACTION_STORY_DEFINITIONS.find((definition) => definition.id === 'qibao')!
    expect(resolved.context.flags.factionId).toBe('qibao')
    expect(resolved.context.queue[0]).toMatchObject({
      pool: qibao.poolName,
      handler: 'story',
      meta: { factionId: 'qibao', factionStoryStage: 'adult' },
    })
  })

  it('starts every supported entry route without changing the state-machine contract', () => {
    for (const route of ['random', 'human', 'beast'] as const) {
      const result = transition(createInitialState(), { type: 'START', route, seed: `route-${route}` })
      expect(result.accepted).toBe(true)
      expect(['humanSetup', 'beastSetup']).toContain(result.state.value)
      expect(result.state.context.queue.length).toBeGreaterThan(0)
    }
  })

  it('moves lethal outcomes to the ending state', () => {
    const state = startHuman() as MachineState
    const deathTask: RollTask = {
      id: 'death-task',
      tag: '流浪or不参与主线独立剧情',
      pool: '11-20级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）',
      handler: 'humanEncounter',
    }
    state.value = 'humanAdventure'
    state.context.queue = [deathTask]
    const rolling = transition(state, { type: 'ROLL' }).state
    const ended = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'death', name: '执行任务时，你被魂兽击杀' },
      probability: 0.1,
    }).state
    expect(ended.value).toBe('ending')
    expect(ended.context.alive).toBe(false)
    expect(ended.context.queue).toHaveLength(0)
  })

  it('schedules the matching original-story milestone before another time jump', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.level = 1
    state.context.age = 20
    state.context.tangAge = 20
    state.context.branch = 1
    state.context.flags = {
      'faction:12': true,
      'faction:18': true,
      slaughter: true,
      'story:1@12': true,
      'story:1@14': true,
      'story:1@19': true,
    }
    const rolling = transition(state, { type: 'ROLL' }).state
    expect(rolling.context.activeTask?.pool).toContain('剧情14:是否参与天斗宫变')
    expect(rolling.context.queue.some((item) => item.pool.includes('剧情15:唐三重建唐门'))).toBe(true)
  })

  it('routes characters aged twenty-five or older through Shrek mentor story pools', () => {
    const entryState = startHuman() as MachineState
    entryState.value = 'humanAdventure'
    entryState.context.queue = []
    entryState.context.age = 80
    entryState.context.tangAge = 12
    entryState.context.branch = 3
    entryState.context.flags = { 'faction:6': true, 'faction:12': true, 'faction:18': true, slaughter: true }

    const entryRoll = transition(entryState, { type: 'ROLL' }).state
    expect(entryRoll.context.activeTask?.pool).toBe(SHREK_MENTOR_ENTRY_POOL_NAME)
    const accepted = transition(entryRoll, {
      type: 'RESOLVE',
      option: { id: 'mentor', name: '是，接受弗兰德邀请，成为史莱克学院客卿导师（40+级限定）' },
      probability: 0.5,
    }).state
    expect(accepted.context.flags.shrekMentor).toBe(true)

    accepted.value = 'humanAdventure'
    accepted.context.queue = []
    accepted.context.age = 82
    accepted.context.tangAge = 14
    const tournamentRoll = transition(accepted, { type: 'ROLL' }).state
    expect(tournamentRoll.context.activeTask?.pool).toBe(SHREK_MENTOR_TOURNAMENT_POOL_NAME)
  })

  it('uses the mentor route when a character will age out before the tournament', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.age = 24
    state.context.tangAge = 12
    state.context.branch = 3
    state.context.flags = { 'faction:6': true, 'faction:12': true, 'faction:18': true, slaughter: true }

    const rolling = transition(state, { type: 'ROLL' }).state
    expect(rolling.context.activeTask?.pool).toBe(SHREK_MENTOR_ENTRY_POOL_NAME)
  })

  it('keeps existing Shrek teachers on the teacher-side mentor entry', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.age = 80
    state.context.tangAge = 12
    state.context.faction = '史莱克学院任职教师'
    state.context.branch = 1
    state.context.flags = {
      'faction:6': true,
      'faction:12': true,
      'faction:18': true,
      factionHistory: '史莱克学院任职教师',
      slaughter: true,
    }

    const rolling = transition(state, { type: 'ROLL' }).state
    const options = previewOptions(findPool(SHREK_MENTOR_ENTRY_POOL_NAME)!, rolling.context.activeTask!, rolling.context)
    expect(options.map((option) => option.name)).toEqual(['是，你本就在史莱克任教，转任学院大赛导师'])
  })

  it('does not backfill expired story milestones after changing factions', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.age = 18
    state.context.tangAge = 18
    state.context.faction = '史莱克学院'
    state.context.branch = 1
    state.context.flags = {
      factionHistory: '诺丁初级魂师学院｜史莱克学院',
      slaughter: true,
      'story:1@12': true,
      'story:1@14': true,
    }
    state.context.queue = [{
      id: 'adult-faction-change',
      tag: '选择势力',
      pool: '加入的势力（18岁限定）',
      handler: 'faction',
      meta: { stage: 18 },
    }]

    const rolling = transition(state, { type: 'ROLL' }).state
    const resolved = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'wuhun', name: '武魂殿任职主教（进入剧情分支二）' },
      probability: 0.1,
    }).state

    expect(resolved.context.branch).toBe(2)
    expect(resolved.context.flags['story:2@14']).toBe(true)
    expect(resolved.context.queue[0]).toMatchObject({
      tag: '势力专属剧情',
      pool: '势力专属剧情：武魂殿',
      meta: { factionId: 'wuhun', factionStoryStage: 'adult' },
    })
    expect(resolved.context.queue.some((item) => item.pool.startsWith('剧情'))).toBe(false)
    expect(resolved.context.flags.factionHistory).toBe('诺丁初级魂师学院｜史莱克学院｜武魂殿任职主教')
  })

  it('preserves the mentor entry when an older character joins before the tournament', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.age = 50
    state.context.tangAge = 14
    state.context.queue = [{
      id: 'late-adult-faction',
      tag: '选择势力',
      pool: '加入的势力（18岁限定）',
      handler: 'faction',
      meta: { stage: 18 },
    }]

    const rolling = transition(state, { type: 'ROLL' }).state
    const resolved = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'wanderer', name: '选择独自流浪' },
      probability: 0.1,
    }).state

    expect(resolved.context.queue[0]?.pool).toBe(SHREK_MENTOR_ENTRY_POOL_NAME)
  })

  it('filters faction roles by their level requirements', () => {
    const context = createInitialState().context
    const adultTask: RollTask = {
      id: 'adult-faction-options',
      tag: '选择势力',
      pool: '加入的势力（18岁限定）',
      handler: 'faction',
    }

    context.level = 29
    const lowLevelNames = previewOptions(findPool(adultTask.pool)!, adultTask, context).map((option) => option.name)
    expect(lowLevelNames.some((name) => /副团长|主教|供奉|任职教师|武魂殿长老/.test(name))).toBe(false)

    context.level = 89
    const highLevelNames = previewOptions(findPool(adultTask.pool)!, adultTask, context).map((option) => option.name)
    expect(highLevelNames.some((name) => /任职教师|主教|供奉/.test(name))).toBe(true)
    expect(highLevelNames.some((name) => /武魂殿长老/.test(name))).toBe(false)

    context.level = 90
    expect(previewOptions(findPool(adultTask.pool)!, adultTask, context).some((option) => /武魂殿长老/.test(option.name))).toBe(true)

    const youthTask: RollTask = {
      id: 'youth-faction-options',
      tag: '选择势力',
      pool: '加入的势力（12岁限定）',
      handler: 'faction',
    }
    context.level = 19
    expect(previewOptions(findPool(youthTask.pool)!, youthTask, context).some((option) => /20\+级限定/.test(option.name))).toBe(false)
  })

  it('keeps mentor identity through the seven-monster reunion milestone', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.age = 32
    state.context.tangAge = 20
    state.context.branch = 3
    state.context.flags = {
      'faction:6': true,
      'faction:12': true,
      'faction:18': true,
      'story:3@12': true,
      'story:3@14': true,
      shrekMentor: true,
      slaughter: true,
    }

    const reunionRoll = transition(state, { type: 'ROLL' }).state
    expect(reunionRoll.context.activeTask?.pool).toBe(SHREK_MENTOR_REUNION_POOL_NAME)
    const resolved = transition(reunionRoll, {
      type: 'RESOLVE',
      option: { id: 'review', name: '你以客卿导师身份复盘七怪配合，没有占用八怪成员位置' },
      probability: 0.25,
    }).state
    expect(resolved.context.queue.some((item) => item.pool.includes('剧情7:是否参与天斗宫变'))).toBe(true)
  })

  it('does not backfill lower-age faction wheels after an adult faction choice', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.age = 80
    state.context.tangAge = 6
    state.context.queue = [{
      id: 'adult-faction',
      tag: '选择势力',
      pool: '加入的势力（18岁限定）',
      handler: 'faction',
      meta: { stage: 18 },
    }]

    const rolling = transition(state, { type: 'ROLL' }).state
    const resolved = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'mercenary', name: '加入中级佣兵团当任副团长' },
      probability: 0.1,
    }).state

    expect(resolved.context.flags).toMatchObject({ 'faction:6': true, 'faction:12': true, 'faction:18': true })
    expect(resolved.context.queue.some((item) => item.pool === '加入的势力（12岁限定）')).toBe(false)
  })
})
