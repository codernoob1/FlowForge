/**
 * Compensation Step: CancelShipment
 * 
 * Cancels shipment when order fails after CreateShipment.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { COMPENSATION_TOPICS } from '../../workflows/compensator'
import { shipmentService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  originalStep: z.string(),
  compensationStep: z.string(),
  context: z.record(z.string(), z.any()),
  originalOutput: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'CancelShipment',
  description: 'Cancels shipment (compensation for CreateShipment)',
  subscribes: [ORDER_TOPICS.CANCEL_SHIPMENT],
  emits: [COMPENSATION_TOPICS.COMPENSATION_COMPLETED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['CancelShipment'] = async (input, ctx) => {
  const { workflowId, originalStep, originalOutput } = input

  const trackingNumber = originalOutput.trackingNumber as string

  ctx.logger.info('[Compensation] Cancelling shipment', {
    workflowId,
    trackingNumber,
  })

  try {
    await shipmentService.cancel({
      trackingNumber,
      reason: 'Order workflow failed - cancelling shipment',
    })

    ctx.logger.info('[Compensation] Shipment cancelled', {
      workflowId,
      trackingNumber,
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
    ctx.logger.error('[Compensation] Shipment cancellation failed', {
      workflowId,
      error: errorMessage,
    })

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

