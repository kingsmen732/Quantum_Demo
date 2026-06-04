'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const current = theme === 'system' ? systemTheme : theme

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="inline-flex h-8 items-center gap-2 rounded-md border px-2 text-sm bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
    >
      {mounted && current === 'dark' ? (
        <span>Light</span>
      ) : (
        <span>Dark</span>
      )}
    </button>
  )
}
