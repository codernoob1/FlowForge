/**
 * Compensation Step: RefundPayment
 * 
 * Refunds payment when order fails after ChargePayment.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { COMPENSATION_TOPICS } from '../../workflows/compensator'
import { paymentService, notificationService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  originalStep: z.string(),
  compensationStep: z.string(),
  context: z.record(z.string(), z.any()),
  originalOutput: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'RefundPayment',
  description: 'Refunds payment (compensation for ChargePayment)',
  subscribes: [ORDER_TOPICS.REFUND_PAYMENT],
  emits: [COMPENSATION_TOPICS.COMPENSATION_COMPLETED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['RefundPayment'] = async (input, ctx) => {
  const { workflowId, originalStep, context, originalOutput } = input

  const transactionId = originalOutput.transactionId as string
  const amount = (originalOutput.amountCharged as number) ?? (context.total as number) ?? 0

  ctx.logger.info('[Compensation] Refunding payment', {
    workflowId,
    transactionId,
    amount,
  })

  try {
    const result = await paymentService.refund({
      transactionId,
      amount,
      reason: 'Order workflow failed - automatic refund',
    })

    ctx.logger.info('[Compensation] Payment refunded', {
      workflowId,
      refundId: result.refundId,
    })

    // Notify user about refund
    await notificationService.send({
      userId: context.userId as string,
      type: 'order_refunded',
      orderId: context.orderId as string,
      data: { refundId: result.refundId, amount },
    })

    await ctx.emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
      data: {
        workflowId,
        stepName: originalStep,
        success: true,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Compensation] Refund failed', {
      workflowId,
      error: errorMessage,
    })

    // Compensation failures are logged but process continues
    await ctx.emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
      data: {
        workflowId,
        stepName: originalStep,
        success: false,
        error: errorMessage,
      },
    })
  }
}

