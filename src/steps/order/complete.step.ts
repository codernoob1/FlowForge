/**
 * Order Step: Complete
 * 
 * Final step - marks order as complete.
 * No compensation - this is the terminal state.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'CompleteOrder',
  description: 'Marks order as complete',
  subscribes: [ORDER_TOPICS.COMPLETE],
  emits: [ENGINE_TOPICS.STEP_COMPLETED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['CompleteOrder'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  ctx.logger.info('[Order] Completing order', {
    workflowId,
    orderId: context.orderId,
    transactionId: context.transactionId,
    trackingNumber: context.trackingNumber,
  })

  await ctx.emit({
    topic: ENGINE_TOPICS.STEP_COMPLETED,
    data: {
      workflowId,
      stepName,
      output: {
        completedAt: new Date().toISOString(),
        summary: {
          orderId: context.orderId,
          userId: context.userId,
          total: context.total,
          transactionId: context.transactionId,
          trackingNumber: context.trackingNumber,
        },
      },
    },
  })
}

