/**
 * Order Step: NotifyUser
 * 
 * Sends order confirmation notification to user.
 * No compensation - notifications are fire-and-forget.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { notificationService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'NotifyUser',
  description: 'Sends order confirmation notification',
  subscribes: [ORDER_TOPICS.NOTIFY_USER],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['NotifyUser'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  ctx.logger.info('[Order] Sending notification', {
    workflowId,
    userId: context.userId,
  })

  try {
    const result = await notificationService.send({
      userId: context.userId as string,
      type: 'order_confirmed',
      orderId: context.orderId as string,
      data: {
        trackingNumber: context.trackingNumber,
        total: context.total,
      },
    })

    ctx.logger.info('[Order] Notification sent', {
      workflowId,
      notificationId: result.notificationId,
    })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          notificationId: result.notificationId,
          notificationType: 'order_confirmed',
        },
      },
    })
  } catch (error) {
    // Notifications are non-critical, log but don't fail
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.warn('[Order] Notification failed (non-critical)', {
      workflowId,
      error: errorMessage,
    })

    // Still complete - notifications are fire-and-forget
    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          notificationFailed: true,
          error: errorMessage,
        },
      },
    })
  }
}

