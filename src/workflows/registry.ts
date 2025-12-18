/**
 * FlowForge - Workflow Registry
 * 
 * Central registry for workflow definitions.
 * Workflows are registered at startup and looked up at runtime.
 */

import type { WorkflowDefinition, StepDefinition } from './types'

// ============================================================================
// WORKFLOW REGISTRY
// ============================================================================

const workflows = new Map<string, WorkflowDefinition>()

export const workflowRegistry = {
  /**
   * Register a workflow definition
   */
  register(definition: WorkflowDefinition): void {
    if (workflows.has(definition.type)) {
      throw new Error(`Workflow type "${definition.type}" is already registered`)
    }
    workflows.set(definition.type, definition)
  },

  /**
   * Get a workflow definition by type
   */
  get(type: string): WorkflowDefinition | undefined {
    return workflows.get(type)
  },

  /**
   * Check if a workflow type exists
   */
  has(type: string): boolean {
    return workflows.has(type)
  },

  /**
   * Get all registered workflow types
   */
  listTypes(): string[] {
    return Array.from(workflows.keys())
  },

  /**
   * Get step definition by name within a workflow
   */
  getStep(workflowType: string, stepName: string): StepDefinition | undefined {
    const workflow = workflows.get(workflowType)
    if (!workflow) return undefined
    return workflow.steps.find(s => s.name === stepName)
  },

  /**
   * Get the first step of a workflow
   */
  getFirstStep(workflowType: string): StepDefinition | undefined {
    const workflow = workflows.get(workflowType)
    if (!workflow || workflow.steps.length === 0) return undefined
    return workflow.steps[0]
  },

  /**
   * Get the next step after a given step
   */
  getNextStep(workflowType: string, currentStepName: string): StepDefinition | undefined {
    const workflow = workflows.get(workflowType)
    if (!workflow) return undefined

    const currentIndex = workflow.steps.findIndex(s => s.name === currentStepName)
    if (currentIndex === -1 || currentIndex === workflow.steps.length - 1) {
      return undefined // No next step
    }

    return workflow.steps[currentIndex + 1]
  },

  /**
   * Check if a step is the last step in the workflow
   */
  isLastStep(workflowType: string, stepName: string): boolean {
    const workflow = workflows.get(workflowType)
    if (!workflow || workflow.steps.length === 0) return false

    const lastStep = workflow.steps[workflow.steps.length - 1]
    return lastStep.name === stepName
  },

  /**
   * Get all steps up to and including a given step (for compensation)
   * Returns steps in reverse order (most recent first)
   */
  getCompensableSteps(workflowType: string, upToStep: string): StepDefinition[] {
    const workflow = workflows.get(workflowType)
    if (!workflow) return []

    const stepIndex = workflow.steps.findIndex(s => s.name === upToStep)
    if (stepIndex === -1) return []

    // Get steps from start to upToStep, filter those with compensation, reverse
    return workflow.steps
      .slice(0, stepIndex + 1)
      .filter(s => s.compensation !== undefined)
      .reverse()
  },

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    workflows.clear()
  },
}

export type WorkflowRegistry = typeof workflowRegistry

