import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import AppShell from '@/components/app-shell'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'Quantum Circuit Designer | Professional Simulator for Research & Education',
  description: 'Advanced quantum circuit design and simulation tool for researchers, educators, and students. Build, visualize, and analyze quantum circuits with professional-grade features.',
  generator: 'Quantum Circuit Designer',
  keywords: ['quantum computing', 'quantum circuits', 'simulation', 'research', 'education', 'qiskit'],
  authors: [{ name: 'Quantum Research Lab' }],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans bg-background text-foreground ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider>
          <AppShell>
            {children}
          </AppShell>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
