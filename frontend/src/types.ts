export type WorkflowSummary = {
  id: string
  type: string
  status: string
  currentStep: string | null
  createdAt: string
  updatedAt: string
}

export type WorkflowStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING'
  | 'ACTIVE'
  | 'REVERSED'
  | 'PENDING'
  | string

export type WorkflowStats = {
  total: number
  completed: number
  failed: number
  running: number
}

export type StepExecution = {
  id?: string
  label?: string
  stepName: string
  status: string
  startedAt: string
  completedAt?: string
  output?: Record<string, unknown>
  error?: { message: string; code?: string }
}

export type CompensationRecord = {
  stepName: string
  compensationStep: string
  executed: boolean
  executedAt?: string
  result?: 'success' | 'failed'
}

export type WorkflowDetail = {
  workflow: {
    id: string
    type: string
    status: string
    currentStep: string | null
    context: Record<string, unknown>
    failedStep?: string
    error?: string
    createdAt: string
    updatedAt: string
  }
  steps: StepExecution[]
  compensations: CompensationRecord[]
}

export type OrderItem = { sku: string; name: string; quantity: number; price: number }

export type Toast = { type: 'success' | 'error'; msg: string } | null

export type WorkflowInstance = WorkflowDetail['workflow'] & {
  steps: StepExecution[]
  compensations: CompensationRecord[]
  price?: number
  sku?: string
  quantity?: number
  orderId?: string
  failureStep?: SagaStepId | 'NONE'
}

export type SagaStepId =
  | 'VALIDATE'
  | 'CHARGE'
  | 'RESERVE'
  | 'SHIP'
  | 'NOTIFY'
  | 'COMPLETE'
  | string

export type SagaStep = {
  id: SagaStepId
  label: string
  status: WorkflowStatus
  timestamp?: string
  error?: string
}


