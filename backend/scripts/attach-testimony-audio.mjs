import {createReadStream, existsSync} from 'node:fs'
import path from 'node:path'
import {createClient} from '@sanity/client'

const token = process.env.SANITY_WRITE_TOKEN
if (!token) throw new Error('Configura SANITY_WRITE_TOKEN para adjuntar grabaciones en Sanity.')

const client = createClient({projectId: 'en0s05um', dataset: 'production', apiVersion: '2024-01-01', useCdn: false, token})
const mappings = new Map([
  ['tequendama', 'drafts.sighting-espantos-refugio-del-salto'],
  ['morgue', 'drafts.sighting-morgue-san-juan-de-dios'],
  ['transmilenio', 'drafts.sighting-nina-bicentenario-transmilenio'],
  ['gorgona', 'drafts.sighting-ecos-prision-gorgona'],
  ['jose-raimundo', 'drafts.sighting-fantasma-jose-raimundo-russi'],
])

const inputs = process.argv.slice(2).filter((arg) => arg !== '--dry-run').map((arg) => {
  const [key, title, filePath] = arg.split('|')
  if (!key || !title || !filePath || !mappings.has(key)) throw new Error(`Argumento inválido: ${arg}. Formato: clave|título|ruta`)
  if (!existsSync(filePath)) throw new Error(`No se encuentra el archivo: ${filePath}`)
  return {key, title, filePath, documentId: mappings.get(key)}
})
if (!inputs.length) throw new Error('Indica al menos un audio en formato clave|título|ruta.')

const ids = [...new Set(inputs.map((item) => item.documentId))]
const docs = await client.fetch('*[_id in $ids]{_id,title,testimonyAudios[]{title,"assetId":file.asset._ref}}', {ids})
const byId = new Map(docs.map((doc) => [doc._id, doc]))
for (const input of inputs) if (!byId.has(input.documentId)) throw new Error(`No existe el borrador esperado para ${input.key}.`)

const pending = inputs.filter((input) => !byId.get(input.documentId).testimonyAudios?.some((audio) => audio.title === input.title))
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({mode: 'simulación', audios: inputs.map(({key, title, filePath}) => ({key, title, fileName: path.basename(filePath)})), porAdjuntar: pending.length}, null, 2))
  process.exit(0)
}

const uploaded = new Map()
for (const input of pending) {
  const asset = await client.assets.upload('file', createReadStream(input.filePath), {filename: path.basename(input.filePath), contentType: 'audio/mpeg'})
  uploaded.set(input, {_key: input.key, _type: 'object', title: input.title, file: {_type: 'file', asset: {_type: 'reference', _ref: asset._id}}})
}

let transaction = client.transaction()
for (const documentId of new Set(pending.map((item) => item.documentId))) {
  const doc = byId.get(documentId)
  const additions = pending.filter((item) => item.documentId === documentId).map((item) => uploaded.get(item))
  transaction = transaction.patch(documentId, (patch) => patch.set({testimonyAudios: [...(doc.testimonyAudios ?? []), ...additions]}))
}
if (pending.length) await transaction.commit()
console.log(JSON.stringify({mode: 'audios adjuntos a borradores', audiosAdjuntos: pending.length, expedientesActualizados: new Set(pending.map((item) => item.documentId)).size, yaPresentes: inputs.length - pending.length}, null, 2))
