import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'route',
  title: 'Ruta de investigación',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Título', type: 'string', validation: (Rule) => Rule.required().max(120)}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title', maxLength: 96}, validation: (Rule) => Rule.required()}),
    defineField({name: 'city', title: 'Ciudad', type: 'string', validation: (Rule) => Rule.required()}),
    defineField({name: 'description', title: 'Descripción', type: 'text', validation: (Rule) => Rule.required().min(30).max(1200)}),
    defineField({
      name: 'stops', title: 'Paradas', type: 'array',
      of: [defineArrayMember({type: 'object', fields: [
        defineField({name: 'sighting', title: 'Expediente', type: 'reference', to: [{type: 'sighting'}], validation: (Rule) => Rule.required()}),
        defineField({name: 'note', title: 'Nota de la parada', type: 'text', rows: 3, validation: (Rule) => Rule.max(300)}),
      ]})],
      validation: (Rule) => Rule.required().min(2).max(20),
    }),
    defineField({name: 'estimatedMinutes', title: 'Duración estimada (minutos)', type: 'number', validation: (Rule) => Rule.required().integer().min(15).max(1440)}),
    defineField({name: 'coverImage', title: 'Imagen de portada', type: 'image', options: {hotspot: true}, fields: [defineField({name: 'alt', title: 'Texto alternativo', type: 'string', validation: (Rule) => Rule.required().max(180)})]}),
  ],
  preview: {select: {title: 'title', subtitle: 'city', media: 'coverImage'}},
})
