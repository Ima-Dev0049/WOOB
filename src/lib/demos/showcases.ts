export const demoShowcases = [
  {
    slug: 'king-food',
    name: 'King Food',
    type: 'Restaurant',
    tagline: 'Une table généreuse, une identité chaleureuse.',
    image: '/images/demos/king-food-hero.jpg',
    color: '#a34a2d',
  },
  {
    slug: 'atelier-ligne',
    name: 'Atelier Ligne',
    type: 'Portfolio',
    tagline: 'Des images, des matières et un rythme éditorial.',
    image: '/images/demos/portfolio-hero.jpg',
    color: '#285c58',
  },
  {
    slug: 'studio-cap',
    name: 'Studio Cap',
    type: 'Formation',
    tagline: 'Un parcours clair pour donner envie d’apprendre.',
    image: '/images/demos/formation-hero.jpg',
    color: '#477554',
  },
] as const;

export type DemoSlug = typeof demoShowcases[number]['slug'];

export function isDemoSlug(value: string): value is DemoSlug {
  return demoShowcases.some((demo) => demo.slug === value);
}
