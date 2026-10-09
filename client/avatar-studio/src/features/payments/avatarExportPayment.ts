const PURCHASE_API = '/api/avatar-studio/payments'
const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'
const PAID_EXPORTS_ENABLED = import.meta.env.VITE_LMSGEN_PAID_EXPORTS === '1'

type PurchaseOrder = {
  purchased?: boolean
  keyId?: string
  orderId?: string
  amount?: number
  currency?: string
}

type CheckoutResult = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayCheckout = {
  open: () => void
  on: (event: 'payment.failed', handler: () => void) => void
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

const apiUrl = (path: string) => `${import.meta.env.VITE_BACKEND_URL || ''}${path}`

const readSession = () => {
  const token = window.localStorage.getItem('token')
  let user: { email?: string; username?: string } = {}
  try {
    user = JSON.parse(window.localStorage.getItem('user') || '{}')
  } catch {
    user = {}
  }
  return { token, user }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(payload.message || 'PAYMENT_REQUEST_FAILED')
  return payload
}

const request = async <T>(path: string, token: string, init?: RequestInit) =>
  parseResponse<T>(
    await fetch(apiUrl(`${PURCHASE_API}${path}`), {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  )

let checkoutScriptPromise: Promise<void> | null = null

const loadCheckout = () => {
  if (window.Razorpay) return Promise.resolve()
  if (checkoutScriptPromise) return checkoutScriptPromise
  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PAYMENT_CHECKOUT_UNAVAILABLE'))
    document.head.append(script)
  })
  return checkoutScriptPromise
}

export const avatarExportFingerprint = async (source: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(source))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
}

export async function ensureAvatarExportPurchased({
  avatarId,
  avatarName,
}: {
  avatarId: string
  avatarName: string
}) {
  if (!PAID_EXPORTS_ENABLED) return true
  const { token, user } = readSession()
  if (!token) throw new Error('PAYMENT_LOGIN_REQUIRED')

  const fingerprint = await avatarExportFingerprint({ avatarId })
  const entitlement = await request<{ purchased: boolean }>(
    `/entitlement?fingerprint=${encodeURIComponent(fingerprint)}`,
    token
  )
  if (entitlement.purchased) return true

  const order = await request<PurchaseOrder>('/orders', token, {
    method: 'POST',
    body: JSON.stringify({ avatarName, fingerprint }),
  })
  if (order.purchased) return true
  await loadCheckout()
  if (!order.keyId || !order.orderId || !order.amount || !order.currency || !window.Razorpay) {
    throw new Error('PAYMENT_NOT_CONFIGURED')
  }

  const result = await new Promise<CheckoutResult>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'LMSGEN',
      description: `Avatar Studio export · ${avatarName}`,
      image: '/favicon.svg',
      prefill: { name: user.username || '', email: user.email || '' },
      theme: { color: '#54cfc4' },
      modal: { ondismiss: () => reject(new Error('PAYMENT_CANCELLED')) },
      handler: (payment: CheckoutResult) => resolve(payment),
    })
    checkout.on('payment.failed', () => reject(new Error('PAYMENT_FAILED')))
    checkout.open()
  })

  const verified = await request<{ purchased: boolean }>('/verify', token, {
    method: 'POST',
    body: JSON.stringify({
      orderId: result.razorpay_order_id,
      paymentId: result.razorpay_payment_id,
      signature: result.razorpay_signature,
    }),
  })
  if (!verified.purchased) throw new Error('PAYMENT_VERIFICATION_FAILED')
  return true
}
