"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

const QUANTUM_TERMS = [
  {
    term: "Qubit",
    category: "Basic",
    definition:
      "The fundamental unit of quantum information, analogous to a classical bit but capable of existing in superposition.",
    example: "A qubit can be in state |0⟩, |1⟩, or any superposition α|0⟩ + β|1⟩",
  },
  {
    term: "Superposition",
    category: "Basic",
    definition: "A quantum mechanical principle where a quantum system can exist in multiple states simultaneously.",
    example: "The Hadamard gate creates superposition: H|0⟩ = (|0⟩ + |1⟩)/√2",
  },
  {
    term: "Bloch Sphere",
    category: "Visualization",
    definition: "A geometric representation of qubit states as points on a unit sphere.",
    example: "|0⟩ is at the north pole, |1⟩ at the south pole, and |+⟩ on the equator",
  },
  {
    term: "Hadamard Gate",
    category: "Gates",
    definition: "A quantum gate that creates superposition by rotating a qubit state.",
    example: "H|0⟩ = (|0⟩ + |1⟩)/√2 and H|1⟩ = (|0⟩ - |1⟩)/√2",
  },
  {
    term: "Pauli Gates",
    category: "Gates",
    definition: "Three fundamental quantum gates (X, Y, Z) that perform rotations around different axes.",
    example: "X gate flips |0⟩ ↔ |1⟩, Z gate adds phase: |1⟩ → -|1⟩",
  },
  {
    term: "Measurement",
    category: "Basic",
    definition: "The process of observing a quantum state, which collapses it to a classical state.",
    example: "Measuring |+⟩ = (|0⟩ + |1⟩)/√2 gives |0⟩ or |1⟩ with 50% probability each",
  },
  {
    term: "Entanglement",
    category: "Advanced",
    definition: "A quantum phenomenon where particles become correlated and share quantum states.",
    example: "Bell state |Φ+⟩ = (|00⟩ + |11⟩)/√2 shows perfect correlation",
  },
  {
    term: "No-Cloning Theorem",
    category: "Advanced",
    definition: "A fundamental principle stating that arbitrary quantum states cannot be perfectly copied.",
    example: "This prevents eavesdroppers from copying qubits without detection",
  },
  {
    term: "Quantum Circuit",
    category: "Basic",
    definition: "A model for quantum computation using quantum gates applied to qubits over time.",
    example: "Circuits read left to right, with gates applied sequentially to qubit wires",
  },
  {
    term: "Basis States",
    category: "Basic",
    definition: "The fundamental states that form the basis for a quantum system.",
    example: "Computational basis: {|0⟩, |1⟩}, Hadamard basis: {|+⟩, |-⟩}",
  },
]

export function QuantumGlossary() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = Array.from(new Set(QUANTUM_TERMS.map((term) => term.category)))

  const filteredTerms = QUANTUM_TERMS.filter((term) => {
    const matchesSearch =
      term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || term.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search terms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Badge>
        {categories.map((category) => (
          <Badge
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {filteredTerms.map((term, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-foreground">{term.term}</h4>
                <Badge variant="secondary" className="text-xs">
                  {term.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{term.definition}</p>
              <div className="p-2 bg-muted rounded text-xs font-mono">{term.example}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
