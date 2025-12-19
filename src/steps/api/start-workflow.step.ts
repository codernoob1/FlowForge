/**
 * API: POST /workflows/start
 * 
 * Starts a new workflow.
 * Currently supports: OrderWorkflow
 * 
 * This is a THIN API - no business logic here.
 * Just validates input and starts the workflow.
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowEngine, ENGINE_TOPICS } from '../../workflows/engine'
import { registerOrderWorkflow } from '../../workflows/order-workflow'

// Register OrderWorkflow on module load
registerOrderWorkflow()

const bodySchema = z.object({
  type: z.literal('OrderWorkflow'),
  input: z.object({
    orderId: z.string().min(1),
    userId: z.string().min(1),
    items: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      quantity: z.number().min(1),
      price: z.number().nonnegative(),
    })).min(1),
    shippingAddress: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      country: z.string().min(1),
      postalCode: z.string().min(1),
    }),
    // Test overrides for failure scenarios
    _testAmount: z.number().optional(),
    _testQuantity: z.number().optional(),
    _testWeight: z.number().optional(),
  }).passthrough(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'StartWorkflow',
  description: 'Starts a new workflow',
  path: '/workflows/start',
  method: 'POST',
  emits: [ENGINE_TOPICS.EXECUTE_STEP],
  bodySchema,
  responseSchema: {
    201: z.object({
      workflowId: z.string(),
      type: z.string(),
      status: z.string(),
      message: z.string(),
    }),
    400: z.object({
      error: z.string(),
    }),
  },
  flows: ['order-workflow'],
}

export const handler: Handlers['StartWorkflow'] = async (req, ctx) => {
  try {
    const { type, input } = bodySchema.parse(req.body)

    ctx.logger.info('[API] Starting workflow', { type, orderId: input.orderId })

    const result = await workflowEngine.startWorkflow(ctx, {
      type,
      input,
    })

    ctx.logger.info('[API] Workflow started', {
      workflowId: result.workflowId,
      type,
    })

    return {
      status: 201,
      body: {
        workflowId: result.workflowId,
        type: result.workflow.type,
        status: result.workflow.status,
        message: 'Workflow started successfully',
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[API] Failed to start workflow', { error: errorMessage })

    return {
      status: 400,
      body: { error: errorMessage },
    }
  }
}

