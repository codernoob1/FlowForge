/**
 * FlowForge - Step Completed Handler
 * 
 * Handles successful step completion.
 * Advances workflow to next step or marks as complete.
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
  output: z.record(z.string(), z.any()).default({}),
})

export const config: EventConfig = {
  type: 'event',
  name: 'StepCompleted',
  description: 'Handles successful step completion and advances workflow',
  subscribes: [ENGINE_TOPICS.STEP_COMPLETED],
  emits: [
    ENGINE_TOPICS.EXECUTE_STEP,
    ENGINE_TOPICS.WORKFLOW_COMPLETED,
  ],
  input: inputSchema,
  flows: ['order-workflow'],
}

export const handler: Handlers['StepCompleted'] = async (input, ctx) => {
  const { workflowId, stepName, output } = input

  ctx.logger.info('[Engine] Step completed', { workflowId, stepName })

  await workflowEngine.handleStepCompleted(ctx, { workflowId, stepName, output })
}

