import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'creature',
  title: 'Criatura',
  type: 'document',
  fields: [
    defineField({
      name: 'importSourceId',
      title: 'ID de origen de importación',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'name',
      title: 'Nombre principal',
      type: 'string',
      description: 'The name under which it is filed in the central archive. E.g. "Chupacabras"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'regionalNames',
      title: 'Nombres regionales',
      type: 'array',
      of: [{type: 'string'}],
      description: 'The same entity may have different names depending on the region where it is reported.',
    }),
    defineField({
      name: 'regions',
      title: 'Regiones asociadas',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'region'}]}],
      description: 'Regions where this creature has folkloric tradition or reported sightings.',
    }),
    defineField({
      name: 'physicalDescription',
      title: 'Descripción física',
      type: 'text',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'distinctiveTraits',
      title: 'Rasgos distintivos',
      type: 'array',
      of: [{type: 'string'}],
      description:
        'List of "official" traits for this creature (e.g. "glowing red eyes", "backward feet"). Each sighting is compared against this list to calculate consistency.',
      validation: (Rule) =>
        Rule.min(1).error('You need at least one distinctive trait to be able to calculate consistency.'),
    }),
    defineField({
      name: 'archiveIllustration',
      title: 'Ilustración de archivo',
      type: 'image',
      options: {hotspot: true},
      description: 'The retrofuturist classified-archive-style illustration.',
    }),
    defineField({
      name: 'threatLevel',
      title: 'Nivel de amenaza',
      type: 'string',
      options: {
        list: [
          {title: 'Inofensivo', value: 'harmless'},
          {title: 'Precaución', value: 'caution'},
          {title: 'Peligroso', value: 'dangerous'},
          {title: 'Desconocido', value: 'unknown'},
        ],
        layout: 'radio',
      },
      initialValue: 'unknown',
    }),
    defineField({
      name: 'folkloreOrigin',
      title: 'Origen folclórico',
      type: 'text',
      description: 'Historical/cultural context of the legend.',
    }),
  ],
  preview: {
    select: {
      title: 'name',
      media: 'archiveIllustration',
      threatLevel: 'threatLevel',
    },
    prepare({title, media, threatLevel}) {
      return {
        title,
        subtitle: threatLevel ? `Amenaza: ${threatLevel}` : undefined,
        media,
      }
    },
  },
})


