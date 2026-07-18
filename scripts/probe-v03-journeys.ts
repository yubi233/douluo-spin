import { simulateJourney } from '@/application/simulation'
import { v03Content, v03Policies } from '@/content/v03/content'

for (const route of ['human', 'beast'] as const) {
  for (let index = 1; index <= 100; index += 1) {
    const seed = `v03-${route}-${index}`
    const result = simulateJourney(v03Content, v03Policies, { seed, route })
    console.log(JSON.stringify({
      seed,
      route: result.state.route,
      turns: result.trace.length,
      completed: result.completed,
      ending: result.state.ending,
      rings: result.state.progression.rings.length,
      stories: result.state.progression.storyNodes.length,
      tribulations: result.state.progression.resolvedTribulations,
      audit: result.audit,
    }))
  }
}
