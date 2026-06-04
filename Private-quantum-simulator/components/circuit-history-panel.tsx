import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trash2, Clock, Zap } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

export interface SavedCircuit {
  id: string
  title: string
  createdAt: Date
  numQubits: number
  gateCount: number
  circuitElements: any[]
}

interface CircuitHistoryPanelProps {
  savedCircuits: SavedCircuit[]
  onLoadCircuit: (circuit: SavedCircuit) => void
  onDeleteCircuit: (circuitId: string) => void
  isLoading?: boolean
  isAuthenticated?: boolean
  // Optional external search control
  searchQuery?: string
  showSearch?: boolean
}

export function CircuitHistoryPanel({ 
  savedCircuits, 
  onLoadCircuit, 
  onDeleteCircuit, 
  isLoading = false,
  isAuthenticated = false,
  searchQuery,
  showSearch = true,
}: CircuitHistoryPanelProps) {
  const [search, setSearch] = useState("")
  const [qubitFilter, setQubitFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest")
  const effectiveSearch = searchQuery !== undefined ? searchQuery : search
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  // Compute filtered list before any conditional returns to keep hook order stable
  const filteredCircuits = useMemo(() => {
    let list = [...savedCircuits]
    if (effectiveSearch.trim()) {
      const q = effectiveSearch.toLowerCase()
      list = list.filter(c => c.title.toLowerCase().includes(q))
    }
    if (qubitFilter !== "all") {
      if (qubitFilter === "1-2") list = list.filter(c => c.numQubits <= 2)
      else if (qubitFilter === "3-5") list = list.filter(c => c.numQubits >= 3 && c.numQubits <= 5)
      else if (qubitFilter === "6+") list = list.filter(c => c.numQubits >= 6)
    }
    list.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortBy === "newest" ? -diff : diff
    })
    return list
  }, [savedCircuits, effectiveSearch, qubitFilter, sortBy])

  if (isLoading) {
    return (
      <div className="space-y-2 pr-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg p-2.5 bg-muted">
            <Skeleton className="h-4 w-4/5 mb-2" />
            <Skeleton className="h-3 w-3/5 mb-2" />
            <div className="flex gap-1.5">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (savedCircuits.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 px-2">
        <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm text-foreground">No saved circuits yet</p>
        <p className="text-xs mt-1">Build a circuit and save it to see it here!</p>
      </div>
    )
  }

  

  // Note: thumbnails and hover previews intentionally removed per UX request

  return (
    <div className="space-y-2">
      {/* Search and filters */}
      <div className="flex items-center gap-1.5 pr-2">
        {showSearch && (
          <Input
            placeholder="Search circuits..."
            value={searchQuery !== undefined ? searchQuery : search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            aria-label="Search saved circuits"
          />
        )}
        <select
          className="h-8 rounded-md border border-border px-2 text-sm text-foreground bg-background"
          value={qubitFilter}
          onChange={(e) => setQubitFilter(e.target.value)}
          aria-label="Filter by qubits"
        >
          <option value="all">All qubits</option>
          <option value="1-2">1–2</option>
          <option value="3-5">3–5</option>
          <option value="6+">6+</option>
        </select>
        <select
          className="h-8 rounded-md border border-border px-2 text-sm text-foreground bg-background ml-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          aria-label="Sort circuits"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <ScrollArea className="h-full mt-1">
        <div className="space-y-1 pr-2">
          {filteredCircuits.map((circuit) => (
            <div
              key={circuit.id}
              className="group cursor-pointer hover:bg-accent rounded-lg p-2.5 transition-colors duration-200 border border-transparent hover:border-border"
              onClick={() => onLoadCircuit(circuit)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-normal text-sm text-foreground truncate mb-1 leading-tight" title={circuit.title}>
                    {circuit.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{formatDate(circuit.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {circuit.numQubits} qubits
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {circuit.gateCount} gates
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteCircuit(circuit.id)
                  }}
                  aria-label={`Delete ${circuit.title}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
