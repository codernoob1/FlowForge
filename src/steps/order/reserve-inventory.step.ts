/**
 * Order Step: ReserveInventory
 * 
 * Reserves inventory for order items.
 * Compensation: ReleaseInventory
 * 
 * Rules:
 * - quantity < 10: success
 * - quantity >= 10: failure
 * - quantity === 777: timeout error
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { inventoryService } from '../../services/fake-externals'

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ReserveInventory',
  description: 'Reserves inventory for order items',
  subscribes: [ORDER_TOPICS.RESERVE_INVENTORY],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ReserveInventory'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  const items = context.items as Array<{ sku: string; quantity: number }>
  
  // Use test quantity if provided
  const testQuantity = context._testQuantity as number | undefined
  const effectiveItems = testQuantity
    ? [{ sku: 'TEST', quantity: testQuantity }]
    : items

  ctx.logger.info('[Order] Reserving inventory', {
    workflowId,
    itemCount: effectiveItems.length,
  })

  try {
    const result = await inventoryService.reserve({
      orderId: context.orderId as string,
      items: effectiveItems,
    })

    if (!result.success) {
      ctx.logger.warn('[Order] Inventory reservation failed', {
        workflowId,
        error: result.error,
      })

      await ctx.emit({
        topic: ENGINE_TOPICS.STEP_FAILED,
        data: {
          workflowId,
          stepName,
          error: {
            message: result.error ?? 'Inventory reservation failed',
            code: 'INVENTORY_FAILED',
          },
        },
      })
      return
    }

    ctx.logger.info('[Order] Inventory reserved', {
      workflowId,
      reservationId: result.reservationId,
    })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_COMPLETED,
      data: {
        workflowId,
        stepName,
        output: {
          reservationId: result.reservationId,
        },
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Order] Inventory exception', { workflowId, error: errorMessage })

    await ctx.emit({
      topic: ENGINE_TOPICS.STEP_FAILED,
      data: {
        workflowId,
        stepName,
        error: { message: errorMessage, code: 'INVENTORY_EXCEPTION' },
      },
    })
  }
}

