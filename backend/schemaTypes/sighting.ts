import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'sighting',
  title: 'Avistamiento',
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
      name: 'creature',
      title: 'Criatura reportada',
      type: 'reference',
      to: [{type: 'creature'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'region',
      title: 'Región',
      type: 'reference',
      to: [{type: 'region'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Punto en el mapa',
      type: 'geopoint',
      description:
        'Lugar informado, localidad o centro regional aproximado. Consulta la precisión antes de interpretar el punto.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'locationPrecision',
      title: 'Precisión de ubicación',
      type: 'string',
      options: {list: [
        {title: 'Lugar exacto indicado por la fuente', value: 'exact'},
        {title: 'Localidad o punto de referencia; ubicación aproximada', value: 'locality'},
        {title: 'Solo región general; punto en el centro regional', value: 'region'},
      ]},
      initialValue: 'region',
    }),

    // --- Witness ---
    defineField({
      name: 'witness',
      title: 'Testigo',
      type: 'object',
      fields: [
        defineField({
          name: 'anonymous',
          title: '¿Testigo anónimo?',
          type: 'boolean',
          initialValue: true,
        }),
        defineField({
          name: 'name',
          title: 'Nombre',
          type: 'string',
          hidden: ({parent}) => parent?.anonymous,
        }),
        defineField({
          name: 'occupation',
          title: 'Ocupación o función',
          type: 'string',
          description: 'E.g. "park ranger", "local police officer", "hiker". Feeds the base credibility score.',
        }),
        defineField({
          name: 'baseCredibility',
          title: 'Credibilidad base del testigo',
          type: 'number',
          description: '1 (very low) to 5 (very high). Editorial judgment by the archive team when validating the report.',
          validation: (Rule) => Rule.min(1).max(5).required(),
          initialValue: 3,
        }),
        defineField({
          name: 'witnessState',
          title: 'Estado del testigo durante el avistamiento',
          type: 'string',
          options: {
            list: [
              {title: 'Sobrio y en control', value: 'sober'},
              {title: 'Bajo estrés o miedo intenso', value: 'stressed'},
              {title: 'Se reportó consumo de alcohol u otras sustancias', value: 'impaired'},
              {title: 'No especificado', value: 'unspecified'},
            ],
          },
          initialValue: 'unspecified',
        }),
      ],
    }),

    defineField({
      name: 'date',
      title: 'Fecha del evento o de la fuente',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dateBasis',
      title: 'Base de la fecha',
      type: 'string',
      options: {list: [
        {title: 'Fecha del evento indicada por la fuente', value: 'event'},
        {title: 'Periodo aproximado del evento', value: 'approximate_event'},
        {title: 'Fecha de recopilación o publicación del relato', value: 'record_date'},
      ]},
      initialValue: 'event',
    }),
    defineField({
      name: 'timeOfDay',
      title: 'Momento del día',
      type: 'string',
      options: {
        list: [
          {title: 'Amanecer', value: 'dawn'},
          {title: 'Día', value: 'day'},
          {title: 'Atardecer', value: 'dusk'},
          {title: 'Noche', value: 'night'},
          {title: 'Madrugada', value: 'late_night'},
          {title: 'No especificado', value: 'unspecified'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'freeformDescription',
      title: 'Relato del testigo',
      type: 'text',
      description: 'Resume lo que afirma la fuente y distingue el testimonio de una interpretación paranormal.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'accountType',
      title: 'Tipo de relato',
      type: 'string',
      options: {list: [
        {title: 'Testimonio presencial', value: 'eyewitness'},
        {title: 'Reporte contemporáneo de un testimonio', value: 'press_report'},
        {title: 'Tradición oral o relato recopilado', value: 'folklore'},
        {title: 'Texto histórico o religioso', value: 'historical_text'},
        {title: 'Relato clínico o historial de caso', value: 'case_history'},
      ]},
    }),
    defineField({name: 'sourceTitle', title: 'Título de la fuente', type: 'string'}),
    defineField({name: 'sourceUrl', title: 'URL de la fuente', type: 'url'}),

    defineField({
      name: 'testimonyAudio',
      title: 'Audio del testimonio',
      type: 'file',
      options: {
        accept: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm',
      },
      description:
        'Optional short field recording for this exact sighting. Keep clips concise; use a streaming service for long-form recordings.',
    }),

    defineField({
      name: 'observedTraits',
      title: 'Rasgos observados en este avistamiento',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description:
        'Traits the witness described. Compared against the creature\'s "distinctiveTraits" to calculate consistency — this is what keeps the credibility index from being manual.',
    }),

    // --- Environmental conditions: key for "cross-referencing patterns" ---
    defineField({
      name: 'environmentalConditions',
      title: 'Condiciones ambientales',
      type: 'object',
      fields: [
        defineField({
          name: 'moonPhase',
          title: 'Fase lunar',
          type: 'string',
          options: {
            list: [
              {title: 'Luna nueva', value: 'new'},
              {title: 'Creciente', value: 'waxing'},
              {title: 'Luna llena', value: 'full'},
              {title: 'Menguante', value: 'waning'},
              {title: 'Desconocido', value: 'unknown'},
            ],
          },
        }),
        defineField({
          name: 'weather',
          title: 'Clima',
          type: 'string',
          options: {
            list: [
              {title: 'Despejado', value: 'clear'},
              {title: 'Niebla', value: 'fog'},
              {title: 'Tormenta', value: 'storm'},
              {title: 'Lluvia ligera', value: 'light_rain'},
              {title: 'Nevada', value: 'snow'},
            ],
          },
        }),
        defineField({
          name: 'visibility',
          title: 'Visibilidad estimada',
          type: 'string',
          options: {
            list: [
              {title: 'Buena', value: 'good'},
              {title: 'Regular', value: 'fair'},
              {title: 'Mala', value: 'poor'},
            ],
          },
        }),
      ],
    }),

    defineField({
      name: 'corroboratedBy',
      title: 'Corroborado por otros avistamientos',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'sighting'}]})],
      description: 'References to other sightings nearby in time/space with similar descriptions.',
    }),

    // --- Computed field, not manually editable ---
    defineField({
      name: 'credibilityIndex',
      title: 'Índice de credibilidad (calculado)',
      type: 'number',
      readOnly: true,
      description:
        'Automatically calculated by cross-referencing: trait consistency, witness credibility, corroboration with other sightings, and folkloric density of the region. Do not edit by hand — see lib/calculateCredibility.ts',
    }),

    defineField({
      name: 'status',
      title: 'Estado del expediente',
      type: 'string',
      options: {
        list: [
          {title: 'Pendiente de revisión', value: 'pending'},
          {title: 'Verificado por el equipo', value: 'verified'},
          {title: 'Descartado', value: 'dismissed'},
        ],
      },
      initialValue: 'pending',
    }),
  ],
  preview: {
    select: {
      creatureName: 'creature.name',
      date: 'date',
      index: 'credibilityIndex',
    },
    prepare({creatureName, date, index}) {
      const formattedDate = date ? new Date(date).toLocaleDateString('es-CO') : 'sin fecha'
      return {
        title: creatureName ?? 'Avistamiento sin criatura asociada',
        subtitle: `${formattedDate} · credibilidad: ${index ?? 'sin calcular'}`,
      }
    },
  },
})


