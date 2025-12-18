/**
 * Compensation Step: ReleaseInventory
 * 
 * Releases inventory reservation when order fails after ReserveInventory.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { COMPENSATION_TOPICS } from '../../workflows/compensator'
import { inventoryService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  originalStep: z.string(),
  compensationStep: z.string(),
  context: z.record(z.string(), z.any()),
  originalOutput: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ReleaseInventory',
  description: 'Releases inventory (compensation for ReserveInventory)',
  subscribes: [ORDER_TOPICS.RELEASE_INVENTORY],
  emits: [COMPENSATION_TOPICS.COMPENSATION_COMPLETED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ReleaseInventory'] = async (input, ctx) => {
  const { workflowId, originalStep, originalOutput } = input

  const reservationId = originalOutput.reservationId as string

  ctx.logger.info('[Compensation] Releasing inventory', {
    workflowId,
    reservationId,
  })

  try {
    await inventoryService.release({
      reservationId,
      reason: 'Order workflow failed - releasing inventory',
    })

    ctx.logger.info('[Compensation] Inventory released', {
      workflowId,
      reservationId,
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
    ctx.logger.error('[Compensation] Inventory release failed', {
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

