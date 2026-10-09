import { describe, expect, it } from 'vitest'

import { avatarExportFingerprint } from '@/features/payments/avatarExportPayment'

describe('avatar export payment', () => {
  it('creates a stable SHA-256 fingerprint for an avatar definition', async () => {
    const definition = { name: 'Aarav', colors: { body: '#f59e0b', eyes: '#111827' } }

    const first = await avatarExportFingerprint(definition)
    const second = await avatarExportFingerprint(definition)

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses a distinct fingerprint for each mascot identity', async () => {
    const first = await avatarExportFingerprint({ avatarId: 'aarav-1' })
    const second = await avatarExportFingerprint({ avatarId: 'aarav-2' })

    expect(first).not.toBe(second)
  })
})
