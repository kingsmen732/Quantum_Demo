"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Pause, RotateCcw, Zap, BookOpen } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function BlochSphereVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | null>(null)

  const [theta, setTheta] = useState([Math.PI / 4]) // Polar angle
  const [phi, setPhi] = useState([0]) // Azimuthal angle
  const [isAnimating, setIsAnimating] = useState(false)
  const [rotationX, setRotationX] = useState(0)
  const [rotationY, setRotationY] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showTrajectory, setShowTrajectory] = useState(false)
  const [trajectory, setTrajectory] = useState<Array<{ x: number; y: number; z: number }>>([])

  // Preset quantum states for educational purposes
  const presetStates = [
    { name: "|0⟩", theta: 0, phi: 0, description: "Ground state - North pole" },
    { name: "|1⟩", theta: Math.PI, phi: 0, description: "Excited state - South pole" },
    { name: "|+⟩", theta: Math.PI / 2, phi: 0, description: "Superposition - X+ axis" },
    { name: "|-⟩", theta: Math.PI / 2, phi: Math.PI, description: "Superposition - X- axis" },
    { name: "|+i⟩", theta: Math.PI / 2, phi: Math.PI / 2, description: "Superposition - Y+ axis" },
    { name: "|-i⟩", theta: Math.PI / 2, phi: (3 * Math.PI) / 2, description: "Superposition - Y- axis" },
  ]

  // Convert spherical coordinates to Cartesian with 3D rotation
  const getCartesianCoords = useCallback(
    (theta: number, phi: number, applyRotation = true) => {
      const x = Math.sin(theta) * Math.cos(phi)
      const y = Math.sin(theta) * Math.sin(phi)
      const z = Math.cos(theta)

      if (applyRotation) {
        // Apply 3D rotation
        const cosRx = Math.cos(rotationX)
        const sinRx = Math.sin(rotationX)
        const cosRy = Math.cos(rotationY)
        const sinRy = Math.sin(rotationY)

        // Rotate around X axis
        const y1 = y * cosRx - z * sinRx
        const z1 = y * sinRx + z * cosRx

        // Rotate around Y axis
        const x2 = x * cosRy + z1 * sinRy
        const z2 = -x * sinRy + z1 * cosRy

        return { x: x2, y: y1, z: z2 }
      }

      return { x, y, z }
    },
    [rotationX, rotationY],
  )

  // Enhanced Bloch sphere drawing with 3D effects
  const drawBlochSphere = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(centerX, centerY) - 50

    // Clear canvas with subtle gradient background
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5)
    gradient.addColorStop(0, "rgba(5, 150, 105, 0.05)")
    gradient.addColorStop(1, "rgba(5, 150, 105, 0.02)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw sphere outline with 3D shading
    const sphereGradient = ctx.createRadialGradient(
      centerX - radius * 0.3,
      centerY - radius * 0.3,
      0,
      centerX,
      centerY,
      radius,
    )
    sphereGradient.addColorStop(0, "rgba(229, 231, 235, 0.8)")
    sphereGradient.addColorStop(0.7, "rgba(229, 231, 235, 0.4)")
    sphereGradient.addColorStop(1, "rgba(229, 231, 235, 0.1)")

    ctx.fillStyle = sphereGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
    ctx.fill()

    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw enhanced grid lines with 3D perspective
    ctx.strokeStyle = "rgba(209, 213, 219, 0.6)"
    ctx.lineWidth = 1

    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const latRad = (lat * Math.PI) / 180
      const r = Math.sin(Math.PI / 2 - Math.abs(latRad)) * radius
      const y = centerY + Math.cos(Math.PI / 2 - latRad) * radius * Math.sign(lat)

      ctx.beginPath()
      ctx.ellipse(centerX, y, r, r * 0.3, 0, 0, 2 * Math.PI)
      ctx.stroke()
    }

    // Longitude lines
    for (let lon = 0; lon < 360; lon += 45) {
      const lonRad = (lon * Math.PI) / 180
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radius * Math.abs(Math.cos(lonRad)), radius, lonRad, 0, 2 * Math.PI)
      ctx.stroke()
    }

    // Draw enhanced coordinate axes
    const axisLength = radius * 1.3
    ctx.lineWidth = 3

    // X-axis (red)
    const xAxis = getCartesianCoords(Math.PI / 2, 0)
    ctx.strokeStyle = "#ef4444"
    ctx.beginPath()
    ctx.moveTo(centerX - xAxis.x * axisLength, centerY - xAxis.z * axisLength)
    ctx.lineTo(centerX + xAxis.x * axisLength, centerY + xAxis.z * axisLength)
    ctx.stroke()

    // Y-axis (green)
    const yAxis = getCartesianCoords(Math.PI / 2, Math.PI / 2)
    ctx.strokeStyle = "#22c55e"
    ctx.beginPath()
    ctx.moveTo(centerX - yAxis.x * axisLength, centerY - yAxis.z * axisLength)
    ctx.lineTo(centerX + yAxis.x * axisLength, centerY + yAxis.z * axisLength)
    ctx.stroke()

    // Z-axis (blue)
    const zAxis = getCartesianCoords(0, 0)
    ctx.strokeStyle = "#3b82f6"
    ctx.beginPath()
    ctx.moveTo(centerX, centerY - axisLength)
    ctx.lineTo(centerX, centerY + axisLength)
    ctx.stroke()

    // Draw axis labels with better positioning
    ctx.fillStyle = "#374151"
    ctx.font = "bold 14px monospace"
    ctx.fillText("X", centerX + xAxis.x * (axisLength + 15), centerY + xAxis.z * (axisLength + 15))
    ctx.fillText("Y", centerX + yAxis.x * (axisLength + 15), centerY + yAxis.z * (axisLength + 15))
    ctx.fillText("Z", centerX + 10, centerY - axisLength - 10)

    // Draw state labels with better visibility
    ctx.fillStyle = "#059669"
    ctx.font = "bold 18px monospace"
    const zUp = getCartesianCoords(0, 0)
    const zDown = getCartesianCoords(Math.PI, 0)
    ctx.fillText("|0⟩", centerX + 15, centerY - zUp.z * radius - 15)
    ctx.fillText("|1⟩", centerX + 15, centerY - zDown.z * radius + 30)

    // Draw trajectory if enabled
    if (showTrajectory && trajectory.length > 1) {
      ctx.strokeStyle = "rgba(220, 38, 38, 0.5)"
      ctx.lineWidth = 2
      ctx.beginPath()

      trajectory.forEach((point, index) => {
        const screenX = centerX + point.x * radius
        const screenY = centerY - point.z * radius

        if (index === 0) {
          ctx.moveTo(screenX, screenY)
        } else {
          ctx.lineTo(screenX, screenY)
        }
      })
      ctx.stroke()

      // Draw trajectory points
      ctx.fillStyle = "rgba(220, 38, 38, 0.7)"
      trajectory.forEach((point) => {
        const screenX = centerX + point.x * radius
        const screenY = centerY - point.z * radius
        ctx.beginPath()
        ctx.arc(screenX, screenY, 3, 0, 2 * Math.PI)
        ctx.fill()
      })
    }

    // Calculate and draw enhanced state vector
    const coords = getCartesianCoords(theta[0], phi[0])
    const vectorX = centerX + coords.x * radius
    const vectorY = centerY - coords.z * radius

    // Draw state vector with gradient
    const vectorGradient = ctx.createLinearGradient(centerX, centerY, vectorX, vectorY)
    vectorGradient.addColorStop(0, "#dc2626")
    vectorGradient.addColorStop(1, "#f87171")

    ctx.strokeStyle = vectorGradient
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(vectorX, vectorY)
    ctx.stroke()

    // Draw enhanced state vector endpoint
    const endpointGradient = ctx.createRadialGradient(vectorX, vectorY, 0, vectorX, vectorY, 10)
    endpointGradient.addColorStop(0, "#dc2626")
    endpointGradient.addColorStop(1, "#991b1b")

    ctx.fillStyle = endpointGradient
    ctx.beginPath()
    ctx.arc(vectorX, vectorY, 8, 0, 2 * Math.PI)
    ctx.fill()

    // Add white border to endpoint
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw projection lines with better styling
    ctx.strokeStyle = "rgba(220, 38, 38, 0.4)"
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])

    // Projection to equatorial plane
    const projX = centerX + coords.x * radius
    const projY = centerY
    ctx.beginPath()
    ctx.moveTo(vectorX, vectorY)
    ctx.lineTo(projX, projY)
    ctx.stroke()

    // Projection to Z-axis
    ctx.beginPath()
    ctx.moveTo(vectorX, vectorY)
    ctx.lineTo(centerX, vectorY)
    ctx.stroke()

    ctx.setLineDash([])

    // Draw angle indicators
    if (theta[0] > 0.1 && theta[0] < Math.PI - 0.1) {
      // Theta angle arc
      ctx.strokeStyle = "rgba(59, 130, 246, 0.7)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, 30, -Math.PI / 2, -Math.PI / 2 + theta[0], false)
      ctx.stroke()

      ctx.fillStyle = "#3b82f6"
      ctx.font = "12px monospace"
      ctx.fillText("θ", centerX + 35, centerY - 10)
    }

    if (Math.abs(phi[0]) > 0.1) {
      // Phi angle arc
      ctx.strokeStyle = "rgba(168, 85, 247, 0.7)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, 25, 0, phi[0], phi[0] > 0)
      ctx.stroke()

      ctx.fillStyle = "#a855f7"
      ctx.font = "12px monospace"
      ctx.fillText("φ", centerX + 30, centerY + 20)
    }
  }, [theta, phi, rotationX, rotationY, getCartesianCoords, showTrajectory, trajectory])

  // Auto-rotation animation
  useEffect(() => {
    if (autoRotate) {
      const animate = () => {
        setRotationY((prev) => prev + 0.01)
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

  useEffect(() => {
    drawBlochSphere()
  }, [drawBlochSphere])

  // Update trajectory when state changes
  useEffect(() => {
    if (showTrajectory) {
      const coords = getCartesianCoords(theta[0], phi[0], false)
      setTrajectory((prev) => {
        const newTrajectory = [...prev, coords]
        return newTrajectory.length > 50 ? newTrajectory.slice(-50) : newTrajectory
      })
    }
  }, [theta, phi, showTrajectory, getCartesianCoords])

  const animateToPreset = (preset: (typeof presetStates)[0]) => {
    setIsAnimating(true)
    setSelectedPreset(preset.name)

    const startTheta = theta[0]
    const startPhi = phi[0]
    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Smooth easing function
      const eased = 1 - Math.pow(1 - progress, 3)

      const currentTheta = startTheta + (preset.theta - startTheta) * eased
      const currentPhi = startPhi + (preset.phi - startPhi) * eased

      setTheta([currentTheta])
      setPhi([currentPhi])

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animate)
  }

  const animateRandomState = () => {
    setIsAnimating(true)
    setSelectedPreset(null)
    const targetTheta = Math.random() * Math.PI
    const targetPhi = Math.random() * 2 * Math.PI

    const startTheta = theta[0]
    const startPhi = phi[0]
    const duration = 1000
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const eased = 1 - Math.pow(1 - progress, 3)

      const currentTheta = startTheta + (targetTheta - startTheta) * eased
      const currentPhi = startPhi + (targetPhi - startPhi) * eased

      setTheta([currentTheta])
      setPhi([currentPhi])

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animate)
  }

  const resetView = () => {
    setRotationX(0)
    setRotationY(0)
    setTrajectory([])
  }

  // Calculate quantum state amplitudes and probabilities
  const alpha = Math.cos(theta[0] / 2)
  const betaMagnitude = Math.sin(theta[0] / 2)
  const prob0 = Math.pow(alpha, 2)
  const prob1 = Math.pow(betaMagnitude, 2)

  // Calculate Bloch vector components
  const blochX = Math.sin(theta[0]) * Math.cos(phi[0])
  const blochY = Math.sin(theta[0]) * Math.sin(phi[0])
  const blochZ = Math.cos(theta[0])

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Tabs defaultValue="interactive" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="interactive">Interactive</TabsTrigger>
            <TabsTrigger value="presets">Preset States</TabsTrigger>
            <TabsTrigger value="education">Learn More</TabsTrigger>
          </TabsList>

          <TabsContent value="interactive" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced Bloch Sphere Canvas */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Bloch Sphere</CardTitle>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setAutoRotate(!autoRotate)}>
                            {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{autoRotate ? "Stop rotation" : "Auto rotate"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={resetView}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset view</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={500}
                    className="w-full max-w-lg mx-auto border border-border rounded-lg cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => {
                      const startX = e.clientX
                      const startY = e.clientY
                      const startRotX = rotationX
                      const startRotY = rotationY

                      const handleMouseMove = (e: MouseEvent) => {
                        const deltaX = e.clientX - startX
                        const deltaY = e.clientY - startY
                        setRotationX(startRotX + deltaY * 0.01)
                        setRotationY(startRotY + deltaX * 0.01)
                      }

                      const handleMouseUp = () => {
                        document.removeEventListener("mousemove", handleMouseMove)
                        document.removeEventListener("mouseup", handleMouseUp)
                      }

                      document.addEventListener("mousemove", handleMouseMove)
                      document.addEventListener("mouseup", handleMouseUp)
                    }}
                  />

                  <div className="flex items-center justify-center gap-4 mt-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showTrajectory}
                        onChange={(e) => {
                          setShowTrajectory(e.target.checked)
                          if (!e.target.checked) setTrajectory([])
                        }}
                        className="rounded"
                      />
                      Show trajectory
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Controls */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">State Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-3 block">
                        Polar Angle (θ): {((theta[0] * 180) / Math.PI).toFixed(1)}°
                      </label>
                      <Slider
                        value={theta}
                        onValueChange={(value) => {
                          setTheta(value)
                          setSelectedPreset(null)
                        }}
                        max={Math.PI}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-foreground mb-3 block">
                        Azimuthal Angle (φ): {((phi[0] * 180) / Math.PI).toFixed(1)}°
                      </label>
                      <Slider
                        value={phi}
                        onValueChange={(value) => {
                          setPhi(value)
                          setSelectedPreset(null)
                        }}
                        max={2 * Math.PI}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    <Button onClick={animateRandomState} disabled={isAnimating} className="w-full" variant="secondary">
                      <Zap className="w-4 h-4 mr-2" />
                      {isAnimating ? "Animating..." : "Random State"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Enhanced State Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">Quantum State</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                      <div className="text-foreground mb-2">State Vector:</div>
                      <div className="text-primary font-semibold">
                        |ψ⟩ = {alpha.toFixed(3)}|0⟩ + {betaMagnitude.toFixed(3)}e^(i{phi[0].toFixed(2)})|1⟩
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">P(|0⟩)</div>
                        <div className="text-xl font-bold text-primary">{(prob0 * 100).toFixed(1)}%</div>
                        <div className="w-full h-2 bg-background rounded-full mt-2">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${prob0 * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">P(|1⟩)</div>
                        <div className="text-xl font-bold text-secondary">{(prob1 * 100).toFixed(1)}%</div>
                        <div className="w-full h-2 bg-background rounded-full mt-2">
                          <div
                            className="h-full bg-secondary rounded-full transition-all duration-300"
                            style={{ width: `${prob1 * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground mb-2">Bloch Vector:</div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-sm">
                        <div>X: {blochX.toFixed(3)}</div>
                        <div>Y: {blochY.toFixed(3)}</div>
                        <div>Z: {blochZ.toFixed(3)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="presets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Common Quantum States</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {presetStates.map((preset) => (
                    <Card
                      key={preset.name}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedPreset === preset.name ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => animateToPreset(preset)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary mb-2 font-mono">{preset.name}</div>
                        <div className="text-sm text-muted-foreground">{preset.description}</div>
                        <div className="mt-3 text-xs font-mono text-muted-foreground">
                          θ = {((preset.theta * 180) / Math.PI).toFixed(0)}°, φ ={" "}
                          {((preset.phi * 180) / Math.PI).toFixed(0)}°
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Understanding the Bloch Sphere
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground">
                    The Bloch sphere is a geometric representation of qubit states. Every point on the sphere
                    corresponds to a unique quantum state, making it an invaluable tool for visualizing quantum
                    mechanics.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Key Concepts:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• North pole (|0⟩): Ground state</li>
                        <li>• South pole (|1⟩): Excited state</li>
                        <li>• Equator: Superposition states</li>
                        <li>• θ (theta): Polar angle, controls |0⟩/|1⟩ probability</li>
                        <li>• φ (phi): Azimuthal angle, controls phase</li>
                      </ul>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Applications:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• Quantum gate visualization</li>
                        <li>• State evolution tracking</li>
                        <li>• Quantum algorithm design</li>
                        <li>• Error analysis in quantum computing</li>
                        <li>• Educational demonstrations</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
