/**
 * FlowForge - Order Workflow Definition
 * 
 * A durable e-commerce order processing workflow with compensation support.
 * 
 * Steps:
 * 1. ValidateOrder - Validate order data
 * 2. ChargePayment - Charge customer (compensation: RefundPayment)
 * 3. ReserveInventory - Reserve stock (compensation: ReleaseInventory)
 * 4. CreateShipment - Create shipping label (compensation: CancelShipment)
 * 5. NotifyUser - Send confirmation
 * 6. Complete - Mark order complete
 */

import type { WorkflowDefinition } from './types'
import { workflowRegistry } from './registry'

// ============================================================================
// WORKFLOW TOPICS
// ============================================================================

export const ORDER_TOPICS = {
  // Main workflow steps
  VALIDATE_ORDER: 'order.validate',
  CHARGE_PAYMENT: 'order.charge-payment',
  RESERVE_INVENTORY: 'order.reserve-inventory',
  CREATE_SHIPMENT: 'order.create-shipment',
  NOTIFY_USER: 'order.notify-user',
  COMPLETE: 'order.complete',

  // Compensation steps
  REFUND_PAYMENT: 'compensate.RefundPayment',
  RELEASE_INVENTORY: 'compensate.ReleaseInventory',
  CANCEL_SHIPMENT: 'compensate.CancelShipment',
} as const

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export const OrderWorkflowDefinition: WorkflowDefinition = {
  type: 'OrderWorkflow',
  description: 'Process e-commerce order with payment, inventory, and shipping',
  steps: [
    {
      name: 'ValidateOrder',
      topic: ORDER_TOPICS.VALIDATE_ORDER,
      // No compensation - validation has no side effects
    },
    {
      name: 'ChargePayment',
      topic: ORDER_TOPICS.CHARGE_PAYMENT,
      compensation: 'RefundPayment',
    },
    {
      name: 'ReserveInventory',
      topic: ORDER_TOPICS.RESERVE_INVENTORY,
      compensation: 'ReleaseInventory',
    },
    {
      name: 'CreateShipment',
      topic: ORDER_TOPICS.CREATE_SHIPMENT,
      compensation: 'CancelShipment',
    },
    {
      name: 'NotifyUser',
      topic: ORDER_TOPICS.NOTIFY_USER,
      // No compensation - notification is fire-and-forget
    },
    {
      name: 'Complete',
      topic: ORDER_TOPICS.COMPLETE,
      // No compensation - final step
    },
  ],
}

// ============================================================================
// REGISTER WORKFLOW
// ============================================================================

/**
 * Register the OrderWorkflow with the registry
 * Call this at application startup
 */
export function registerOrderWorkflow(): void {
  workflowRegistry.register(OrderWorkflowDefinition)
}

// ============================================================================
// ORDER INPUT TYPE
// ============================================================================

export interface OrderInput {
  orderId: string
  userId: string
  items: Array<{
    sku: string
    name: string
    quantity: number
    price: number
  }>
  shippingAddress: {
    street: string
    city: string
    country: string
    postalCode: string
  }
  /** Optional: Override amount for testing failure scenarios */
  _testAmount?: number
  /** Optional: Override quantity for testing failure scenarios */
  _testQuantity?: number
  /** Optional: Override weight for testing failure scenarios */
  _testWeight?: number
}

