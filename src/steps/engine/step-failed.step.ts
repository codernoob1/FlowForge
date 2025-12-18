/**
 * FlowForge - Step Failed Handler
 * 
 * Handles step failures.
 * Records failure and triggers compensation.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowEngine, ENGINE_TOPICS } from '../../workflows/engine'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
})

export const config: EventConfig = {
  type: 'event',
  name: 'StepFailed',
  description: 'Handles step failures and triggers compensation',
  subscribes: [ENGINE_TOPICS.STEP_FAILED],
  emits: [ENGINE_TOPICS.COMPENSATE],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['StepFailed'] = async (input, ctx) => {
  const { workflowId, stepName, error } = input

  ctx.logger.error('[Engine] Step failed', { workflowId, stepName, error })

  await workflowEngine.handleStepFailed(ctx, { workflowId, stepName, error })
}

