/**
 * API: POST /workflows/:id/signal
 * 
 * Sends a signal to resume a waiting workflow.
 * 
 * This is a THIN API - no business logic here.
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowEngine, ENGINE_TOPICS } from '../../workflows/engine'

const bodySchema = z.object({
  signal: z.string().min(1),
  payload: z.record(z.string(), z.any()).optional(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'SignalWorkflow',
  description: 'Sends a signal to resume a waiting workflow',
  path: '/workflows/:id/signal',
  method: 'POST',
  emits: [ENGINE_TOPICS.EXECUTE_STEP],
  bodySchema,
  responseSchema: {
    200: z.object({
      workflowId: z.string(),
      signal: z.string(),
      message: z.string(),
    }),
    400: z.object({
      error: z.string(),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
  flows: ['order-workflow'],
}

export const handler: Handlers['SignalWorkflow'] = async (req, ctx) => {
  try {
    const workflowId = req.pathParams.id
    const { signal, payload } = bodySchema.parse(req.body)

    ctx.logger.info('[API] Signaling workflow', { workflowId, signal })

    await workflowEngine.resumeWorkflow(ctx, {
      workflowId,
      signal,
      payload,
    })

    return {
      status: 200,
      body: {
        workflowId,
        signal,
        message: 'Signal sent successfully',
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[API] Failed to signal workflow', { error: errorMessage })

    return {
      status: 400,
      body: { error: errorMessage },
    }
  }
}

