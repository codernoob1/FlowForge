import { fetchJson } from './client'
import type { WorkflowSummary, WorkflowDetail } from '../types'

export function listWorkflows() {
  return fetchJson<{ workflows: WorkflowSummary[] }>('/workflows')
}

export function startWorkflow(input: unknown) {
  return fetchJson('/workflows/start', {
    method: 'POST',
    body: JSON.stringify({ type: 'OrderWorkflow', input }),
  })
}

export function getWorkflow(id: string) {
  return fetchJson<WorkflowDetail>(`/workflows/${id}`)
}

export function signalWorkflow(id: string, signal: string, payload: Record<string, unknown>) {
  return fetchJson(`/workflows/${id}/signal`, {
    method: 'POST',
    body: JSON.stringify({ signal, payload }),
  })
}


