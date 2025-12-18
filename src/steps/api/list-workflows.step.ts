/**
 * API: GET /workflows
 * 
 * Lists all workflows.
 * 
 * This is a THIN API - no business logic here.
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowPersistence } from '../../services/workflow-persistence'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'ListWorkflows',
  description: 'Lists all workflows',
  path: '/workflows',
  method: 'GET',
  emits: [],
  responseSchema: {
    200: z.object({
      workflows: z.array(z.object({
        id: z.string(),
        type: z.string(),
        status: z.string(),
        currentStep: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })),
      count: z.number(),
    }),
  },
  flows: ['order-workflow'],
}

export const handler: Handlers['ListWorkflows'] = async (_req, ctx) => {
  ctx.logger.info('[API] Listing workflows')

  const workflows = await workflowPersistence.listWorkflows(ctx.state)

  // Sort by createdAt descending (newest first)
  const sorted = workflows.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return {
    status: 200,
    body: {
      workflows: sorted.map(w => ({
        id: w.id,
        type: w.type,
        status: w.status,
        currentStep: w.currentStep,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      count: sorted.length,
    },
  }
}

