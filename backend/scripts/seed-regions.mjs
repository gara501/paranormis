import {randomBytes} from 'node:crypto'
import {createClient} from '@sanity/client'

const token = process.env.SANITY_WRITE_TOKEN
if (!token) throw new Error('Configura SANITY_WRITE_TOKEN para escribir en Sanity.')

const client = createClient({
  projectId: 'en0s05um',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token,
})

const regions = [
  {
    name: 'Tolima',
    country: 'Colombia',
    lat: 4.0355786,
    lng: -75.2086642,
    folkloreHistory: 'En el archivo, Tolima aparece en relatos de la Patasola, el Mohán, el Sombrerón, la Madre del Río y el Duende. El punto señala el centro aproximado del departamento, no un avistamiento.',
    creatures: ['La Patasola', 'El Mohán', 'El Sombrerón', 'La Madre del Río', 'El Duende'],
  },
  {
    name: 'Antioquia',
    country: 'Colombia',
    lat: 7.0000085,
    lng: -75.5000086,
    folkloreHistory: 'Tradiciones rurales de Antioquia relacionan el monte y los cursos de agua con la Madremonte y la Madre del Río; también circulan variantes del Sombrerón y la Mula de Tres Patas.',
    creatures: ['La Madremonte', 'El Sombrerón', 'La Madre del Río', 'La Mula de Tres Patas'],
  },
  {
    name: 'Magdalena Medio',
    country: 'Colombia',
    lat: 7.0673313,
    lng: -73.8525627,
    folkloreHistory: 'El valle del Magdalena está asociado con narraciones sobre el Mohán, la Madremonte y la Madre del Río. El punto de Barrancabermeja sirve como referencia cartográfica aproximada de esta amplia región.',
    creatures: ['El Mohán', 'La Madremonte', 'La Madre del Río'],
  },
  {
    name: 'Plato, Magdalena',
    country: 'Colombia',
    lat: 9.7904163,
    lng: -74.7820016,
    folkloreHistory: 'Municipio ribereño del Magdalena vinculado a la leyenda del Hombre Caimán. El punto corresponde a la localidad, no a un encuentro individual.',
    creatures: ['El Hombre Caimán'],
  },
  {
    name: 'Tumaco, Nariño',
    country: 'Colombia',
    lat: 1.8062887,
    lng: -78.7649814,
    folkloreHistory: 'En la tradición oral afrocolombiana del Pacífico sur se cuentan versiones de La Tunda, especialmente en Tumaco y sus alrededores.',
    creatures: ['La Tunda'],
  },
  {
    name: 'Estado Portuguesa',
    country: 'Venezuela',
    lat: 9.0188628,
    lng: -69.2736055,
    folkloreHistory: 'Los Llanos venezolanos son el ámbito de origen de los relatos del Silbón. Portuguesa representa una zona de esa tradición; su centro no señala un evento concreto.',
    creatures: ['El Silbón'],
  },
  {
    name: 'Llanos Orientales (Villavicencio)',
    country: 'Colombia',
    lat: 4.1114595,
    lng: -73.4967836,
    folkloreHistory: 'La leyenda del Silbón también circula en los Llanos Orientales colombianos. Villavicencio es una referencia geográfica para esa región extensa.',
    creatures: ['El Silbón'],
  },
  {
    name: 'Loreto',
    country: 'Perú',
    lat: -5,
    lng: -75,
    folkloreHistory: 'La tradición amazónica peruana incluye relatos del Bufeo Colorado alrededor de los ríos y del delfín rosado. El punto marca el centro aproximado de Loreto.',
    creatures: ['El Bufeo Colorado'],
  },
  {
    name: 'Amazonía brasileña (Manaos)',
    country: 'Brasil',
    lat: -3.1316333,
    lng: -59.9825041,
    folkloreHistory: 'En Brasil, el Boto forma parte de narraciones amazónicas emparentadas con el Bufeo Colorado. Manaos sirve como referencia cartográfica, no como lugar de un testimonio.',
    creatures: ['El Bufeo Colorado'],
  },
  {
    name: 'Boyacá',
    country: 'Colombia',
    lat: 5.6278979,
    lng: -72.8268617,
    folkloreHistory: 'La Mancarita figura en relatos campesinos andinos recopilados en Boyacá y Santander. El punto señala el centro aproximado del departamento.',
    creatures: ['La Mancarita'],
  },
  {
    name: 'Santander',
    country: 'Colombia',
    lat: 7.0000085,
    lng: -73.2500086,
    folkloreHistory: 'Santander comparte con Boyacá variantes orales sobre La Mancarita. La ubicación es regional y aproximada.',
    creatures: ['La Mancarita'],
  },
  {
    name: 'Eje Cafetero (Pereira)',
    country: 'Colombia',
    lat: 4.7854606,
    lng: -75.788322,
    folkloreHistory: 'En el Eje Cafetero se cuentan versiones de la Mula de Tres Patas. Pereira actúa como punto de referencia para la región.',
    creatures: ['La Mula de Tres Patas'],
  },
  {
    name: 'Arenoso, Duarte',
    country: 'República Dominicana',
    lat: 19.18884,
    lng: -69.7697808,
    folkloreHistory: 'La ficha de La Mechona remite a una fuente localizada en Arenoso bajo el nombre «El Mixto de la Mechona». La relación con otras versiones permanece por confirmar.',
    creatures: ['La Mechona'],
  },
  {
    name: 'Bogotá',
    country: 'Colombia',
    lat: 4.6533817,
    lng: -74.0836331,
    folkloreHistory: 'Una variante urbana de la Monja Fantasma se cuenta entre conductores de Bogotá, en particular sobre la calle 100. El punto indica la ciudad y no ese tramo exacto.',
    creatures: ['La Monja Fantasma'],
  },
  {
    name: 'Tuluá, Valle del Cauca',
    country: 'Colombia',
    lat: 4.0856667,
    lng: -76.1972779,
    folkloreHistory: 'También circulan relatos locales de una monja fantasma en Tuluá y sus alrededores. La ubicación señala la localidad.',
    creatures: ['La Monja Fantasma'],
  },
  {
    name: 'Nariño',
    country: 'Colombia',
    lat: 1.5842268,
    lng: -77.8585766,
    folkloreHistory: 'El Duende aparece en variantes de la tradición oral nariñense. El centro del departamento permite identificar la región sin atribuir un avistamiento preciso.',
    creatures: ['El Duende'],
  },
]

const published = (docs) => docs.filter((doc) => !doc._id.startsWith('drafts.'))
const keyOf = (name, country) => country + '\u0000' + name
const [existingRegions, existingCreatures] = await Promise.all([
  client.fetch('*[_type == "region"]{_id,name,country}'),
  client.fetch('*[_type == "creature"]{_id,name,regions}'),
])
const regionsByKey = new Map(published(existingRegions).map((doc) => [keyOf(doc.name, doc.country), doc]))
const creaturesByName = new Map(published(existingCreatures).map((doc) => [doc.name, doc]))
const missingCreatures = [...new Set(regions.flatMap((region) => region.creatures))].filter((name) => !creaturesByName.has(name))
if (missingCreatures.length) throw new Error('Faltan criaturas publicadas: ' + missingCreatures.join(', '))

if (process.argv.includes('--dry-run')) {
  const newRegions = regions.filter((region) => !regionsByKey.has(keyOf(region.name, region.country)))
  console.log(JSON.stringify({
    regionesDefinidas: regions.length,
    regionesPorCrear: newRegions.map(({name, country}) => name + ' · ' + country),
    criaturasPorVincular: [...new Set(regions.flatMap((region) => region.creatures))].length,
  }, null, 2))
  process.exit(0)
}

let created = 0
let linked = 0
for (const region of regions) {
  const key = keyOf(region.name, region.country)
  if (regionsByKey.has(key)) continue
  const doc = await client.create({
    _type: 'region',
    name: region.name,
    country: region.country,
    centroid: {_type: 'geopoint', lat: region.lat, lng: region.lng},
    folkloreHistory: region.folkloreHistory,
  })
  regionsByKey.set(key, doc)
  created += 1
  console.log('Región creada: ' + region.name + ' · ' + region.country)
}

for (const creature of creaturesByName.values()) {
  const targetIds = regions
    .filter((region) => region.creatures.includes(creature.name))
    .map((region) => regionsByKey.get(keyOf(region.name, region.country))._id)
  if (!targetIds.length) continue
  const current = creature.regions ?? []
  const newIds = targetIds.filter((id) => !current.some((item) => item._ref === id))
  if (!newIds.length) continue
  const references = newIds.map((_ref) => ({
    _type: 'reference',
    _ref,
    _key: randomBytes(6).toString('hex'),
  }))
  await client.patch(creature._id).setIfMissing({regions: []}).append('regions', references).commit()
  linked += 1
  console.log('Criatura vinculada: ' + creature.name + ' (' + references.length + ' regiones)')
}

console.log(JSON.stringify({regionesCreadas: created, criaturasActualizadas: linked}))