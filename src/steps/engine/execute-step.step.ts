/**
 * FlowForge - Execute Step Handler
 * 
 * Orchestrates the execution of workflow steps.
 * Listens to flowforge.execute-step and delegates to the actual step topic.
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowEngine, ENGINE_TOPICS } from '../../workflows/engine'
import { registerOrderWorkflow } from '../../workflows/order-workflow'

// Register workflows on module load
registerOrderWorkflow()

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
})

export const config: EventConfig = {
  type: 'event',
  name: 'ExecuteStep',
  description: 'Orchestrates workflow step execution',
  subscribes: [ENGINE_TOPICS.EXECUTE_STEP],
  emits: [
    // Dynamic: emits to step topics from registry
    { topic: 'order.validate', label: 'ValidateOrder' },
    { topic: 'order.charge-payment', label: 'ChargePayment' },
    { topic: 'order.reserve-inventory', label: 'ReserveInventory' },
    { topic: 'order.create-shipment', label: 'CreateShipment' },
    { topic: 'order.notify-user', label: 'NotifyUser' },
    { topic: 'order.complete', label: 'Complete' },
    ENGINE_TOPICS.STEP_COMPLETED,
    ENGINE_TOPICS.STEP_FAILED,
  ],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['ExecuteStep'] = async (input, ctx) => {
  const { workflowId, stepName } = input

  ctx.logger.info('[Engine] Executing step', { workflowId, stepName })

  await workflowEngine.executeStep(ctx, { workflowId, stepName })
}

