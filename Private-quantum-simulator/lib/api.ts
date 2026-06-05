export function getQiskitApiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_QISKIT_API_URL

  if (!baseUrl) {
    return path
  }

  return new URL(path, baseUrl).toString()
}