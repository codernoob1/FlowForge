/**
 * Order Step: ChargePayment
 * 
 * Charges customer payment.
 * Compensation: RefundPayment
 * 
 * Rules:
 * - amount < 500: success
 * - amount >= 500: failure
 * - amount === 777: timeout error
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { paymentService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ChargePayment',
  description: 'Charges customer payment',
  subscribes: [ORDER_TOPICS.CHARGE_PAYMENT],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ChargePayment'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  // Use test amount if provided, otherwise calculate from items
  const amount = (context._testAmount as number) ?? (context.total as number) ?? 100

  ctx.logger.info('[Order] Charging payment', { workflowId, amount })

  try {
    const result = await paymentService.charge({
      orderId: context.orderId as string,
      amount,
    })

    if (!result.success) {
      ctx.logger.warn('[Order] Payment failed', {
        workflowId,
        error: result.error,
      })

      await ctx.emit({
        topic: ENGINE_TOPICS.STEP_FAILED,
        data: {
          workflowId,
          stepName,
          error: {
            message: result.error ?? 'Payment failed',
            code: 'PAYMENT_FAILED',
          },
        },
      })
      return
    }

    ctx.logger.info('[Order] Payment charged', {
      workflowId,
      transactionId: result.transactionId,
    })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          transactionId: result.transactionId,
          amountCharged: amount,
        },
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Order] Payment exception', { workflowId, error: errorMessage })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_FAILED,
      data: {
        workflowId,
        stepName,
        error: { message: errorMessage, code: 'PAYMENT_EXCEPTION' },
      },
    })
  }
}

