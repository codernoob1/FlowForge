/**
 * FlowForge - Durable Workflow Engine Types
 * 
 * Core persistence models for workflow durability.
 * These types represent the state that survives crashes and restarts.
 */

// ============================================================================
// WORKFLOW INSTANCE
// ============================================================================

export type WorkflowStatus = 
  | 'running'      // Actively executing steps
  | 'waiting'      // Paused, waiting for signal
  | 'failed'       // Step failed, compensation may be needed
  | 'completed'    // All steps finished successfully
  | 'compensating' // Rolling back via compensation steps
  | 'compensated'  // Compensation completed

export interface WorkflowInstance {
  /** Unique workflow identifier */
  id: string
  /** Workflow type (e.g., 'OrderWorkflow') */
  type: string
  /** Current execution status */
  status: WorkflowStatus
  /** Current step being executed (null when workflow ends) */
  currentStep: string | null
  /** Workflow context - carries data between steps */
  context: Record<string, unknown>
  /** Step that caused failure (if status is 'failed') */
  failedStep?: string
  /** Error message (if status is 'failed') */
  error?: string
  /** ISO timestamp when workflow started */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
}

// ============================================================================
// STEP EXECUTION
// ============================================================================

export type StepStatus = 
  | 'pending'     // Not yet executed
  | 'running'     // Currently executing
  | 'completed'   // Finished successfully
  | 'failed'      // Execution failed
  | 'skipped'     // Skipped (e.g., during compensation)
  | 'compensated' // Compensation executed for this step

export interface StepExecution {
  /** Workflow this step belongs to */
  workflowId: string
  /** Step name (e.g., 'ValidateOrder', 'ChargePayment') */
  stepName: string
  /** Current step status */
  status: StepStatus
  /** Input data for this step */
  input: Record<string, unknown>
  /** Output data from this step (if completed) */
  output?: Record<string, unknown>
  /** Error details (if failed) */
  error?: {
    message: string
    code?: string
    stack?: string
  }
  /** ISO timestamp when step started */
  startedAt: string
  /** ISO timestamp when step completed/failed */
  completedAt?: string
  /** Retry attempt number (starts at 1) */
  attempt: number
}

// ============================================================================
// COMPENSATION RECORD
// ============================================================================

export interface CompensationRecord {
  /** Workflow this compensation belongs to */
  workflowId: string
  /** Original step that needs compensation */
  stepName: string
  /** Compensation step to execute (e.g., 'RefundPayment' for 'ChargePayment') */
  compensationStep: string
  /** ISO timestamp when compensation was registered (for ordering) */
  registeredAt: string
  /** Whether compensation has been executed */
  executed: boolean
  /** ISO timestamp when compensation was executed */
  executedAt?: string
  /** Result of compensation execution */
  result?: 'success' | 'failed'
  /** Error if compensation failed */
  error?: string
}

// ============================================================================
// WORKFLOW DEFINITION (Registry)
// ============================================================================

export interface StepDefinition {
  /** Step name */
  name: string
  /** Compensation step name (for rollback) */
  compensation?: string
  /** Topic to emit to trigger this step */
  topic: string
}

export interface WorkflowDefinition {
  /** Workflow type identifier */
  type: string
  /** Ordered list of steps */
  steps: StepDefinition[]
  /** Description of the workflow */
  description?: string
}

// ============================================================================
// WORKFLOW EVENTS (Topics)
// ============================================================================

export interface WorkflowStartedEvent {
  workflowId: string
  workflowType: string
  input: Record<string, unknown>
}

export interface StepCompletedEvent {
  workflowId: string
  stepName: string
  output: Record<string, unknown>
}

export interface StepFailedEvent {
  workflowId: string
  stepName: string
  error: {
    message: string
    code?: string
  }
}

export interface WorkflowSignalEvent {
  workflowId: string
  signal: string
  payload?: Record<string, unknown>
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Generate a unique workflow ID */
export function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `wf_${timestamp}_${random}`
}

/** Get current ISO timestamp */
export function now(): string {
  return new Date().toISOString()
}

