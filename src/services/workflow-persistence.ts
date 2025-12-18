/**
 * FlowForge - Workflow Persistence Service
 * 
 * Uses Motia's state manager to persist workflow state.
 * All operations are idempotent and crash-safe.
 * 
 * Key guarantees:
 * - Step execution is idempotent (crash recovery safe)
 * - Compensations execute in reverse registration order (Saga pattern)
 * - State transitions are guarded against invalid operations
 */

import type {
  WorkflowInstance,
  WorkflowStatus,
  StepExecution,
  StepStatus,
  CompensationRecord,
} from '../workflows/types'
import { now } from '../workflows/types'

// ============================================================================
// STATE GROUP KEYS
// ============================================================================

const GROUPS = {
  WORKFLOWS: 'flowforge:workflows',
  STEPS: (workflowId: string) => `flowforge:steps:${workflowId}`,
  COMPENSATIONS: (workflowId: string) => `flowforge:compensations:${workflowId}`,
} as const

// ============================================================================
// STATE MANAGER TYPE (from Motia context)
// ============================================================================

interface StateManager {
  get<T>(groupId: string, key: string): Promise<T | null>
  set<T>(groupId: string, key: string, value: T): Promise<T>
  delete<T>(groupId: string, key: string): Promise<T | null>
  getGroup<T>(groupId: string): Promise<T[]>
  clear(groupId: string): Promise<void>
}

// ============================================================================
// VALID STATE TRANSITIONS
// ============================================================================

/** Statuses that allow step advancement */
const ADVANCEABLE_STATUSES: WorkflowStatus[] = ['running']

/** Statuses that indicate workflow has ended */
const TERMINAL_STATUSES: WorkflowStatus[] = ['completed', 'compensated', 'failed']

/** Step statuses that indicate step has reached a final state */
const TERMINAL_STEP_STATUSES: StepStatus[] = ['completed', 'failed', 'skipped', 'compensated']

/** Check if workflow can advance to next step */
function canAdvance(status: WorkflowStatus): boolean {
  return ADVANCEABLE_STATUSES.includes(status)
}

/** Check if workflow has ended */
function isTerminal(status: WorkflowStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Check if step has reached a terminal state (cannot be modified) */
function isStepTerminal(status: StepStatus): boolean {
  return TERMINAL_STEP_STATUSES.includes(status)
}

// ============================================================================
// WORKFLOW OPERATIONS
// ============================================================================

export const workflowPersistence = {
  // --------------------------------------------------------------------------
  // WORKFLOW INSTANCE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create a new workflow instance
   */
  async createWorkflow(
    state: StateManager,
    params: {
      id: string
      type: string
      initialStep: string
      context: Record<string, unknown>
    }
  ): Promise<WorkflowInstance> {
    const workflow: WorkflowInstance = {
      id: params.id,
      type: params.type,
      status: 'running',
      currentStep: params.initialStep,
      context: params.context,
      createdAt: now(),
      updatedAt: now(),
    }

    await state.set(GROUPS.WORKFLOWS, params.id, workflow)
    return workflow
  },

  /**
   * Get workflow instance by ID
   */
  async getWorkflow(
    state: StateManager,
    workflowId: string
  ): Promise<WorkflowInstance | null> {
    return state.get<WorkflowInstance>(GROUPS.WORKFLOWS, workflowId)
  },

  /**
   * List all workflows (for debugging/admin)
   */
  async listWorkflows(state: StateManager): Promise<WorkflowInstance[]> {
    return state.getGroup<WorkflowInstance>(GROUPS.WORKFLOWS)
  },

  /**
   * Update workflow status with defensive merging
   * 
   * FIX #4: Explicit field handling prevents accidental overrides
   * FIX #3: Clears currentStep when entering terminal status
   */
  async updateWorkflowStatus(
    state: StateManager,
    workflowId: string,
    status: WorkflowStatus,
    updates?: Partial<Pick<WorkflowInstance, 'currentStep' | 'context' | 'failedStep' | 'error'>>
  ): Promise<WorkflowInstance | null> {
    const workflow = await state.get<WorkflowInstance>(GROUPS.WORKFLOWS, workflowId)
    if (!workflow) return null

    // FIX #3: Clear currentStep on terminal status
    const shouldClearCurrentStep = isTerminal(status)

    // FIX #4: Explicit field handling - status is always applied last
    const updated: WorkflowInstance = {
      ...workflow,
      // Apply context updates if provided
      context: updates?.context 
        ? { ...workflow.context, ...updates.context }
        : workflow.context,
      // Apply optional fields only if explicitly provided
      ...(updates?.failedStep !== undefined && { failedStep: updates.failedStep }),
      ...(updates?.error !== undefined && { error: updates.error }),
      // currentStep: use provided value, or clear if terminal, or keep existing
      currentStep: updates?.currentStep !== undefined
        ? updates.currentStep
        : shouldClearCurrentStep
          ? null
          : workflow.currentStep,
      // Status is always applied (never overridable via updates)
      status,
      updatedAt: now(),
    }

    await state.set(GROUPS.WORKFLOWS, workflowId, updated)
    return updated
  },

  /**
   * Update workflow context (data carried between steps)
   * 
   * FIX #7: Guards against updating non-running workflows
   */
  async updateWorkflowContext(
    state: StateManager,
    workflowId: string,
    contextUpdates: Record<string, unknown>
  ): Promise<WorkflowInstance | null> {
    const workflow = await state.get<WorkflowInstance>(GROUPS.WORKFLOWS, workflowId)
    if (!workflow) return null

    // FIX #7: Guard - only update context on active workflows
    if (isTerminal(workflow.status)) {
      return null // Cannot update context on terminated workflow
    }

    const updated: WorkflowInstance = {
      ...workflow,
      context: { ...workflow.context, ...contextUpdates },
      updatedAt: now(),
    }

    await state.set(GROUPS.WORKFLOWS, workflowId, updated)
    return updated
  },

  /**
   * Advance workflow to next step
   * 
   * FIX #7: Guards against advancing non-running workflows
   */
  async advanceToStep(
    state: StateManager,
    workflowId: string,
    nextStep: string,
    contextUpdates?: Record<string, unknown>
  ): Promise<WorkflowInstance | null> {
    const workflow = await state.get<WorkflowInstance>(GROUPS.WORKFLOWS, workflowId)
    if (!workflow) return null

    // FIX #7: Guard - can only advance running workflows
    if (!canAdvance(workflow.status)) {
      return null // Cannot advance workflow in non-running state
    }

    const updated: WorkflowInstance = {
      ...workflow,
      currentStep: nextStep,
      context: contextUpdates 
        ? { ...workflow.context, ...contextUpdates }
        : workflow.context,
      updatedAt: now(),
    }

    await state.set(GROUPS.WORKFLOWS, workflowId, updated)
    return updated
  },

  // --------------------------------------------------------------------------
  // STEP EXECUTION OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Record step execution start (idempotent)
   * 
   * FIX #1: If step already exists, return existing record instead of overwriting.
   * This is critical for crash recovery - prevents re-running completed steps.
   */
  async recordStepStart(
    state: StateManager,
    params: {
      workflowId: string
      stepName: string
      input: Record<string, unknown>
      attempt?: number
    }
  ): Promise<{ execution: StepExecution; isNew: boolean }> {
    const groupId = GROUPS.STEPS(params.workflowId)
    
    // FIX #1: Check if step execution already exists
    const existing = await state.get<StepExecution>(groupId, params.stepName)
    if (existing) {
      // Return existing execution - idempotent behavior for crash recovery
      return { execution: existing, isNew: false }
    }

    // Create new execution only if none exists
    const execution: StepExecution = {
      workflowId: params.workflowId,
      stepName: params.stepName,
      status: 'running',
      input: params.input,
      startedAt: now(),
      attempt: params.attempt ?? 1,
    }

    await state.set(groupId, params.stepName, execution)
    return { execution, isNew: true }
  },

  /**
   * Record step completion
   * 
   * Idempotent: Returns existing execution if step is already in a terminal state.
   * This prevents overwriting a failed/compensated step with completion.
   */
  async recordStepComplete(
    state: StateManager,
    workflowId: string,
    stepName: string,
    output: Record<string, unknown>
  ): Promise<StepExecution | null> {
    const groupId = GROUPS.STEPS(workflowId)
    const execution = await state.get<StepExecution>(groupId, stepName)
    if (!execution) return null

    // Guard: Skip if step is already in any terminal state
    // This prevents overwriting failed/compensated steps with completion
    if (isStepTerminal(execution.status)) {
      return execution
    }

    const updated: StepExecution = {
      ...execution,
      status: 'completed',
      output,
      completedAt: now(),
    }

    await state.set(groupId, stepName, updated)
    return updated
  },

  /**
   * Record step failure
   * 
   * Idempotent: Returns existing execution if step is already in a terminal state.
   * This prevents overwriting a completed/compensated step with failure.
   */
  async recordStepFailure(
    state: StateManager,
    workflowId: string,
    stepName: string,
    error: { message: string; code?: string; stack?: string }
  ): Promise<StepExecution | null> {
    const groupId = GROUPS.STEPS(workflowId)
    const execution = await state.get<StepExecution>(groupId, stepName)
    if (!execution) return null

    // Guard: Skip if step is already in any terminal state
    // This prevents overwriting completed/compensated steps with failure
    if (isStepTerminal(execution.status)) {
      return execution
    }

    const updated: StepExecution = {
      ...execution,
      status: 'failed',
      error,
      completedAt: now(),
    }

    await state.set(groupId, stepName, updated)
    return updated
  },

  /**
   * Get all step executions for a workflow
   */
  async getStepExecutions(
    state: StateManager,
    workflowId: string
  ): Promise<StepExecution[]> {
    const groupId = GROUPS.STEPS(workflowId)
    return state.getGroup<StepExecution>(groupId)
  },

  /**
   * Get specific step execution
   */
  async getStepExecution(
    state: StateManager,
    workflowId: string,
    stepName: string
  ): Promise<StepExecution | null> {
    const groupId = GROUPS.STEPS(workflowId)
    return state.get<StepExecution>(groupId, stepName)
  },

  /**
   * Mark step as compensated
   * 
   * FIX #6: Records completedAt timestamp when marking compensated
   */
  async markStepCompensated(
    state: StateManager,
    workflowId: string,
    stepName: string
  ): Promise<StepExecution | null> {
    const groupId = GROUPS.STEPS(workflowId)
    const execution = await state.get<StepExecution>(groupId, stepName)
    if (!execution) return null

    // FIX #6: Set completedAt for proper timeline tracking
    const updated: StepExecution = {
      ...execution,
      status: 'compensated',
      completedAt: now(),
    }

    await state.set(groupId, stepName, updated)
    return updated
  },

  // --------------------------------------------------------------------------
  // COMPENSATION OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Register a compensation for a completed step
   * 
   * FIX #5: Records registeredAt timestamp for proper ordering
   */
  async registerCompensation(
    state: StateManager,
    params: {
      workflowId: string
      stepName: string
      compensationStep: string
    }
  ): Promise<CompensationRecord> {
    const groupId = GROUPS.COMPENSATIONS(params.workflowId)
    
    // Check if already registered (idempotent)
    const existing = await state.get<CompensationRecord>(groupId, params.stepName)
    if (existing) {
      return existing
    }

    // FIX #5: Include registeredAt for ordering
    const record: CompensationRecord = {
      workflowId: params.workflowId,
      stepName: params.stepName,
      compensationStep: params.compensationStep,
      registeredAt: now(),
      executed: false,
    }

    await state.set(groupId, params.stepName, record)
    return record
  },

  /**
   * Get all pending compensations in REVERSE order (Saga pattern)
   * 
   * FIX #2: Sorts compensations in reverse chronological order by registeredAt.
   * This ensures compensations run in the opposite order of step execution.
   */
  async getPendingCompensations(
    state: StateManager,
    workflowId: string
  ): Promise<CompensationRecord[]> {
    const groupId = GROUPS.COMPENSATIONS(workflowId)
    const all = await state.getGroup<CompensationRecord>(groupId)
    
    // FIX #2: Filter pending and sort in reverse registration order
    return all
      .filter(c => !c.executed)
      .sort((a, b) => {
        // Sort descending by registeredAt (most recent first = reverse order)
        return new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      })
  },

  /**
   * Mark compensation as executed
   */
  async markCompensationExecuted(
    state: StateManager,
    workflowId: string,
    stepName: string,
    result: 'success' | 'failed',
    error?: string
  ): Promise<CompensationRecord | null> {
    const groupId = GROUPS.COMPENSATIONS(workflowId)
    const record = await state.get<CompensationRecord>(groupId, stepName)
    if (!record) return null

    // Idempotent - skip if already executed
    if (record.executed) {
      return record
    }

    const updated: CompensationRecord = {
      ...record,
      executed: true,
      executedAt: now(),
      result,
      error,
    }

    await state.set(groupId, stepName, updated)
    return updated
  },

  /**
   * Get all compensation records for a workflow
   */
  async getCompensations(
    state: StateManager,
    workflowId: string
  ): Promise<CompensationRecord[]> {
    const groupId = GROUPS.COMPENSATIONS(workflowId)
    return state.getGroup<CompensationRecord>(groupId)
  },

  // --------------------------------------------------------------------------
  // FULL WORKFLOW HISTORY
  // --------------------------------------------------------------------------

  /**
   * Get complete workflow state with all executions and compensations
   */
  async getWorkflowHistory(
    state: StateManager,
    workflowId: string
  ): Promise<{
    workflow: WorkflowInstance | null
    steps: StepExecution[]
    compensations: CompensationRecord[]
  }> {
    const [workflow, steps, compensations] = await Promise.all([
      this.getWorkflow(state, workflowId),
      this.getStepExecutions(state, workflowId),
      this.getCompensations(state, workflowId),
    ])

    return { workflow, steps, compensations }
  },
}

export type WorkflowPersistence = typeof workflowPersistence
