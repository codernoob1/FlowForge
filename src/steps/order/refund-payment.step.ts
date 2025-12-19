/**
 * Compensation Step: RefundPayment
 * 
 * Refunds payment when order fails after ChargePayment.
 * 
 * Includes:
 * - Timeout protection (prevents hanging on unresponsive services)
 * - Retry logic with exponential backoff (handles transient failures)
 * - Idempotency protection (prevents duplicate refunds on replay)
 */

import { EventConfig, Handlers } from 'motia'
import { z } from 'zod'
import { ORDER_TOPICS } from '../../workflows/order-workflow'
import { COMPENSATION_TOPICS } from '../../workflows/compensator'
import { paymentService, notificationService } from '../../services/fake-externals'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  /** Timeout for external service calls (ms) */
  TIMEOUT_MS: 10000,
  /** Maximum retry attempts */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (ms) */
  BASE_DELAY_MS: 1000,
  /** Maximum delay between retries (ms) */
  MAX_DELAY_MS: 10000,
} as const

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Creates a timeout promise that rejects after specified ms
 */
function createTimeout<T>(ms: number, operation: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`TIMEOUT: ${operation} timed out after ${ms}ms`))
    }, ms)
  })
}

/**
 * Wraps a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([promise, createTimeout<T>(ms, operation)])
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable (transient)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Retry on timeouts, network errors, and 5xx-like errors
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('unavailable') ||
      message.includes('service_unavailable') ||
      message.includes('too_many_requests')
    )
  }
  return false
}

/**
 * Generate idempotency key for refund operation
 */
function generateIdempotencyKey(workflowId: string, transactionId: string): string {
  return `refund:${workflowId}:${transactionId}`
}

// ============================================================================
// SCHEMA
// ============================================================================

const inputSchema = z.object({
  workflowId: z.string(),
  originalStep: z.string(),
  compensationStep: z.string(),
  context: z.record(z.string(), z.any()),
  originalOutput: z.record(z.string(), z.any()),
})

// ============================================================================
// STEP CONFIG
// ============================================================================

export const config: EventConfig = {
  type: 'event',
  name: 'RefundPayment',
  description: 'Refunds payment (compensation for ChargePayment)',
  subscribes: [ORDER_TOPICS.REFUND_PAYMENT],
  emits: [COMPENSATION_TOPICS.COMPENSATION_COMPLETED],
  input: inputSchema as any,
  flows: ['order-workflow'],
}

// ============================================================================
// HANDLER
// ============================================================================

export const handler: Handlers['RefundPayment'] = async (input, ctx) => {
  const { workflowId, originalStep, context, originalOutput } = input

  // -------------------------------------------------------------------------
  // INPUT VALIDATION: Fail fast if required data is missing or invalid
  // -------------------------------------------------------------------------
  
  // Validate transactionId exists and is a non-empty string
  const rawTransactionId = originalOutput.transactionId
  if (
    rawTransactionId === undefined ||
    rawTransactionId === null ||
    typeof rawTransactionId !== 'string' ||
    rawTransactionId.trim() === ''
  ) {
    const errorMessage = `Invalid transactionId: expected non-empty string, got ${
      rawTransactionId === undefined ? 'undefined' :
      rawTransactionId === null ? 'null' :
      typeof rawTransactionId !== 'string' ? `${typeof rawTransactionId}` :
      'empty string'
    }`
    
    ctx.logger.error('[Compensation] Refund validation failed - missing transactionId', {
      workflowId,
      originalStep,
      rawTransactionId,
      error: errorMessage,
    })

    // Emit failure and exit - cannot attempt refund without transaction reference
    await ctx.emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
      data: {
        workflowId,
        stepName: originalStep,
        success: false,
        error: errorMessage,
      },
    })
    return
  }
  const transactionId = rawTransactionId.trim()

  // Validate amount: must be a finite number > 0
  const rawAmount = originalOutput.amountCharged ?? context.total
  const parsedAmount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount
  
  if (
    parsedAmount === undefined ||
    parsedAmount === null ||
    typeof parsedAmount !== 'number' ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0
  ) {
    const errorMessage = `Invalid refund amount: expected positive finite number, got ${
      parsedAmount === undefined ? 'undefined' :
      parsedAmount === null ? 'null' :
      typeof parsedAmount !== 'number' ? `${typeof parsedAmount} (${String(rawAmount)})` :
      !Number.isFinite(parsedAmount) ? `non-finite (${parsedAmount})` :
      `${parsedAmount} (must be > 0)`
    }`
    
    ctx.logger.error('[Compensation] Refund validation failed - invalid amount', {
      workflowId,
      transactionId,
      originalStep,
      rawAmountCharged: originalOutput.amountCharged,
      rawContextTotal: context.total,
      parsedAmount,
      error: errorMessage,
    })

    // Emit failure and exit - cannot refund zero or invalid amount
    await ctx.emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
      data: {
        workflowId,
        stepName: originalStep,
        success: false,
        error: errorMessage,
      },
    })
    return
  }
  const amount = parsedAmount

  const idempotencyKey = generateIdempotencyKey(workflowId, transactionId)

  ctx.logger.info('[Compensation] Starting refund', {
    workflowId,
    transactionId,
    amount,
    idempotencyKey,
  })

  // -------------------------------------------------------------------------
  // IDEMPOTENCY CHECK: Prevent duplicate refunds
  // -------------------------------------------------------------------------
  const existingRefund = await ctx.state.get<{ refundId: string; completedAt: string }>(
    'flowforge:refunds',
    idempotencyKey
  )

  if (existingRefund) {
    ctx.logger.info('[Compensation] Refund already processed (idempotent skip)', {
      workflowId,
      transactionId,
      existingRefundId: existingRefund.refundId,
      completedAt: existingRefund.completedAt,
    })

    // Already processed - emit success without re-processing
    await ctx.emit({
      topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
      data: {
        workflowId,
        stepName: originalStep,
        success: true,
      },
    })
    return
  }

  // -------------------------------------------------------------------------
  // RETRY LOOP with exponential backoff
  // -------------------------------------------------------------------------
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      ctx.logger.info('[Compensation] Refund attempt', {
        workflowId,
        attempt,
        maxRetries: CONFIG.MAX_RETRIES,
      })

      // Execute refund with timeout protection
      const result = await withTimeout(
        paymentService.refund({
          transactionId,
          amount,
          reason: 'Order workflow failed - automatic refund',
        }),
        CONFIG.TIMEOUT_MS,
        'paymentService.refund'
      )

      // -----------------------------------------------------------------------
      // SUCCESS: Record for idempotency and emit completion
      // -----------------------------------------------------------------------
      ctx.logger.info('[Compensation] Payment refunded', {
        workflowId,
        refundId: result.refundId,
        attempt,
      })

      // Store refund record for idempotency (prevent duplicate refunds on replay)
      await ctx.state.set('flowforge:refunds', idempotencyKey, {
        refundId: result.refundId,
        transactionId,
        amount,
        workflowId,
        completedAt: new Date().toISOString(),
      })

      // Notify user about refund (fire-and-forget, don't fail compensation)
      try {
        await withTimeout(
          notificationService.send({
            userId: context.userId as string,
            type: 'order_refunded',
            orderId: context.orderId as string,
            data: { refundId: result.refundId, amount },
          }),
          CONFIG.TIMEOUT_MS,
          'notificationService.send'
        )
      } catch (notifyError) {
        // Log but don't fail - notification is non-critical
        ctx.logger.warn('[Compensation] Refund notification failed (non-critical)', {
          workflowId,
          error: notifyError instanceof Error ? notifyError.message : 'Unknown',
        })
      }

      await ctx.emit({
        topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
        data: {
          workflowId,
          stepName: originalStep,
          success: true,
        },
      })

      return // Success - exit handler

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      ctx.logger.warn('[Compensation] Refund attempt failed', {
        workflowId,
        attempt,
        error: lastError.message,
        isRetryable: isRetryableError(lastError),
      })

      // Check if we should retry
      if (attempt < CONFIG.MAX_RETRIES && isRetryableError(lastError)) {
        const delay = calculateBackoff(attempt, CONFIG.BASE_DELAY_MS, CONFIG.MAX_DELAY_MS)
        ctx.logger.info('[Compensation] Retrying after backoff', {
          workflowId,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: Math.round(delay),
        })
        await sleep(delay)
        continue
      }

      // Non-retryable error or max retries reached - break out
      break
    }
  }

  // -------------------------------------------------------------------------
  // FAILURE: All retries exhausted
  // -------------------------------------------------------------------------
  const errorMessage = lastError?.message ?? 'Unknown error after retries'
  
  ctx.logger.error('[Compensation] Refund failed after all retries', {
    workflowId,
    transactionId,
    error: errorMessage,
    attempts: CONFIG.MAX_RETRIES,
  })

  // Compensation failures are logged but process continues
  await ctx.emit({
    topic: COMPENSATION_TOPICS.COMPENSATION_COMPLETED,
    data: {
      workflowId,
      stepName: originalStep,
      success: false,
      error: errorMessage,
    },
  })
}
