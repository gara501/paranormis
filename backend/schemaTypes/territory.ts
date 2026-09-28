import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'territory',
  title: 'Territorio de leyenda',
  type: 'document',
  fields: [
    defineField({name: 'creature', title: 'Criatura asociada', type: 'reference', to: [{type: 'creature'}], validation: (Rule) => Rule.required()}),
    defineField({name: 'name', title: 'Nombre del territorio', type: 'string', validation: (Rule) => Rule.required().max(120)}),
    defineField({name: 'description', title: 'Descripción', type: 'text', validation: (Rule) => Rule.required().min(30).max(1200)}),
    defineField({
      name: 'area', title: 'Área aproximada', type: 'array',
      of: [defineArrayMember({type: 'geopoint'})],
      description: 'Dibuja el contorno aproximado como una secuencia de coordenadas. El mapa cerrará el polígono.',
      validation: (Rule) => Rule.required().min(3).max(200),
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'creature.name'}},
})
