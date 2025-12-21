import { INITIAL_STEPS } from '../constants'
import type { WorkflowInstance, SagaStepId, WorkflowStatus } from '../types'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class WorkflowSimulator {
  private static generateId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase()
  }

  static create(data: any): WorkflowInstance {
    const now = new Date().toISOString()
    const failureStep = (data?.failureStep as SagaStepId | 'NONE' | undefined) ?? 'NONE'
    return {
      id: this.generateId(),
      orderId: data?.orderId ?? `ORD-${this.generateId()}`,
      userId: data?.userId ?? `USR-${Math.floor(Math.random() * 1000)}`,
      sku: data?.items?.[0]?.sku ?? data?.sku ?? 'SKU-123',
      quantity: data?.items?.[0]?.quantity ?? data?.quantity ?? 1,
      price: data?.items?.[0]?.price ?? data?.price ?? 100,
      address: data?.shippingAddress ?? data?.address,
      status: 'RUNNING',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
      steps: JSON.parse(JSON.stringify(INITIAL_STEPS)),
      compensations: [],
      context: data ?? {},
      type: 'OrderWorkflow',
      currentStep: null,
      failureStep,
    }
  }

  static async runStep(
    workflow: WorkflowInstance,
    stepIndex: number,
    onUpdate: (wf: WorkflowInstance) => void
  ): Promise<boolean> {
    const currentStep = workflow.steps[stepIndex]
    currentStep.status = 'ACTIVE'
    workflow.currentStep = currentStep.label
    workflow.updatedAt = new Date().toISOString()
    onUpdate({ ...workflow })

    await sleep(1200)

    const shouldFail =
      workflow.failureStep &&
      workflow.failureStep !== 'NONE' &&
      workflow.failureStep === (currentStep.id as SagaStepId)

    if (shouldFail) {
      currentStep.status = 'FAILED'
      currentStep.error = `Simulated error at ${currentStep.id}`
      workflow.status = 'FAILED'
      workflow.failedStep = currentStep.id
      workflow.error = currentStep.error
      workflow.updatedAt = new Date().toISOString()
      onUpdate({ ...workflow })
      await this.runCompensation(workflow, stepIndex, onUpdate)
      return false
    }

    currentStep.status = 'COMPLETED'
    currentStep.timestamp = new Date().toLocaleTimeString()
    workflow.updatedAt = new Date().toISOString()
    onUpdate({ ...workflow })
    return true
  }

  static async runCompensation(
    workflow: WorkflowInstance,
    failedStepIndex: number,
    onUpdate: (wf: WorkflowInstance) => void
  ) {
    workflow.status = 'COMPENSATING'
    workflow.updatedAt = new Date().toISOString()
    onUpdate({ ...workflow })

    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = workflow.steps[i]
      step.status = 'ACTIVE'
      onUpdate({ ...workflow })
      await sleep(900)
      step.status = 'REVERSED' as WorkflowStatus
      onUpdate({ ...workflow })
    }

    workflow.status = 'CANCELLED'
    workflow.updatedAt = new Date().toISOString()
    workflow.currentStep = null
    onUpdate({ ...workflow })
  }
}

