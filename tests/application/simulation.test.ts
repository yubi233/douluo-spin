import { describe, expect, it } from 'vitest'
import { auditBeastIdentity, auditTraceOrder, simulateJourney } from '@/application/simulation'
import { formatBiography, projectGameView } from '@/application/gameViewModel'
import { v03Content, v03Policies } from '@/content/v03/content'
import { legacyFlow } from '@/content/v03/legacyFlow'

function simulate(seed: string, route: 'human' | 'beast') {
  return simulateJourney(v03Content, v03Policies, { seed, route, maxTurns: 240 })
}

const godOfferPoolIds = new Set([20, 30, 40, 50, 60, 70, 80, 99].map((threshold) => `pool.god-offer.${threshold}`))
const activeFlowPoolIds = new Set([
  ...legacyFlow.pools.map((pool) => pool.activePoolId),
  ...legacyFlow.virtualPools.map((pool) => pool.activePoolId),
  ...godOfferPoolIds,
])
const humanEntryPoolIds = new Set(legacyFlow.entrypoints.human)
const beastEntryPoolIds = new Set(legacyFlow.entrypoints.beast)
const ringPoolIds = new Set(legacyFlow.progression.soulRingByIndex.map((entry) => entry.poolId))
const humanGrowthPoolIds = new Set(legacyFlow.progression.humanGrowthByAge.map((entry) => entry.poolId))

function traceIndex(trace: readonly { poolId: string }[], candidates: ReadonlySet<string>) {
  return trace.findIndex((entry) => candidates.has(entry.poolId))
}

describe('v0.3 original-content deterministic journeys', () => {
  it('runs a human journey only through generated original or explicit virtual pools', () => {
    const result = simulate('v03-human-2', 'human')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.completed).toBe(true)
    expect(result.state.route).toBe('human')
    expect(result.state.ending).not.toBeNull()
    expect(result.trace.length).toBeGreaterThan(0)
    expect(humanEntryPoolIds.has(result.trace[0]!.poolId as never)).toBe(true)
    expect(result.trace.every((entry) => activeFlowPoolIds.has(entry.poolId as never))).toBe(true)
  })

  it('keeps the original soul-ring sequence ahead of the first human growth task', () => {
    const result = simulate('v03-human-2', 'human')
    const firstRing = traceIndex(result.trace, ringPoolIds)
    const firstGrowth = traceIndex(result.trace, humanGrowthPoolIds)

    expect(firstRing).toBeGreaterThanOrEqual(0)
    expect(firstGrowth).toBeGreaterThanOrEqual(0)
    expect(firstRing).toBeLessThan(firstGrowth)
    expect(auditTraceOrder(result.state.route, result.trace, 20)).toEqual([])

    const growth = result.trace[firstGrowth]!
    const faultyTrace = [growth, ...result.trace.filter((entry) => entry !== growth)]
    expect(auditTraceOrder('human', faultyTrace, 20)).toContainEqual({
      code: 'invalid-task-order',
      message: 'First growth task ran before initial soul rings were granted',
    })
  })

  it('commits exactly one terminal event and clears the agenda for a real lethal path', () => {
    const result = simulate('v03-human-2', 'human')
    const terminalEvents = result.eventLog.flatMap((batch) => batch.events.filter((event) => event.type === 'run.finished'))

    expect(result.state.ending).toEqual({ endingId: 'ending.death', alive: false })
    expect(result.state.agenda).toEqual([])
    expect(terminalEvents).toEqual([{ type: 'run.finished', endingId: 'ending.death', alive: false }])
  })

  it('uses the generated god offer, original god pools and gated reward progression to ascend', () => {
    const result = simulate('v03-recovery-human-023', 'human')
    const godTierPoolIds = new Set(legacyFlow.pools.filter((pool) => pool.role === 'god-tier').map((pool) => pool.activePoolId))
    const deityPoolIds = new Set(legacyFlow.pools.filter((pool) => pool.role === 'god-deity').map((pool) => pool.activePoolId))
    const rewardPoolIds = new Set(legacyFlow.pools.filter((pool) => pool.role === 'god-reward').map((pool) => pool.activePoolId))

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.state.ending).toEqual({ endingId: 'ending.god-ascension', alive: true })
    expect(result.state.progression.godTrial).toMatchObject({ origin: 'inheritance' })
    expect(result.trace.some((entry) => entry.poolId.startsWith('pool.god-offer.'))).toBe(true)
    expect(result.trace.some((entry) => godTierPoolIds.has(entry.poolId as never))).toBe(true)
    expect(result.trace.some((entry) => deityPoolIds.has(entry.poolId as never))).toBe(true)
    expect(result.trace.some((entry) => rewardPoolIds.has(entry.poolId as never))).toBe(true)
  })

  it('keeps beast type, species, bloodline and area compatible with original IDs', () => {
    const result = simulate('v03-beast-2', 'beast')

    expect(result.audit.passed).toBe(true)
    expect(result.state.route).toBe('beast')
    expect(beastEntryPoolIds.has(result.trace[0]!.poolId as never)).toBe(true)
    expect(result.state.entities['beast-bloodline']).toHaveLength(1)
    expect(result.state.entities['beast-bloodline'][0]).toMatch(/^entity\.legacy\.beast-bloodline\./)
    expect(auditBeastIdentity(result.state)).toEqual([])

    const invalid = structuredClone(result.state) as unknown as { entities: Record<string, string[]> }
    invalid.entities['beast-type'] = ['entity.legacy.beast-type.invalid']
    invalid.entities['beast-species'] = ['entity.legacy.beast-species.invalid']
    invalid.entities['beast-bloodline'] = ['entity.legacy.beast-bloodline.invalid']
    invalid.entities['beast-area'] = ['entity.legacy.beast-area.invalid']
    expect(auditBeastIdentity(invalid as never)[0]?.code).toBe('incompatible-beast-identity')
  })

  it('changes a real beast route into transformed human setup before continuing its original journey', () => {
    const result = simulate('v03-recovery-beast-001', 'beast')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.state.route).toBe('transformed')
    expect(result.state.progression.beastRouteChoiceResolved).toBe(true)
    expect(result.state.entities['martial-soul']).toHaveLength(1)
    expect(result.trace.some((entry) => humanEntryPoolIds.has(entry.poolId as never))).toBe(true)
    expect(result.trace.every((entry) => activeFlowPoolIds.has(entry.poolId as never))).toBe(true)
  })

  it('repeats a complete journey byte-for-byte for the same seed and commands', () => {
    const first = simulate('v03-recovery-beast-007', 'beast')
    const second = simulate('v03-recovery-beast-007', 'beast')

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
