/**
 * FlowForge - Workflow Engine
 * 
 * Core orchestration logic for durable workflow execution.
 * 
 * Key responsibilities:
 * - Start workflows and execute first step
 * - Handle step completion → advance to next step or complete workflow
 * - Handle step failure → trigger compensation
 * - Support WAIT/resume for human delays
 */

import type { WorkflowInstance, StepExecution, WorkflowStatus } from './types'
import { generateWorkflowId } from './types'
import { workflowRegistry } from './registry'
import { workflowPersistence } from '../services/workflow-persistence'

// ============================================================================
// TYPES
// ============================================================================

/** Motia context type (subset we need) */
interface EngineContext {
  state: StateManager
  emit: EmitFn
  logger: Logger
}

interface StateManager {
  get<T>(groupId: string, key: string): Promise<T | null>
  set<T>(groupId: string, key: string, value: T): Promise<T>
  delete<T>(groupId: string, key: string): Promise<T | null>
  getGroup<T>(groupId: string): Promise<T[]>
  clear(groupId: string): Promise<void>
}

interface EmitFn {
  (params: { topic: string; data: Record<string, unknown> }): Promise<void>
}

interface Logger {
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}

/** Result of starting a workflow */
export interface StartWorkflowResult {
  workflowId: string
  workflow: WorkflowInstance
}

/** Result of step execution */
export interface StepResult {
  success: boolean
  output?: Record<string, unknown>
  error?: {
    message: string
    code?: string
  }
  /** If true, workflow should wait for signal before continuing */
  wait?: boolean
}

// ============================================================================
// INTERNAL TOPICS (for workflow orchestration)
// ============================================================================

export const ENGINE_TOPICS = {
  /** Emitted when a workflow step needs to be executed */
  EXECUTE_STEP: 'flowforge.execute-step',
  /** Emitted when a step completes successfully */
  STEP_COMPLETED: 'flowforge.step-completed',
  /** Emitted when a step fails */
  STEP_FAILED: 'flowforge.step-failed',
  /** Emitted to trigger compensation */
  COMPENSATE: 'flowforge.compensate',
  /** Emitted when workflow completes */
  WORKFLOW_COMPLETED: 'flowforge.workflow-completed',
  /** Emitted when workflow fails */
  WORKFLOW_FAILED: 'flowforge.workflow-failed',
} as const

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

export const workflowEngine = {
  /**
   * Start a new workflow
   * 
   * Creates workflow instance and emits first step for execution.
   */
  async startWorkflow(
    ctx: EngineContext,
    params: {
      type: string
      input: Record<string, unknown>
      workflowId?: string // Optional: use provided ID or generate
    }
  ): Promise<StartWorkflowResult> {
    const { state, emit, logger } = ctx
    const { type, input, workflowId: providedId } = params

    // Validate workflow type exists
    const definition = workflowRegistry.get(type)
    if (!definition) {
      throw new Error(`Unknown workflow type: ${type}`)
    }

    const firstStep = workflowRegistry.getFirstStep(type)
    if (!firstStep) {
      throw new Error(`Workflow "${type}" has no steps defined`)
    }

    // Generate or use provided workflow ID
    const workflowId = providedId ?? generateWorkflowId()

    // Check if workflow already exists (idempotent start)
    const existing = await workflowPersistence.getWorkflow(state, workflowId)
    if (existing) {
      logger.info('Workflow already exists, returning existing', { workflowId })
      return { workflowId, workflow: existing }
    }

    // Create workflow instance
    const workflow = await workflowPersistence.createWorkflow(state, {
      id: workflowId,
      type,
      initialStep: firstStep.name,
      context: input,
    })

    logger.info('Workflow started', {
      workflowId,
      type,
      firstStep: firstStep.name,
    })

    // Emit first step for execution
    await emit({
      topic: ENGINE_TOPICS.EXECUTE_STEP,
      data: {
        workflowId,
        stepName: firstStep.name,
      },
    })

    return { workflowId, workflow }
  },

  /**
   * Execute a workflow step
   * 
   * Called by the step executor event handler.
   * Records execution and emits to the actual step topic.
   */
  async executeStep(
    ctx: EngineContext,
    params: {
      workflowId: string
      stepName: string
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, stepName } = params

    // Get workflow
    const workflow = await workflowPersistence.getWorkflow(state, workflowId)
    if (!workflow) {
      logger.error('Workflow not found', { workflowId })
      return
    }

    // Get step definition
    const stepDef = workflowRegistry.getStep(workflow.type, stepName)
    if (!stepDef) {
      logger.error('Step not found in workflow definition', {
        workflowId,
        workflowType: workflow.type,
        stepName,
      })
      return
    }

    // Record step start (idempotent)
    const { execution, isNew } = await workflowPersistence.recordStepStart(state, {
      workflowId,
      stepName,
      input: workflow.context,
    })

    // If step already executed, check its status
    if (!isNew) {
      logger.info('Step already exists, checking status', {
        workflowId,
        stepName,
        status: execution.status,
      })

      if (execution.status === 'completed') {
        // Step already completed, emit completion to continue
        await emit({
          topic: ENGINE_TOPICS.STEP_COMPLETED,
          data: {
            workflowId,
            stepName,
            output: execution.output ?? {},
          },
        })
        return
      }

      if (execution.status === 'failed') {
        // Step already failed
        await emit({
          topic: ENGINE_TOPICS.STEP_FAILED,
          data: {
            workflowId,
            stepName,
            error: execution.error ?? { message: 'Unknown error' },
          },
        })
        return
      }
      // If running, let it continue
    }

    logger.info('Executing step', { workflowId, stepName })

    // Emit to the actual step topic for business logic execution
    await emit({
      topic: stepDef.topic,
      data: {
        workflowId,
        stepName,
        context: workflow.context,
      },
    })
  },

  /**
   * Handle step completion
   * 
   * Records completion, registers compensation, advances to next step.
   */
  async handleStepCompleted(
    ctx: EngineContext,
    params: {
      workflowId: string
      stepName: string
      output: Record<string, unknown>
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, stepName, output } = params

    // Get workflow
    const workflow = await workflowPersistence.getWorkflow(state, workflowId)
    if (!workflow) {
      logger.error('Workflow not found on step completion', { workflowId })
      return
    }

    // Record step completion
    await workflowPersistence.recordStepComplete(state, workflowId, stepName, output)

    // Register compensation if step has one
    const stepDef = workflowRegistry.getStep(workflow.type, stepName)
    if (stepDef?.compensation) {
      await workflowPersistence.registerCompensation(state, {
        workflowId,
        stepName,
        compensationStep: stepDef.compensation,
      })
      logger.info('Compensation registered', {
        workflowId,
        stepName,
        compensation: stepDef.compensation,
      })
    }

    // Update workflow context with step output
    await workflowPersistence.updateWorkflowContext(state, workflowId, output)

    // Check if this is the last step
    if (workflowRegistry.isLastStep(workflow.type, stepName)) {
      // Workflow completed!
      await workflowPersistence.updateWorkflowStatus(state, workflowId, 'completed')
      
      logger.info('Workflow completed', { workflowId })
      
      await emit({
        topic: ENGINE_TOPICS.WORKFLOW_COMPLETED,
        data: { workflowId },
      })
      return
    }

    // Get next step
    const nextStep = workflowRegistry.getNextStep(workflow.type, stepName)
    if (!nextStep) {
      logger.error('No next step found', { workflowId, stepName })
      return
    }

    // Advance workflow to next step
    await workflowPersistence.advanceToStep(state, workflowId, nextStep.name)

    logger.info('Advancing to next step', {
      workflowId,
      fromStep: stepName,
      toStep: nextStep.name,
    })

    // Execute next step
    await emit({
      topic: ENGINE_TOPICS.EXECUTE_STEP,
      data: {
        workflowId,
        stepName: nextStep.name,
      },
    })
  },

  /**
   * Handle step failure
   * 
   * Records failure and triggers compensation.
   */
  async handleStepFailed(
    ctx: EngineContext,
    params: {
      workflowId: string
      stepName: string
      error: { message: string; code?: string }
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, stepName, error } = params

    logger.error('Step failed', { workflowId, stepName, error })

    // Record step failure
    await workflowPersistence.recordStepFailure(state, workflowId, stepName, error)

    // Update workflow status to failed
    await workflowPersistence.updateWorkflowStatus(state, workflowId, 'failed', {
      failedStep: stepName,
      error: error.message,
    })

    // Trigger compensation
    await emit({
      topic: ENGINE_TOPICS.COMPENSATE,
      data: { workflowId },
    })
  },

  /**
   * Pause workflow (for human delays)
   */
  async pauseWorkflow(
    ctx: EngineContext,
    params: {
      workflowId: string
      waitingFor?: string // Optional description of what we're waiting for
    }
  ): Promise<WorkflowInstance | null> {
    const { state, logger } = ctx
    const { workflowId, waitingFor } = params

    logger.info('Pausing workflow', { workflowId, waitingFor })

    return workflowPersistence.updateWorkflowStatus(state, workflowId, 'waiting', {
      context: waitingFor ? { _waitingFor: waitingFor } : undefined,
    })
  },

  /**
   * Resume a waiting workflow
   */
  async resumeWorkflow(
    ctx: EngineContext,
    params: {
      workflowId: string
      signal: string
      payload?: Record<string, unknown>
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, signal, payload } = params

    const workflow = await workflowPersistence.getWorkflow(state, workflowId)
    if (!workflow) {
      logger.error('Workflow not found for resume', { workflowId })
      return
    }

    if (workflow.status !== 'waiting') {
      logger.warn('Workflow is not waiting, cannot resume', {
        workflowId,
        status: workflow.status,
      })
      return
    }

    logger.info('Resuming workflow', { workflowId, signal })

    // Update workflow status back to running
    await workflowPersistence.updateWorkflowStatus(state, workflowId, 'running', {
      context: {
        ...workflow.context,
        _lastSignal: signal,
        ...payload,
      },
    })

    // Continue executing current step
    if (workflow.currentStep) {
      await emit({
        topic: ENGINE_TOPICS.EXECUTE_STEP,
        data: {
          workflowId,
          stepName: workflow.currentStep,
        },
      })
    }
  },
}

export type WorkflowEngine = typeof workflowEngine

