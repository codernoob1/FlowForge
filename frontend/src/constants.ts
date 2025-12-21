import type { SagaStep } from './types'

export const INITIAL_STEPS: SagaStep[] = [
  { id: 'VALIDATE', label: 'Validate Order', status: 'PENDING' },
  { id: 'CHARGE', label: 'Charge Payment', status: 'PENDING' },
  { id: 'RESERVE', label: 'Reserve Inventory', status: 'PENDING' },
  { id: 'SHIP', label: 'Create Shipment', status: 'PENDING' },
  { id: 'NOTIFY', label: 'Notify User', status: 'PENDING' },
  { id: 'COMPLETE', label: 'Complete', status: 'PENDING' },
]

export const SAGA_STEPS_CONFIG = INITIAL_STEPS.map(s => ({ id: s.id, label: s.label }))

