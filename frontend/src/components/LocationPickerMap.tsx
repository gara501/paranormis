import {useEffect, useRef} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface Coordinates {
  lat: number
  lng: number
}

interface LocationPickerMapProps {
  value: Coordinates | null
  onChange: (coordinates: Coordinates) => void
}

export default function LocationPickerMap({value, onChange}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {center: [12, -20], zoom: 2, zoomControl: false})
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map)

    function placeMarker(coordinates: Coordinates) {
      const latLng = L.latLng(coordinates.lat, coordinates.lng)
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(latLng, {
          radius: 8,
          color: '#42e8ff',
          fillColor: '#b6ff52',
          fillOpacity: 0.95,
          weight: 2,
          className: 'location-picker__signal',
        }).addTo(map)
      } else {
        markerRef.current.setLatLng(latLng)
      }
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      const coordinates = {lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6))}
      placeMarker(coordinates)
      onChangeRef.current(coordinates)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!value || !mapRef.current || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return
    const map = mapRef.current
    const latLng = L.latLng(value.lat, value.lng)
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(latLng, {
        radius: 8,
        color: '#42e8ff',
        fillColor: '#b6ff52',
        fillOpacity: 0.95,
        weight: 2,
        className: 'location-picker__signal',
      }).addTo(map)
      map.setView(latLng, 6, {animate: false})
    } else {
      markerRef.current.setLatLng(latLng)
    }
  }, [value?.lat, value?.lng])

  return (
    <div className="dossier__location-picker-shell">
      <div ref={containerRef} className="dossier__location-picker" aria-label="Mapa para elegir la ubicación del avistamiento" />
      <p className="dossier__map-caption"><span>⌖</span> Selecciona un punto en el mapa para registrar la ubicación.</p>
    </div>
  )
}



