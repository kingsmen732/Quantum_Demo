import { existsSync, readFileSync } from "fs"

function loadPublicEnv(fileUrl) {
  if (!existsSync(fileUrl)) return {}

  return readFileSync(fileUrl, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith("#")) return env

      const equalsIndex = trimmedLine.indexOf("=")
      if (equalsIndex === -1) return env

      const key = trimmedLine.slice(0, equalsIndex).trim()
      if (!key.startsWith("NEXT_PUBLIC_")) return env

      let value = trimmedLine.slice(equalsIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      env[key] = value
      return env
    }, {})
}

const publicEnv = loadPublicEnv(new URL("./env.local", import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: publicEnv,
}

export default nextConfig
