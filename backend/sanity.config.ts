import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'paranormis',
  title: 'Paranormis · Archivo de fenómenos',
  projectId: 'en0s05um',
  dataset: 'production',
  plugins: [structureTool(), visionTool()],
  schema: {types: schemaTypes},
})
