import { isSuperAdmin, getTeamMembersMap } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await isSuperAdmin(event)
  if (!admin) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const config = useRuntimeConfig()
  const teamMap = getTeamMembersMap(config.teamMembers)

  // Return email + password from the TEAM_MEMBERS env var (admin-only endpoint)
  return Object.entries(teamMap).map(([email, password]) => ({ email, password }))
})
