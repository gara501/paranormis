export const ENTITY_CLASSES = ['cryptid', 'specter', 'entity', 'anomaly'] as const
export type EntityClass = (typeof ENTITY_CLASSES)[number]

const CLASS_LABELS: Record<EntityClass, string> = {
  cryptid: 'Críptido',
  specter: 'Espectro',
  entity: 'Entidad',
  anomaly: 'Anomalía',
}

const NAME_CLASSIFICATION: Partial<Record<EntityClass, string[]>> = {
  cryptid: [
    'la patasola', 'patasola', 'el mohan', 'mohan', 'la madremonte', 'madremonte',
    'el hombre caiman', 'hombre caiman', 'la tunda', 'tunda', 'el bufeo colorado',
    'bufeo colorado', 'la mancarita', 'mancarita', 'la mula de tres patas',
    'mula de tres patas', 'la madre del rio', 'madre del rio',
  ],
  specter: [
    'el sombreron', 'sombreron', 'el silbon', 'silbon', 'la mechona', 'mechona',
    'la monja fantasma', 'monja fantasma', 'la mujer fantasma de la carretera',
    'mujer fantasma de la carretera', 'fantasma', 'poltergeist', 'el excavador del gaitan',
  ],
  entity: [
    'demonio de posesion', 'extraterrestres', 'seres grises', 'el duende', 'duende',
  ],
  anomaly: ['avistamiento ovni', 'ovni', 'objeto volador no identificado'],
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function classForCreatureName(name?: string | null): EntityClass {
  const normalized = normalizeName(name ?? '')
  for (const entityClass of ENTITY_CLASSES) {
    if (NAME_CLASSIFICATION[entityClass]?.some((candidate) => normalized === normalizeName(candidate))) {
      return entityClass
    }
  }
  return 'anomaly'
}

export function labelForEntityClass(entityClass: EntityClass): string {
  return CLASS_LABELS[entityClass]
}
