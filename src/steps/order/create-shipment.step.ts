/**
 * Order Step: CreateShipment
 *
 * Creates shipping label for an order.
 * Compensation: CancelShipment
 *
 * Rules:
 * - weight < 50: success
 * - weight >= 50: failure
 * - weight === 777: timeout
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { ENGINE_TOPICS } from '../../workflows/engine'
import { shipmentService } from '../../services/fake-externals'

// Infer handler context type
type HandlerContext = Parameters<Handlers['CreateShipment']>[1]

// ─────────────────────────────────────────────────────────────────────────────
// Config + Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHT = 1

const inputSchema = z.object({
  workflowId: z.string(),
  stepName: z.string(),
  context: z.record(z.string(), z.any()),
})

export const config: EventConfig = {
  type: 'event',
  name: 'CreateShipment',
  description: 'Creates shipping label for order',
  subscribes: [ORDER_TOPICS.CREATE_SHIPMENT],
  emits: [ENGINE_TOPICS.STEP_COMPLETED, ENGINE_TOPICS.STEP_FAILED],
  input: inputSchema as any,
  flows: ['order-workflow'],
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Schemas & Types
// ─────────────────────────────────────────────────────────────────────────────

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().min(1),
})

type Address = z.infer<typeof addressSchema>
type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

function validateAddress(raw: unknown): ValidationResult<Address> {
  if (raw == null) {
    return {
      ok: false,
      code: 'SHIPMENT_VALIDATION_FAILED',
      message: 'shippingAddress is required',
    }
  }

  const parsed = addressSchema.safeParse(raw)
  if (!parsed.success) {
    const uniqueFields = [...new Set(parsed.error.issues.map(i => i.path.join('.') || 'root'))]
    return {
      ok: false,
      code: 'SHIPMENT_VALIDATION_FAILED',
      message: `Invalid shippingAddress fields: [${uniqueFields.join(', ')}]`,
    }
  }

  return { ok: true, value: parsed.data }
}

function validateOrderId(raw: unknown): ValidationResult<string> {
  if (!raw || typeof raw !== 'string') {
    return {
      ok: false,
      code: 'SHIPMENT_VALIDATION_FAILED',
      message: 'orderId must be a non-empty string',
    }
  }
  return { ok: true, value: raw }
}

function getWeight(
  raw: unknown,
  logger: HandlerContext['logger'],
  workflowId: string
): number {
  if (raw === undefined) return DEFAULT_WEIGHT

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw
  }

  logger.warn('[Order] Invalid _testWeight, using default', {
    workflowId,
    raw,
    fallback: DEFAULT_WEIGHT,
  })

  return DEFAULT_WEIGHT
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Emit Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function emitStepFailed(
  ctx: HandlerContext,
  workflowId: string,
  stepName: string,
  message: string,
  code: string
) {
  await ctx.emit({
    topic: ENGINE_TOPICS.STEP_FAILED,
    data: {
      workflowId,
      stepName,
      error: { message, code },
    },
  })
}

async function emitStepCompleted(
  ctx: HandlerContext,
  workflowId: string,
  stepName: string,
  output: Record<string, unknown>
) {
  await ctx.emit({
    topic: ENGINE_TOPICS.STEP_COMPLETED,
    data: {
      workflowId,
      stepName,
      output,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler: Handlers['CreateShipment'] = async (input, ctx) => {
  const { workflowId, stepName, context } = input

  // Validate address
  const addressCheck = validateAddress(context.shippingAddress)
  if (!addressCheck.ok) {
    ctx.logger.warn('[Order] Address validation failed', {
      workflowId,
      raw: context.shippingAddress,
    })
    return emitStepFailed(ctx, workflowId, stepName, addressCheck.message, addressCheck.code)
  }

  // Validate orderId
  const orderIdCheck = validateOrderId(context.orderId)
  if (!orderIdCheck.ok) {
    ctx.logger.warn('[Order] OrderId validation failed', {
      workflowId,
      raw: context.orderId,
    })
    return emitStepFailed(ctx, workflowId, stepName, orderIdCheck.message, orderIdCheck.code)
  }

  const address = addressCheck.value
  const orderId = orderIdCheck.value
  const weight = getWeight(context._testWeight, ctx.logger, workflowId)

  ctx.logger.info('[Order] Creating shipment', {
    workflowId,
    city: address.city,
    weight,
  })

  // External service call
  let result: Awaited<ReturnType<typeof shipmentService.create>>
  try {
    result = await shipmentService.create({ orderId, address, weight })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    ctx.logger.error('[Order] Shipment service exception', { workflowId, error: message })
    return emitStepFailed(ctx, workflowId, stepName, message, 'SHIPMENT_SERVICE_FAILED')
  }

  // Handle service-level failure
  if (!result.success) {
    const message = result.error ?? 'Shipment creation failed'
    ctx.logger.warn('[Order] Shipment service returned failure', {
      workflowId,
      result,
    })
    return emitStepFailed(ctx, workflowId, stepName, message, 'SHIPMENT_SERVICE_FAILED')
  }

  // Missing tracking number (service bug or failure)
  if (!result.trackingNumber) {
    ctx.logger.error('[Order] Shipment succeeded but trackingNumber missing', {
      workflowId,
      result,
    })
    return emitStepFailed(
      ctx,
      workflowId,
      stepName,
      'Tracking number missing from shipment response',
      'SHIPMENT_MISSING_TRACKING'
    )
  }

  // Success
  ctx.logger.info('[Order] Shipment created', {
    workflowId,
    trackingNumber: result.trackingNumber,
  })

  return emitStepCompleted(ctx, workflowId, stepName, {
    trackingNumber: result.trackingNumber,
  })
}
