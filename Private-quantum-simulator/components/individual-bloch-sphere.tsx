"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RotateCcw, Play, Pause } from "lucide-react"

export type QubitState = {
  amplitude0: { real: number; imag: number }
  amplitude1: { real: number; imag: number }
  measured?: boolean
  measurementResult?: 0 | 1
  is_mixed?: boolean
  purity?: number
  // Optional probabilities from backend for mixed states
  prob0?: number
  prob1?: number
  // Optional reduced density matrix (from backend)
  density_matrix?: {
    rho_00?: { real: number; imag: number }
    rho_01?: { real: number; imag: number }
    rho_10?: { real: number; imag: number }
    rho_11?: { real: number; imag: number }
  }
}

interface IndividualBlochSphereProps {
  qubitIndex: number
  state: QubitState
  size?: number
}

export function IndividualBlochSphere({ qubitIndex, state, size = 200 }: IndividualBlochSphereProps) {
  const [rotation, setRotation] = useState({ x: 20, y: 45 })
  const [isDragging, setIsDragging] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const sphereRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)

  // Normalize an angle in degrees to the range [-180, 180)
  const normalizeDegrees = (deg: number) => {
    let d = deg
    while (d >= 180) d -= 360
    while (d < -180) d += 360
    return d
  }
  // Normalize an angle in degrees to the range [0, 360)
  const normalizeDegrees360 = (deg: number) => {
    let d = deg % 360
    if (d < 0) d += 360
    return d
  }

  // Calculate Bloch sphere coordinates from quantum state
  const getBlochCoordinates = (
    amplitude0?: { real: number; imag: number },
    amplitude1?: { real: number; imag: number },
    isMixed: boolean = false
  ) => {
    // Use state amplitudes if not provided
    const amp0 = amplitude0 || state.amplitude0;
    const amp1 = amplitude1 || state.amplitude1;
    const dm = state.density_matrix;
    
    // If reduced density matrix is available, prefer it to compute Bloch vector (handles mixed states)
    if (dm && dm.rho_00 && dm.rho_11 && dm.rho_01) {
      const rho00 = dm.rho_00;
      const rho11 = dm.rho_11;
      const rho01 = dm.rho_01;
      const x = 2 * (rho01.real);
      const y = 2 * (rho01.imag);
      const z = (rho00.real - rho11.real);
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = r > 0 ? Math.acos(Math.max(-1, Math.min(1, z / r))) * 180 / Math.PI : 90;
      const phi = Math.atan2(y, x) * 180 / Math.PI;
      const prob0 = Math.max(0, Math.min(1, rho00.real));
      const prob1 = Math.max(0, Math.min(1, rho11.real));
      return {
        x, y, z, theta, phi, r,
        prob0,
        prob1,
        amp0Magnitude: Math.sqrt(prob0),
        amp1Magnitude: Math.sqrt(prob1),
        phase0: Math.atan2(amp0.imag, amp0.real),
        phase1: Math.atan2(amp1.imag, amp1.real)
      }
    }

    // Calculate probabilities from amplitudes (pure-state path)
    let prob0 = amp0.real * amp0.real + amp0.imag * amp0.imag;
    let prob1 = amp1.real * amp1.real + amp1.imag * amp1.imag;
    
    // If we reach here and explicit mixed-state probabilities are provided, but no density matrix,
    // use them to determine z (x,y unknown → 0). This still gives a meaningful θ.
    if (typeof state.prob0 === 'number' && typeof state.prob1 === 'number') {
      prob0 = state.prob0
      prob1 = state.prob1
      const z = prob0 - prob1
      const x = 0
      const y = 0
      const r = Math.min(1, Math.abs(z))
      const theta = r > 0 ? Math.acos(Math.max(-1, Math.min(1, z / r))) * 180 / Math.PI : 90
      const phi = 0
      return {
        x, y, z, theta, phi, r,
        prob0,
        prob1,
        amp0Magnitude: Math.sqrt(prob0),
        amp1Magnitude: Math.sqrt(prob1),
        phase0: Math.atan2(amp0.imag, amp0.real),
        phase1: Math.atan2(amp1.imag, amp1.real)
      }
    }
    
    // Normalize amplitudes
    const norm = Math.sqrt(prob0 + prob1);
    if (norm === 0) {
      return { 
        x: 0, y: 0, z: 0, theta: 90, phi: 0, r: 0,
        prob0, prob1,
        amp0Magnitude: Math.sqrt(prob0),
        amp1Magnitude: Math.sqrt(prob1),
        phase0: Math.atan2(amp0.imag, amp0.real),
        phase1: Math.atan2(amp1.imag, amp1.real)
      };
    }
    
    const alpha_norm = { real: amp0.real / norm, imag: amp0.imag / norm };
    const beta_norm = { real: amp1.real / norm, imag: amp1.imag / norm };
    
  // Bloch sphere coordinates using ᾱβ (alpha conjugate times beta):
  // x = 2*Re(ᾱβ), y = 2*Im(ᾱβ), z = |α|² - |β|²
  const alpha_conj_beta_real = alpha_norm.real * beta_norm.real + alpha_norm.imag * beta_norm.imag; // Re(ᾱβ) == Re(αβ̄)
  const alpha_conj_beta_imag = alpha_norm.real * beta_norm.imag - alpha_norm.imag * beta_norm.real; // Im(ᾱβ) = -Im(αβ̄)
    
    const x = 2 * alpha_conj_beta_real;
    const y = 2 * alpha_conj_beta_imag;
    const z = (alpha_norm.real * alpha_norm.real + alpha_norm.imag * alpha_norm.imag) - 
              (beta_norm.real * beta_norm.real + beta_norm.imag * beta_norm.imag);
    
    // Convert to spherical coordinates
    const r = Math.sqrt(x*x + y*y + z*z);
    const theta = r > 0 ? Math.acos(Math.max(-1, Math.min(1, z/r))) * 180 / Math.PI : 90;
    const phi = Math.atan2(y, x) * 180 / Math.PI;
    
    return { 
      x, y, z, theta, phi, r,
      prob0,
      prob1,
      amp0Magnitude: Math.sqrt(prob0),
      amp1Magnitude: Math.sqrt(prob1),
      phase0: Math.atan2(amp0.imag, amp0.real),
      phase1: Math.atan2(amp1.imag, amp1.real)
    };
  };

  // Auto-rotation animation
  useEffect(() => {
    if (autoRotate) {
      const animate = () => {
        setRotation((prev) => ({ ...prev, y: (prev.y + 1) % 360 }))
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [autoRotate])

  // Mouse interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setAutoRotate(false)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - lastMousePos.x
      const deltaY = e.clientY - lastMousePos.y

      setRotation((prev) => ({
        x: Math.max(-90, Math.min(90, prev.x - deltaY * 0.5)),
        y: (prev.y + deltaX * 0.5) % 360,
      }))

      setLastMousePos({ x: e.clientX, y: e.clientY })
    },
    [isDragging, lastMousePos],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const resetRotation = useCallback(() => {
    setRotation({ x: 20, y: 45 })
    setAutoRotate(false)
  }, [])

  const blochCoords = getBlochCoordinates(state.amplitude0, state.amplitude1, state.is_mixed || false)
  const radius = size / 2 - 20
  const deltaPhaseDeg = normalizeDegrees(((blochCoords.phase1 - blochCoords.phase0) * 180) / Math.PI)
  const displayPhiDeg = normalizeDegrees(blochCoords.phi)

  // Transform 3D coordinates to 2D screen coordinates
  const transform3DTo2D = (x: number, y: number, z: number) => {
    const rotX = (rotation.x * Math.PI) / 180
    const rotY = (rotation.y * Math.PI) / 180

    // Apply rotations
    const cosX = Math.cos(rotX)
    const sinX = Math.sin(rotX)
    const cosY = Math.cos(rotY)
    const sinY = Math.sin(rotY)

    // Rotate around X axis
    const y1 = y * cosX - z * sinX
    const z1 = y * sinX + z * cosX

    // Rotate around Y axis
    const x2 = x * cosY + z1 * sinY
    const z2 = -x * sinY + z1 * cosY

    // Project to 2D
    const screenX = x2 * radius + size / 2
    const screenY = -y1 * radius + size / 2
    const depth = z2

    return { x: screenX, y: screenY, depth }
  }

  const stateVector = transform3DTo2D(blochCoords.x, blochCoords.y, blochCoords.z)

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="px-3 py-2 pb-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary-foreground border border-border">
            Qubit {qubitIndex}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setAutoRotate(!autoRotate)} className="h-6 px-1">
              {autoRotate ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
            </Button>
            <Button variant="outline" size="sm" onClick={resetRotation} className="h-6 px-1 bg-transparent">
              <RotateCcw className="w-2.5 h-2.5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-3 py-2">
        {/* Interactive 3D Bloch Sphere */}
        <div className="relative flex justify-center">
          <div
            ref={sphereRef}
            className={`relative bg-card rounded-full border-2 border-border ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            } select-none`}
            style={{ width: size, height: size }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Sphere wireframe */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
            >
              {/* Equatorial circles */}
              {[0, 60, 120].map((angle) => {
                const rotRad = (angle * Math.PI) / 180
                return (
                  <ellipse
                    key={`eq-${angle}`}
                    cx={size / 2}
                    cy={size / 2}
                    rx={radius * Math.cos(rotRad)}
                    ry={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.7"
                    transform={`rotate(${rotation.y} ${size / 2} ${size / 2})`}
                    className="text-muted-foreground"
                  />
                )
              })}

              {/* Meridian circles */}
              {[0, 45, 90, 135].map((angle) => {
                const points: string[] = []
                for (let i = 0; i <= 180; i += 10) {
                  const theta = (i * Math.PI) / 180
                  const phi = (angle * Math.PI) / 180
                  const x = Math.sin(theta) * Math.cos(phi)
                  const y = Math.sin(theta) * Math.sin(phi)
                  const z = Math.cos(theta)
                  const projected = transform3DTo2D(x, y, z)
                  points.push(`${projected.x},${projected.y}`)
                }
                return (
                  <polyline
                    key={`mer-${angle}`}
                    points={points.join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.6"
                    className="text-muted-foreground"
                  />
                )
              })}

              {/* Coordinate axes */}
              {/* X axis (red) */}
              {(() => {
                const xPos = transform3DTo2D(1, 0, 0)
                const xNeg = transform3DTo2D(-1, 0, 0)
                return (
                  <line
                    x1={xNeg.x}
                    y1={xNeg.y}
                    x2={xPos.x}
                    y2={xPos.y}
                    stroke="rgb(239 68 68)"
                    strokeWidth="3"
                    opacity="0.8"
                  />
                )
              })()}

              {/* Y axis (green) */}
              {(() => {
                const yPos = transform3DTo2D(0, 1, 0)
                const yNeg = transform3DTo2D(0, -1, 0)
                return (
                  <line
                    x1={yNeg.x}
                    y1={yNeg.y}
                    x2={yPos.x}
                    y2={yPos.y}
                    stroke="rgb(34 197 94)"
                    strokeWidth="3"
                    opacity="0.8"
                  />
                )
              })()}

              {/* Z axis (blue) */}
              {(() => {
                const zPos = transform3DTo2D(0, 0, 1)
                const zNeg = transform3DTo2D(0, 0, -1)
                return (
                  <line
                    x1={zNeg.x}
                    y1={zNeg.y}
                    x2={zPos.x}
                    y2={zPos.y}
                    stroke="rgb(59 130 246)"
                    strokeWidth="3"
                    opacity="0.8"
                  />
                )
              })()}

              {/* Axis direction indicators (small circles at positive ends) */}
              {(() => {
                const xPos = transform3DTo2D(1, 0, 0)
                const yPos = transform3DTo2D(0, 1, 0)
                const zPos = transform3DTo2D(0, 0, 1)
                return (
                  <>
                    <circle cx={xPos.x} cy={xPos.y} r="4" fill="rgb(239 68 68)" opacity="0.8" />
                    <circle cx={yPos.x} cy={yPos.y} r="4" fill="rgb(34 197 94)" opacity="0.8" />
                    <circle cx={zPos.x} cy={zPos.y} r="4" fill="rgb(59 130 246)" opacity="0.8" />
                  </>
                )
              })()}

              {/* State vector */}
              <line
                x1={size / 2}
                y1={size / 2}
                x2={stateVector.x}
                y2={stateVector.y}
                stroke="currentColor"
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
                className="text-primary"
              />

              {/* Arrow marker */}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary" />
                </marker>
              </defs>

              {/* State point */}
              <circle
                cx={stateVector.x}
                cy={stateVector.y}
                r="6"
                fill="currentColor"
                stroke="white"
                strokeWidth="2"
                className="drop-shadow-lg text-primary"
              />

              {/* Pole labels */}
              {(() => {
                const northPole = transform3DTo2D(0, 0, 1)
                const southPole = transform3DTo2D(0, 0, -1)
                return (
                  <>
                    <text
                      x={northPole.x}
                      y={northPole.y - 10}
                      textAnchor="middle"
                      className="text-xs font-mono fill-foreground"
                    >
                      |0⟩
                    </text>
                    <text
                      x={southPole.x}
                      y={southPole.y + 20}
                      textAnchor="middle"
                      className="text-xs font-mono fill-foreground"
                    >
                      |1⟩
                    </text>
                    
                    {/* X, Y, Z axis labels */}
                    {(() => {
                      const xPos = transform3DTo2D(1, 0, 0)
                      const yPos = transform3DTo2D(0, 1, 0)
                      const zPos = transform3DTo2D(0, 0, 1)
                      return (
                        <>
                          <text
                            x={xPos.x + 10}
                            y={xPos.y + 3}
                            textAnchor="middle"
                            className="text-xs font-bold fill-foreground"
                          >
                            X
                          </text>
                          <text
                            x={yPos.x + 3}
                            y={yPos.y - 5}
                            textAnchor="middle"
                            className="text-xs font-bold fill-foreground"
                          >
                            Y
                          </text>
                          <text
                            x={zPos.x + 15}
                            y={zPos.y - 5}
                            textAnchor="middle"
                            className="text-xs font-bold fill-foreground"
                          >
                            Z
                          </text>
                        </>
                      )
                    })()}
                  </>
                )
              })()}
            </svg>
          </div>
        </div>

        {/* State Information */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="space-y-1 text-center">
              <Badge variant="outline" className="text-xs py-0 px-1 h-4 mx-auto">
                Spherical
              </Badge>
              <div className="font-mono text-muted-foreground text-xs">
                <div>θ = {blochCoords.theta.toFixed(1)}°</div>
                <div>φ = {displayPhiDeg.toFixed(1)}°</div>
              </div>
            </div>
            <div className="space-y-1 text-center">
              <Badge variant="outline" className="text-xs py-0 px-1 h-4 mx-auto">
                Cartesian
              </Badge>
              <div className="font-mono text-muted-foreground text-xs">
                <div>x = {blochCoords.x.toFixed(3)}</div>
                <div>y = {blochCoords.y.toFixed(3)}</div>
                <div>z = {blochCoords.z.toFixed(3)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="space-y-1 text-center">
              <Badge variant="outline" className="text-xs py-0 px-1 h-4 mx-auto">
                Probabilities
              </Badge>
              <div className="font-mono text-muted-foreground text-xs">
                <div>P(|0⟩) = {blochCoords.prob0.toFixed(3)}</div>
                <div>P(|1⟩) = {blochCoords.prob1.toFixed(3)}</div>
              </div>
            </div>
            <div className="space-y-1 text-center">
              <Badge variant="outline" className="text-xs py-0 px-1 h-4 mx-auto">
                Amplitudes
              </Badge>
              <div className="font-mono text-muted-foreground text-xs">
                <div>|α₀| = {blochCoords.amp0Magnitude.toFixed(3)}</div>
                <div>|α₁| = {blochCoords.amp1Magnitude.toFixed(3)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-1 text-center">
            <Badge variant="outline" className="text-xs py-0 px-1 h-4 mx-auto">
              Phases
            </Badge>
            <div className="font-mono text-muted-foreground text-xs">
              <div>φ₀ = {((blochCoords.phase0 * 180) / Math.PI).toFixed(1)}°</div>
              <div>φ₁ = {((blochCoords.phase1 * 180) / Math.PI).toFixed(1)}°</div>
              <div>Δφ = {deltaPhaseDeg.toFixed(1)}°</div>
            </div>
          </div>

          {state.measured && (
            <Badge variant="secondary" className="w-full justify-center">
              Measured: |{state.measurementResult}⟩
            </Badge>
          )}
          
          {/* Coordinate System Legend */}
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-red-500"></div>
                <span className="text-red-500 font-medium">X</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-green-500"></div>
                <span className="text-green-500 font-medium">Y</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-blue-500"></div>
                <span className="text-blue-500 font-medium">Z</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interaction Help */}
        <div className="text-xs text-muted-foreground text-center opacity-70">Drag • Auto-rotate</div>
      </div>
    </div>
  )
}
