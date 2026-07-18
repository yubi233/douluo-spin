import { describe, expect, it } from 'vitest'
import { auditBeastIdentity, auditTraceOrder, simulateJourney } from '@/application/simulation'
import { formatBiography, projectGameView } from '@/application/gameViewModel'
import { v03Content, v03Policies } from '@/content/v03/content'

function simulate(seed: string, route: 'human' | 'beast') {
  return simulateJourney(v03Content, v03Policies, { seed, route })
}

describe('v0.3 complete deterministic journeys', () => {
  it('completes the pre-ascension human route through rings, story nodes and inherited god trial', () => {
    const result = simulate('v03-human-2', 'human')
    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.state.ending).toEqual({ endingId: 'ending.god-ascension', alive: true })
    expect(result.state.progression.rings).toHaveLength(9)
    expect(result.state.progression.storyNodes).toHaveLength(4)
    expect(result.state.progression.godTrial).toMatchObject({ completed: 3, total: 3 })
    expect(result.state.progression.godTrial?.origin).toBe('inheritance')
    expect(result.state.agenda).toEqual([])
  })

  it('completes four non-deifying postwar stages before a self-created godhood', () => {
    const result = simulate('v03-human-1', 'human')
    expect(result.audit.passed).toBe(true)
    expect(result.state.progression.storyNodes.filter((id) => id.startsWith('entity.story-node.postwar.'))).toHaveLength(4)
    expect(result.state.progression.godTrial).toMatchObject({ origin: 'self-created', completed: 3, total: 3 })
    expect(result.state.ending).toEqual({ endingId: 'ending.self-created-ascension', alive: true })
  })

  it('commits a lethal human outcome once and schedules nothing after ending', () => {
    const result = simulate('v03-human-28', 'human')
    expect(result.state.ending).toEqual({ endingId: 'ending.death', alive: false })
    expect(result.state.agenda).toEqual([])
    const finalBatch = result.eventLog.at(-1)!
    expect(finalBatch.events.filter((event) => event.type === 'run.finished')).toHaveLength(1)
    expect(finalBatch.events.at(-1)?.type).toBe('run.finished')
  })

  it('completes the beast route through four explicit tribulation thresholds', () => {
    const result = simulate('v03-beast-2', 'beast')
    expect(result.audit.passed).toBe(true)
    expect(result.state.route).toBe('beast')
    expect(result.state.entities['beast-bloodline']).toHaveLength(1)
    expect(result.state.entities['beast-bloodline'][0]).toMatch(/^entity\.beast-bloodline\./)
    expect(result.state.progression.resolvedTribulations).toEqual([100_000, 300_000, 600_000, 1_000_000])
    expect(result.state.ending).toEqual({ endingId: 'ending.beast-ascension', alive: true })
  })

  it('keeps beast type, species, bloodline and area compatible', () => {
    const result = simulate('v03-preflight-dev5-r3-batch-01-sample-04', 'beast')
    expect(result.audit.passed).toBe(true)
    expect(auditBeastIdentity(result.state)).toEqual([])

    const invalid = structuredClone(result.state) as unknown as { entities: Record<string, string[]> }
    invalid.entities['beast-type'] = ['entity.beast-type.land']
    invalid.entities['beast-species'] = ['entity.beast-species.spirit-whale']
    invalid.entities['beast-bloodline'] = ['entity.beast-bloodline.spirit-whale']
    invalid.entities['beast-area'] = ['entity.beast-area.ocean']
    expect(auditBeastIdentity(invalid as never)[0]?.code).toBe('incompatible-beast-identity')
  })

  it('changes route explicitly and completes transformed setup and progression', () => {
    const result = simulate('v03-beast-1', 'beast')
    expect(result.audit.passed).toBe(true)
    expect(result.state.route).toBe('transformed')
    expect(result.state.progression.beastRouteChoiceResolved).toBe(true)
    expect(result.state.entities['martial-soul']).toContain('entity.martial-soul.beast-form')
    expect(result.state.progression.rings).toHaveLength(9)
    expect(result.state.ending).toEqual({ endingId: 'ending.god-ascension', alive: true })
  })

  it('finishes human setup before scheduling the first story node', () => {
    const result = simulate('v03-preflight-dev5-batch-01-sample-03', 'human')
    const pools = result.trace.map((entry) => entry.poolId)
    expect(pools.indexOf('pool.setup.faction')).toBeLessThan(pools.indexOf('pool.story.1'))
  })

  it('finishes transformed appearance and faction setup before granting soul rings', () => {
    const result = simulate('v03-preflight-dev5-batch-01-sample-02', 'beast')
    const pools = result.trace.map((entry) => entry.poolId)
    const firstRing = pools.indexOf('pool.human.soul-ring')
    expect(result.state.route).toBe('transformed')
    expect(pools.indexOf('pool.setup.appearance')).toBeLessThan(firstRing)
    expect(pools.indexOf('pool.setup.faction')).toBeLessThan(firstRing)
  })

  it('grants initial soul rings before the first human growth task', () => {
    const result = simulate('v03-preflight-dev5-r2-batch-01-sample-15', 'human')
    const pools = result.trace.map((entry) => entry.poolId)
    expect(pools.indexOf('pool.human.soul-ring')).toBeLessThan(pools.indexOf('pool.human.growth'))

    const growth = result.trace.find((entry) => entry.poolId === 'pool.human.growth')!
    const faultyTrace = [growth, ...result.trace.filter((entry) => entry !== growth)]
    expect(auditTraceOrder('human', faultyTrace, 20)).toContainEqual({
      code: 'invalid-task-order',
      message: 'First growth task ran before initial soul rings were granted',
    })
  })

  it('repeats a complete journey byte-for-byte for the same seed and commands', () => {
    const first = simulate('v03-beast-7', 'beast')
    const second = simulate('v03-beast-7', 'beast')
    expect(JSON.stringify(first.eventLog)).toBe(JSON.stringify(second.eventLog))
    expect(first.state).toEqual(second.state)
  })

  it('projects UI, biography and simulation facts from the same event log', () => {
    const result = simulate('v03-human-2', 'human')
    const view = projectGameView(result.state, result.eventLog, v03Content)
    const biography = formatBiography(view)
    expect(view.route).toBe(result.state.route)
    expect(view.rings).toHaveLength(result.state.progression.rings.length)
    expect(view.logs).toHaveLength(result.trace.length)
    expect(view.ending).toBe(v03Content.presentation.endings.get(result.state.ending!.endingId)?.title)
    expect(biography).toContain(`路线：${result.state.route}`)
    expect(biography).toContain(`终局：${view.ending}`)
    expect(biography.match(/^### 第/gm)).toHaveLength(result.trace.length)
  })
})
