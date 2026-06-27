import { makeToken, getTeamMembersMap, AUTH_COOKIE, AUTH_FLAG_COOKIE } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body ?? {}

  const config = useRuntimeConfig()
  const envUser = config.authUsername
  const envPass = config.authPassword
  const secret = config.authSecret

  if (!envUser || !envPass || !secret) {
    throw createError({ statusCode: 500, message: 'Auth not configured on server' })
  }

  let isValid = false
  let tokenInputPassword = ''

  if (username && password) {
    // 1. Check if super-admin (from .env)
    if (username === envUser && password === envPass) {
      isValid = true
      tokenInputPassword = envPass
    } else {
      // 2. Check if team member (from environment configuration)
      const teamMembers = getTeamMembersMap(config.teamMembers)
      const memberPassword = teamMembers[username.toLowerCase().trim()]
      if (memberPassword && password === memberPassword) {
        isValid = true
        tokenInputPassword = memberPassword
      }
    }
  }

  if (!isValid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  // Generate the token
  const token = await makeToken(username, tokenInputPassword, secret)
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }

  setCookie(event, AUTH_COOKIE, token, cookieOpts)
  setCookie(event, AUTH_FLAG_COOKIE, '1', { ...cookieOpts, httpOnly: false })

  return { ok: true }
})
