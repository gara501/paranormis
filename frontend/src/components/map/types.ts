import type L from 'leaflet'
import type {EntityClass} from '../../data/entityClass'

export interface MapSignal {
  _id: string
  title?: string
  city?: string
  location: {lat: number; lng: number}
  credibilityIndex: number | null
  status: string
  entityClass: EntityClass
  testimonyAudioUrl?: string
}
