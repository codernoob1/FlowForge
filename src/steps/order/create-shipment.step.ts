/**
 * Order Step: CreateShipment
 * 
 * Creates shipping label for order.
 * Compensation: CancelShipment
 * 
 * Rules:
 * - weight < 50: success
 * - weight >= 50: failure
 * - weight === 777: timeout error
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { shipmentService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'CreateShipment',
  description: 'Creates shipping label for order',
  subscribes: [ORDER_TOPICS.CREATE_SHIPMENT],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['CreateShipment'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  const address = context.shippingAddress as {
    street: string
    city: string
    country: string
    postalCode: string
  }
  
  // Use test weight if provided
  const weight = (context._testWeight as number) ?? 1

  ctx.logger.info('[Order] Creating shipment', {
    workflowId,
    city: address.city,
    weight,
  })

  try {
    const result = await shipmentService.create({
      orderId: context.orderId as string,
      address,
      weight,
    })

    if (!result.success) {
      ctx.logger.warn('[Order] Shipment creation failed', {
        workflowId,
        error: result.error,
      })

      await ctx.emit({
        topic: ENGINE_TOPICS.STEP_FAILED,
        data: {
          workflowId,
          stepName,
          error: {
            message: result.error ?? 'Shipment creation failed',
            code: 'SHIPMENT_FAILED',
          },
        },
      })
      return
    }

    ctx.logger.info('[Order] Shipment created', {
      workflowId,
      trackingNumber: result.trackingNumber,
    })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          trackingNumber: result.trackingNumber,
        },
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Order] Shipment exception', { workflowId, error: errorMessage })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_FAILED,
      data: {
        workflowId,
        stepName,
        error: { message: errorMessage, code: 'SHIPMENT_EXCEPTION' },
      },
    })
  }
}

