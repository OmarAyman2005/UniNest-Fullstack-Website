"use client"
import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ReactDOM from 'react-dom'

function safeDecode(b64) {
  if (!b64) return null
  try {
    return atob(b64)
  } catch (e) {
    try {
      const b = b64.replace(/-/g, '+').replace(/_/g, '/')
      const pad = b + '='.repeat((4 - (b.length % 4)) % 4)
      return atob(pad)
    } catch (e2) {
      return null
    }
  }
}

export default function VisitorQRPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const d = sp?.get('d') || ''

  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    setPayload(null)
    if (!d) {
      setError('No data provided in QR.')
      return
    }
    const jsonStr = safeDecode(d)
    if (!jsonStr) {
      setError('Failed to decode QR data.')
      return
    }
    try {
      const obj = JSON.parse(jsonStr)
      if (obj && obj.v) {
        setPayload(obj.v)
      } else if (obj) {
        setPayload(obj)
      } else {
        setError('QR payload not recognized.')
      }
    } catch (e) {
      setError('Invalid JSON payload in QR.')
    }
  }, [d])

  const displayText = useMemo(() => {
    if (!payload) return ''
    const lines = []
    if (payload.t) lines.push(`Type: ${payload.t}`)
    if (payload.eventId) lines.push(`Event ID: ${payload.eventId}`)
    if (payload.eventName) lines.push(`Event: ${payload.eventName}`)
    if (payload.name) lines.push(`Name: ${payload.name}`)
    if (payload.email) lines.push(`Visitor Email: ${payload.email}`)
    if (payload.ts) lines.push(`Timestamp: ${new Date(payload.ts).toLocaleString()}`)
    if (lines.length === 0) return JSON.stringify(payload, null, 2)
    return lines.join('\n')
  }, [payload])

  useEffect(() => {
    let t
    if (copied) t = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(t)
  }, [])

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText || JSON.stringify(payload || {}, null, 2))
      setCopied(true)
    } catch (e) {
      console.error('copy failed', e)
    }
  }

  return (
    <main className="min-h-screen bg-root flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-surface border border-root rounded-2xl shadow-elevated p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold text-root-primary">Visitor QR</h1>
          </div>

          {error ? (
            <div className="px-3 py-3 rounded-lg bg-red-600/10 text-red-200 border border-red-400/30">{error}</div>
          ) : !payload ? (
            <div className="text-root-secondary">Decoding…</div>
          ) : (
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-full">
                <div className="bg-highlight rounded-lg p-6 text-root-primary shadow-elevated">
                  <h2 className="text-lg font-semibold mb-2">Scanned QR payload</h2>
                  <p className="text-sm text-root-secondary mb-3">The decoded information from the scanned QR is shown below.</p>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(payload).map(([key, val]) => {
                      const displayKey = key === 'k' ? 'Message Type' : key === 'v' ? 'Payload' : key
                      return (
                        <div key={key} className="flex flex-col sm:flex-row gap-3 items-center sm:items-start p-3 rounded-md bg-surface/20 border border-root/10 text-center sm:text-left">
                          <div className="sm:w-1/3 w-full text-xs text-root-secondary font-semibold uppercase">{displayKey}</div>
                          <div className="sm:w-2/3 w-full text-sm font-mono text-root-primary break-words">
                            {typeof val === 'object' && val !== null ? (
                              <div className="grid grid-cols-1 gap-2 text-left">
                                {Object.entries(val)
                                  .filter(([k2]) => k2 !== 'email')
                                  .map(([k2, v2]) => {
                                    const label = k2 === 't' ? 'Visitor Type' : k2
                                    return (
                                      <div key={k2} className="flex justify-between gap-4">
                                        <div className="text-xs text-root-secondary w-1/3">{label}</div>
                                        <div className="text-sm w-2/3 font-mono break-words">{typeof v2 === 'object' ? JSON.stringify(v2) : String(v2)}</div>
                                      </div>
                                    )
                                  })}
                              </div>
                            ) : (
                              String(val)
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <CopyButton copied={copied} onCopy={handleCopy} />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function CopyButton({ copied, onCopy }) {
  const [hover, setHover] = useState(false)
  const baseColor = '#4F46E5'
  const style = hover
    ? { background: '#ffffff', color: '#4F46E5', borderColor: baseColor }
    : { background: baseColor, color: '#ffffff', borderColor: 'transparent' }

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onCopy}
      style={style}
      className="inline-block px-5 py-2 rounded-xl shadow-md transition focus:outline-none focus:ring-2"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
