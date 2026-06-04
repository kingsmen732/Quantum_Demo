"use client"

import React, { useMemo, useRef, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Minimal 3D Q-sphere using Canvas 2D with simple perspective; no external libs
// Inputs: statevector as array of { real, imag }
// - Position: by Hamming weight layer around sphere (latitude) + even spacing by index (longitude)
// - Size: proportional to probability |amp|^2
// - Color: phase hue = arg(amp) mapped to [0, 360)

type Complex = { real: number; imag: number }

interface QSphereVisualizationProps {
  statevectorData?: {
    statevector?: Complex[]
    qsphere_probabilities?: { [bitstring: string]: number }
    qsphere_available?: boolean
    num_qubits?: number
  }
  width?: number
  height?: number
}

function hammingWeight(i: number): number {
  let w = 0
  while (i) { w += i & 1; i >>= 1 }
  return w
}

function angleOf(c: Complex): number {
  // Returns radians in [-pi, pi]
  return Math.atan2(c.imag, c.real)
}

export default function QSphereVisualization({ statevectorData, width = 900, height = 540 }: QSphereVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotateY, setRotateY] = useState(0)
  const [rotateX, setRotateX] = useState(0)
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: width, h: height })
  const [hover, setHover] = useState<{ x: number; y: number; label: string; prob: number; phase: number; idx: number } | null>(null)
  const [pinned, setPinned] = useState<{ x: number; y: number; label: string; prob: number; phase: number; idx: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef<{ dragging: boolean; lastX: number; lastY: number; startRX: number; startRY: number } | null>(null)

  // Pretty-format phase around multiples of π and provide color hue
  function formatPhase(angle: number) {
    // normalize to [0, 2π)
    const twoPi = Math.PI * 2
    let a = angle % twoPi
    if (a < 0) a += twoPi
    // Snap to common angles if close
    const marks = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
    const labels = ["0", "π/2", "π", "3π/2"]
    for (let i = 0; i < marks.length; i++) {
      if (Math.abs(a - marks[i]) < 0.05) {
        return { text: labels[i], hue: (angle * 180) / Math.PI + 180 }
      }
    }
    // fallback numeric radians
    return { text: `${angle.toFixed(3)} rad`, hue: (angle * 180) / Math.PI + 180 }
  }

  // Fallback: use qsphere_probabilities if statevector is missing
  const points = useMemo(() => {
    let amps: Complex[] = []
    let probabilities: { [bitstring: string]: number } | undefined = undefined
    let useProbFallback = false
    let numQubits = 0
    let nStates = 0

    if (statevectorData?.statevector && statevectorData.statevector.length) {
      amps = statevectorData.statevector
      nStates = amps.length
      numQubits = Math.log2(nStates) | 0
    } else if (statevectorData?.qsphere_probabilities && statevectorData.qsphere_available) {
      probabilities = statevectorData.qsphere_probabilities
      numQubits = statevectorData.num_qubits || (probabilities && Object.keys(probabilities).length > 0 ? Object.keys(probabilities)[0].length : 0)
      nStates = 1 << numQubits
      useProbFallback = true
    }

    if (useProbFallback && probabilities) {
      // Build points from probabilities only, neutral phase
      const layers: number[][] = Array.from({ length: numQubits + 1 }, () => [])
      for (let i = 0; i < nStates; i++) {
        layers[hammingWeight(i)].push(i)
      }
      const R = 1
      const pts: Array<{ idx: number; prob: number; phase: number; x: number; y: number; z: number; amp: Complex }> = []
      for (let w = 0; w <= numQubits; w++) {
        const layer = layers[w]
        if (layer.length === 0) continue
        const z = 1 - (2 * w) / numQubits
        const theta = Math.acos(Math.max(-1, Math.min(1, z / R)))
        for (let k = 0; k < layer.length; k++) {
          const idx = layer[k]
          const bitstring = idx.toString(2).padStart(numQubits, '0')
          const prob = probabilities[bitstring] || 0
          if (prob > 1e-9) {
            const phi = (2 * Math.PI * k) / layer.length
            const x = R * Math.sin(theta) * Math.cos(phi)
            const y = R * Math.sin(theta) * Math.sin(phi)
            // Neutral phase for fallback
            pts.push({ idx, prob, phase: 0, x, y, z, amp: { real: Math.sqrt(prob), imag: 0 } })
          }
        }
      }
      return pts
    }

    // Default: use statevector
    if (!amps.length) return [] as any[]
    const layers: number[][] = Array.from({ length: numQubits + 1 }, () => [])
    for (let i = 0; i < nStates; i++) {
      layers[hammingWeight(i)].push(i)
    }
    const R = 1
    const pts: Array<{ idx: number; prob: number; phase: number; x: number; y: number; z: number; amp: Complex }> = []
    for (let w = 0; w <= numQubits; w++) {
      const layer = layers[w]
      if (layer.length === 0) continue
      const z = 1 - (2 * w) / numQubits
      const theta = Math.acos(Math.max(-1, Math.min(1, z / R)))
      for (let k = 0; k < layer.length; k++) {
        const idx = layer[k]
        const amp = amps[idx]
        const prob = amp ? amp.real * amp.real + amp.imag * amp.imag : 0
        const phi = (2 * Math.PI * k) / layer.length
        const x = R * Math.sin(theta) * Math.cos(phi)
        const y = R * Math.sin(theta) * Math.sin(phi)
        const phase = angleOf(amp)
        if (prob > 1e-9) {
          pts.push({ idx, prob, phase, x, y, z, amp })
        }
      }
    }
    return pts
  }, [statevectorData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Responsively size to parent if possible
    const parent = canvas.parentElement
    const W = (canvas.width = (parent?.clientWidth || width))
    const H = (canvas.height = dims.h || height)
    setDims({ w: W, h: H })
    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(W, H) * 0.35 * zoom
    const endcapSize = 4

    // Clear to transparent so the canvas inherits page theme
    ctx.clearRect(0, 0, W, H)

    // Draw sphere outline with subtle shading (use CSS var-like colors)
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border') ? 'hsl(var(--border))' : '#e5e7eb'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
    // radial shading
    const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, cx, cy, radius)
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.classList.contains('dark')
    grad.addColorStop(0, isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()

    // Perspective projection for points
    function rotProject(x: number, y: number, z: number) {
      const cosX = Math.cos(rotateX)
      const sinX = Math.sin(rotateX)
      const y1 = y * cosX - z * sinX
      const z1 = y * sinX + z * cosX
      const cosY = Math.cos(rotateY)
      const sinY = Math.sin(rotateY)
      const xr = x * cosY + z1 * sinY
      const zr = -x * sinY + z1 * cosY
      const yr = y1
      return { x: cx + xr * radius, y: cy - yr * radius, depth: zr }
    }

    // Draw grid: latitudes and meridians
    function drawPolyline(pts: Array<{x:number;y:number}>) {
  if (pts.length < 2 || !ctx) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
    }
    // Latitudes
    ctx.strokeStyle = isDark ? "rgba(148,163,184,0.35)" : "rgba(209,213,219,0.6)"
    ctx.lineWidth = 1
    for (let lat = -60; lat <= 60; lat += 30) {
      const theta = (90 - lat) * Math.PI / 180
      const pts: Array<{x:number;y:number}> = []
      for (let a = 0; a <= 360; a += 8) {
        const phi = a * Math.PI / 180
        const x = Math.sin(theta) * Math.cos(phi)
        const y = Math.sin(theta) * Math.sin(phi)
        const z = Math.cos(theta)
        pts.push(rotProject(x, y, z))
      }
      drawPolyline(pts)
    }
    // Meridians
    for (let lon = 0; lon < 360; lon += 45) {
      const phi = lon * Math.PI / 180
      const pts: Array<{x:number;y:number}> = []
      for (let t = 0; t <= 180; t += 6) {
        const theta = t * Math.PI / 180
        const x = Math.sin(theta) * Math.cos(phi)
        const y = Math.sin(theta) * Math.sin(phi)
        const z = Math.cos(theta)
        pts.push(rotProject(x, y, z))
      }
      drawPolyline(pts)
    }

    // Project all points for current rotation and sort by depth
    const projected = points.map((p) => {
      // Rotate around X
      const cosX = Math.cos(rotateX)
      const sinX = Math.sin(rotateX)
      const y1 = p.y * cosX - p.z * sinX
      const z1 = p.y * sinX + p.z * cosX
      // Rotate around Y
      const cosY = Math.cos(rotateY)
      const sinY = Math.sin(rotateY)
      const xr = p.x * cosY + z1 * sinY
      const zr = -p.x * sinY + z1 * cosY
      const yr = y1
      const scale = 0.6 + 0.4 * (zr + 1) / 2
      return {
        ...p,
        px: cx + xr * radius,
        py: cy - yr * radius,
        s: scale,
        depth: zr,
      }
    }).sort((a, b) => a.depth - b.depth)

    // Draw radial lines (center to surface through the point), colored by phase
    ctx.lineWidth = 1.8
    for (const p of projected) {
      const hue = (p.phase * 180) / Math.PI + 180
      ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(p.px, p.py)
      ctx.stroke()
    }

    // Highlight active (hover or pinned)
    const activeIdx = (pinned?.idx ?? hover?.idx) ?? null
    if (activeIdx !== null) {
      const target = projected.find(pp => pp.idx === activeIdx)
      if (target) {
        const hue = (target.phase * 180) / Math.PI + 180
        // Highlight line
        ctx.save()
        ctx.strokeStyle = `hsl(${hue}, 90%, 45%)`
        ctx.lineWidth = 3
        ctx.shadowColor = `hsl(${hue}, 90%, 55%)`
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(target.px, target.py)
        ctx.stroke()
        ctx.restore()
        // Glow halo on endcap
        ctx.save()
        ctx.strokeStyle = `hsl(${hue}, 90%, 45%)`
        ctx.shadowColor = `hsl(${hue}, 90%, 55%)`
        ctx.shadowBlur = 10
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.arc(target.px, target.py, endcapSize, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    // Final pass: uniform endcaps on all line endpoints
    for (const p of projected) {
      const hue = (p.phase * 180) / Math.PI + 180
      ctx.beginPath()
      ctx.fillStyle = `hsl(${hue}, 80%, 55%)`
      ctx.arc(p.px, p.py, endcapSize, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = "#ffffff"
      ctx.stroke()
    }

    // Labels beside endcaps when enabled
    if (showLabels) {
      const n = statevectorData?.statevector?.length || 0
      const numQubits = n ? (Math.log2(n) | 0) : 0
      ctx.fillStyle = isDark ? "#f3f4f6" : "#111827"
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      for (const p of projected) {
        const label = `|${p.idx.toString(2).padStart(numQubits, '0')}⟩`
        ctx.fillText(label, p.px, p.py + endcapSize + 2)
      }
    }

    // Phase legend ring (donut with labels) at bottom-left
    const lgCx = 70
    const lgCy = H - 70
    const outer = 28
    const inner = 18
    ctx.save()
    for (let deg = 0; deg < 360; deg += 2) {
      const rad = (deg * Math.PI) / 180
      ctx.beginPath()
      ctx.strokeStyle = `hsl(${deg}, 80%, 55%)`
      ctx.lineWidth = outer - inner
      ctx.arc(lgCx, lgCy, (outer + inner) / 2, rad, rad + (2 * Math.PI) / 180)
      ctx.stroke()
    }
    ctx.fillStyle = "#111827"
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("0", lgCx + outer + 12, lgCy)
    ctx.fillText("π/2", lgCx, lgCy - outer - 12)
    ctx.fillText("π", lgCx - outer - 12, lgCy)
    ctx.fillText("3π/2", lgCx, lgCy + outer + 12)
    ctx.font = "12px sans-serif"
    ctx.fillText("Phase", lgCx, lgCy)
    ctx.restore()
    // Caption removed per request
  }, [points, width, height, rotateY, rotateX, dims.h, zoom, showLabels, hover, pinned])

  useEffect(() => {
    // ...canvas drawing code above...
  }, [points, width, height, rotateY, rotateX, dims.h, zoom, showLabels, hover, pinned])

  // Pointer drag to rotate (no auto-rotation)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      draggingRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY, startRX: rotateX, startRY: rotateY }
      setDragging(true)
    }
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current?.dragging) return
      const dx = e.clientX - draggingRef.current.lastX
      const dy = e.clientY - draggingRef.current.lastY
      setRotateY(draggingRef.current.startRY + dx * 0.01)
      setRotateX(draggingRef.current.startRX + dy * 0.01)
    }
    const onUp = (e: PointerEvent) => {
      try { canvas.releasePointerCapture(e.pointerId) } catch {}
      draggingRef.current = null
      setDragging(false)
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [rotateX, rotateY])

  // Zoom with mouse wheel
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY
      setZoom((z) => Math.max(0.6, Math.min(2.0, z * (delta > 0 ? 0.95 : 1.05))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false } as any)
    return () => canvas.removeEventListener('wheel', onWheel as any)
  }, [])

  // Resize observer to keep canvas in sync with container width
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return
    const ro = new ResizeObserver(() => {
      // Trigger redraw with new width; height stays as prop/dims.h
      setDims((d) => ({ ...d, w: canvas.parentElement!.clientWidth }))
    })
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [])

  // Persist and restore Labels toggle for consistency across tabs/circuits
  useEffect(() => {
    // Restore on mount
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null
      if (!ls) return
      const sb = ls.getItem('qsphere.showLabels')
      if (sb !== null) setShowLabels(sb === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    // Persist on change
    try {
      const ls = typeof window !== 'undefined' ? window.localStorage : null
      if (!ls) return
      ls.setItem('qsphere.showLabels', String(showLabels))
    } catch {}
  }, [showLabels])

  // Hover detection: find nearest projected point within radius OR nearest colored radial line
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function onMove(e: MouseEvent) {
      const cnv = canvasRef.current
      if (!cnv) { setHover(null); return }
      const rect = cnv.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // Recompute simple projection for hit testing
      const cx = cnv.width / 2
      const cy = cnv.height / 2
      const radius = Math.min(cnv.width, cnv.height) * 0.35
      // Project memoized points with current rotations
      const cosX = Math.cos(rotateX)
      const sinX = Math.sin(rotateX)
      const cosY = Math.cos(rotateY)
      const sinY = Math.sin(rotateY)
  let bestPoint: { dist: number; x: number; y: number; p: typeof points[0] } | null = null
  let bestLine: { dist: number; x: number; y: number; p: typeof points[0] } | null = null
      for (const p of points) {
        // rotate
        const y1 = p.y * cosX - p.z * sinX
        const z1 = p.y * sinX + p.z * cosX
        const xr = p.x * cosY + z1 * sinY
        const zr = -p.x * sinY + z1 * cosY
        const yr = y1
        const px = cx + xr * radius
        const py = cy - yr * radius
        const dist = Math.hypot(mx - px, my - py)
  const r = 10
        if (dist <= r + 6 && (!bestPoint || dist < bestPoint.dist)) bestPoint = { dist, x: px, y: py, p }

        // Line distance (from center to (px,py))
        const x1 = cx, y1s = cy, x2 = px, y2 = py
        const dx = x2 - x1, dy = y2 - y1s
        const len2 = dx * dx + dy * dy || 1
        let t = ((mx - x1) * dx + (my - y1s) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const lx = x1 + t * dx
        const ly = y1s + t * dy
        const ldist = Math.hypot(mx - lx, my - ly)
  const lineHitThresh = 8
        if (ldist <= lineHitThresh && (!bestLine || ldist < bestLine.dist)) bestLine = { dist: ldist, x: lx, y: ly, p }
      }
      const n = statevectorData?.statevector?.length || 0
      const numQubits = n ? (Math.log2(n) | 0) : 0
      const target = bestPoint || bestLine
      if (target) {
        const label = `|${target.p.idx.toString(2).padStart(numQubits, '0')}⟩`
        setHover({ x: target.x, y: target.y - 10, label, prob: target.p.prob, phase: target.p.phase, idx: target.p.idx })
      } else setHover(null)
    }
    const onLeave = () => setHover(null)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [rotateY, rotateX, points, zoom])

  // Click to pin/unpin selection
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function onClick(e: MouseEvent) {
      const cnv = canvasRef.current
      if (!cnv) return
      const rect = cnv.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      // If currently hovering something, pin it; else clear pin
      if (hover) {
        setPinned({ ...hover })
      } else {
        setPinned(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(null)
    }
    canvas.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [hover])

  // Show fallback label if using probability-only mode
  const isProbFallback = Boolean(!statevectorData?.statevector?.length && statevectorData?.qsphere_available)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Q‑Sphere</CardTitle>
        {isProbFallback && (
          <div className="text-xs text-muted-foreground mt-1">
            Probability-only visualization (phases unavailable under noise)
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          <canvas ref={canvasRef} style={{ width: "100%", height: `${height}px`, cursor: dragging ? 'grabbing' : 'grab' }} />
          {/* Controls overlay */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5 bg-popover text-popover-foreground border border-border rounded-md px-1.5 py-1 shadow-sm">
            <button
              className={`text-xs px-2 py-1 rounded-md transition-colors ${showLabels ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
              onClick={() => setShowLabels(v => !v)}
              aria-pressed={showLabels}
            >
              Labels
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              className="text-xs px-2 py-1 rounded-md text-foreground hover:bg-muted transition-colors"
              onClick={() => { setZoom(1); setRotateX(0); setRotateY(0); setPinned(null); setHover(null) }}
            >
              Reset
            </button>
          </div>
          {(pinned || hover) && (
            <div
              className="absolute bg-black/80 text-white text-xs px-2 py-1 rounded shadow"
              style={{ left: (pinned?.x ?? hover!.x), top: (pinned?.y ?? hover!.y), transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}
            >
              <div className="font-mono">{(pinned?.label ?? hover!.label)}</div>
              <div>Probability: <span className="font-semibold">{(pinned?.prob ?? hover!.prob).toFixed(6)}</span></div>
              <div className="flex items-center gap-1">
                <span>Phase angle:</span>
                <span className="font-mono">{isProbFallback ? 'N/A' : formatPhase(pinned?.phase ?? hover!.phase).text}</span>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isProbFallback ? '#888' : `hsl(${(((pinned?.phase ?? hover!.phase) * 180) / Math.PI + 180)}, 80%, 55%)` }}
                />
              </div>
              {(() => {
                const idx = (pinned?.idx ?? hover!.idx)
                if (isProbFallback) return null
                const amp = statevectorData?.statevector?.[idx]
                if (!amp) return null
                const re = amp.real
                const im = amp.imag
                const sign = im < 0 ? '-' : '+'
                const aim = Math.abs(im)
                return <div className="mt-0.5">Amplitude: <span className="font-mono">{re.toFixed(6)} {sign} {aim.toFixed(6)}i</span></div>
              })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
