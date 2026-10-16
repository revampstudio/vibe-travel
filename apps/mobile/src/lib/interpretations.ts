import type { Planet, LineType } from '../types'

export const ANGLE_MEANINGS: Record<LineType, { name: string; meaning: string; travel: string; live: string }> = {
  ASC: { name: 'Ascendant · self and beginnings', meaning: 'The Ascendant is the eastern horizon: a planet rising at your birth. Astrologers associate it with your first impressions, physical presence and approach to new experiences.', travel: 'Notice the roles you try on, how you introduce yourself and what gives you energy.', live: 'Reflect on whether the identity you develop here feels sustainable in everyday life.' },
  DSC: { name: 'Descendant · relationships', meaning: 'The Descendant is the western horizon: a planet setting at your birth. Its symbolism is explored through partners, close friends, collaborators and the qualities you meet in others.', travel: 'Leave room for conversation and shared experiences, while checking assumptions about new connections.', live: 'Discuss boundaries, mutual expectations and how you would build a local support network.' },
  MC: { name: 'Midheaven · public life', meaning: 'The Midheaven marks a planet culminating above the horizon at your birth. It is associated with vocation, visibility, reputation and the contribution you make to the wider world.', travel: 'Explore local creative or professional communities and notice what you want to contribute.', live: 'Consider the kind of work, visibility and responsibility you want over the long term.' },
  IC: { name: 'Imum Coeli · home and roots', meaning: 'The IC is opposite the Midheaven, below the horizon. Its symbolism centres on home, privacy, family patterns and the foundations that help you feel settled.', travel: 'Try a slower stay and pay attention to what helps you feel grounded away from home.', live: 'Look closely at domestic routines, emotional space and the kind of home you could build.' },
}
const PLANET_MEANINGS: Record<Planet, { theme: string; opportunity: string; tension: string }> = {
  Sun: { theme: 'identity, vitality and creative purpose', opportunity: 'Practise being seen and making choices that feel personally meaningful', tension: 'Watch for pressure to perform, over-identifying with a role or needing constant recognition' },
  Moon: { theme: 'emotions, habits, memory and belonging', opportunity: 'Notice your needs for care, familiar rhythms and emotional connection', tension: 'Sensitivity, changing moods or old family patterns may need extra space' },
  Mercury: { theme: 'language, learning, movement and exchange', opportunity: 'Explore writing, classes, local conversations and collaborative ideas', tension: 'A busy mind or constant activity can make it harder to switch off' },
  Venus: { theme: 'relationships, pleasure, beauty and values', opportunity: 'Make room for art, friendship, affection and the things you find beautiful', tension: 'Comfort-seeking, overspending or avoiding difficult conversations can obscure your needs' },
  Mars: { theme: 'initiative, desire, assertion and effort', opportunity: 'Channel motivation into movement, independent projects and clear decisions', tension: 'Impatience, competition or conflict call for pacing and direct, respectful boundaries' },
  Jupiter: { theme: 'growth, education, faith and wider horizons', opportunity: 'Explore study, cultural exchange and possibilities beyond your usual frame of reference', tension: 'Optimism can become overcommitment; check costs and practical details' },
  Saturn: { theme: 'structure, time, responsibility and mastery', opportunity: 'Build patient routines, defined commitments and skills that mature through practice', tension: 'Duty or isolation can feel heavy; make room for rest and support' },
  Uranus: { theme: 'independence, experimentation and change', opportunity: 'Explore fresh communities and more flexible ways of living or working', tension: 'Novelty and disruption can compete with your need for stability' },
  Neptune: { theme: 'imagination, spirituality, compassion and idealisation', opportunity: 'Create space for art, contemplation and reflective time', tension: 'Inspiration can blur expectations; verify agreements and keep clear boundaries' },
  Pluto: { theme: 'power, depth, endings and renewal', opportunity: 'Reflect on what you want to change and which commitments still feel authentic', tension: 'Intensity or control struggles can become consuming; respect your limits and those of others' },
}
export function getInterpretation(planet: Planet, lineType: LineType): string {
  const p = PLANET_MEANINGS[planet]
  const a = ANGLE_MEANINGS[lineType]
  return `In astrology, ${planet} symbolises ${p.theme}. ${a.meaning}\n\nPossibilities: ${p.opportunity}.\n\nWhat to watch: ${p.tension}.\n\nFor a visit: ${a.travel}\n\nFor a longer stay: ${a.live}`
}
export const ASTROLOGY_CONTEXT = 'Astrocartography maps where planets were rising, setting, overhead or below the horizon at the moment of birth. The planet suggests a theme; the angle suggests where that theme is explored. These are symbolic interpretations, not predictions. Nearby lines can offer several themes at once; more lines does not mean a better place.'
