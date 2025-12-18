/**
 * FlowForge - Execute Compensation Handler
 * 
 * Executes a single compensation step.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { compensator, COMPENSATION_TOPICS } from '../../workflows/compensator'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  compensationStep: z.string(),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ExecuteCompensation',
  description: 'Executes a single compensation step',
  subscribes: [COMPENSATION_TOPICS.EXECUTE_COMPENSATION],
  emits: [
    // Compensation topics (dynamic based on step)
    'compensate.RefundPayment',
    'compensate.ReleaseInventory',
    'compensate.CancelShipment',
  ],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ExecuteCompensation'] = async (input, ctx) => {
  const { workflowId, stepName, compensationStep } = input

  ctx.logger.info('[Compensator] Executing compensation', {
    workflowId,
    stepName,
    compensationStep,
  })

  await compensator.executeCompensation(ctx, { workflowId, stepName, compensationStep })
}

