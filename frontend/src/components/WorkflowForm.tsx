import React, { useState } from 'react'
import type { SagaStepId } from '../types'
import { SAGA_STEPS_CONFIG } from '../constants'
import { Play, ShieldCheck } from 'lucide-react'

interface WorkflowFormProps {
  onStart: (data: any) => void
  isSubmitting: boolean
}

export const WorkflowForm: React.FC<WorkflowFormProps> = ({ onStart, isSubmitting }) => {
  const [formData, setFormData] = useState({
    sku: 'FLW-900',
    name: 'Industrial Valve X1',
    quantity: 2,
    price: 99.0, // Default price that keeps total < 500 for happy path
    address: '123 Tech Lane, Silicon Valley, CA',
    failureStep: 'NONE' as SagaStepId | 'NONE',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Map failureStep to backend's expected test override fields
    // Backend failure rules:
    // - Payment: amount >= 500 fails
    // - Inventory: quantity >= 10 fails  
    // - Shipment: weight >= 50 fails
    const getTestOverrides = (failureStep: string) => {
      switch (failureStep) {
        case 'CHARGE':
          return { _testAmount: 500 } // Triggers payment failure
        case 'RESERVE':
          return { _testQuantity: 10 } // Triggers inventory failure
        case 'SHIP':
          return { _testWeight: 50 } // Triggers shipment failure
        default:
          return {} // NONE, VALIDATE, NOTIFY, COMPLETE - no test overrides
      }
    }

    const testOverrides = getTestOverrides(formData.failureStep)

    // Normalize for API shape; passthrough fields are allowed
    const payload = {
      orderId: 'ORD-' + Math.floor(Math.random() * 99999),
      userId: 'user-123',
      items: [
        {
          sku: formData.sku,
          name: formData.name,
          quantity: formData.quantity,
          price: formData.price,
        },
      ],
      shippingAddress: {
        street: formData.address,
        city: 'Metropolis',
        country: 'USA',
        postalCode: '00000',
      },
      ...testOverrides, // Include the test overrides for failure simulation
    }
    onStart(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Product SKU
          </label>
          <input
            type="text"
            value={formData.sku}
            onChange={e => setFormData({ ...formData, sku: e.target.value })}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Quantity
          </label>
          <input
            type="number"
            value={formData.quantity}
            onChange={e =>
              setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
            }
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Unit Price ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.price}
            onChange={e =>
              setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
            }
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Total
          </label>
          <div className="w-full bg-zinc-900/30 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-blue-400 font-mono">
            ${(formData.price * formData.quantity).toFixed(2)}
            {formData.price * formData.quantity >= 500 && (
              <span className="text-amber-500 text-[10px] ml-2">⚠️ ≥$500 = payment fails</span>
            )}
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Shipping Address
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Failure Simulation (Saga Testing)
          </h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Intentionally trigger a failure at a specific step to observe the{' '}
          <b>Compensating Transaction</b> logic in action.
        </p>

        <div className="flex flex-wrap gap-2">
          {['NONE', ...SAGA_STEPS_CONFIG.map(s => s.id)].map(step => {
            // Only these steps can be failed via test overrides in the backend
            const canFail = ['CHARGE', 'RESERVE', 'SHIP'].includes(step)
            const isDisabled = step !== 'NONE' && !canFail
            
            return (
              <button
                key={step}
                type="button"
                disabled={isDisabled}
                onClick={() => setFormData({ ...formData, failureStep: step as any })}
                title={isDisabled ? 'This step cannot be failed via test values' : undefined}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all border ${
                  formData.failureStep === step
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : isDisabled
                      ? 'bg-zinc-900/30 border-zinc-800 text-zinc-700 cursor-not-allowed'
                      : 'bg-zinc-800/30 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {step === 'NONE' ? 'Happy Path' : `Fail at ${step}`}
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">
          💡 CHARGE, RESERVE, SHIP can be failed. VALIDATE requires invalid data; NOTIFY/COMPLETE always succeed.
        </p>
      </div>

      <button
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 group"
      >
        {isSubmitting ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Launch Saga Workflow</span>
          </>
        )}
      </button>
    </form>
  )
}

