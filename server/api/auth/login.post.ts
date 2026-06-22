export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body ?? {}

  const envUser = process.env.AUTH_USERNAME
  const envPass = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET

  if (!envUser || !envPass || !secret) {
    throw createError({ statusCode: 500, message: 'Auth not configured on server' })
  }

  if (!username || !password || username !== envUser || password !== envPass) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const token = await makeToken(username, password, secret)
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
