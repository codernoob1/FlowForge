/**
 * API: GET /workflows/:id
 * 
 * Gets full workflow execution history.
 * 
 * This is a THIN API - no business logic here.
 */

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { workflowPersistence } from '../../services/workflow-persistence'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetWorkflow',
  description: 'Gets full workflow execution history',
  path: '/workflows/:id',
  method: 'GET',
  emits: [],
  responseSchema: {
    200: z.object({
      workflow: z.object({
        id: z.string(),
        type: z.string(),
        status: z.string(),
        currentStep: z.union([z.string(), z.null()]),
        context: z.record(z.string(), z.any()),
        failedStep: z.string().optional(),
        error: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
      steps: z.array(z.object({
        stepName: z.string(),
        status: z.string(),
        startedAt: z.string(),
        completedAt: z.string().optional(),
        output: z.record(z.string(), z.any()).optional(),
        error: z.object({
          message: z.string(),
          code: z.string().optional(),
        }).optional(),
      })),
      compensations: z.array(z.object({
        stepName: z.string(),
        compensationStep: z.string(),
        executed: z.boolean(),
        executedAt: z.string().optional(),
        result: z.enum(['success', 'failed']).optional(),
      })),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
  flows: ['order-workflow'],
}

export const handler: Handlers['GetWorkflow'] = async (req, ctx) => {
  const workflowId = req.pathParams.id

  ctx.logger.info('[API] Getting workflow', { workflowId })

  const history = await workflowPersistence.getWorkflowHistory(ctx.state, workflowId)

  if (!history.workflow) {
    return {
      status: 404,
      body: { error: `Workflow not found: ${workflowId}` },
    }
  }

  // Sort steps by startedAt
  const sortedSteps = history.steps.sort((a, b) =>
    new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )

  return {
    status: 200,
    body: {
      workflow: {
        id: history.workflow.id,
        type: history.workflow.type,
        status: history.workflow.status,
        currentStep: history.workflow.currentStep,
        context: history.workflow.context,
        failedStep: history.workflow.failedStep,
        error: history.workflow.error,
        createdAt: history.workflow.createdAt,
        updatedAt: history.workflow.updatedAt,
      },
      steps: sortedSteps.map(s => ({
        stepName: s.stepName,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        output: s.output,
        error: s.error ? { message: s.error.message, code: s.error.code } : undefined,
      })),
      compensations: history.compensations.map(c => ({
        stepName: c.stepName,
        compensationStep: c.compensationStep,
        executed: c.executed,
        executedAt: c.executedAt,
        result: c.result,
      })),
    },
  }
}

