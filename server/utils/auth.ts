export const AUTH_COOKIE = 'auth_token'
export const AUTH_FLAG_COOKIE = 'auth_ok'

export async function makeToken(username: string, password: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${username}:${password}`))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyAuthCookie(event: Parameters<typeof getCookie>[0]): Promise<boolean> {
  const token = getCookie(event, AUTH_COOKIE)
  if (!token) return false

  const username = process.env.AUTH_USERNAME ?? ''
  const password = process.env.AUTH_PASSWORD ?? ''
  const secret = process.env.AUTH_SECRET ?? ''

  if (!username || !password || !secret) return false

  const expected = await makeToken(username, password, secret)
  return token === expected
}
