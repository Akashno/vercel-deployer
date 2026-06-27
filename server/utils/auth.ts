export const AUTH_COOKIE = 'auth_token'
export const AUTH_FLAG_COOKIE = 'auth_ok'

export function getTeamMembersMap(configString: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!configString) return map
  const pairs = configString.split(',')
  for (const pair of pairs) {
    const idx = pair.indexOf(':')
    if (idx !== -1) {
      const email = pair.substring(0, idx).trim().toLowerCase()
      const pass = pair.substring(idx + 1)
      if (email && pass) {
        map[email] = pass
      }
    }
  }
  return map
}

export async function makeToken(username: string, passwordHashOrPass: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(`${username}:${passwordHashOrPass}`))
  const sigHex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${username}:${sigHex}`
}

export async function verifyAuthCookie(event: Parameters<typeof getCookie>[0]): Promise<boolean> {
  const cookieVal = getCookie(event, AUTH_COOKIE)
  if (!cookieVal) return false

  const separatorIndex = cookieVal.indexOf(':')
  if (separatorIndex === -1) return false

  const username = cookieVal.substring(0, separatorIndex)

  const config = useRuntimeConfig()
  const secret = config.authSecret
  if (!secret) return false

  // 1. Check if primary admin from .env
  if (username === config.authUsername) {
    const expectedToken = await makeToken(username, config.authPassword, secret)
    return cookieVal === expectedToken
  }

  // 2. Check if team member from config string
  const teamMembers = getTeamMembersMap(config.teamMembers)
  const password = teamMembers[username.toLowerCase().trim()]
  if (!password) return false

  const expectedToken = await makeToken(username, password, secret)
  return cookieVal === expectedToken
}

export async function isSuperAdmin(event: Parameters<typeof getCookie>[0]): Promise<boolean> {
  const ok = await verifyAuthCookie(event)
  if (!ok) return false

  const cookieVal = getCookie(event, AUTH_COOKIE)
  if (!cookieVal) return false
  const separatorIndex = cookieVal.indexOf(':')
  if (separatorIndex === -1) return false
  const username = cookieVal.substring(0, separatorIndex)

  const config = useRuntimeConfig()
  return username === config.authUsername
}
