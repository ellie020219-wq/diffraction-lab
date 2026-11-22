export const routes = {
  home: '#/',
  slits: '#/slits',
  farfield: '#/farfield',
  comparison: '#/comparison',
  quiz: '#/quiz',
  model: '#/model',
} as const

export type Page = keyof typeof routes

export function pageFor(hash: string): Page {
  if (hash === '#experiment' || hash === '#results') return 'slits'
  if (hash === '#model') return 'model'
  return (Object.keys(routes) as Page[]).find((page) => routes[page] === hash) ?? 'home'
}
