/**
 * FlowForge - Compensate Handler
 * 
 * Starts the compensation (rollback) process for a failed workflow.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { compensator, COMPENSATION_TOPICS } from '../../workflows/compensator'

const inputSchema = z.object({
  workflowId: z.string(),
})

export const config: EventConfig = {
  type: 'event',
  name: 'Compensate',
  description: 'Starts compensation process for failed workflow',
  subscribes: [ENGINE_TOPICS.COMPENSATE],
  emits: [
    COMPENSATION_TOPICS.EXECUTE_COMPENSATION,
    COMPENSATION_TOPICS.COMPENSATION_FINISHED,
  ],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['Compensate'] = async (input, ctx) => {
  const { workflowId } = input

  ctx.logger.info('[Compensator] Starting compensation', { workflowId })

  await compensator.startCompensation(ctx, { workflowId })
}

