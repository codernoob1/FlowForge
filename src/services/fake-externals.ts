/**
 * FlowForge - Fake External Services
 * 
 * Deterministic simulations of external services for testing workflow durability.
 * These are NOT real integrations - they simulate success/failure based on input.
 * 
 * RULES:
 * - amount < 500  → success
 * - amount >= 500 → failure
 * - amount === 777 → timeout/crash simulation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentResult {
  success: boolean
  transactionId?: string
  error?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

export interface InventoryResult {
  success: boolean
  reservationId?: string
  error?: string
}

export interface ShipmentResult {
  success: boolean
  trackingNumber?: string
  error?: string
}

export interface NotificationResult {
  success: boolean
  notificationId?: string
  error?: string
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

async function simulateLatency(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// PAYMENT SERVICE
// ============================================================================

export const paymentService = {
  /**
   * Charge payment
   * 
   * Rules:
   * - amount < 500: success
   * - amount >= 500: failure (insufficient funds)
   * - amount === 777: throws error (simulates timeout)
   */
  async charge(params: {
    orderId: string
    amount: number
    currency?: string
  }): Promise<PaymentResult> {
    await simulateLatency()

    const { orderId, amount, currency = 'USD' } = params

    // Simulate timeout/crash
    if (amount === 777) {
      throw new Error('PAYMENT_TIMEOUT: Connection to payment gateway timed out')
    }

    // Simulate failure for high amounts
    if (amount >= 500) {
      return {
        success: false,
        error: `INSUFFICIENT_FUNDS: Cannot charge ${currency} ${amount} for order ${orderId}`,
      }
    }

    // Success
    return {
      success: true,
      transactionId: generateId('txn'),
    }
  },

  /**
   * Refund payment (compensation)
   * 
   * Always succeeds (compensations should be reliable)
   */
  async refund(params: {
    transactionId: string
    amount: number
    reason?: string
  }): Promise<RefundResult> {
    await simulateLatency()

    return {
      success: true,
      refundId: generateId('ref'),
    }
  },
}

// ============================================================================
// INVENTORY SERVICE
// ============================================================================

export const inventoryService = {
  /**
   * Reserve inventory
   * 
   * Rules:
   * - quantity < 10: success
   * - quantity >= 10: failure (out of stock)
   * - quantity === 777: throws error (simulates timeout)
   */
  async reserve(params: {
    orderId: string
    items: Array<{ sku: string; quantity: number }>
  }): Promise<InventoryResult> {
    await simulateLatency()

    const { orderId, items } = params
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

    // Simulate timeout
    if (totalQuantity === 777) {
      throw new Error('INVENTORY_TIMEOUT: Inventory system unavailable')
    }

    // Simulate failure for large quantities
    if (totalQuantity >= 10) {
      return {
        success: false,
        error: `OUT_OF_STOCK: Cannot reserve ${totalQuantity} items for order ${orderId}`,
      }
    }

    // Success
    return {
      success: true,
      reservationId: generateId('res'),
    }
  },

  /**
   * Release inventory (compensation)
   * 
   * Always succeeds
   */
  async release(params: {
    reservationId: string
    reason?: string
  }): Promise<InventoryResult> {
    await simulateLatency()

    return {
      success: true,
    }
  },
}

// ============================================================================
// SHIPMENT SERVICE
// ============================================================================

export const shipmentService = {
  /**
   * Create shipment
   * 
   * Rules:
   * - weight < 50: success
   * - weight >= 50: failure (exceeds limit)
   * - weight === 777: throws error (simulates timeout)
   */
  async create(params: {
    orderId: string
    address: {
      street: string
      city: string
      country: string
      postalCode: string
    }
    weight?: number
  }): Promise<ShipmentResult> {
    await simulateLatency()

    const { orderId, weight = 1 } = params

    // Simulate timeout
    if (weight === 777) {
      throw new Error('SHIPMENT_TIMEOUT: Shipping provider unavailable')
    }

    // Simulate failure for heavy packages
    if (weight >= 50) {
      return {
        success: false,
        error: `WEIGHT_EXCEEDED: Package weight ${weight}kg exceeds limit for order ${orderId}`,
      }
    }

    // Success
    return {
      success: true,
      trackingNumber: generateId('TRK').toUpperCase(),
    }
  },

  /**
   * Cancel shipment (compensation)
   * 
   * Always succeeds
   */
  async cancel(params: {
    trackingNumber: string
    reason?: string
  }): Promise<ShipmentResult> {
    await simulateLatency()

    return {
      success: true,
    }
  },
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export const notificationService = {
  /**
   * Send notification
   * 
   * Always succeeds (fire and forget)
   */
  async send(params: {
    userId: string
    type: 'order_confirmed' | 'order_shipped' | 'order_failed' | 'order_refunded'
    orderId: string
    data?: Record<string, unknown>
  }): Promise<NotificationResult> {
    await simulateLatency(50)

    return {
      success: true,
      notificationId: generateId('ntf'),
    }
  },
}

// ============================================================================
// ORDER VALIDATION
// ============================================================================

export interface OrderValidationResult {
  valid: boolean
  errors?: string[]
}

export const orderValidator = {
  /**
   * Validate order data
   */
  validate(order: {
    orderId: string
    userId: string
    items: Array<{ sku: string; quantity: number; price: number }>
    shippingAddress: {
      street: string
      city: string
      country: string
      postalCode: string
    }
  }): OrderValidationResult {
    const errors: string[] = []

    if (!order.orderId) errors.push('Order ID is required')
    if (!order.userId) errors.push('User ID is required')
    if (!order.items || order.items.length === 0) errors.push('Order must have at least one item')
    if (!order.shippingAddress) errors.push('Shipping address is required')

    // Validate items
    order.items?.forEach((item, index) => {
      if (!item.sku) errors.push(`Item ${index + 1}: SKU is required`)
      if (item.quantity <= 0) errors.push(`Item ${index + 1}: Quantity must be positive`)
      if (item.price < 0) errors.push(`Item ${index + 1}: Price cannot be negative`)
    })

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  },

  /**
   * Calculate order total
   */
  calculateTotal(items: Array<{ quantity: number; price: number }>): number {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  },
}

