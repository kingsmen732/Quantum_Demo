"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Montserrat } from "next/font/google"
import { BookOpen, ChevronRight, ChevronDown, Play, Grid3X3, BarChart3 } from "lucide-react"
import { QuantumCircuitBuilder, type QubitState } from "./quantum-circuit-builder"
// import { BlochSphereVisualization } from "./bloch-sphere-visualization"
import QSphereVisualization from "./q-sphere-visualization"
import { IndividualBlochSphere } from "./individual-bloch-sphere"
import { QuantumGlossary } from "./quantum-glossary"
import { CircuitHistoryPanel, type SavedCircuit } from "./circuit-history-panel"
import { useCircuitStorage } from "@/hooks/use-circuit-storage"

// Font for the graph title (geometric, bold, similar to the provided style)
const montserrat = Montserrat({ subsets: ["latin"], weight: ["800", "900"] })

export function QuantumSimulator() {
  const [activeTab, setActiveTab] = useState("circuit")
  const [blochView, setBlochView] = useState<'per' | 'qsphere'>('per')

  const [numQubits, setNumQubits] = useState(3)
  const [circuitElements, setCircuitElements] = useState<any[]>([])
  const [circuitQubitStates, setCircuitQubitStates] = useState<QubitState[]>([
    { amplitude0: { real: 1, imag: 0 }, amplitude1: { real: 0, imag: 0 }, measured: false },
    { amplitude0: { real: 1, imag: 0 }, amplitude1: { real: 0, imag: 0 }, measured: false },
    { amplitude0: { real: 1, imag: 0 }, amplitude1: { real: 0, imag: 0 }, measured: false },
  ])

  // Listen for global circuit loads from the fixed sidebar
  useEffect(() => {
    const handler = (e: any) => {
      const circuit: SavedCircuit | undefined = e?.detail
      if (!circuit) return
      const loaded = loadCircuit(circuit)
      setNumQubits(loaded.numQubits)
      setCircuitElements(loaded.circuitElements)
      setCurrentlyLoadedCircuit(circuit)
      setWorkingCircuitTitle(circuit.title)
      setActiveTab("circuit")
    }
    window.addEventListener("app:load-circuit", handler as EventListener)
    return () => window.removeEventListener("app:load-circuit", handler as EventListener)
  }, [])

  // Listen for nav-bar tab changes
  useEffect(() => {
    const onSetTab = (e: any) => {
      const tab = e?.detail
      if (tab === "circuit" || tab === "bloch" || tab === "density" || tab === "amplitudes") {
        setActiveTab(tab)
        // Smooth-scroll main content into view (below navbar)
        try {
          document.querySelector("main, [data-main]")?.scrollIntoView({ behavior: "smooth", block: "start" })
        } catch {}
      }
    }
    window.addEventListener("app:set-simulator-tab", onSetTab as EventListener)
    return () => window.removeEventListener("app:set-simulator-tab", onSetTab as EventListener)
  }, [])

  // Broadcast tab changes to navbar for active state sync
  useEffect(() => {
    try {
      const evt = new CustomEvent("app:simulator-tab-changed", { detail: activeTab })
      window.dispatchEvent(evt)
    } catch {}
  }, [activeTab])
  const [measurementResults, setMeasurementResults] = useState<any[]>([])
  const [statevectorData, setStatevectorData] = useState<any>(null)
  const [currentlyLoadedCircuit, setCurrentlyLoadedCircuit] = useState<SavedCircuit | null>(null)
  const [workingCircuitTitle, setWorkingCircuitTitle] = useState<string>("New Circuit")

  // Circuit storage hook
  const { savedCircuits, saveCircuit, updateCircuit, deleteCircuit, loadCircuit, isLoading, isAuthenticated } = useCircuitStorage()

  // Removed auto-opening help/welcome dialog

  const handleCircuitStateUpdate = (states: QubitState[]) => {
    setCircuitQubitStates(states)
  }

  const handleCircuitElementsUpdate = (elements: any[]) => {
    setCircuitElements(elements)
  }

  const handleNumQubitsUpdate = (newNum: number) => {
    const oldNum = numQubits
    console.log(`🔧 Updating qubits: ${oldNum} → ${newNum}`)
    setNumQubits(newNum)
    
    // Preserve existing circuit elements, only filter out invalid ones
    if (newNum < oldNum) {
      // If reducing qubits, remove elements from deleted qubits
      setCircuitElements(prev => {
        const filtered = prev.filter(element => {
          // For regular gates, check qubitIndex
          if (element.qubitIndex >= newNum) {
            console.log(`🗑️ Removing element ${element.id} (qubitIndex ${element.qubitIndex} >= ${newNum})`)
            return false
          }
          
          // For CNOT gates, check both control and target qubits
          if (element.gateType === "CNOT") {
            if ((element.controlQubit !== undefined && element.controlQubit >= newNum) ||
                (element.targetQubit !== undefined && element.targetQubit >= newNum)) {
              console.log(`🗑️ Removing CNOT element ${element.id} (control: ${element.controlQubit}, target: ${element.targetQubit}, max allowed: ${newNum - 1})`)
              return false
            }
          }
          
          return true
        })
        console.log(`📊 Circuit elements: ${prev.length} → ${filtered.length}`)
        return filtered
      })
    }
    // If increasing qubits, keep all existing elements (no need to filter)
    
    // Update qubit states: preserve existing, add new ones
    setCircuitQubitStates(prev => {
      const newStates = Array(newNum)
        .fill(null)
        .map((_, index) => {
          // Keep existing state if it exists, otherwise create new |0⟩ state
          if (index < prev.length && prev[index]) {
            return prev[index]
          }
          return {
            amplitude0: { real: 1, imag: 0 },
            amplitude1: { real: 0, imag: 0 },
            measured: false,
          }
        })
      return newStates
    })
  }

  const handleSaveCircuit = (title: string, numQubitsToSave: number, elementsToSave: any[]) => {
    // Always save as a new circuit when this function is called
    // (either truly new circuit, or "Save As New" from loaded circuit)
    saveCircuit(title, numQubitsToSave, elementsToSave)
    
    // If we were editing a loaded circuit and saved as new, clear the loaded state
    // so we're now working with the new circuit
    setCurrentlyLoadedCircuit(null)
  }

  const handleUpdateCircuit = (title: string, numQubitsToSave: number, elementsToSave: any[]) => {
    if (currentlyLoadedCircuit) {
      updateCircuit(currentlyLoadedCircuit.id, title, numQubitsToSave, elementsToSave)
      setCurrentlyLoadedCircuit(prev => prev ? {
        ...prev,
        title,
        numQubits: numQubitsToSave,
        gateCount: elementsToSave.length,
        circuitElements: elementsToSave
      } : null)
    }
  }

  const handleLoadCircuit = (circuit: SavedCircuit) => {
    const { numQubits: loadedNumQubits, circuitElements: loadedElements } = loadCircuit(circuit)
    
    // Update the circuit state
    setNumQubits(loadedNumQubits)
    setCircuitElements(loadedElements)
    setCurrentlyLoadedCircuit(circuit)
    setWorkingCircuitTitle(circuit.title)
    
    // Reset qubit states to |0⟩ for the loaded number of qubits
    const newStates = Array(loadedNumQubits)
      .fill(null)
      .map(() => ({
        amplitude0: { real: 1, imag: 0 },
        amplitude1: { real: 0, imag: 0 },
        measured: false,
      }))
    setCircuitQubitStates(newStates)
  }

  // Wrapper functions for the history panel
  const handleLoadSavedCircuit = (circuit: SavedCircuit) => {
    handleLoadCircuit(circuit)
  }

  const handleDeleteSavedCircuit = (circuitId: string) => {
    deleteCircuit(circuitId)
    // If we deleted the currently loaded circuit, clear it
    if (currentlyLoadedCircuit && currentlyLoadedCircuit.id === circuitId) {
      setCurrentlyLoadedCircuit(null)
    }
  }

  const handleNewCircuit = () => {
    // Clear currently loaded circuit to start fresh
    setCurrentlyLoadedCircuit(null)
    setWorkingCircuitTitle("New Circuit")
    setNumQubits(3)
    setCircuitElements([])
    const newStates = Array(3)
      .fill(null)
      .map(() => ({
        amplitude0: { real: 1, imag: 0 },
        amplitude1: { real: 0, imag: 0 },
        measured: false,
      }))
    setCircuitQubitStates(newStates)
  }

  return (
    <div className="w-full h-full">
      {/* Help/Welcome dialog removed as requested */}

      <div className="mb-6">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            {/* Help button removed as requested */}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        {/* Tab triggers moved to the top navigation bar */}

        <TabsContent value="circuit" className="h-full flex flex-col">
          {/* Two-column layout: builder + right sidebar */}
          <div className="flex flex-row gap-4 flex-1 min-h-0">
            {/* Main Circuit Builder */}
            <div className="flex-1 min-w-0">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      {currentlyLoadedCircuit && (
                        <div className="text-sm text-muted-foreground">
                          Currently editing: <span className="font-medium text-foreground">{currentlyLoadedCircuit.title}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {currentlyLoadedCircuit && (
                        <Button variant="outline" size="sm" onClick={handleNewCircuit}>
                          New Circuit
                        </Button>
                      )}
                      {/* Removed 'Interactive Learning' badge per request */}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <div className="h-full flex-1 min-h-0">
                    <QuantumCircuitBuilder
                    onStateUpdate={handleCircuitStateUpdate}
                    numQubits={numQubits}
                    circuitElements={circuitElements}
                    qubitStates={circuitQubitStates}
                    onCircuitElementsUpdate={handleCircuitElementsUpdate}
                    onNumQubitsUpdate={handleNumQubitsUpdate}
                    onMeasurementResults={setMeasurementResults}
                    onStatevectorUpdate={setStatevectorData}
                    onSaveCircuit={handleSaveCircuit}
                    onUpdateCircuit={handleUpdateCircuit}
                    currentCircuitTitle={currentlyLoadedCircuit?.title || workingCircuitTitle}
                    onUpdateWorkingTitle={setWorkingCircuitTitle}
                    isCircuitLoaded={currentlyLoadedCircuit !== null}
                    existingCircuitTitles={savedCircuits.map(circuit => circuit.title)}
                    isAuthenticated={isAuthenticated}
                    savedCircuits={savedCircuits}
                    onLoadSavedCircuit={handleLoadSavedCircuit}
                    onDeleteSavedCircuit={handleDeleteSavedCircuit}
                  />
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Right Sidebar host; Gate Properties portal mounts into #gate-props-host */}
            {/* Right sidebar is width 0 by default; expands to w-80 only when a gate is being edited */}
            <aside id="gate-props-container" className="w-0 flex-shrink-0 hidden lg:flex relative overflow-hidden transition-[width] duration-200 ease-in-out">
              <div id="gate-props-host" className="w-full h-full" />
              {/* Placeholder can be shown when active with no element, otherwise stays hidden by width */}
              <div id="gate-props-placeholder" className="absolute inset-0 border border-dashed border-border rounded-lg bg-card/40 text-sm text-muted-foreground items-center justify-center hidden">
                Select a gate to edit
              </div>
            </aside>
          </div>
        </TabsContent>

  <TabsContent value="bloch" className="space-y-6 pt-4">
          <Card>
            <CardHeader className="pt-8 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Bloch Visualization</CardTitle>
                <div className="inline-flex rounded-md border bg-card overflow-hidden relative z-10">
                  <button
                    className={`px-3 py-1 text-xs ${blochView === 'per' ? "bg-primary text-white" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setBlochView('per')}
                  >
                    Bloch Spheres
                  </button>
                  <button
                    className={`px-3 py-1 text-xs ${blochView === 'qsphere' ? "bg-primary text-white" : "text-foreground hover:bg-muted"}`}
                    onClick={() => setBlochView('qsphere')}
                  >
                    Q‑Sphere
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Default to per-qubit Bloch spheres; allow switching to Q-sphere */}
              <BlochSwitcher view={blochView} qubitStates={circuitQubitStates} statevectorData={statevectorData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="density" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                {/* Removed title and badge per request */}
                <div />
                <div />
              </div>
            </CardHeader>
            <CardContent>
              <DensityMatrixVisualization quantumStates={circuitQubitStates} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amplitudes" className="space-y-6">
          <Card>
            <CardContent className="pt-0">
              <AmplitudeProbabilityTable 
                quantumStates={circuitQubitStates} 
                measurementResults={measurementResults}
                statevectorData={statevectorData}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
function BlochSwitcher({ view, qubitStates, statevectorData }: { view: 'per' | 'qsphere'; qubitStates: QubitState[]; statevectorData: any }) {
  if (view === 'qsphere') {
    return <QSphereVisualization statevectorData={statevectorData} />
  }
  // per-qubit Bloch spheres
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {qubitStates.map((qs, idx) => (
        <IndividualBlochSphere key={idx} qubitIndex={idx} state={qs} size={260} />
      ))}
    </div>
  )
}

function DensityMatrixVisualization({ quantumStates }: { quantumStates: QubitState[] }) {
  const calculateDensityMatrix = () => {
    const n = quantumStates.length
    const dim = Math.pow(2, n)
    const matrix = Array(dim)
      .fill(null)
      .map(() => Array(dim).fill({ real: 0, imag: 0 }))

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const binaryI = i.toString(2).padStart(n, "0")
        const binaryJ = j.toString(2).padStart(n, "0")

        let ampI = { real: 1, imag: 0 }
        for (let k = 0; k < n; k++) {
          const bit = binaryI[k]
          const qubitAmp = bit === "0" ? quantumStates[k].amplitude0 : quantumStates[k].amplitude1
          const newReal = ampI.real * qubitAmp.real - ampI.imag * qubitAmp.imag
          const newImag = ampI.real * qubitAmp.imag + ampI.imag * qubitAmp.real
          ampI = { real: newReal, imag: newImag }
        }

        let ampJ = { real: 1, imag: 0 }
        for (let k = 0; k < n; k++) {
          const bit = binaryJ[k]
          const qubitAmp = bit === "0" ? quantumStates[k].amplitude0 : quantumStates[k].amplitude1
          const newReal = ampJ.real * qubitAmp.real - ampJ.imag * qubitAmp.imag
          const newImag = ampJ.real * qubitAmp.imag + ampJ.imag * qubitAmp.real
          ampJ = { real: newReal, imag: newImag }
        }

        matrix[i][j] = {
          real: ampI.real * ampJ.real + ampI.imag * ampJ.imag,
          imag: ampI.imag * ampJ.real - ampI.real * ampJ.imag,
        }
      }
    }

    return matrix
  }

  const densityMatrix = calculateDensityMatrix()
  const dim = densityMatrix.length

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Circuit Output Density Matrix</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Real-time density matrix ρ calculated from your quantum circuit's current state
        </p>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          {/* Left bracket */}
          <div className="absolute left-0 top-0 h-full w-3 flex items-center">
            <div className="w-0.5 h-5/6 bg-foreground rounded-full"></div>
            <div className="absolute top-0 left-0 w-3 h-0.5 bg-foreground rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-3 h-0.5 bg-foreground rounded-full"></div>
          </div>
          
          {/* Right bracket */}
          <div className="absolute right-0 top-0 h-full w-3 flex items-center justify-end">
            <div className="w-0.5 h-5/6 bg-foreground rounded-full"></div>
            <div className="absolute top-0 right-0 w-3 h-0.5 bg-foreground rounded-full"></div>
            <div className="absolute bottom-0 right-0 w-3 h-0.5 bg-foreground rounded-full"></div>
          </div>
          
          {/* Matrix content */}
          <div className="mx-3 p-4 bg-card rounded-lg border border-border shadow-lg">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${dim}, 1fr)` }}>
              {densityMatrix.map((row, i) =>
                row.map((element, j) => {
                  const magnitude = Math.sqrt(element.real * element.real + element.imag * element.imag)
                  const opacity = Math.min(magnitude * 2, 1) // Scale opacity based on magnitude
                  
                  return (
                    <div
                      key={`${i}-${j}`}
                      className={`
                        relative w-16 h-16 border border-border bg-card rounded-md 
                        flex flex-col items-center justify-center text-xs shadow-sm
                        hover:shadow-md hover:scale-105 transition-all duration-200
                        ${i === j ? 'ring-1 ring-primary/30 bg-primary/5' : 'bg-muted'}
                      `}
                    >
                      {/* Real part */}
                      <div className="font-mono font-medium text-xs text-foreground">
                        {Math.abs(element.real) < 0.001 ? '0' : element.real.toFixed(2)}
                      </div>
                      
                      {/* Imaginary part */}
                      {Math.abs(element.imag) > 0.001 && (
                        <div className="font-mono text-muted-foreground" style={{ fontSize: '10px' }}>
                          {element.imag >= 0 ? '+' : ''}
                          {element.imag.toFixed(2)}i
                        </div>
                      )}
                      
                      {/* Magnitude indicator */}
                      {magnitude > 0.001 && (
                        <div className="absolute bottom-0.5 right-0.5">
                          <div 
                            className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-primary to-secondary"
                            style={{ opacity: magnitude }}
                            title={`Magnitude: ${magnitude.toFixed(3)}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            
            {/* Matrix label */}
            <div className="text-center mt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-popover rounded-full border border-border">
                <span className="font-semibold text-lg">ρ</span>
                <span className="text-sm text-muted-foreground">({dim}×{dim})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-2">Matrix Properties</h4>
          <div className="space-y-1 text-sm">
            <div>
              Dimension: {dim} × {dim}
            </div>
            <div>Trace: {densityMatrix.reduce((sum, row, i) => sum + row[i].real, 0).toFixed(3)}</div>
            <div>Hermitian: Yes</div>
            <div>Positive Semidefinite: Yes</div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-2">Physical Interpretation</h4>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>• Diagonal elements: state probabilities</div>
            <div>• Off-diagonal: quantum coherences</div>
            <div>• Trace = 1: normalization</div>
            <div>• Hermitian: physical observability</div>
          </div>
        </Card>
      </div>

      {/* Individual Qubit Analysis Dropdowns */}
      <div className="space-y-3">
        <h4 className="font-semibold text-lg">Individual Qubit Analysis</h4>
        {quantumStates.map((state, qubitIndex) => (
          <Collapsible key={qubitIndex} className="w-full">
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">
                      Qubit {qubitIndex} - State Vector & Density Matrix
                    </CardTitle>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Individual State Vector */}
                    <div>
                      <h5 className="font-medium mb-2">State Vector |ψ{qubitIndex}⟩</h5>
                      <div className="bg-muted rounded-lg p-3 border text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {Math.abs(state.amplitude0.real) < 0.001 ? '0' : state.amplitude0.real.toFixed(3)}
                              {Math.abs(state.amplitude0.imag) > 0.001 && (
                                <span>
                                  {state.amplitude0.imag >= 0 ? '+' : ''}
                                  {state.amplitude0.imag.toFixed(3)}i
                                </span>
                              )}
                            </span>
                            <span>|0⟩</span>
                            <span className="text-muted-foreground">
                              ({((state.amplitude0.real ** 2 + state.amplitude0.imag ** 2) * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {Math.abs(state.amplitude1.real) < 0.001 ? '0' : state.amplitude1.real.toFixed(3)}
                              {Math.abs(state.amplitude1.imag) > 0.001 && (
                                <span>
                                  {state.amplitude1.imag >= 0 ? '+' : ''}
                                  {state.amplitude1.imag.toFixed(3)}i
                                </span>
                              )}
                            </span>
                            <span>|1⟩</span>
                            <span className="text-muted-foreground">
                              ({((state.amplitude1.real ** 2 + state.amplitude1.imag ** 2) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Individual Density Matrix */}
                    <div>
                      <h5 className="font-medium mb-2">Density Matrix ρ{qubitIndex}</h5>
                      <div className="bg-muted rounded-lg p-3 border">
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {/* Calculate single-qubit density matrix */}
                          {(() => {
                            const a0 = state.amplitude0
                            const a1 = state.amplitude1
                            
                            // ρ = |ψ⟩⟨ψ| for single qubit
                            const rho00 = { 
                              real: a0.real * a0.real + a0.imag * a0.imag, 
                              imag: 0 
                            }
                            const rho01 = { 
                              real: a0.real * a1.real + a0.imag * a1.imag, 
                              imag: a0.imag * a1.real - a0.real * a1.imag 
                            }
                            const rho10 = { 
                              real: a1.real * a0.real + a1.imag * a0.imag, 
                              imag: a1.imag * a0.real - a1.real * a0.imag 
                            }
                            const rho11 = { 
                              real: a1.real * a1.real + a1.imag * a1.imag, 
                              imag: 0 
                            }
                            
                            return [rho00, rho01, rho10, rho11].map((element, idx) => (
                              <div key={idx} className="bg-card p-2 rounded border text-center">
                                <div className="font-mono">
                                  {Math.abs(element.real) < 0.001 ? '0' : element.real.toFixed(3)}
                                </div>
                                {Math.abs(element.imag) > 0.001 && (
                                  <div className="font-mono text-muted-foreground" style={{ fontSize: '10px' }}>
                                    {element.imag >= 0 ? '+' : ''}
                                    {element.imag.toFixed(3)}i
                                  </div>
                                )}
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="font-medium">Purity:</span>
                        <div className="text-muted-foreground">
                          {(() => {
                            const prob0 = state.amplitude0.real ** 2 + state.amplitude0.imag ** 2
                            const prob1 = state.amplitude1.real ** 2 + state.amplitude1.imag ** 2
                            const purity = prob0 ** 2 + prob1 ** 2
                            return purity.toFixed(3)
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Entropy:</span>
                        <div className="text-muted-foreground">
                          {(() => {
                            const prob0 = state.amplitude0.real ** 2 + state.amplitude0.imag ** 2
                            const prob1 = state.amplitude1.real ** 2 + state.amplitude1.imag ** 2
                            const entropy = prob0 > 0 && prob1 > 0 ? 
                              -(prob0 * Math.log2(prob0) + prob1 * Math.log2(prob1)) : 0
                            return entropy.toFixed(3)
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">|0⟩ Prob:</span>
                        <div className="text-muted-foreground">
                          {((state.amplitude0.real ** 2 + state.amplitude0.imag ** 2) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">|1⟩ Prob:</span>
                        <div className="text-muted-foreground">
                          {((state.amplitude1.real ** 2 + state.amplitude1.imag ** 2) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}

function AmplitudeProbabilityTable({ 
  quantumStates,
  measurementResults,
  statevectorData
}: { 
  quantumStates: QubitState[]
  measurementResults?: any[]
  statevectorData?: any
}) {
  const generateBasisStates = (numQubits: number) => {
    // Debug: Log what data we received from Qiskit
    console.log("🔍 Frontend AmplitudeProbabilityTable - Received data:", {
      hasMeasurementResults: !!measurementResults,
      hasStatevectorData: !!statevectorData,
      statevectorLength: statevectorData?.statevector?.length,
      measurementResultsLength: measurementResults?.length
    })
    
    if (statevectorData?.statevector) {
      console.log("📊 Using authentic Qiskit statevector:", statevectorData.statevector.slice(0, 8))
    }
    
    const states = []
    for (let i = 0; i < Math.pow(2, numQubits); i++) {
      const binary = i.toString(2).padStart(numQubits, "0")
      
      // Use authentic Qiskit statevector if available
      let amplitude
      if (statevectorData && statevectorData.statevector && statevectorData.statevector[i]) {
        amplitude = {
          real: statevectorData.statevector[i].real || 0,
          imag: statevectorData.statevector[i].imag || 0
        }
      } else {
        // Fallback to calculated amplitude
        amplitude = calculateAmplitude(binary, quantumStates)
      }
      
      states.push({
        index: i,
        binary,
        ket: `|${binary}⟩`,
        amplitude,
      })
    }
    return states
  }

  const calculateAmplitude = (binaryState: string, states: QubitState[]) => {
    let amplitude = { real: 1, imag: 0 }

    for (let i = 0; i < binaryState.length; i++) {
      const bit = binaryState[i]
      const qubitState = states[i]
      const qubitAmp = bit === "0" ? qubitState.amplitude0 : qubitState.amplitude1

      const newReal = amplitude.real * qubitAmp.real - amplitude.imag * qubitAmp.imag
      const newImag = amplitude.real * qubitAmp.imag + amplitude.imag * qubitAmp.real
      amplitude = { real: newReal, imag: newImag }
    }

    return amplitude
  }

  const basisStates = generateBasisStates(quantumStates.length)
  const usingQiskitData = statevectorData && statevectorData.statevector

  return (
    <div className="space-y-6">

      {/* Beautiful Bar Graph Visualization */}
  <div className="bg-card rounded-lg px-4 pb-4 pt-[15px] border border-border shadow-lg">
        {/* Professional Chart Container */}
  <div className="bg-card rounded-lg p-6 shadow-lg border border-border">
          {/* Centered title above the graph */}
          <div className="text-center mb-4">
            <h4 className={`text-2xl font-extrabold text-card-foreground tracking-wide uppercase ${montserrat.className}`}>
              Quantum State Probabilities
            </h4>
            <div className="mx-auto mt-[5px] h-[3px] w-24 rounded-full bg-foreground/80" />
          </div>
          {/* Y-axis with improved styling */}
          <div className="flex mb-2">
            <div className="w-12 flex items-center justify-center mr-3" style={{ height: '350px' }}>
              <div className="text-sm font-medium text-muted-foreground transform -rotate-90 whitespace-nowrap">
                Probability
              </div>
            </div>
            
            {/* Chart area container */}
            <div className="flex-1 relative flex">
              {/* Y-axis scale positioned authentically on the left */}
                    {/* left spacer for Y-axis title */}
                    <div className="relative mr-2" style={{ height: '350px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30px' }} />
                    </div>
              
              {/* Unified chart area with integrated X-axis */}
              <div className="relative bg-muted rounded-md p-4 border border-border flex-1" style={{ height: '450px' }}>
                
                {/* Authentic grid lines - matching reference chart */}
                <div className="absolute inset-4 pointer-events-none" style={{ height: '350px' }}>
                  {/* Professional grid lines */}
                  {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((value) => (
                    <div
                      key={value}
                      className={`absolute w-full ${value === 0.0 ? 'border-b-2 border-foreground/70' : 'border-t border-border'}`}
                      style={{ bottom: `${value * 100}%` }}
                    />
                  ))}

                  {/* Y-axis numeric labels aligned to the same grid lines */}
                  {[1.0, 0.8, 0.6, 0.4, 0.2, 0.0].map((value) => (
                    <div
                      key={`ylabel-${value}`}
                      className="absolute text-xs font-medium text-muted-foreground text-right"
                      style={{ bottom: `${value * 100}%`, right: '100%', marginRight: '22px', transform: 'translateY(50%)' }}
                    >
                      {value.toFixed(1)}
                    </div>
                  ))}
                </div>
                
                {/* Beautiful bars */}
                <div className="relative flex flex-col px-4" style={{ height: '350px' }}>
                  {/* Bar container */}
                  <div className="relative flex-1">
                    {(() => {
                      const total = basisStates.length
                      const EPS = 1e-9
                      // Build list of items and filter when total > 32 to non-zero probabilities
                      const items = basisStates
                        .map((state, index) => {
                          const magnitude = Math.sqrt(state.amplitude.real ** 2 + state.amplitude.imag ** 2)
                          const probability = magnitude ** 2
                          const phase = Math.atan2(state.amplitude.imag, state.amplitude.real)
                          return { state, index, magnitude, probability, phase }
                        })
                        .filter(item => total > 32 ? item.probability > EPS : true)

                      const displayedCount = items.length || 1
                      const useFilteredLayout = total > 32
                      const containerWidthPercent = (useFilteredLayout ? (100 / displayedCount) : (100 / total))

                      // Bar width: constant based on total, not on filtered layout
                      const barWidthPercent = Math.min((100 / total) * 0.4, 4)

                      const minWidthPx = (total > 8 ? '28px' : '45px')

                      return items.map((item, i) => {
                        const leftPercent = (useFilteredLayout ? (i * containerWidthPercent) : (item.index * containerWidthPercent)) + (containerWidthPercent / 2)

                        // Color function
                        const getBarColor = (prob: number) => {
                          if (prob > 0.01) return 'bg-primary'
                          return 'bg-muted'
                        }

                        return (
                          <TooltipProvider key={item.state.index}>
                            <Tooltip delayDuration={100}>
                              <TooltipTrigger asChild>
                                <div 
                                  className="absolute group cursor-pointer flex flex-col items-center"
                                  style={{ 
                                    left: `${leftPercent}%`,
                                    transform: 'translateX(-50%)',
                                    bottom: 0,
                                    width: `${Math.max(barWidthPercent, 3)}%`,
                                    minWidth: minWidthPx
                                  }}
                                >
                                  {/* Probability badge above bar (only for > 0) */}
                                  {item.probability > EPS && (
                                    <div className="absolute -top-9 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
                                      <span className="text-xs font-semibold px-2 py-1 rounded-md shadow bg-popover text-popover-foreground border border-border">
                                        {(item.probability * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}

                                  {/* Professional bar design */}
                                  <div
                                    className={`
                                      w-full ${getBarColor(item.probability)} rounded-t-md shadow-md border-l border-r border-white/20
                                      hover:opacity-90 hover:scale-105 transition-all duration-200
                                      ${item.probability > 0.001 ? 'min-h-[3px]' : 'h-0'}
                                    `}
                                    style={{ 
                                      height: `${Math.max(item.probability * 350, item.probability > 0.001 ? 3 : 0)}px`,
                                      filter: 'brightness(1.05)'
                                    }}
                                  />

                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm border border-border bg-popover text-popover-foreground shadow-xl">
                                <div className="space-y-3 p-2">
                                  <div className="text-center border-b pb-2">
                                    <div className="text-xl font-bold text-foreground">{item.state.ket}</div>
                                    <div className="text-lg font-semibold text-primary">
                                      {(item.probability * 100).toFixed(2)}% probability
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="space-y-1">
                                      <div className="font-medium">Amplitude</div>
                                      <div className="font-mono text-xs bg-muted p-2 rounded">
                                        Real: {item.state.amplitude.real.toFixed(4)}<br/>
                                        Imag: {item.state.amplitude.imag.toFixed(4)}
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                      <div className="font-medium">Properties</div>
                                      <div className="font-mono text-xs bg-muted p-2 rounded">
                                        |Amplitude|: {item.magnitude.toFixed(4)}<br/>
                                        Phase: {((item.phase * 180) / Math.PI).toFixed(1)}°
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Enhanced visual probability bar in tooltip */}
                                  <div className="pt-2 border-t">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">Measurement chance:</span>
                                      <div className="flex-1 bg-muted rounded-full h-3 shadow-inner">
                                        <div
                                          className={`${getBarColor(item.probability)} h-3 rounded-full transition-all duration-700 shadow-sm`}
                                          style={{ 
                                            width: `${item.probability * 100}%`,
                                            filter: 'saturate(1.3) brightness(1.1)'
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })
                    })()}
                  </div>
                  
                  {/* X-axis tick marks and compact label row directly under baseline */}
                  <div className="absolute left-0 right-0" style={{ bottom: '-64px', height: '64px', padding: '0 1rem' }}>
                    <div className="relative w-full h-6">
                      {(() => {
                        const total = basisStates.length
                        const EPS = 1e-9
                        const items = basisStates
                          .map((state, index) => {
                            const magnitude = Math.sqrt(state.amplitude.real ** 2 + state.amplitude.imag ** 2)
                            const probability = magnitude ** 2
                            const shouldShow = total > 32 ? probability > EPS : true
                            return { state, index, probability, shouldShow }
                          })
                          .filter(x => x.shouldShow)
                        const useFilteredLayout = total > 32
                        const containerWidth = 100 / (useFilteredLayout ? items.length || 1 : total)
                        const isDense = total >= 32
                        return items.map(({ state, index }, i) => {
                          const posIndex = useFilteredLayout ? i : index
                          const isMajor = isDense ? posIndex % 4 === 0 : true
                          return (
                            <div key={`tick-${state.index}`} className="absolute flex flex-col items-center" style={{ left: `${(posIndex * containerWidth) + (containerWidth / 2)}%`, transform: 'translateX(-50%)' }}>
                              <div className={`w-px ${isMajor ? 'h-3 bg-muted-foreground/70' : 'h-2 bg-muted-foreground/40'}`} />
                            </div>
                          )
                        })
                      })()}
                    </div>

                    <div className="relative w-full overflow-visible" style={{ top: '8px' }}>
                      {(() => {
                        const total = basisStates.length
                        const EPS = 1e-9
                        const items = basisStates
                          .map((state, index) => {
                            const magnitude = Math.sqrt(state.amplitude.real ** 2 + state.amplitude.imag ** 2)
                            const probability = magnitude ** 2
                            const shouldShow = total > 32 ? probability > EPS : true
                            return { state, index, probability, shouldShow }
                          })
                          .filter(x => x.shouldShow)
                        const labelCount = items.length
                        const angle = labelCount <= 8 ? 0 : (labelCount <= 16 ? -20 : -35)
                        const useFilteredLayout = total > 32
                        const containerWidth = 100 / (useFilteredLayout ? items.length || 1 : total)
                        return items.map(({ state, index }, i) => {
                          const posIndex = useFilteredLayout ? i : index
                          return (
                            <div
                              key={`label-${state.index}`}
                              className="absolute text-center"
                              style={{ left: `${(posIndex * containerWidth) + (containerWidth / 2)}%`, transform: 'translateX(-50%)' }}
                            >
                              <span
                                className={`text-sm font-mono font-semibold text-foreground tracking-tight select-none`}
                                style={{ display: 'inline-block', whiteSpace: 'nowrap', transform: angle ? `rotate(${angle}deg)` : 'none', transformOrigin: 'top center' }}
                                title={state.ket.replace('|', '').replace('⟩', '')}
                              >
                                {state.ket.replace('|', '').replace('⟩', '')}
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                  
                </div>
              </div>
              
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-2">Normalization Check</h4>
          <div className="text-sm">
            <div>
              Total Probability:{" "}
              {basisStates
                .reduce((sum, state) => {
                  const magnitude = Math.sqrt(state.amplitude.real ** 2 + state.amplitude.imag ** 2)
                  return sum + magnitude ** 2
                }, 0)
                .toFixed(6)}
            </div>
            <div className="text-muted-foreground">Should equal 1.000000</div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-2">Dominant States</h4>
          <div className="text-sm space-y-1">
            {basisStates
              .sort((a, b) => {
                const probA = a.amplitude.real ** 2 + a.amplitude.imag ** 2
                const probB = b.amplitude.real ** 2 + b.amplitude.imag ** 2
                return probB - probA
              })
              .slice(0, 3)
              .map((state) => {
                const prob = state.amplitude.real ** 2 + state.amplitude.imag ** 2
                return (
                  <div key={state.index}>
                    {state.ket}: {(prob * 100).toFixed(1)}%
                  </div>
                )
              })}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-2">Quantum Properties</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>• Complex amplitudes allow interference</div>
            <div>• Probabilities must sum to 1</div>
            <div>• Phase differences create quantum effects</div>
          </div>
        </Card>
      </div>


    </div>
  )
}
