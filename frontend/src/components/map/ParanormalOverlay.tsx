import {useEffect, useRef} from 'react'
import L from 'leaflet'
import type {EntityClass} from '../../data/entityClass'
import type {MapSignal} from './types'

interface ParanormalOverlayProps {
  map: L.Map
  signals: readonly MapSignal[]
  visibleClasses: ReadonlySet<EntityClass>
  selectedSignalId: string | null
  flashlightOn: boolean
  receiverActive: boolean
  staticBurst: boolean
  reducedMotion: boolean
  onSelect: (signalId: string) => void
  onReceiverLevel: (level: number, dt: number) => void
}

interface RuntimeSignal extends MapSignal {
  latLng: L.LatLng
  x: number
  y: number
  radius: number
  signalColor: string
  phase: number
  reveal: number
  lastSweep: number
}

interface FogLayer {
  pattern: CanvasPattern
  matrix: DOMMatrix
  scale: number
  speed: number
  alpha: number
}

const TAU = Math.PI * 2
const HIT_RADIUS = 18
const STATUS_COLORS = {
  corroborated: '#e9e6dd',
  review: '#b9a77e',
  unverified: '#d63b35',
} as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function colorForStatus(status: string): string {
  const normalized = status.toLocaleLowerCase('es')
  if (normalized === 'verified' || normalized === 'corroborated' || normalized === 'corroborada') {
    return STATUS_COLORS.corroborated
  }
  if (normalized === 'pending' || normalized === 'under review' || normalized === 'en revisión') {
    return STATUS_COLORS.review
  }
  return STATUS_COLORS.unverified
}

function wrapAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function createFogTexture(): HTMLCanvasElement {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return canvas

  const octaves = [
    {cells: 8, amplitude: 0.5},
    {cells: 16, amplitude: 0.28},
    {cells: 32, amplitude: 0.14},
    {cells: 64, amplitude: 0.08},
  ]
  const noise = octaves.map(({cells}) => {
    const values = new Float32Array(cells * cells)
    for (let i = 0; i < values.length; i += 1) values[i] = Math.random()
    return {cells, values}
  })
  const image = context.createImageData(size, size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0
      for (let octave = 0; octave < octaves.length; octave += 1) {
        const {cells, values} = noise[octave]
        const gx = (x / size) * cells
        const gy = (y / size) * cells
        const x0 = Math.floor(gx) % cells
        const y0 = Math.floor(gy) % cells
        const x1 = (x0 + 1) % cells
        const y1 = (y0 + 1) % cells
        const tx = smooth(gx - Math.floor(gx))
        const ty = smooth(gy - Math.floor(gy))
        const top = values[y0 * cells + x0] * (1 - tx) + values[y0 * cells + x1] * tx
        const bottom = values[y1 * cells + x0] * (1 - tx) + values[y1 * cells + x1] * tx
        value += (top * (1 - ty) + bottom * ty) * octaves[octave].amplitude
      }
      const alpha = Math.round(clamp(Math.max(0, value - 0.42) * 2.2, 0, 1) * 255)
      const index = (y * size + x) * 4
      image.data[index] = 137
      image.data[index + 1] = 135
      image.data[index + 2] = 127
      image.data[index + 3] = alpha
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function makeFogLayers(context: CanvasRenderingContext2D, texture: HTMLCanvasElement): FogLayer[] {
  const layers: FogLayer[] = []
  const first = context.createPattern(texture, 'repeat')
  const second = context.createPattern(texture, 'repeat')
  if (!first || !second || typeof DOMMatrix === 'undefined') return layers
  layers.push({pattern: first, matrix: new DOMMatrix(), scale: 2.2, speed: 6, alpha: 0.13})
  layers.push({pattern: second, matrix: new DOMMatrix(), scale: 3.4, speed: -10, alpha: 0.09})
  return layers
}

function drawSigil(context: CanvasRenderingContext2D, entityClass: EntityClass, x: number, y: number, radius: number): void {
  const r = radius
  context.beginPath()
  if (entityClass === 'cryptid') {
    for (let claw = -1; claw <= 1; claw += 1) {
      const startX = x + claw * r * 0.55
      context.moveTo(startX - r * 0.22, y - r * 0.82)
      context.quadraticCurveTo(startX + r * 0.18, y, startX + r * 0.42, y + r * 0.8)
    }
  } else if (entityClass === 'specter') {
    context.moveTo(x - r * 0.82, y + r * 0.72)
    context.lineTo(x - r * 0.82, y - r * 0.08)
    context.arc(x, y - r * 0.08, r * 0.82, Math.PI, 0)
    context.lineTo(x + r * 0.82, y + r * 0.72)
    context.lineTo(x + r * 0.4, y + r * 0.48)
    context.lineTo(x, y + r * 0.76)
    context.lineTo(x - r * 0.4, y + r * 0.48)
    context.closePath()
    context.moveTo(x - r * 0.33, y - r * 0.06)
    context.arc(x - r * 0.33, y - r * 0.06, r * 0.055, 0, TAU)
    context.moveTo(x + r * 0.39, y - r * 0.06)
    context.arc(x + r * 0.39, y - r * 0.06, r * 0.055, 0, TAU)
  } else if (entityClass === 'entity') {
    context.moveTo(x - r * 0.84, y - r * 0.64)
    context.lineTo(x + r * 0.84, y - r * 0.64)
    context.lineTo(x, y + r * 0.88)
    context.closePath()
    context.moveTo(x, y - r * 0.1)
    context.ellipse(x, y - r * 0.1, r * 0.22, r * 0.11, 0, 0, TAU)
    context.moveTo(x + r * 0.045, y - r * 0.1)
    context.arc(x, y - r * 0.1, r * 0.045, 0, TAU)
  } else {
    context.ellipse(x, y + r * 0.04, r * 0.92, r * 0.25, 0, 0, TAU)
    context.moveTo(x - r * 0.42, y - r * 0.05)
    context.quadraticCurveTo(x, y - r * 0.95, x + r * 0.42, y - r * 0.05)
    context.moveTo(x - r * 0.4, y + r * 0.34)
    context.lineTo(x - r * 0.72, y + r * 0.94)
    context.moveTo(x + r * 0.4, y + r * 0.34)
    context.lineTo(x + r * 0.72, y + r * 0.94)
  }
  context.stroke()
}

export default function ParanormalOverlay(props: ParanormalOverlayProps) {
  const latest = useRef(props)
  const invalidate = useRef<(() => void) | null>(null)
  latest.current = props

  useEffect(() => {
    const container = props.map.getContainer()
    const canvas = document.createElement('canvas')
    canvas.className = 'paranormal-overlay'
    canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(canvas)

    const context = canvas.getContext('2d', {alpha: true})
    if (!context) {
      canvas.remove()
      return
    }

    const fogTexture = createFogTexture()
    const fogLayers = makeFogLayers(context, fogTexture)
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionPreference.matches
    let frame = 0
    let previousTime = 0
    let elapsed = 0
    let sweepAngle = 0
    let width = 0
    let height = 0
    let dpr = 1
    let projectionDirty = true
    let signalSource: readonly MapSignal[] | null = null
    let entries: RuntimeSignal[] = []
    let pointerX = 0
    let pointerY = 0
    let pointerKnown = false
    let radiusScale = 1
    let receiverValue = 0
    let staticSeed = 0
    const accent = getComputedStyle(container).getPropertyValue('--hud-alert').trim() || '#d63b35'
    const warm = getComputedStyle(container).getPropertyValue('--hud-text').trim() || '#e9e6dd'
    const noMotion = () => { reducedMotion = motionPreference.matches; schedule() }

    function resize() {
      const bounds = container.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      projectionDirty = true
    }

    function prepareSignals() {
      const current = latest.current.signals
      if (current === signalSource) return
      signalSource = current
      entries = current.map((signal, index) => ({
        ...signal,
        latLng: L.latLng(signal.location.lat, signal.location.lng),
        x: 0,
        y: 0,
        radius: 6,
        signalColor: colorForStatus(signal.status),
        phase: (index * 2.399963229728653) % TAU,
        reveal: reducedMotion ? 0.55 : 0,
        lastSweep: -1,
      }))
      projectionDirty = true
    }

    function updateProjection() {
      if (!projectionDirty) return
      for (const signal of entries) {
        const point = latest.current.map.latLngToContainerPoint(signal.latLng)
        signal.x = point.x
        signal.y = point.y
      }
      projectionDirty = false
    }

    function hitTest(x: number, y: number): RuntimeSignal | null {
      const visible = latest.current.visibleClasses
      let closest: RuntimeSignal | null = null
      let closestDistance = HIT_RADIUS
      for (const signal of entries) {
        if (!visible.has(signal.entityClass)) continue
        const distance = Math.hypot(signal.x - x, signal.y - y)
        if (distance < closestDistance) {
          closest = signal
          closestDistance = distance
        }
      }
      return closest
    }

    function updatePointer(event: PointerEvent) {
      const rect = container.getBoundingClientRect()
      pointerX = event.clientX - rect.left
      pointerY = event.clientY - rect.top
      pointerKnown = true
      schedule()
    }

    function onPointerMove(event: PointerEvent) {
      updatePointer(event)
      updateProjection()
      if (!latest.current.flashlightOn) {
        const rect = container.getBoundingClientRect()
        container.style.cursor = hitTest(event.clientX - rect.left, event.clientY - rect.top) ? 'pointer' : ''
      }
    }

    function onPointerLeave() {
      pointerKnown = false
      container.style.cursor = ''
      schedule()
    }

    function onCanvasClick(event: MouseEvent) {
      updateProjection()
      const rect = container.getBoundingClientRect()
      const signal = hitTest(event.clientX - rect.left, event.clientY - rect.top)
      if (signal) {
        event.preventDefault()
        event.stopPropagation()
        latest.current.onSelect(signal._id)
      }
    }

    function onMapChange() {
      projectionDirty = true
      schedule()
    }

    function onMapResize() {
      projectionDirty = true
      resize()
      schedule()
    }

    function drawFog(now: number) {
      if (!fogLayers.length) return
      for (const layer of fogLayers) {
        const drift = reducedMotion ? 0 : now * layer.speed
        layer.matrix.a = layer.scale
        layer.matrix.b = 0
        layer.matrix.c = 0
        layer.matrix.d = layer.scale
        layer.matrix.e = ((drift % 256) + 256) % 256
        layer.matrix.f = (((drift * 0.37) % 256) + 256) % 256
        layer.pattern.setTransform(layer.matrix)
        context.globalAlpha = layer.alpha
        context.fillStyle = layer.pattern
        context.fillRect(0, 0, width, height)
      }
      context.globalAlpha = 1
    }

    function drawFlashlight() {
      const active = latest.current.flashlightOn
      const baseAlpha = active ? 0.56 : 0.28
      context.fillStyle = `rgba(2,4,2,${baseAlpha})`
      context.fillRect(0, 0, width, height)
      if (active) {
        if (!reducedMotion && Math.random() < 0.004) radiusScale = 0.55
        radiusScale += (1 - radiusScale) * 0.08
        const breath = reducedMotion ? 1 : 1 + Math.sin(elapsed * 9) * 0.02
        const radius = Math.min(width, height) * 0.24 * radiusScale * breath
        const x = pointerKnown ? pointerX : width / 2
        const y = pointerKnown ? pointerY : height / 2
        context.globalCompositeOperation = 'destination-out'
        const light = context.createRadialGradient(x, y, 0, x, y, radius)
        light.addColorStop(0, 'rgba(0,0,0,1)')
        light.addColorStop(0.6, 'rgba(0,0,0,.8)')
        light.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = light
        context.fillRect(0, 0, width, height)
        context.globalCompositeOperation = 'source-over'
        const glow = context.createRadialGradient(x, y, 0, x, y, radius * 0.92)
        glow.addColorStop(0, 'rgba(233,230,221,.075)')
        glow.addColorStop(1, 'rgba(233,230,221,0)')
        context.fillStyle = glow
        context.fillRect(0, 0, width, height)
      }
    }

    function drawRadar(dt: number) {
      if (!reducedMotion) sweepAngle += dt * 0.55
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.hypot(width, height)
      const radarContext = context as CanvasRenderingContext2D & {
        createConicGradient?: (startAngle: number, x: number, y: number) => CanvasGradient
      }
      if (!reducedMotion && radarContext.createConicGradient) {
        const gradient = radarContext.createConicGradient(sweepAngle, centerX, centerY)
        gradient.addColorStop(0, 'rgba(214,59,53,.12)')
        gradient.addColorStop(0.14, 'rgba(214,59,53,0)')
        gradient.addColorStop(1, 'rgba(214,59,53,0)')
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }
      if (!reducedMotion) {
        context.beginPath()
        context.moveTo(centerX, centerY)
        context.lineTo(centerX + Math.cos(sweepAngle) * radius, centerY + Math.sin(sweepAngle) * radius)
        context.strokeStyle = 'rgba(214,59,53,.26)'
        context.lineWidth = 1
        context.stroke()
      }

      const pass = Math.floor(sweepAngle / TAU)
      const angle = wrapAngle(sweepAngle)
      for (const signal of entries) {
        if (!latest.current.visibleClasses.has(signal.entityClass)) continue
        if (signal.x < -24 || signal.y < -24 || signal.x > width + 24 || signal.y > height + 24) continue
        if (latest.current.selectedSignalId === signal._id) signal.reveal = 1
        if (reducedMotion) signal.reveal = 0.55
        else {
          const targetAngle = Math.atan2(signal.y - centerY, signal.x - centerX)
          const difference = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle))
          if (Math.abs(difference) < 0.06 && signal.lastSweep !== pass) {
            signal.reveal = 1
            signal.lastSweep = pass
          }
          signal.reveal = Math.max(0, signal.reveal - dt * 0.45)
        }

        const credibility = clamp(signal.credibilityIndex ?? 0, 0, 100)
        const r = clamp(3 + latest.current.map.getZoom() * 1.1, 4, 10) * (0.75 + credibility / 200)
        signal.radius = r
        const color = signal.signalColor
        const dotAlpha = clamp(0.12 + 0.08 * Math.sin(elapsed * 2 + signal.phase) + signal.reveal, 0, 1)
        context.beginPath()
        context.arc(signal.x, signal.y, 2.2, 0, TAU)
        context.fillStyle = color
        context.globalAlpha = dotAlpha
        context.fill()
        context.globalAlpha = 1

        if (signal.reveal > 0.05) {
          context.save()
          context.globalAlpha = signal.reveal * 0.9
          context.strokeStyle = color
          context.fillStyle = color
          context.lineWidth = 1.6
          context.lineCap = 'round'
          context.lineJoin = 'round'
          context.shadowColor = color
          context.shadowBlur = 10
          drawSigil(context, signal.entityClass, signal.x, signal.y, r)
          context.restore()
          const ringRadius = 6 + (1 - signal.reveal) * 22
          context.beginPath()
          context.arc(signal.x, signal.y, ringRadius, 0, TAU)
          context.strokeStyle = color
          context.globalAlpha = signal.reveal * 0.45
          context.lineWidth = 1
          context.stroke()
          context.globalAlpha = 1
        }

        if (latest.current.selectedSignalId === signal._id) {
          context.save()
          context.translate(signal.x, signal.y)
          context.rotate(reducedMotion ? 0 : elapsed * 0.8)
          context.strokeStyle = warm
          context.globalAlpha = 0.86
          context.lineWidth = 1
          for (let arc = 0; arc < 4; arc += 1) {
            const start = arc * (TAU / 4) + 0.18
            context.beginPath()
            context.arc(0, 0, r * 2.6, start, start + 0.56)
            context.stroke()
          }
          context.restore()
        }
      }
    }

    function drawStatic() {
      if (!latest.current.staticBurst || reducedMotion) return
      staticSeed += 1
      context.save()
      context.globalAlpha = 0.36
      for (let i = 0; i < 110; i += 1) {
        context.fillStyle = i % 5 === 0 ? accent : warm
        const x = Math.random() * width
        const y = Math.random() * height
        const streakWidth = 2 + Math.random() * Math.max(2, width * 0.1)
        context.fillRect(x, y, streakWidth, Math.random() > 0.7 ? 2 : 1)
      }
      context.restore()
    }

    function drawCursor() {
      if (!latest.current.flashlightOn || !pointerKnown) return
      context.beginPath()
      context.arc(pointerX, pointerY, 5, 0, TAU)
      context.strokeStyle = accent
      context.globalAlpha = 0.92
      context.lineWidth = 1
      context.stroke()
      context.beginPath()
      context.arc(pointerX, pointerY, 1.25, 0, TAU)
      context.fillStyle = accent
      context.fill()
      context.globalAlpha = 1
    }

    function updateReceiver(dt: number) {
      if (!latest.current.receiverActive) return
      const x = pointerKnown ? pointerX : width / 2
      const y = pointerKnown ? pointerY : height / 2
      let closest = Number.POSITIVE_INFINITY
      for (const signal of entries) {
        if (!latest.current.visibleClasses.has(signal.entityClass)) continue
        const credibility = clamp(signal.credibilityIndex ?? 0, 0, 100)
        const distance = Math.hypot(signal.x - x, signal.y - y) / (0.5 + credibility / 200)
        if (distance < closest) closest = distance
      }
      const target = Number.isFinite(closest) ? Math.pow(clamp(1 - closest / 200, 0, 1), 1.4) : 0
      receiverValue += (target - receiverValue) * clamp(dt * 6, 0, 1)
      latest.current.onReceiverLevel(receiverValue)
    }

    function draw(time: number) {
      const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
      previousTime = time
      if (!reducedMotion) elapsed += dt
      prepareSignals()
      updateProjection()
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      drawFog(elapsed)
      drawFlashlight()
      drawRadar(dt)
      drawStatic()
      drawCursor()
      updateReceiver(dt)
    }

    function tick(time: number) {
      frame = 0
      if (document.hidden) return
      draw(time)
      if (!reducedMotion || latest.current.receiverActive) frame = requestAnimationFrame(tick)
    }

    function schedule() {
      if (document.hidden || frame) return
      frame = requestAnimationFrame(tick)
    }

    invalidate.current = schedule
    resize()
    schedule()
    container.classList.toggle('radar-flashlight-on', latest.current.flashlightOn)
    container.addEventListener('pointermove', onPointerMove, {passive: true})
    container.addEventListener('pointerdown', updatePointer, {passive: true})
    container.addEventListener('pointerleave', onPointerLeave, {passive: true})
    container.addEventListener('click', onCanvasClick)
    props.map.on('move zoom viewreset', onMapChange)
    props.map.on('resize', onMapResize)
    motionPreference.addEventListener('change', noMotion)
    document.addEventListener('visibilitychange', onVisibilityChange)

    function onVisibilityChange() {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        previousTime = 0
      } else {
        schedule()
      }
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      invalidate.current = null
      container.classList.remove('radar-flashlight-on')
      container.style.cursor = ''
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerdown', updatePointer)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('click', onCanvasClick)
      props.map.off('move zoom viewreset', onMapChange)
      props.map.off('resize', onMapResize)
      motionPreference.removeEventListener('change', noMotion)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.remove()
    }
  }, [props.map])

  useEffect(() => {
    const container = props.map.getContainer()
    container.classList.toggle('radar-flashlight-on', props.flashlightOn)
    invalidate.current?.()
  }, [props.map, props.signals, props.visibleClasses, props.selectedSignalId, props.flashlightOn, props.receiverActive, props.staticBurst, props.reducedMotion])

  return null
}






