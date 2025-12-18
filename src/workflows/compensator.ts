/**
 * FlowForge - Compensation Handler
 * 
 * Implements the Saga pattern for rollback.
 * When a step fails, compensations run in reverse order to undo completed steps.
 * 
 * Compensation guarantees:
 * - Executes in reverse registration order (last completed → first completed)
 * - Each compensation is executed exactly once (idempotent)
 * - Compensation failures are recorded but don't stop the process
 * - Workflow ends in 'compensated' state when done
 */

import { workflowPersistence } from '../services/workflow-persistence'
import { ENGINE_TOPICS } from './engine'

// ============================================================================
// TYPES
// ============================================================================

interface CompensatorContext {
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

/** Result of a compensation execution */
export interface CompensationResult {
  stepName: string
  success: boolean
  error?: string
}

// ============================================================================
// COMPENSATION TOPICS
// ============================================================================

export const COMPENSATION_TOPICS = {
  /** Execute a single compensation step */
  EXECUTE_COMPENSATION: 'flowforge.execute-compensation',
  /** Compensation step completed */
  COMPENSATION_COMPLETED: 'flowforge.compensation-completed',
  /** All compensations done */
  COMPENSATION_FINISHED: 'flowforge.compensation-finished',
} as const

// ============================================================================
// COMPENSATOR
// ============================================================================

export const compensator = {
  /**
   * Start compensation process for a failed workflow
   * 
   * Gets all pending compensations and executes them in reverse order.
   */
  async startCompensation(
    ctx: CompensatorContext,
    params: { workflowId: string }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId } = params

    // Get workflow
    const workflow = await workflowPersistence.getWorkflow(state, workflowId)
    if (!workflow) {
      logger.error('Workflow not found for compensation', { workflowId })
      return
    }

    // Only compensate failed workflows
    if (workflow.status !== 'failed') {
      logger.warn('Workflow is not in failed state, skipping compensation', {
        workflowId,
        status: workflow.status,
      })
      return
    }

    // Update status to compensating
    await workflowPersistence.updateWorkflowStatus(state, workflowId, 'compensating')

    logger.info('Starting compensation', { workflowId })

    // Get pending compensations (already sorted in reverse order)
    const pending = await workflowPersistence.getPendingCompensations(state, workflowId)

    if (pending.length === 0) {
      logger.info('No compensations to execute', { workflowId })
      await this.finishCompensation(ctx, { workflowId })
      return
    }

    logger.info('Found compensations to execute', {
      workflowId,
      count: pending.length,
      steps: pending.map(c => c.stepName),
    })

    // Execute first compensation (others will chain)
    const first = pending[0]
    await emit({
      topic: COMPENSATION_TOPICS.EXECUTE_COMPENSATION,
      data: {
        workflowId,
        stepName: first.stepName,
        compensationStep: first.compensationStep,
      },
    })
  },

  /**
   * Execute a single compensation step
   * 
   * Emits to the compensation step's topic for actual execution.
   */
  async executeCompensation(
    ctx: CompensatorContext,
    params: {
      workflowId: string
      stepName: string
      compensationStep: string
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, stepName, compensationStep } = params

    // Get workflow context for compensation
    const workflow = await workflowPersistence.getWorkflow(state, workflowId)
    if (!workflow) {
      logger.error('Workflow not found for compensation execution', { workflowId })
      return
    }

    // Get original step output (compensation may need it)
    const stepExecution = await workflowPersistence.getStepExecution(
      state,
      workflowId,
      stepName
    )

    logger.info('Executing compensation', {
      workflowId,
      stepName,
      compensationStep,
    })

    // Emit to the compensation step's topic
    // Convention: compensation topics are prefixed with 'compensate.'
    await emit({
      topic: `compensate.${compensationStep}`,
      data: {
        workflowId,
        originalStep: stepName,
        compensationStep,
        context: workflow.context,
        originalOutput: stepExecution?.output ?? {},
      },
    })
  },

  /**
   * Handle compensation step completion
   * 
   * Marks compensation as executed and continues to next compensation.
   */
  async handleCompensationCompleted(
    ctx: CompensatorContext,
    params: {
      workflowId: string
      stepName: string
      success: boolean
      error?: string
    }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId, stepName, success, error } = params

    // Mark compensation as executed
    await workflowPersistence.markCompensationExecuted(
      state,
      workflowId,
      stepName,
      success ? 'success' : 'failed',
      error
    )

    // Mark original step as compensated
    await workflowPersistence.markStepCompensated(state, workflowId, stepName)

    logger.info('Compensation executed', {
      workflowId,
      stepName,
      success,
      error,
    })

    // Check for more pending compensations
    const pending = await workflowPersistence.getPendingCompensations(state, workflowId)

    if (pending.length === 0) {
      // All compensations done
      await this.finishCompensation(ctx, { workflowId })
      return
    }

    // Execute next compensation
    const next = pending[0]
    await emit({
      topic: COMPENSATION_TOPICS.EXECUTE_COMPENSATION,
      data: {
        workflowId,
        stepName: next.stepName,
        compensationStep: next.compensationStep,
      },
    })
  },

  /**
   * Finish compensation process
   * 
   * Updates workflow status to 'compensated'.
   */
  async finishCompensation(
    ctx: CompensatorContext,
    params: { workflowId: string }
  ): Promise<void> {
    const { state, emit, logger } = ctx
    const { workflowId } = params

    // Update workflow to compensated
    await workflowPersistence.updateWorkflowStatus(state, workflowId, 'compensated')

    logger.info('Compensation finished', { workflowId })

    // Emit completion event
    await emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_FINISHED,
      data: { workflowId },
    })
  },
}

export type Compensator = typeof compensator

