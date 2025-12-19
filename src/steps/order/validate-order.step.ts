/**
 * Order Step: ValidateOrder
 * 
 * Validates order data before processing.
 * No compensation needed - validation has no side effects.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { orderValidator } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ValidateOrder',
  description: 'Validates order data',
  subscribes: [ORDER_TOPICS.VALIDATE_ORDER],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ValidateOrder'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  ctx.logger.info('[Order] Validating order', { workflowId, orderId: context.orderId })

  try {
    // Validate order structure
    const validationResult = orderValidator.validate({
      orderId: context.orderId as string,
      userId: context.userId as string,
      items: context.items as Array<{ sku: string; quantity: number; price: number }>,
      shippingAddress: context.shippingAddress as {
        street: string
        city: string
        country: string
        postalCode: string
      },
    })

    if (!validationResult.valid) {
      ctx.logger.warn('[Order] Validation failed', {
        workflowId,
        errors: validationResult.errors,
      })

      const errors = validationResult.errors?.join(', ') ?? 'unknown validation errors'

      await ctx.emit({
        topic: ENGINE_TOPICS.STEP_FAILED,
        data: {
          workflowId,
          stepName,
          error: {
            message: `Validation failed: ${errors}`,
            code: 'VALIDATION_ERROR',
          },
        },
      })
      return
    }

    // Calculate total
    const items = context.items as Array<{ quantity: number; price: number }>
    const total = orderValidator.calculateTotal(items)

    ctx.logger.info('[Order] Order validated', { workflowId, total })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          validated: true,
          total,
          itemCount: items.length,
        },
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Order] Validation error', { workflowId, error: errorMessage })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_FAILED,
      data: {
        workflowId,
        stepName,
        error: { message: errorMessage, code: 'VALIDATION_EXCEPTION' },
      },
    })
  }
}

