"use client"

import { useState } from "react"
import CircuitLibrarySidebar from "./circuit-library-sidebar"
import { useCircuitStorage } from "@/hooks/use-circuit-storage"
import NavBar from "./nav-bar"

type AppShellProps = {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { savedCircuits, deleteCircuit, isAuthenticated, isLoading } = useCircuitStorage()
  const [isExpanded, setIsExpanded] = useState(false)
  const collapsed = 60
  const expanded = 260

  return (
    <div className="min-h-screen bg-background">
      {/* Global fixed sidebar */}
      <CircuitLibrarySidebar
        savedCircuits={savedCircuits}
        onLoadCircuit={(circuit) => {
          // Broadcast selection so any page can handle loading
          try {
            const evt = new CustomEvent("app:load-circuit", { detail: circuit })
            window.dispatchEvent(evt)
          } catch (e) {
            // no-op
          }
        }}
        onDeleteCircuit={deleteCircuit}
        isAuthenticated={isAuthenticated}
        onExpandChange={setIsExpanded}
        collapsedWidth={collapsed}
        expandedWidth={expanded}
      />

      {/* Top navigation bar */}
      <div
        className="transition-all duration-300 ease-in-out"
        style={{ paddingLeft: `${isExpanded ? expanded : collapsed}px` }}
      >
        <NavBar sidebarWidth={isExpanded ? expanded : collapsed} />

        {/* Content area shifts based on sidebar width; top padding follows fixed navbar height */}
        <div className="px-3 h-screen flex flex-col" style={{ paddingTop: "calc((var(--app-nav-height, 96))px + 12px)" }}>
          <div className="flex-1 min-h-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
