"use client"

import { useState, useEffect, useRef } from "react"
import { ThemeToggle } from "./theme-toggle"

function setSimulatorTab(tab: "circuit" | "bloch" | "density" | "amplitudes") {
  try {
    const evt = new CustomEvent("app:set-simulator-tab", { detail: tab })
    window.dispatchEvent(evt)
  } catch (e) {
    // no-op
  }
}

type NavBarProps = {
  sidebarWidth?: number
}

export default function NavBar({ sidebarWidth = 0 }: NavBarProps) {
  const [activeTab, setActiveTab] = useState<"circuit" | "bloch" | "density" | "amplitudes">("circuit")
  const headerRef = useRef<HTMLElement | null>(null)

  // Listen for active tab changes from the simulator
  useEffect(() => {
    const onTabChange = (e: any) => {
      const tab = e?.detail
      if (tab === "circuit" || tab === "bloch" || tab === "density" || tab === "amplitudes") {
        setActiveTab(tab)
      }
    }
    window.addEventListener("app:simulator-tab-changed", onTabChange as EventListener)
    return () => window.removeEventListener("app:simulator-tab-changed", onTabChange as EventListener)
  }, [])

  // Publish header height as a CSS variable for consistent content offset
  useEffect(() => {
    const updateHeight = () => {
      const h = headerRef.current?.offsetHeight || 0
      document.documentElement.style.setProperty("--app-nav-height", `${h}`)
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    const t = setTimeout(updateHeight, 50)
    return () => {
      window.removeEventListener("resize", updateHeight)
      clearTimeout(t)
    }
  }, [sidebarWidth])

  return (
    <header
      ref={headerRef}
      className="fixed top-0 z-50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
      style={{ left: `${sidebarWidth}px`, width: `calc(100% - ${sidebarWidth}px)` }}
    >
      <div className="relative w-full px-3 py-3">
        {/* Left-aligned app title */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 select-none">
          <span className="text-sm md:text-base lg:text-lg font-semibold tracking-tight">
            Quantum Circuit Simulator
          </span>
        </div>
        <nav aria-label="Simulator tabs" className="flex justify-center">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setSimulatorTab("circuit")}
              className={`px-4 py-2 rounded-lg border text-sm md:text-base shadow-sm transition-colors ${
                activeTab === "circuit"
                  ? "border-primary ring-2 ring-primary/30 bg-card text-card-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              Circuit Builder
            </button>
            <button
              onClick={() => setSimulatorTab("bloch")}
              className={`px-4 py-2 rounded-lg border text-sm md:text-base shadow-sm transition-colors ${
                activeTab === "bloch"
                  ? "border-primary ring-2 ring-primary/30 bg-card text-card-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              Bloch Sphere
            </button>
            <button
              onClick={() => setSimulatorTab("density")}
              className={`px-4 py-2 rounded-lg border text-sm md:text-base shadow-sm transition-colors ${
                activeTab === "density"
                  ? "border-primary ring-2 ring-primary/30 bg-card text-card-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              Density Matrix
            </button>
            <button
              onClick={() => setSimulatorTab("amplitudes")}
              className={`px-4 py-2 rounded-lg border text-sm md:text-base shadow-sm transition-colors ${
                activeTab === "amplitudes"
                  ? "border-primary ring-2 ring-primary/30 bg-card text-card-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              Amplitude Table
            </button>
            {/* Right aligned theme toggle */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
