"use client"

import { useState, useCallback, useRef, useLayoutEffect, useEffect, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, Play, Info, Link, Save, History, ChevronLeft, ChevronRight, RotateCcw, RotateCw, Download, Upload, HelpCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getQiskitApiUrl } from "@/lib/api"
import { SaveCircuitDialog } from "./save-circuit-dialog"
import { CircuitHistoryPanel, type SavedCircuit } from "./circuit-history-panel"

// Quantum gate types with enhanced properties
export type QuantumGate = {
  id: string
  type: "H" | "X" | "Y" | "Z" | "CNOT" | "CNOT_CONTROL" | "CONTROL" | "MEASURE" | "S" | "T" | "Sdg" | "Tdg" | "RX" | "RY" | "RZ" | "U" | "P" | "SWAP" | "ISWAP"
  name: string
  description: string
  color: string
  symbol: string
  matrix?: number[][]
  parametric?: boolean
  parameters?: Array<{ name: string; defaultValue: number }>
}

// Enhanced quantum circuit state
export type QubitState = {
  amplitude0: { real: number; imag: number }
  amplitude1: { real: number; imag: number }
  measured?: boolean
  measurementResult?: 0 | 1
  // Optional metadata from backend for mixed/entangled states
  is_mixed?: boolean
  purity?: number
  // Optional probabilities for display when amplitudes are not meaningful (mixed states)
  prob0?: number
  prob1?: number
  // Optional density matrix diagonals (for deriving probabilities)
  density_matrix?: {
    rho_00?: { real: number; imag: number }
    rho_01?: { real: number; imag: number }
    rho_10?: { real: number; imag: number }
    rho_11?: { real: number; imag: number }
  }
}

export type CircuitElement = {
  id: string
  gateType: QuantumGate["type"]
  qubitIndex: number
  position: number
  controlQubit?: number // For CNOT gates and single control
  controlQubits?: number[] // For multi-control gates (array of control qubits)
  targetQubit?: number // For multi-qubit gates
  rotation?: number // For parameterized gates (legacy)
  parameters?: number[] // For multi-parameter gates like U gate
  connectedElementId?: string // For linking CNOT control and target
  connectedControlIds?: string[] // For linking multiple controls to target
}

export type CircuitStats = {
  depth: number
  gateCount: number
  shots: number
  backend: string
  mostProbable: string
  probability: number
}

const QUANTUM_GATES: QuantumGate[] = [
  {
    id: "hadamard",
    type: "H",
    name: "Hadamard",
    description: "Creates superposition: |0⟩ → (|0⟩ + |1⟩)/√2, |1⟩ → (|0⟩ - |1⟩)/√2",
    color: "bg-blue-500 hover:bg-blue-600",
    symbol: "H",
    matrix: [
      [1 / Math.sqrt(2), 1 / Math.sqrt(2)],
      [1 / Math.sqrt(2), -1 / Math.sqrt(2)],
    ],
  },
  {
    id: "phase-gate",
    type: "P",
    name: "Phase (P)",
    description: "Phase rotation by angle φ (equivalent to U1)",
    color: "bg-amber-500 hover:bg-amber-600",
    symbol: "P",
    parametric: true,
    parameters: [{ name: "φ", defaultValue: Math.PI / 2 }],
  },
  {
    id: "pauli-x",
    type: "X",
    name: "Pauli-X",
    description: "Bit flip: |0⟩ ↔ |1⟩ (quantum NOT gate)",
    color: "bg-red-500 hover:bg-red-600",
    symbol: "X",
    matrix: [
      [0, 1],
      [1, 0],
    ],
  },
  {
    id: "swap",
    type: "SWAP",
    name: "SWAP",
    description: "Swap the states of two qubits",
    color: "bg-emerald-600 hover:bg-emerald-700",
    symbol: "↔",
  },
  {
    id: "iswap",
    type: "ISWAP",
    name: "iSWAP",
    description: "Swap with i phase on |01⟩ and |10⟩",
    color: "bg-teal-600 hover:bg-teal-700",
    symbol: "iS",
  },
  {
    id: "pauli-y",
    type: "Y",
    name: "Pauli-Y",
    description: "Bit and phase flip: |0⟩ → i|1⟩, |1⟩ → -i|0⟩",
    color: "bg-slate-500 hover:bg-slate-600",
    symbol: "Y",
    matrix: [
      [0, -1],
      [1, 0],
    ], // Simplified representation
  },
  {
    id: "pauli-z",
    type: "Z",
    name: "Pauli-Z",
    description: "Phase flip: |0⟩ → |0⟩, |1⟩ → -|1⟩",
    color: "bg-green-500 hover:bg-green-600",
    symbol: "Z",
    matrix: [
      [1, 0],
      [0, -1],
    ],
  },
  {
    id: "s-gate",
    type: "S",
    name: "S Gate",
    description: "Phase gate: |0⟩ → |0⟩, |1⟩ → i|1⟩",
    color: "bg-purple-500 hover:bg-purple-600",
    symbol: "S",
    matrix: [
      [1, 0],
      [0, 1],
    ], // Simplified
  },
  {
    id: "t-gate",
    type: "T",
    name: "T Gate",
    description: "π/8 phase gate: |0⟩ → |0⟩, |1⟩ → e^(iπ/4)|1⟩",
    color: "bg-indigo-500 hover:bg-indigo-600",
    symbol: "T",
    matrix: [
      [1, 0],
      [0, 1],
    ], // Simplified
  },
  {
    id: "s-dagger",
    type: "Sdg",
    name: "S† Gate",
    description: "S-dagger gate: |0⟩ → |0⟩, |1⟩ → -i|1⟩",
    color: "bg-purple-700 hover:bg-purple-800",
    symbol: "S†",
    matrix: [
      [1, 0],
      [0, -1],
    ], // Simplified
  },
  {
    id: "t-dagger",
    type: "Tdg",
    name: "T† Gate",
    description: "T-dagger gate: |0⟩ → |0⟩, |1⟩ → e^(-iπ/4)|1⟩",
    color: "bg-indigo-700 hover:bg-indigo-800",
    symbol: "T†",
    matrix: [
      [1, 0],
      [0, 1],
    ], // Simplified
  },
  {
    id: "rx-gate",
    type: "RX",
    name: "RX Gate",
    description: "Rotation around X-axis by angle θ",
    color: "bg-pink-500 hover:bg-pink-600",
    symbol: "RX",
    parametric: true,
    parameters: [{ name: "θ", defaultValue: Math.PI / 2 }],
  },
  {
    id: "ry-gate",
    type: "RY",
    name: "RY Gate",
    description: "Rotation around Y-axis by angle θ",
    color: "bg-cyan-500 hover:bg-cyan-600",
    symbol: "RY",
    parametric: true,
    parameters: [{ name: "θ", defaultValue: Math.PI / 2 }],
  },
  {
    id: "rz-gate",
    type: "RZ",
    name: "RZ Gate",
    description: "Rotation around Z-axis by angle θ",
    color: "bg-teal-500 hover:bg-teal-600",
    symbol: "RZ",
    parametric: true,
    parameters: [{ name: "θ", defaultValue: Math.PI / 2 }],
  },
  {
    id: "u-gate",
    type: "U",
    name: "U Gate",
    description: "Universal single-qubit gate: U(θ,φ,λ)",
    color: "bg-violet-500 hover:bg-violet-600",
    symbol: "U",
    parametric: true,
    parameters: [
      { name: "θ", defaultValue: Math.PI / 2 },
      { name: "φ", defaultValue: 0 },
      { name: "λ", defaultValue: 0 }
    ],
  },
  {
    id: "cnot-target",
    type: "CNOT",
    name: "CNOT Target",
    description: "CNOT target gate: configure control qubits and target position",
    color: "bg-slate-600 hover:bg-slate-700",
    symbol: "⊕",
    parametric: true,
    parameters: [
      { name: "Control Qubits (comma-separated)", defaultValue: 0 },
      { name: "Target Qubit", defaultValue: 1 }
    ]
  },
  {
    id: "cnot-control",
    type: "CNOT_CONTROL",
    name: "CNOT Control",
    description: "CNOT control gate: drag and connect to a CNOT target",
    color: "bg-slate-700 hover:bg-slate-800",
    symbol: "●",
  },
  {
    id: "control",
    type: "CONTROL",
    name: "Control Qubit",
    description: "Generic control qubit: can be connected to any target gate for multi-controlled operations",
    color: "bg-cyan-600 hover:bg-cyan-700",
    symbol: "●",
  },
  {
    id: "measure",
    type: "MEASURE",
    name: "Measure",
    description: "Measure qubit in computational basis {|0⟩, |1⟩}",
    color: "bg-gray-500 hover:bg-gray-600",
    symbol: "📊",
  },
]

export function QuantumCircuitBuilder({
  onAchievement,
  onStateUpdate,
  onMeasurementUpdate,
  numQubits: propNumQubits,
  circuitElements: propCircuitElements,
  qubitStates: propQubitStates,
  onCircuitElementsUpdate,
  onNumQubitsUpdate,
  onMeasurementResults,
  onStatevectorUpdate,
  onSaveCircuit,
  onUpdateCircuit,
  currentCircuitTitle,
  onUpdateWorkingTitle,
  isCircuitLoaded,
  existingCircuitTitles,
  isAuthenticated,
  savedCircuits,
  onLoadSavedCircuit,
  onDeleteSavedCircuit,
}: {
  onAchievement?: (id: string) => void
  onStateUpdate?: (states: QubitState[]) => void
  onMeasurementUpdate?: (results: { [key: string]: number }) => void
  numQubits?: number
  circuitElements?: CircuitElement[]
  qubitStates?: QubitState[]
  onCircuitElementsUpdate?: (elements: CircuitElement[]) => void
  onNumQubitsUpdate?: (numQubits: number) => void
  onMeasurementResults?: (results: any[]) => void
  onStatevectorUpdate?: (data: any) => void
  onSaveCircuit?: (title: string, numQubits: number, circuitElements: CircuitElement[]) => void
  onUpdateCircuit?: (title: string, numQubits: number, circuitElements: CircuitElement[]) => void
  currentCircuitTitle?: string
  onUpdateWorkingTitle?: (title: string) => void
  isCircuitLoaded?: boolean
  existingCircuitTitles?: string[]
  isAuthenticated?: boolean
  savedCircuits?: SavedCircuit[]
  onLoadSavedCircuit?: (circuit: SavedCircuit) => void
  onDeleteSavedCircuit?: (circuitId: string) => void
}) {
  const [localNumQubits, setLocalNumQubits] = useState(3)
  const [localCircuitElements, setLocalCircuitElements] = useState<CircuitElement[]>([])
  const [localQubitStates, setLocalQubitStates] = useState<QubitState[]>(
    Array(3)
      .fill(null)
      .map(() => ({
        amplitude0: { real: 1, imag: 0 },
        amplitude1: { real: 0, imag: 0 },
        measured: false,
      })),
  )

  const numQubits = propNumQubits ?? localNumQubits
  const circuitElements = propCircuitElements ?? localCircuitElements
  const qubitStates = propQubitStates ?? localQubitStates

  const [draggedGate, setDraggedGate] = useState<QuantumGate | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<{ qubit: number; position: number } | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [circuitStats, setCircuitStats] = useState<CircuitStats | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Helper: get base bg-* class for a gate type so control dots match the gate color
  const getGateBgClass = useCallback((gateType: QuantumGate["type"]) => {
    const g = QUANTUM_GATES.find(gt => gt.type === gateType)
    if (!g) return "bg-slate-600"
    const bg = g.color.split(" ").find(cls => cls.startsWith("bg-"))
    return bg || "bg-slate-600"
  }, [])
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [parameterValues, setParameterValues] = useState<{ [key: string]: number[] }>({})
  const [historySearch, setHistorySearch] = useState("")

  // Noise model state
  // SSR-safe: initialize with static value, update from localStorage in useEffect
  const [noiseEnabled, setNoiseEnabled] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('noiseEnabled');
      if (stored !== null) setNoiseEnabled(stored === 'true');
    }
  }, [])
  // Restore noiseEnabled from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('noiseEnabled');
      if (stored !== null) setNoiseEnabled(stored === 'true');
    }
  }, []);
  const [depolarizingProb, setDepolarizingProb] = useState(0.001)
  const [t1Time, setT1Time] = useState(50.0)
  const [t2Time, setT2Time] = useState(70.0)
  const [readoutErrorProb, setReadoutErrorProb] = useState(0.01)
  const [gateTime, setGateTime] = useState(0.1)
  const [thermalPopulation, setThermalPopulation] = useState(0.0)
  const [selectedPreset, setSelectedPreset] = useState<string>("custom")
  const [backendCapabilities, setBackendCapabilities] = useState<{ has_aer: boolean } | null>(null)
  const { toast } = useToast()

  // Persist noiseEnabled to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('noiseEnabled', String(noiseEnabled))
    }
  }, [noiseEnabled])

  // Check backend capabilities on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(getQiskitApiUrl("/"))
        const data = await response.json()
        setBackendCapabilities({ has_aer: data.has_aer || false })
      } catch (error) {
        console.warn("Could not check backend capabilities:", error)
        setBackendCapabilities({ has_aer: false })
      }
    }
    checkBackend()
  }, [])

  const circuitRef = useRef<HTMLDivElement>(null)
  const wireRefs = useRef<Array<HTMLDivElement | null>>([])
  const [wireGeom, setWireGeom] = useState<{ left: number[]; centerY: number[] }>({ left: [], centerY: [] })

  // Measure wire container positions to draw accurate connectors between gate centers
  const measureWireGeom = useCallback(() => {
    if (!circuitRef.current) return
    const parentRect = circuitRef.current.getBoundingClientRect()
    const left: number[] = []
    const centerY: number[] = []
    wireRefs.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      left[i] = r.left - parentRect.left
      centerY[i] = (r.top - parentRect.top) + r.height / 2
    })
    setWireGeom({ left, centerY })
  }, [])

  useLayoutEffect(() => {
    measureWireGeom()
  }, [measureWireGeom, numQubits, circuitElements])

  useLayoutEffect(() => {
    const onResize = () => measureWireGeom()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measureWireGeom])

  // Enhanced quantum simulation
  const updateCircuitElements = useCallback(
    (updater: (prev: CircuitElement[]) => CircuitElement[]) => {
      if (onCircuitElementsUpdate) {
        onCircuitElementsUpdate(updater(circuitElements))
      } else {
        setLocalCircuitElements(updater)
      }
    },
    [onCircuitElementsUpdate, circuitElements],
  )

  const updateQubitStates = useCallback(
    (newStates: QubitState[]) => {
      if (onStateUpdate) {
        onStateUpdate(newStates)
      } else {
        setLocalQubitStates(newStates)
      }
    },
    [onStateUpdate],
  )

  const simulateCircuit = useCallback(
    async (elements: CircuitElement[] = circuitElements) => {
      setIsSimulating(true)

      // Debug: Log circuit elements before sorting
      console.log("🔍 Circuit elements before sorting:", elements.map(el => 
        `${el.gateType} on q${el.qubitIndex} at pos${el.position}${el.controlQubit !== undefined ? ` (ctrl:q${el.controlQubit})` : ''}`
      ))

      // Prepare Qiskit API payload
      const gates = elements
        .sort((a, b) => {
          // Sort by position first
          if (a.position !== b.position) {
            return a.position - b.position
          }
          
          // For gates at same position, apply single-qubit gates before two-qubit gates
          const aIsTwoQubit = a.gateType === 'CNOT' && typeof a.controlQubit === 'number'
          const bIsTwoQubit = b.gateType === 'CNOT' && typeof b.controlQubit === 'number'
          
          if (aIsTwoQubit && !bIsTwoQubit) return 1  // b (single-qubit) comes first
          if (!aIsTwoQubit && bIsTwoQubit) return -1 // a (single-qubit) comes first
          
          // Both same type, sort by qubit index (ascending order)
          return a.qubitIndex - b.qubitIndex
        })
        .map((el) => {
          switch (el.gateType) {
            case "P":
              return {
                name: "p",
                qubits: (el.controlQubits && el.controlQubits.length > 0) ? [...el.controlQubits, el.qubitIndex] : [el.qubitIndex],
                params: [el.parameters?.[0] ?? Math.PI/2]
              }
            case "SWAP":
              if (typeof el.targetQubit === "number") {
                return { name: "swap", qubits: [el.qubitIndex, el.targetQubit] }
              }
              // If partner not set, skip until user configures
              return null
            case "ISWAP":
              if (typeof el.targetQubit === "number") {
                return { name: "iswap", qubits: [el.qubitIndex, el.targetQubit] }
              }
              return null
            case "CNOT":
              // For CNOT gates, use controlQubits array or legacy controlQubit
              if (el.controlQubits && el.controlQubits.length > 0) {
                // Multi-control CNOT using controlQubits array
                if (el.controlQubits.length === 1) {
                  return { name: "cx", qubits: [el.controlQubits[0], el.qubitIndex] }
                } else {
                  // Multi-control CNOT (Toffoli, etc.)
                  return { name: "mcx", qubits: [...el.controlQubits, el.qubitIndex] }
                }
              } else if (typeof el.controlQubit === "number") {
                // Legacy single control
                return { name: "cx", qubits: [el.controlQubit, el.qubitIndex] }
              }
              // CNOT target without control - skip for now (incomplete gate)
              return null
            case "CNOT_CONTROL":
              // CNOT control gates are handled by their target counterparts
              return null
            case "CONTROL":
              // Generic control gates don't generate operations by themselves - they need to be connected to targets
              return null
            case "H":
              return { name: "h", qubits: [el.qubitIndex] }
            case "X":
              return { name: "x", qubits: [el.qubitIndex] }
            case "Y":
              return { name: "y", qubits: [el.qubitIndex] }
            case "Z":
              return { name: "z", qubits: [el.qubitIndex] }
            case "S":
              return { name: "s", qubits: [el.qubitIndex] }
            case "T":
              return { name: "t", qubits: [el.qubitIndex] }
            case "Sdg":
              return { name: "sdg", qubits: [el.qubitIndex] }
            case "Tdg":
              return { name: "tdg", qubits: [el.qubitIndex] }
            case "RX":
              return { 
                name: "rx", 
                qubits: (el.controlQubits && el.controlQubits.length > 0) ? [...el.controlQubits, el.qubitIndex] : [el.qubitIndex],
                params: [el.parameters?.[0] ?? el.rotation ?? Math.PI/2]
              }
            case "RY":
              return { 
                name: "ry", 
                qubits: (el.controlQubits && el.controlQubits.length > 0) ? [...el.controlQubits, el.qubitIndex] : [el.qubitIndex],
                params: [el.parameters?.[0] ?? el.rotation ?? Math.PI/2]
              }
            case "RZ":
              return { 
                name: "rz", 
                qubits: (el.controlQubits && el.controlQubits.length > 0) ? [...el.controlQubits, el.qubitIndex] : [el.qubitIndex],
                params: [el.parameters?.[0] ?? el.rotation ?? Math.PI/2]
              }
            case "U":
              return { 
                name: "u", 
                qubits: (el.controlQubits && el.controlQubits.length > 0) ? [...el.controlQubits, el.qubitIndex] : [el.qubitIndex],
                params: (el.parameters ?? [Math.PI/2, 0, 0])
              }
            case "MEASURE":
              // Qiskit measures all at the end
              return null
            default:
              return null
          }
        })
        .filter(Boolean)

      // Debug: Log the exact gate sequence being sent to Qiskit
      console.log(
        "🔬 Gate sequence being sent to Qiskit:",
        (gates as any[]).map((g: any, idx: number) =>
          `${idx}: ${g.name}(${g.qubits.join(',')})${g.params ? ` [${g.params.join(', ')}]` : ''}`
        )
      )

      try {
        const response = await fetch(getQiskitApiUrl("/simulate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            num_qubits: numQubits, 
            gates, 
            shots: 1024,
            noise_params: {
              noise_enabled: noiseEnabled,
              depolarizing_prob: depolarizingProb,
              t1_time: t1Time,
              t2_time: t2Time,
              readout_error_prob: readoutErrorProb,
              gate_time: gateTime,
              thermal_population: thermalPopulation
            }
          }),
        })
        if (!response.ok) {
          throw new Error(`Qiskit API error: ${response.status}`)
        }
        const data = await response.json()
        
        // Check for backend errors
        if (data.error) {
          console.error("Qiskit backend error:", data.error, data.gate)
          throw new Error(`Backend error: ${data.error}`)
        }
        
        if (!data.counts || typeof data.counts !== "object") {
          throw new Error("Qiskit API returned invalid counts")
        }
        
        // Log Qiskit circuit metrics
        console.log("Qiskit Circuit Info:", {
          depth: data.circuit_depth,
          gates: data.gate_count,
          shots: data.shots,
          backend: data.backend
        })
        
        // Convert Qiskit response to QubitState[]
        // Prioritize qubit_states (with proper amplitudes) over qubit_probabilities
        if (data.qubit_states && Array.isArray(data.qubit_states)) {
          const newStates: QubitState[] = data.qubit_states.map((qState: any) => {
            // Derive probabilities preferentially from density matrix if available
            let prob0: number | undefined = undefined
            let prob1: number | undefined = undefined
            if (qState.density_matrix && qState.density_matrix.rho_00 && qState.density_matrix.rho_11) {
              prob0 = Math.max(0, Math.min(1, qState.density_matrix.rho_00.real))
              prob1 = Math.max(0, Math.min(1, qState.density_matrix.rho_11.real))
            } else if (typeof qState.prob_0 === 'number' && typeof qState.prob_1 === 'number') {
              prob0 = qState.prob_0
              prob1 = qState.prob_1
            }

            return {
              amplitude0: {
                real: qState.amplitude0.real,
                imag: qState.amplitude0.imag
              },
              amplitude1: {
                real: qState.amplitude1.real,
                imag: qState.amplitude1.imag
              },
              measured: false,
              measurementResult: undefined,
              is_mixed: qState.is_mixed || false,
              purity: qState.purity || 1.0,
              prob0,
              prob1,
              density_matrix: qState.density_matrix
            } as QubitState
          })
          
          updateQubitStates(newStates)
          console.log("✅ Using accurate qubit states with proper phases")
          console.log("Qubit States:", data.qubit_states)
        } else if (data.qubit_probabilities && Array.isArray(data.qubit_probabilities)) {
          // Fallback: use individual qubit probabilities (loses phase information)
          const newStates: QubitState[] = data.qubit_probabilities.map((probs: any) => ({
            amplitude0: { real: Math.sqrt(probs.prob_0), imag: 0 },
            amplitude1: { real: Math.sqrt(probs.prob_1), imag: 0 },
            measured: false,
            measurementResult: undefined,
            prob0: probs.prob_0,
            prob1: probs.prob_1,
          }))
          
          updateQubitStates(newStates)
          console.log("⚠️ Using probability fallback (phase information lost)")
        } else {
          // Fallback: calculate from measurement counts
          const totalShots = data.shots || 1024
          const probabilities: { [key: string]: number } = {}
          
          // Calculate probability for each measured outcome
          for (const [bitstring, count] of Object.entries(data.counts)) {
            const nCount = typeof count === "number" ? count : Number(count)
            probabilities[bitstring] = nCount / totalShots
          }
          
          // Create qubit states that show superposition probabilities
          const newStates: QubitState[] = Array(numQubits).fill(null).map((_, qubitIndex) => {
            let prob0 = 0
            let prob1 = 0
            
            // Sum probabilities for this qubit being |0⟩ or |1⟩
            for (const [bitstring, probability] of Object.entries(probabilities)) {
              const paddedBitstring = bitstring.padStart(numQubits, "0")
              // Qiskit uses little-endian (rightmost bit is qubit 0)
              const bitValue = paddedBitstring[numQubits - 1 - qubitIndex]
              if (bitValue === "0") {
                prob0 += probability
              } else {
                prob1 += probability
              }
            }
            
            return {
              amplitude0: { real: Math.sqrt(prob0), imag: 0 },
              amplitude1: { real: Math.sqrt(prob1), imag: 0 },
              measured: false, // Show as superposition
              measurementResult: undefined,
              prob0,
              prob1,
            }
          })
          
          updateQubitStates(newStates)
        }
        
        // Find most probable outcome for stats
        let maxKey = "0".repeat(numQubits)
        let maxCount = 0
        for (const [key, count] of Object.entries(data.counts)) {
          const nCount = typeof count === "number" ? count : Number(count)
          if (nCount > maxCount) {
            maxKey = key
            maxCount = nCount
          }
        }
        
        // Update UI with Qiskit metrics (you can display these in your UI)
        setCircuitStats({
          depth: data.circuit_depth || 0,
          gateCount: data.gate_count || 0,
          shots: data.shots || 1024,
          backend: data.backend || "qiskit",
          mostProbable: maxKey,
          probability: (maxCount / (data.shots || 1024)) * 100
        })
        
        // Pass measurement results to parent component
        if (onMeasurementUpdate && data.counts) {
          onMeasurementUpdate(data.counts)
        }
        
        // Pass raw measurement results for the amplitude table
        if (onMeasurementResults && data.counts) {
          const measurementArray = Object.entries(data.counts).map(([bitstring, count]) => ({
            bitstring,
            count: typeof count === "number" ? count : Number(count),
            probability: (typeof count === "number" ? count : Number(count)) / (data.shots || 1024)
          }))
          onMeasurementResults(measurementArray)
        }
        
        // Pass statevector data if available
        if (onStatevectorUpdate) {
          onStatevectorUpdate({
            statevector: data.statevector,
            shots: data.shots,
            backend: data.backend,
            circuit_depth: data.circuit_depth,
            gate_count: data.gate_count
          })
        }
        
      } catch (err) {
        // fallback: reset all
        console.error("Qiskit API error", err)
        updateQubitStates(
          Array(numQubits)
            .fill(null)
            .map(() => ({
              amplitude0: { real: 1, imag: 0 },
              amplitude1: { real: 0, imag: 0 },
              measured: false,
            }))
        )
        // Reset stats on error
        setCircuitStats(null)
      }
      setTimeout(() => setIsSimulating(false), 300)
    },
    [circuitElements, numQubits, updateQubitStates],
  )

  // Enhanced drag handlers with visual feedback
  const handleDragStart = useCallback((gate: QuantumGate, e: DragEvent) => {
    setDraggedGate(gate)
    e.dataTransfer.effectAllowed = "copy"

    // Create custom drag image
    const dragImage = document.createElement("div")
    dragImage.className = `w-12 h-12 ${gate.color} text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-lg`
    dragImage.textContent = gate.symbol
    dragImage.style.position = "absolute"
    dragImage.style.top = "-1000px"
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 24, 24)

    setTimeout(() => document.body.removeChild(dragImage), 0)
  }, [])

  const handleDragOver = useCallback((e: DragEvent, qubitIndex: number, position: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
    setDragOverPosition({ qubit: qubitIndex, position })
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverPosition(null)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent, qubitIndex: number, position: number) => {
      e.preventDefault()
      if (!draggedGate) return

      // Check if position is already occupied by any gate (consider two-qubit mirrors)
      const existingElement = circuitElements.find((el) =>
        el.position === position && (
          el.qubitIndex === qubitIndex ||
          ((el.gateType === "SWAP" || el.gateType === "ISWAP") && el.targetQubit === qubitIndex)
        )
      )

      if (existingElement) {
        // Don't allow placing a gate if position is occupied
        alert("This position is already occupied by another gate. Please choose an empty position or remove the existing gate first.")
        setDraggedGate(null)
        setDragOverPosition(null)
        return
      }

      if (draggedGate.type === "CNOT") {
        // CNOT gate - create without any default control qubits
        const newElement: CircuitElement = {
          id: `cnot-${Date.now()}-${Math.random()}`,
          gateType: "CNOT",
          qubitIndex,
          position,
          controlQubits: [], // Start with no control qubits - user must add them manually
        }

        pushUndo(circuitElements)
        updateCircuitElements((prev) => [...prev, newElement])
        setDraggedGate(null)
        setDragOverPosition(null)
        
        // Auto-simulate after adding gate
        setTimeout(() => simulateCircuit([...circuitElements, newElement]), 100)
        return
      }

      if (draggedGate.type === "CNOT_CONTROL") {
        // CNOT Control gate - find nearby target gates to connect to
        const nearbyTargets = circuitElements.filter(
          (el) => el.gateType === "CNOT" && !el.controlQubit && Math.abs(el.position - position) <= 2
        )

        if (nearbyTargets.length === 0) {
          alert("Please place a CNOT target gate (⊕) first, then add the control gate (●) nearby!")
          setDraggedGate(null)
          setDragOverPosition(null)
          return
        }

        // Find the closest target gate
        const closestTarget = nearbyTargets.reduce((closest, target) => 
          Math.abs(target.position - position) < Math.abs(closest.position - position) ? target : closest
        )

        // Create control gate and link it to target
        const controlElement: CircuitElement = {
          id: `cnot-control-${Date.now()}-${Math.random()}`,
          gateType: "CNOT_CONTROL",
          qubitIndex,
          position: closestTarget.position, // Same position as target
          connectedElementId: closestTarget.id,
        }

        // Update the target gate to know about its control
        updateCircuitElements(prev => {
          const updatedElements = prev.map(el => 
            el.id === closestTarget.id 
              ? { ...el, controlQubit: qubitIndex, connectedElementId: controlElement.id }
              : el
          )
          return [...updatedElements, controlElement]
        })
        
        setDraggedGate(null)
        setDragOverPosition(null)

        // Auto-simulate after adding gate
        setTimeout(() => {
          const finalElements = circuitElements.map(el => 
            el.id === closestTarget.id 
              ? { ...el, controlQubit: qubitIndex, connectedElementId: controlElement.id }
              : el
          )
          simulateCircuit([...finalElements, controlElement])
        }, 100)
        return
      }

      // Two-qubit gates requiring partner selection
      if (draggedGate.type === "SWAP" || draggedGate.type === "ISWAP") {
        const newElement: CircuitElement = {
          id: `${draggedGate.type}-${Date.now()}-${Math.random()}`,
          gateType: draggedGate.type,
          qubitIndex,
          position,
          targetQubit: undefined,
        }
        updateCircuitElements((prev) => [...prev, newElement])
        setDraggedGate(null)
        setDragOverPosition(null)
        // Prompt to choose partner right away
        setEditingElement(newElement.id)
        return
      }

      if (draggedGate.type === "CONTROL") {
        // Generic control gate - can be connected to any target gate
        const newElement: CircuitElement = {
          id: `control-${Date.now()}-${Math.random()}`,
          gateType: "CONTROL",
          qubitIndex,
          position,
        }

        updateCircuitElements((prev) => [...prev, newElement])
        setDraggedGate(null)
        setDragOverPosition(null)

        // Auto-simulate after adding gate (controls without targets don't affect simulation)
        setTimeout(() => simulateCircuit([...circuitElements, newElement]), 100)
        return
      }

      // Handle parametric gates (ask for parameters)
      if (draggedGate.parametric && draggedGate.parameters) {
        const parameters: number[] = []
        
        for (const param of draggedGate.parameters) {
          const input = prompt(`Enter ${param.name} (default: ${param.defaultValue}):`, param.defaultValue.toString())
          if (input === null) {
            // User cancelled
            setDraggedGate(null)
            setDragOverPosition(null)
            return
          }
          const value = parseFloat(input)
          if (Number.isNaN(value)) {
            alert(`Invalid number for ${param.name}: ${input}`)
            setDraggedGate(null)
            setDragOverPosition(null)
            return
          }
          parameters.push(value)
        }
        
        // Create parametric gate with parameters
        const newElement: CircuitElement = {
          id: `${draggedGate.type}-${Date.now()}-${Math.random()}`,
          gateType: draggedGate.type,
          qubitIndex,
          position,
          parameters,
        }

        updateCircuitElements((prev) => [...prev, newElement])
        setDraggedGate(null)
        setDragOverPosition(null)

        // Auto-simulate after adding gate
        setTimeout(() => simulateCircuit([...circuitElements, newElement]), 100)
        return
      }

      // Regular single-qubit gates
      const newElement: CircuitElement = {
        id: `${draggedGate.type}-${Date.now()}-${Math.random()}`,
        gateType: draggedGate.type,
        qubitIndex,
        position,
      }

      pushUndo(circuitElements)
      updateCircuitElements((prev) => [...prev, newElement])
      
      // Initialize default parameters for parameterized gates
      if (draggedGate.type === "RX" || draggedGate.type === "RY" || draggedGate.type === "RZ" || draggedGate.type === "P") {
        setParameterValues(prev => ({
          ...prev,
          [newElement.id]: [Math.PI/2] // Default value for single parameter gates
        }))
      } else if (draggedGate.type === "U") {
        setParameterValues(prev => ({
          ...prev,
          [newElement.id]: [Math.PI/2, 0, 0] // Default values for U gate (θ, φ, λ)
        }))
      }
      
      setDraggedGate(null)
      setDragOverPosition(null)

      // Auto-simulate after adding gate
      setTimeout(() => simulateCircuit([...circuitElements, newElement]), 100)
    },
    [draggedGate, circuitElements, updateCircuitElements, simulateCircuit],
  )

  const removeElement = useCallback(
    (elementId: string) => {
      pushUndo(circuitElements)
      updateCircuitElements((prev) => {
        const elementToRemove = prev.find((el) => el.id === elementId)
        if (!elementToRemove) return prev

        // If removing a CNOT TARGET, also remove any linked CNOT_CONTROL elements
        if (elementToRemove.gateType === "CNOT") {
          const controlsToRemove = prev
            .filter((el) => el.gateType === "CNOT_CONTROL" && el.connectedElementId === elementToRemove.id)
            .map((el) => el.id)
          const idsToRemove = new Set([elementId, ...controlsToRemove])
          return prev.filter((el) => !idsToRemove.has(el.id))
        }

        // If removing a CNOT CONTROL, do NOT remove the target; just detach the control
        if (elementToRemove.gateType === "CNOT_CONTROL" && elementToRemove.connectedElementId) {
          const targetId = elementToRemove.connectedElementId
          return prev
            .filter((el) => el.id !== elementId)
            .map((el) => {
              if (el.id === targetId && el.gateType === "CNOT") {
                const { controlQubits, ...rest } = el as any
                // Clear legacy single control linkage
                const clearedLegacy = { ...rest, controlQubit: undefined, connectedElementId: undefined } as any
                // If using array model, remove the control qubit if present
                if (Array.isArray(controlQubits) && typeof elementToRemove.qubitIndex === "number") {
                  return {
                    ...clearedLegacy,
                    controlQubits: controlQubits.filter((q: number) => q !== elementToRemove.qubitIndex),
                  }
                }
                return clearedLegacy
              }
              return el
            })
        }

        // For any other gate, just remove it
        return prev.filter((el) => el.id !== elementId)
      })
      setSelectedElement(null)
      setTimeout(() => simulateCircuit(), 100)
    },
    [updateCircuitElements, simulateCircuit],
  )

  // Simple undo/redo stacks (local only fallback)
  const [undoStack, setUndoStack] = useState<CircuitElement[][]>([])
  const [redoStack, setRedoStack] = useState<CircuitElement[][]>([])

  const pushUndo = useCallback((prev: CircuitElement[]) => {
    setUndoStack((s) => [prev, ...s].slice(0, 50))
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    
    const [last, ...restUndo] = undoStack
    setRedoStack(prev => [circuitElements, ...prev])
    setUndoStack(restUndo)
    
    // Update circuit elements with the previous state
    if (onCircuitElementsUpdate) {
      onCircuitElementsUpdate(last)
    } else {
      setLocalCircuitElements(last)
    }
  }, [undoStack, circuitElements, onCircuitElementsUpdate])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    
    const [next, ...restRedo] = redoStack
    setUndoStack(prev => [circuitElements, ...prev])
    setRedoStack(restRedo)
    
    // Update circuit elements with the next state
    if (onCircuitElementsUpdate) {
      onCircuitElementsUpdate(next)
    } else {
      setLocalCircuitElements(next)
    }
  }, [redoStack, circuitElements, onCircuitElementsUpdate])

  const handleNewCircuit = useCallback(() => {
    if (circuitElements.length > 0) {
      // Only push to undo if there are elements to clear
      pushUndo(circuitElements)
    }
    
    // Clear circuit elements
    if (onCircuitElementsUpdate) {
      onCircuitElementsUpdate([])
    } else {
      setLocalCircuitElements([])
    }
    
    setSelectedElement(null)
    setEditingElement(null)
    
    if (onUpdateWorkingTitle) {
      onUpdateWorkingTitle("New Circuit")
    }
    
    // Reset qubit states to |0⟩
    const newStates = Array(numQubits)
      .fill(null)
      .map(() => ({
        amplitude0: { real: 1, imag: 0 },
        amplitude1: { real: 0, imag: 0 },
        measured: false,
      }))
    onStateUpdate?.(newStates)
  }, [circuitElements, pushUndo, onCircuitElementsUpdate, onUpdateWorkingTitle, numQubits, onStateUpdate])

  const clearCircuit = useCallback(() => {
    if (circuitElements.length > 0) {
      pushUndo(circuitElements)
    }
    
    // Clear circuit elements
    if (onCircuitElementsUpdate) {
      onCircuitElementsUpdate([])
    } else {
      setLocalCircuitElements([])
    }
    
    setSelectedElement(null)
    updateQubitStates(
      Array(numQubits)
        .fill(null)
        .map(() => ({
          amplitude0: { real: 1, imag: 0 },
          amplitude1: { real: 0, imag: 0 },
          measured: false,
        })),
    )
  }, [numQubits, updateQubitStates, circuitElements, pushUndo, onCircuitElementsUpdate])

  // Ensure all parameterized gates have default parameters
  useEffect(() => {
    circuitElements.forEach(element => {
      if ((element.gateType === "RX" || element.gateType === "RY" || element.gateType === "RZ" || 
           element.gateType === "P" || element.gateType === "U") && !parameterValues[element.id]) {
        setParameterValues(prev => ({
          ...prev,
          [element.id]: element.gateType === "U" 
            ? [Math.PI/2, 0, 0] 
            : [Math.PI/2]
        }))
      }
    })
  }, [circuitElements, parameterValues])

  // Parameter editing functions
  const openParameterEditor = useCallback((elementId: string) => {
    const element = circuitElements.find(el => el.id === elementId)
    if (element && (element.gateType === "RX" || element.gateType === "RY" || element.gateType === "RZ" || element.gateType === "U")) {
      setEditingElement(elementId)
      // Initialize parameter values if not already set
      if (!parameterValues[elementId]) {
        const defaultValues = element.gateType === "U" 
          ? [
              element.parameters?.[0] ?? Math.PI/2,
              element.parameters?.[1] ?? 0,
              element.parameters?.[2] ?? 0
            ] // use existing params if present
          : [element.parameters?.[0] ?? element.rotation ?? Math.PI/2] // single parameter for RX/RY/RZ
        
        setParameterValues(prev => ({
          ...prev,
          [elementId]: defaultValues
        }))
      }
    }
  }, [circuitElements, parameterValues])

  const updateParameter = useCallback((elementId: string, paramIndex: number, value: number) => {
    setParameterValues(prev => ({
      ...prev,
      [elementId]: prev[elementId]?.map((p, i) => i === paramIndex ? value : p) || []
    }))
  }, [])

  const applyParameters = useCallback((elementId: string) => {
    const values = parameterValues[elementId]
    if (values) {
      updateCircuitElements(prev => prev.map(el => 
        el.id === elementId 
          ? { ...el, parameters: values }
          : el
      ))
      // Re-simulate with updated parameters
      setTimeout(() => simulateCircuit(), 100)
    }
    setEditingElement(null)
  }, [parameterValues, updateCircuitElements, simulateCircuit])

  const addControlQubit = useCallback((elementId: string, controlQubit: number) => {
    updateCircuitElements(prev => prev.map(el => 
      el.id === elementId 
        ? { 
            ...el, 
            controlQubits: [...(el.controlQubits || []), controlQubit]
          }
        : el
    ))
    // Re-simulate with new control
    setTimeout(() => simulateCircuit(), 100)
  }, [updateCircuitElements, simulateCircuit])

  const removeControlQubit = useCallback((elementId: string, controlQubit: number) => {
    updateCircuitElements(prev => prev.map(el => 
      el.id === elementId 
        ? { 
            ...el, 
            controlQubits: el.controlQubits?.filter(c => c !== controlQubit) || []
          }
        : el
    ))
    // Re-simulate with removed control
    setTimeout(() => simulateCircuit(), 100)
  }, [updateCircuitElements, simulateCircuit])

  const updateNumQubits = useCallback(
    (newNum: number) => {
      if (onNumQubitsUpdate) {
        onNumQubitsUpdate(newNum)
      } else {
        const oldNum = localNumQubits
        setLocalNumQubits(newNum)
        
        // Preserve existing circuit elements, only filter out invalid ones
        if (newNum < oldNum) {
          // If reducing qubits, remove elements from deleted qubits
          setLocalCircuitElements(prev => {
            const filtered = prev.filter(element => {
              // For regular gates, check qubitIndex
              if (element.qubitIndex >= newNum) {
                // Silently remove element on invalid qubit
                return false
              }
              
              // For CNOT gates, check both control and target qubits
              if (element.gateType === "CNOT") {
                if ((element.controlQubit !== undefined && element.controlQubit >= newNum) ||
                    (element.targetQubit !== undefined && element.targetQubit >= newNum)) {
                  // Silently remove CNOT with invalid qubits
                  return false
                }
              }
              
              return true
            })
            // Silently filter and update circuit elements
            
            // After filtering, re-simulate to ensure state is consistent
            setTimeout(() => {
              const remainingElements = filtered
              if (remainingElements.length > 0) {
                simulateCircuit(remainingElements)
              } else {
                // Reset to initial state if no elements remain
                setLocalQubitStates(Array(newNum).fill(null).map(() => ({
                  amplitude0: { real: 1, imag: 0 },
                  amplitude1: { real: 0, imag: 0 },
                  measured: false,
                })))
              }
            }, 100)
            
            return filtered
          })
        }
        // If increasing qubits, keep all existing elements (no need to filter)
        
        // Update qubit states: preserve existing, add new ones
        setLocalQubitStates(prev => {
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
    },
    [onNumQubitsUpdate, localNumQubits],
  )

  // History panel functions
  const handleLoadCircuit = useCallback((circuit: SavedCircuit) => {
    // Use the provided callback if available
    if (onLoadSavedCircuit) {
      onLoadSavedCircuit(circuit)
    } else {
      // Fallback to local loading
      updateNumQubits(circuit.numQubits)
      updateCircuitElements(() => circuit.circuitElements)
    }
  }, [onLoadSavedCircuit, updateNumQubits, updateCircuitElements])

  const handleDeleteCircuit = useCallback((circuitId: string) => {
    // Use the provided callback if available
    if (onDeleteSavedCircuit) {
      onDeleteSavedCircuit(circuitId)
    }
  }, [onDeleteSavedCircuit])

  const getProbability = (state: QubitState, basis: 0 | 1) => {
    if (!state) return 0
    // Prefer explicit probabilities if present (for mixed/entangled states)
    if (typeof state.prob0 === 'number' && typeof state.prob1 === 'number') {
      return (basis === 0 ? state.prob0 : state.prob1) * 100
    }
    if (!state.amplitude0 || !state.amplitude1) return 0
    const amp = basis === 0 ? state.amplitude0 : state.amplitude1
    return (amp.real ** 2 + amp.imag ** 2) * 100
  }

  const getPhase = (amplitude: { real: number; imag: number }) => {
    if (!amplitude) {
      return 0
    }
    return Math.atan2(amplitude.imag, amplitude.real) * (180 / Math.PI)
  }

  const getAmplitudeMagnitude = (amplitude: { real: number; imag: number }) => {
    if (!amplitude) {
      return 0
    }
    return Math.sqrt(amplitude.real ** 2 + amplitude.imag ** 2)
  }

  const exportJSON = () => {
    const payload = { numQubits, circuitElements }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `circuit-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJSON = async (file: File) => {
    const text = await file.text()
    const obj = JSON.parse(text)
    if (obj?.numQubits && Array.isArray(obj?.circuitElements)) {
      pushUndo(circuitElements)
      updateNumQubits(obj.numQubits)
      updateCircuitElements(() => obj.circuitElements)
    }
  }

  const inputRef = useRef<HTMLInputElement | null>(null)

  // Measure where the Circuit Designer card starts to vertically align the sidebar panel
  const builderRootRef = useRef<HTMLDivElement | null>(null)
  // Header bar inside the Circuit Designer card (px-6 py-4 border-b bg-gray-50)
  const circuitHeaderRef = useRef<HTMLDivElement | null>(null)
  const [gatePropsOffset, setGatePropsOffset] = useState(0)

  const measureGatePropsOffset = useCallback(() => {
    if (!builderRootRef.current || !circuitHeaderRef.current) return
    try {
      const rootTop = builderRootRef.current.getBoundingClientRect().top
      const circuitTop = circuitHeaderRef.current.getBoundingClientRect().top
      const offset = Math.max(0, Math.round(circuitTop - rootTop))
      setGatePropsOffset(offset)
      // Keep placeholder aligned too
      const placeholder = document.getElementById("gate-props-placeholder")
      if (placeholder) {
        placeholder.style.paddingTop = `${offset}px`
      }
    } catch {}
  }, [])

  useLayoutEffect(() => {
    measureGatePropsOffset()
  }, [measureGatePropsOffset])

  useEffect(() => {
    const onResize = () => measureGatePropsOffset()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measureGatePropsOffset])

  // Right sidebar host for Gate Properties via portal
  const [gatePropsHost, setGatePropsHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setGatePropsHost(document.getElementById("gate-props-host"))
    }
  }, [])

  // Toggle placeholder visibility based on editing panel presence
  useEffect(() => {
    if (typeof window === "undefined") return
    const placeholder = document.getElementById("gate-props-placeholder")
    const container = document.getElementById("gate-props-container")
    if (container) {
      container.classList.remove("w-0", "w-80")
      container.classList.add(editingElement ? "w-80" : "w-0")
    }
    if (placeholder) {
      placeholder.classList.toggle("flex", Boolean(!editingElement))
      placeholder.classList.toggle("hidden", Boolean(editingElement))
    }
  }, [editingElement])



  return (
    <TooltipProvider>
  <div ref={builderRootRef} className="flex flex-row h-full min-h-0">

        {/* Main Circuit Content */}
        <div className="flex-1 space-y-2 min-w-0">
        {/* Professional Gate Palette */}
  <div className="bg-card border border-border rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Quantum Gate Library</h2>
              <p className="text-sm text-muted-foreground mt-1">Drag and drop gates onto the circuit canvas</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/20 text-secondary-foreground border border-border">
                Interactive Mode
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-1.5">
            {QUANTUM_GATES.map((gate) => (
              <Tooltip key={gate.id}>
                <TooltipTrigger asChild>
                  <Card
                    className="cursor-grab active:cursor-grabbing hover:shadow-md hover:border-border transition-all duration-200 border border-border bg-card group"
                    draggable
                    onDragStart={(e) => handleDragStart(gate, e)}
                  >
                    <CardContent className="p-1 text-center">
                      <div
                        className={`w-12 h-12 mx-auto mb-1 rounded-lg ${gate.color} flex items-center justify-center text-white font-semibold text-lg transition-all group-hover:scale-105 shadow-sm`}
                      >
                        {gate.symbol}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground tracking-wide">{gate.name}</div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm">{gate.description}</p>
                  {gate.type === "CNOT" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Click gate → Select control qubit → Select target qubit → Select position
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Professional Circuit Canvas */}
        <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div ref={circuitHeaderRef} className="px-6 py-4 border-b border-border circuit-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Sidebar hover handles open/close; no toggle button needed */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight circuit-header-title">Circuit Designer</h2>
                  <div className="text-sm text-muted-foreground">
                    {currentCircuitTitle ? (
                      isCircuitLoaded ? (
                        // Show loaded circuit title (read-only)
                        <span>{currentCircuitTitle}</span>
                      ) : (
                        // Show editable working title for new circuits
                        <input
                          type="text"
                          value={currentCircuitTitle}
                          onChange={(e) => onUpdateWorkingTitle?.(e.target.value)}
                          className="bg-transparent border-none outline-none focus:ring-0 focus:outline-none p-0 text-sm text-muted-foreground placeholder:text-muted-foreground w-full"
                          placeholder="Enter circuit name..."
                        />
                      )
                    ) : (
                      // No title - show editable input for new circuits or default message
                      !isCircuitLoaded ? (
                        <input
                          type="text"
                          value=""
                          onChange={(e) => onUpdateWorkingTitle?.(e.target.value)}
                          className="bg-transparent border-none outline-none focus:ring-0 focus:outline-none p-0 text-sm text-muted-foreground placeholder:text-muted-foreground w-full"
                          placeholder="Enter circuit name..."
                        />
                      ) : (
                        "Build and visualize your quantum circuit"
                      )
                    )}
                  </div>
                </div>
                {/* Removed 'Interactive Learning' button per request */}
              </div>
            <div className="flex items-center gap-3">
              {/* Circuit Controls Group */}
              <div className="toolbar-group">
                <Button variant="ghost" size="sm" onClick={handleNewCircuit} title="New Circuit" className="text-muted-foreground hover:text-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </Button>
                <div className="toolbar-divider" />
                <Button variant="ghost" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo" className="text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" className="text-muted-foreground hover:text-foreground">
                  <RotateCw className="w-4 h-4" />
                </Button>

              </div>
              
              {/* Qubit Controls Group */}
              <div className="toolbar-group">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateNumQubits(Math.max(1, numQubits - 1))}
                  disabled={numQubits <= 1}
                  className="text-foreground border-border"
                >
                  <span className="text-sm">−</span>
                </Button>
                <span className="px-3 py-1 text-sm font-medium text-foreground bg-muted rounded border border-border">
                  {numQubits} Qubits
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateNumQubits(Math.min(20, numQubits + 1))}
                  disabled={numQubits >= 20}
                  className="text-foreground border-border"
                >
                  <span className="text-sm">+</span>
                </Button>
              </div>
              
              {/* Action Buttons Group */}
              <div className="flex items-center gap-2">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4" size="sm" onClick={() => simulateCircuit()} disabled={isSimulating}>
                  <Play className="w-4 h-4 mr-2" />
                  {isSimulating ? "Computing..." : "Execute"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowSaveDialog(true)}
                  disabled={circuitElements.length === 0}
                  title={circuitElements.length === 0 ? "Add some gates to save the circuit" : ""}
                  className="text-foreground border-border"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isCircuitLoaded ? "Save As" : "Save"}
                </Button>
                {isCircuitLoaded && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      if (onUpdateCircuit && currentCircuitTitle) {
                        onUpdateCircuit(currentCircuitTitle, numQubits, circuitElements)
                      }
                    }}
                    disabled={circuitElements.length === 0}
                    title={circuitElements.length === 0 ? "Add some gates to update the circuit" : "Update the current circuit"}
                    className="text-foreground border-border"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Update
                  </Button>
                )}
              </div>
              
              {/* Noise Controls Group */}
              <div className="toolbar-group">
                <div className="flex items-center gap-2">
                  <Switch
                    id="noise-enable"
                    checked={noiseEnabled}
                    onCheckedChange={(checked) => {
                      if (!backendCapabilities?.has_aer && checked) {
                        toast({
                          title: "Noise requires Qiskit Aer",
                          description: "Install the Microsoft Visual C++ Redistributable and Qiskit Aer to enable noisy simulation.",
                          variant: "destructive"
                        })
                        return
                      }
                      setNoiseEnabled(checked)
                      // Persist immediately for responsiveness
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('noiseEnabled', String(checked))
                      }
                    }}
                    disabled={backendCapabilities === null || !backendCapabilities.has_aer}
                  />
                  <span className={`text-sm font-medium ${
                    backendCapabilities?.has_aer ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    Noise
                  </span>
                  {backendCapabilities && !backendCapabilities.has_aer && (
                    <span className="text-xs text-orange-600" title="Requires Qiskit Aer">⚠️</span>
                  )}
                </div>
                {noiseEnabled && (
                  <div className="flex items-center gap-2 ml-2">
                    <select
                      value={selectedPreset}
                      onChange={async (e) => {
                        setSelectedPreset(e.target.value)
                        if (e.target.value !== "custom") {
                          // Load preset from backend
                          try {
                            const response = await fetch(getQiskitApiUrl("/noise-presets"))
                            if (!response.ok) {
                              throw new Error(`HTTP ${response.status}`)
                            }
                            const data = await response.json()
                            const preset = data.presets[e.target.value]
                            if (preset) {
                              setDepolarizingProb(preset.depolarizing_prob)
                              setT1Time(preset.t1_time)
                              setT2Time(preset.t2_time)
                              setReadoutErrorProb(preset.readout_error_prob)
                              setGateTime(preset.gate_time)
                              setThermalPopulation(preset.thermal_population)
                            }
                          } catch (error) {
                            console.error("Failed to load noise preset:", error)
                            console.warn("Noise presets unavailable - using default values")
                          }
                        }
                      }}
                      className="text-xs px-2 py-1 border border-border rounded bg-background text-foreground"
                      title="Select quantum hardware noise model"
                    >
                      <option value="custom">Custom</option>
                      <option value="superconducting_low_noise">SC Low</option>
                      <option value="superconducting_high_noise">SC High</option>
                      <option value="trapped_ion">Ion</option>
                      <option value="photonic">Photonic</option>
                    </select>
                  </div>
                )}
              </div>
              
              {/* File Operations Group */}
              <div className="toolbar-group">
                <Button variant="ghost" size="sm" onClick={exportJSON} title="Export Circuit" className="text-muted-foreground hover:text-foreground">
                  <Download className="w-4 h-4" />
                </Button>
                <input ref={inputRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importJSON(f)
                  e.currentTarget.value = ""
                }} />
                <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} title="Import Circuit" className="text-muted-foreground hover:text-foreground">
                  <Upload className="w-4 h-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1"></div>
                <Button variant="ghost" size="sm" onClick={clearCircuit} title="Clear Circuit" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Circuit Canvas */}
          <div className="p-8 circuit-canvas">
            <div ref={circuitRef} className="relative space-y-[21px]">
              {Array.from({ length: numQubits }, (_, qubitIndex) => (
                <div key={qubitIndex} className="flex items-center space-x-2">
                  <div className="w-24 text-right space-y-2">
                    <div className="qubit-label">
                      <span>|q{qubitIndex}⟩</span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {qubitStates[qubitIndex] ? (
                        <div className="space-y-0.5">
                          <div>{getProbability(qubitStates[qubitIndex], 0).toFixed(1)}% |0⟩</div>
                          <div>{getProbability(qubitStates[qubitIndex], 1).toFixed(1)}% |1⟩</div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Computing...</div>
                      )}
                    </div>
                  </div>

                  {/* Quantum Wire */}
                  <div ref={(el) => { wireRefs.current[qubitIndex] = el; return undefined }} className="flex-1 relative">
                    <div className="quantum-wire"></div>

                    {/* Draw CNOT control dots only - no connection lines */}
                    {circuitElements.filter(el => el.gateType === "CNOT").map((cnotGate, idx) => {
                      const targetPosition = cnotGate.position || 0
                      const targetQubit = cnotGate.qubitIndex
                      const elements = []
                      const bgClass = getGateBgClass("CNOT")
                      
                      // For new controlQubits array approach
                      if (cnotGate.controlQubits && cnotGate.controlQubits.length > 0) {
                        // Check if current qubit is a control qubit for this CNOT
                        if (cnotGate.controlQubits.includes(qubitIndex)) {
                          elements.push(
                            <div
                              key={`control-dot-${cnotGate.id}-${qubitIndex}`}
                              className="control-dot"
                              style={{ 
                                left: `${targetPosition * 80 + 22}px`, 
                                top: "-8px",
                                zIndex: 10
                              }}
                              title={`Control qubit for CNOT on q${targetQubit}`}
                            />
                          )
                        }
                      }
                      
                      // Legacy controlQubit approach (keep for backward compatibility)
                      else if (cnotGate.controlQubit !== undefined) {
                        const controlQubit = cnotGate.controlQubit
                        const position = cnotGate.position || 0
                        
                        // Draw control dot on control qubit
                        if (qubitIndex === controlQubit) {
                          elements.push(
                            <div
                              key={`legacy-control-dot-${cnotGate.id}`}
                              className="control-dot"
                              style={{ 
                                left: `${position * 80 + 22}px`, 
                                top: "-8px",
                                zIndex: 10
                              }}
                              title={`Control qubit for CNOT on q${targetQubit}`}
                            />
                          )
                        }
                      }
                      
                      return elements.length > 0 ? elements : null
                    })}

                    {/* Draw control dots for controlled rotation/U gates (RX, RY, RZ, U) */}
                    {circuitElements
                      .filter(el => (el.gateType === "RX" || el.gateType === "RY" || el.gateType === "RZ" || el.gateType === "U") && el.controlQubits && el.controlQubits.length > 0)
                      .map((gate) => {
                        const targetPosition = gate.position || 0
                        const targetQubit = gate.qubitIndex
                        const bgClass = getGateBgClass(gate.gateType)
                        if (gate.controlQubits && gate.controlQubits.includes(qubitIndex)) {
                          return (
                            <div
                              key={`control-dot-${gate.id}-${qubitIndex}`}
                              className="control-dot"
                              style={{ 
                                left: `${targetPosition * 80 + 22}px`, 
                                top: "-8px",
                                zIndex: 10
                              }}
                              title={`Control qubit for ${gate.gateType} on q${targetQubit}`}
                            />
                          )
                        }
                        return null
                      })}

                    {/* Note: Connection lines for CNOT are intentionally omitted in favor of control dots UI */}

                    {/* Enhanced Drop Zones */}
                    {Array.from({ length: 10 }, (_, position) => {
                      const isOccupied =
                        circuitElements.some((el) => el.qubitIndex === qubitIndex && el.position === position) ||
                        circuitElements.some((el) =>
                          (el.gateType === "SWAP" || el.gateType === "ISWAP") &&
                          el.position === position &&
                          typeof el.targetQubit === "number" &&
                          el.targetQubit === qubitIndex
                        )
                      
                      return (
                        <div
                          key={position}
                          className={`absolute w-16 h-16 rounded-lg flex items-center justify-center transition-all duration-200 gate-drop-zone ${
                            isOccupied
                              ? "opacity-40 cursor-not-allowed"
                              : dragOverPosition?.qubit === qubitIndex && dragOverPosition?.position === position
                              ? "drag-over"
                              : ""
                          }`}
                          style={{ left: `${position * 80}px`, top: "-32px" }}
                          onDragOver={(e) => {
                            if (!isOccupied) {
                              handleDragOver(e, qubitIndex, position)
                            } else {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = "none"
                            }
                          }}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, qubitIndex, position)}
                        >

                        {circuitElements
                          .filter((el) =>
                            el.position === position && (
                              el.qubitIndex === qubitIndex ||
                              ((el.gateType === "SWAP" || el.gateType === "ISWAP") && el.targetQubit === qubitIndex)
                            )
                          )
                          .map((element) => {
                            const gate = QUANTUM_GATES.find((g) => g.type === element.gateType)
                            return (
                              <div key={element.id} className="relative">
                                {element.gateType === "CNOT" ? (
                                  <div className="relative">
                                    {/* CNOT Target symbol (⊕) */}
                                    <div
                                      className={`cnot-target ${
                                        selectedElement === element.id
                                          ? "selected"
                                          : ""
                                      }`}
                                      onClick={() => {
                                        setSelectedElement(selectedElement === element.id ? null : element.id)
                                        setEditingElement(element.id) // Open parameter editor
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        removeElement(element.id)
                                      }}
                                    >
                                      ⊕
                                    </div>
                                    {/* Target label */}
                                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-800">
                                        Target q{element.qubitIndex}
                                      </Badge>
                                    </div>
                                    {/* Show control connections if available */}
                                    {element.controlQubits && element.controlQubits.length > 0 ? (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                          Controls: {element.controlQubits.map(c => `q${c}`).join(', ')}
                                        </div>
                                      </div>
                                    ) : element.controlQubit !== undefined ? (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                          ← Control: q{element.controlQubit}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-500 font-bold whitespace-nowrap bg-gray-50 px-1 rounded border border-gray-200">
                                          Click to edit controls
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : element.gateType === "CNOT_CONTROL" ? (
                                  <div className="relative">
                                    {/* CNOT Control symbol (●) */}
                                    <div
                                      className={`w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-800 flex items-center justify-center font-bold text-white cursor-pointer transition-all duration-200 border-4 border-slate-900 ${
                                        selectedElement === element.id
                                          ? "ring-2 ring-primary ring-offset-2 scale-110"
                                          : "hover:scale-105"
                                      }`}
                                      onClick={() =>
                                        setSelectedElement(selectedElement === element.id ? null : element.id)
                                      }
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        removeElement(element.id)
                                      }}
                                    >
                                      ●
                                    </div>
                                    {/* Control label */}
                                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                                      <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-900">
                                        Control
                                      </Badge>
                                    </div>
                                    {/* Show target connection */}
                                    {element.connectedElementId && (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                          → Target: q{circuitElements.find(el => el.id === element.connectedElementId)?.qubitIndex}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : element.gateType === "CONTROL" ? (
                                  <div className="relative">
                                    {/* Generic Control symbol (●) */}
                                    <div
                                      className={`w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-700 flex items-center justify-center font-bold text-white cursor-pointer transition-all duration-200 border-4 border-cyan-800 ${
                                        selectedElement === element.id
                                          ? "ring-2 ring-primary ring-offset-2 scale-110"
                                          : "hover:scale-105"
                                      }`}
                                      onClick={() =>
                                        setSelectedElement(selectedElement === element.id ? null : element.id)
                                      }
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        removeElement(element.id)
                                      }}
                                    >
                                      ●
                                    </div>
                                    {/* Control label */}
                                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                                      <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-800">
                                        Control
                                      </Badge>
                                    </div>
                                    {/* Show instruction */}
                                    <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                      <div className="text-xs text-cyan-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                        Connect to any target
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className={`quantum-gate-box w-12 h-12 text-white font-bold text-sm ${
                                      selectedElement === element.id
                                        ? "selected"
                                        : ""
                                    } ${gate?.color || "bg-primary"}`}
                                    onClick={() => {
                                      setSelectedElement(selectedElement === element.id ? null : element.id)
                                      // Auto-open properties for gates that have configurable parameters
                                      if (element.gateType === "RX" || element.gateType === "RY" || element.gateType === "RZ" || 
                                          element.gateType === "U" || element.gateType === "SWAP" || element.gateType === "ISWAP" ||
                                          element.gateType === "P") {
                                        setEditingElement(element.id)
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation()
                                      removeElement(element.id)
                                    }}
                                  >
                                    {gate?.symbol || element.gateType}
                                    {(() => {
                                      const currentParams = parameterValues[element.id] || []
                                      const hasParams = currentParams.length > 0 && 
                                        (element.gateType === "RX" || element.gateType === "RY" || element.gateType === "RZ" || 
                                         element.gateType === "U" || element.gateType === "P")
                                      
                                      if (hasParams) {
                                        return (
                                          <div className="text-xs mt-1 opacity-80">
                                            {currentParams.map((p, idx) => (
                                              <div key={idx}>{p.toFixed(2)}</div>
                                            ))}
                                          </div>
                                        )
                                      }
                                      return null
                                    })()}
                                    {/* Partner label for two-qubit gates, show on both qubits */}
                                    {(element.gateType === "SWAP" || element.gateType === "ISWAP") && typeof element.targetQubit === "number" && (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                          {(() => {
                                            const partner = qubitIndex === element.qubitIndex ? element.targetQubit : element.qubitIndex
                                            return <>↔ q{partner}</>
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                    {/* Show control connections if available for controlled rotation/U gates */}
                                    {element.controlQubits && element.controlQubits.length > 0 && (
                                      <div className="absolute top-12 left-1/2 transform -translate-x-1/2 pointer-events-none">
                                        <div className="text-xs text-gray-600 font-bold whitespace-nowrap bg-white px-1 rounded border">
                                          Controls: {element.controlQubits.map(c => `q${c}`).join(', ')}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                      )
                    })}
                  </div>

                  {/* State Probability Display */}
                  <div className="bg-card border border-border rounded-lg shadow-sm p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-blue-600">|0⟩</span>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${qubitStates[qubitIndex] ? getProbability(qubitStates[qubitIndex], 0) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs w-10 text-right text-muted-foreground">
                        {qubitStates[qubitIndex] ? getProbability(qubitStates[qubitIndex], 0).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-xs font-medium text-red-600">|1⟩</span>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full bg-destructive transition-all duration-500 ease-out"
                          style={{ width: `${qubitStates[qubitIndex] ? getProbability(qubitStates[qubitIndex], 1) : 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs w-10 text-right text-muted-foreground">
                        {qubitStates[qubitIndex] ? getProbability(qubitStates[qubitIndex], 1).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                    {qubitStates[qubitIndex]?.measured && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/20 text-foreground border border-border">
                          Measured: |{qubitStates[qubitIndex].measurementResult}⟩
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* Overlay connectors for SWAP / iSWAP (smooth path, no endpoint crosses) */}
              <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
                <svg className="absolute left-0 top-0" width="100%" height="100%">
                  {circuitElements
                    .filter(el => (el.gateType === "SWAP" || el.gateType === "ISWAP") && typeof el.targetQubit === 'number')
                    .map((el, idx) => {
                      const qTop = Math.min(el.qubitIndex, el.targetQubit as number)
                      const qBottom = Math.max(el.qubitIndex, el.targetQubit as number)
                      const yCenterTop = wireGeom.centerY[qTop] ?? (qTop * 80 + 40)
                      const yCenterBottom = wireGeom.centerY[qBottom] ?? (qBottom * 80 + 40)
                      // Gate tile is w-12 h-12 => 48px; start at bottom of top gate and end at top of bottom gate
                      const tileHalf = 24
                      const yStart = yCenterTop + tileHalf
                      const yEnd = yCenterBottom - tileHalf
                      const left = wireGeom.left[qTop] ?? (96 + 8)
                      const x = left + (el.position || 0) * 80 + 32 // center of the tile
                      const strokeColor = el.gateType === 'SWAP' ? '#059669' /* emerald-600 */ : '#0d9488' /* teal-600 */
                      return (
                        <g key={`swap-link-${el.id}-${idx}`}>
                          <line x1={x} y1={yStart} x2={x} y2={yEnd} stroke={strokeColor} strokeWidth={4} strokeLinecap="round" />
                        </g>
                      )
                    })}
                </svg>
              </div>
            </div>
          </div>

          {/* Selected Element Controls */}
          {selectedElement && (
            <Card className="p-2 border-primary/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-3 h-3 text-primary" />
                  <span className="font-medium text-sm">Selected Gate</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Add Edit Parameters button for parametric gates */}
                  {(() => {
                    const element = circuitElements.find(el => el.id === selectedElement)
                    return element && (element.gateType === "RX" || element.gateType === "RY" || element.gateType === "RZ" || element.gateType === "U") ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openParameterEditor(selectedElement)}
                        className="mr-1"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                        Edit
                      </Button>
                    ) : null
                  })()}
                  <Button variant="destructive" size="sm" onClick={() => removeElement(selectedElement)}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>


        {/* Bloch spheres removed from builder; shown in dedicated Bloch tab */}
        </div>

        {/* Gate Configuration Panel - render into sidebar host when available */}
        {editingElement && gatePropsHost && createPortal(
          <div style={{ marginTop: gatePropsOffset, height: `calc(100% - ${gatePropsOffset}px)` }} className="w-full border border-border bg-card shadow-sm rounded-lg flex flex-col">
            <div className="px-6 py-5 border-b border-border bg-muted">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground tracking-tight">Gate Properties</h2>
                  <p className="text-sm text-muted-foreground mt-1">Configure gate parameters</p>
                </div>
                <Button
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditingElement(null)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-card">
            
            {(() => {
              const element = circuitElements.find(el => el.id === editingElement)
              if (!element) return null
              
              const currentParams = parameterValues[editingElement] || []
              
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <div className={`w-6 h-6 rounded ${QUANTUM_GATES.find(g => g.type === element.gateType)?.color} flex items-center justify-center text-white font-bold text-xs`}>
                      {QUANTUM_GATES.find(g => g.type === element.gateType)?.symbol}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{element.gateType}</div>
                      <div className="text-xs text-muted-foreground">q[{element.qubitIndex}]</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Parameters</h4>
                    
                    {element.gateType === "P" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          phi
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={currentParams[0] !== undefined ? currentParams[0] : Math.PI/2}
                          onChange={(e) => updateParameter(editingElement, 0, e.target.value === '' ? Math.PI/2 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          placeholder="1.57 (π/2)"
                          key={`p-${editingElement}-0`}
                        />
                      </div>
                    )}

                    {element.gateType === "RX" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          theta
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={currentParams[0] !== undefined ? currentParams[0] : Math.PI/2}
                          onChange={(e) => updateParameter(editingElement, 0, e.target.value === '' ? Math.PI/2 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          placeholder="1.57 (π/2)"
                          key={`rx-${editingElement}-0`}
                        />
                      </div>
                    )}
                    
                    {element.gateType === "RY" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          theta
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={currentParams[0] !== undefined ? currentParams[0] : Math.PI/2}
                          onChange={(e) => updateParameter(editingElement, 0, e.target.value === '' ? Math.PI/2 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          placeholder="1.57 (π/2)"
                          key={`ry-${editingElement}-0`}
                        />
                      </div>
                    )}
                    
                    {element.gateType === "RZ" && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          phi
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={currentParams[0] !== undefined ? currentParams[0] : Math.PI/2}
                          onChange={(e) => updateParameter(editingElement, 0, e.target.value === '' ? Math.PI/2 : parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          placeholder="1.57 (π/2)"
                          key={`rz-${editingElement}-0`}
                        />
                      </div>
                    )}
                    
                    {element.gateType === "U" && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            theta
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={currentParams[0] !== undefined ? currentParams[0] : Math.PI/2}
                            onChange={(e) => updateParameter(editingElement, 0, e.target.value === '' ? Math.PI/2 : parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                            placeholder="1.57 (π/2)"
                            key={`u-${editingElement}-0`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            phi
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={currentParams[1] !== undefined ? currentParams[1] : 0}
                            onChange={(e) => updateParameter(editingElement, 1, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                            placeholder="0"
                            key={`u-${editingElement}-1`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            lambda
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={currentParams[2] !== undefined ? currentParams[2] : 0}
                            onChange={(e) => updateParameter(editingElement, 2, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                            placeholder="0"
                            key={`u-${editingElement}-2`}
                          />
                        </div>
                      </div>
                    )}
                    
                    {(element.gateType === "SWAP" || element.gateType === "ISWAP") && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Partner Qubit
                          </label>
                          <select
                            value={typeof element.targetQubit === 'number' ? element.targetQubit : ''}
                            onChange={(e) => {
                              const newPartner = parseInt(e.target.value)
                              if (!isNaN(newPartner) && newPartner !== element.qubitIndex) {
                                // Validate slot availability at same position
                                const conflict = circuitElements.some(el => el.qubitIndex === newPartner && el.position === (element as any).position)
                                if (conflict) {
                                  alert(`Position occupied on q${newPartner} at column ${(element as any).position}. Choose another qubit or move/remove the existing gate.`)
                                } else {
                                  updateCircuitElements(prev => prev.map(el => 
                                    el.id === editingElement 
                                      ? { ...el, targetQubit: newPartner }
                                      : el
                                  ))
                                }
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          >
                            <option value="" disabled>Select qubit…</option>
                            {Array.from({ length: numQubits }, (_, i) => i)
                              .filter(i => i !== element.qubitIndex)
                              .map(i => (
                                <option key={i} value={i}>q{i}</option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    )}

                    {element.gateType === "CNOT" && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Target Qubit
                          </label>
                          <select
                            value={element.qubitIndex}
                            onChange={(e) => {
                              const newTarget = parseInt(e.target.value)
                              if (!isNaN(newTarget)) {
                                updateCircuitElements(prev => prev.map(el => 
                                  el.id === editingElement 
                                    ? { ...el, qubitIndex: newTarget }
                                    : el
                                ))
                              }
                            }}
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                          >
                            {Array.from({ length: numQubits }, (_, i) => (
                              <option key={i} value={i}>q{i}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Control Qubits Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Controls</h4>
                      <select
                        onChange={(e) => {
                          const controlQubit = parseInt(e.target.value)
                          if (!isNaN(controlQubit) && controlQubit !== element.qubitIndex) {
                            addControlQubit(editingElement, controlQubit)
                          }
                          e.target.value = ""
                        }}
                        className="px-1 py-1 border border-border rounded text-xs bg-background"
                        defaultValue=""
                      >
                        <option value="" disabled>+</option>
                        {Array.from({ length: numQubits }, (_, i) => i)
                          .filter(i => i !== element.qubitIndex && !(element.controlQubits || []).includes(i))
                          .map(i => (
                            <option key={i} value={i}>q{i}</option>
                          ))
                        }
                      </select>
                    </div>
                    
                    {element.controlQubits && element.controlQubits.length > 0 && (
                      <div className="space-y-1">
                        {element.controlQubits.map(controlQubit => (
                          <div key={controlQubit} className="flex items-center justify-between p-1 bg-muted rounded text-xs">
                            <span>q{controlQubit}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeControlQubit(editingElement, controlQubit)}
                              className="h-4 w-4 p-0 text-red-500 hover:text-red-600"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => applyParameters(editingElement)}
                      size="sm"
                      className="flex-1 text-sm"
                    >
                      Apply
                    </Button>
                    <Button 
                      onClick={() => {
                        // Remove the gate using the existing removeElement function
                        removeElement(editingElement)
                        setEditingElement(null)
                        setSelectedElement(null)
                      }}
                      variant="destructive"
                      size="sm"
                      className="px-3 text-sm"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )
            })()}
            </div>
          </div>,
          gatePropsHost
        )}
      </div>

      {/* Save Circuit Dialog */}
      <SaveCircuitDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={(title) => {
          if (onSaveCircuit) {
            onSaveCircuit(title, numQubits, circuitElements)
          }
        }}
        mode={isCircuitLoaded ? "saveAs" : "save"}
        existingTitles={existingCircuitTitles || []}
        onUpdate={() => {
          setShowSaveDialog(false)
          if (onUpdateCircuit && currentCircuitTitle) {
            onUpdateCircuit(currentCircuitTitle, numQubits, circuitElements)
          }
        }}
      />

      {/* History Dialog */}

      </div>
    </TooltipProvider>
  )
}
