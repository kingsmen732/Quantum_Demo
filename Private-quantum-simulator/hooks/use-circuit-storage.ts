import { useState, useEffect } from "react"
import { SavedCircuit } from "@/components/circuit-history-panel"

const STORAGE_KEY = "quantum-simulator-circuits"

function parseSavedCircuits(value: string | null): SavedCircuit[] {
  if (!value) {
    return []
  }

  try {
    const circuits = JSON.parse(value)
    return circuits.map((circuit: any) => ({
      ...circuit,
      createdAt: new Date(circuit.createdAt),
    }))
  } catch (error) {
    console.error("Error parsing saved circuits:", error)
    return []
  }
}

export function useCircuitStorage() {
  const [savedCircuits, setSavedCircuits] = useState<SavedCircuit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setSavedCircuits(parseSavedCircuits(stored))
    setIsLoading(false)
  }, [])

  const saveToStorage = (circuits: SavedCircuit[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(circuits))
    } catch (error) {
      console.error("Error saving circuits to storage:", error)
    }
  }

  const saveCircuit = (
    title: string,
    numQubits: number,
    circuitElements: any[]
  ): void => {
    const newCircuit: SavedCircuit = {
      id: `circuit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      createdAt: new Date(),
      numQubits,
      gateCount: circuitElements.length,
      circuitElements,
    }

    const updatedCircuits = [newCircuit, ...savedCircuits]
    setSavedCircuits(updatedCircuits)
    saveToStorage(updatedCircuits)
  }

  const updateCircuit = (
    circuitId: string,
    title: string,
    numQubits: number,
    circuitElements: any[]
  ): void => {
    const updatedCircuits = savedCircuits.map(circuit => {
      if (circuit.id === circuitId) {
        return {
          ...circuit,
          title,
          numQubits,
          gateCount: circuitElements.length,
          circuitElements,
        }
      }
      return circuit
    })

    setSavedCircuits(updatedCircuits)
    saveToStorage(updatedCircuits)
  }

  const deleteCircuit = (circuitId: string): void => {
    const updatedCircuits = savedCircuits.filter((circuit) => circuit.id !== circuitId)
    setSavedCircuits(updatedCircuits)
    saveToStorage(updatedCircuits)
  }

  const loadCircuit = (circuit: SavedCircuit) => {
    return {
      numQubits: circuit.numQubits,
      circuitElements: circuit.circuitElements,
    }
  }

  return {
    savedCircuits,
    saveCircuit,
    updateCircuit,
    deleteCircuit,
    loadCircuit,
    isLoading,
    isAuthenticated: true,
  }
}
