import { defineEventHandler, getRouterParam, createError } from 'h3'
import { createVercelApi } from '~~/server/utils/api'
import { getProjectById } from '~~/server/utils/projects'
import { validateUid } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const project = getProjectById(getRouterParam(event, 'projectId'))
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const uid = getRouterParam(event, 'uid')
  validateUid(uid)

  const vercelApi = createVercelApi(project)
  await vercelApi(`/v12/deployments/${uid}/cancel`, { method: 'PATCH' })

  return { ok: true }
})
