"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

type BrandLogoProps = {
  size?: number
  className?: string
  withLink?: boolean
  alt?: string
}

export function BrandLogo({ size = 36, className, withLink = true, alt = "QSim logo" }: BrandLogoProps) {
  const logo = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn(
        "transition-transform",
        "group-hover:scale-[1.08]",
        className
      )}
      aria-label={alt}
    >
      {/* Outer hexagon */}
      <polygon
        points="50,10 90,32.5 90,77.5 50,100 10,77.5 10,32.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.8"
      />
      
      {/* Middle hexagon */}
      <polygon
        points="50,25 80,42.5 80,72.5 50,90 20,72.5 20,42.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      
      {/* Inner hexagon (filled) */}
      <polygon
        points="50,40 70,52.5 70,67.5 50,80 30,67.5 30,52.5"
        fill="currentColor"
        opacity="0.7"
      />
      
      {/* Center circle */}
      <circle cx="50" cy="60" r="6" fill="currentColor" opacity="0.9" />
    </svg>
  )

  if (withLink) {
    return (
      <Link href="/" className="group inline-flex items-center text-foreground">
        {logo}
      </Link>
    )
  }
  return logo
}
