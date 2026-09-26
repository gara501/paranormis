import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'en0s05um',
    dataset: 'production',
  },
  deployment: {
    autoUpdates: true,
  },
})
