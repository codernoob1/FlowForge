/**
 * FlowForge - Compensation Completed Handler
 * 
 * Handles completion of a compensation step and continues to next.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { compensator, COMPENSATION_TOPICS } from '../../workflows/compensator'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
})

export const config: EventConfig = {
  type: 'event',
  name: 'CompensationCompleted',
  description: 'Handles compensation step completion',
  subscribes: [COMPENSATION_TOPICS.COMPENSATION_COMPLETED],
  emits: [
    COMPENSATION_TOPICS.EXECUTE_COMPENSATION,
    COMPENSATION_TOPICS.COMPENSATION_FINISHED,
  ],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['CompensationCompleted'] = async (input, ctx) => {
  const { workflowId, stepName, success, error } = input

  ctx.logger.info('[Compensator] Compensation step completed', {
    workflowId,
    stepName,
    success,
  })

  await compensator.handleCompensationCompleted(ctx, {
    workflowId,
    stepName,
    success,
    error,
  })
}

