import { useMemo, useState } from 'react'
import { Field } from './Field'
import type { OrderItem } from '../types'

const defaultOrder = {
  orderId: 'ORD-' + Math.floor(Math.random() * 99999),
  userId: 'user-123',
  items: [{ sku: 'SKU-123', name: 'Wireless Headphones', quantity: 1, price: 129.0 }] as OrderItem[],
  shippingAddress: {
    street: '123 Main St',
    city: 'Metropolis',
    country: 'USA',
    postalCode: '10001',
  },
  _testAmount: undefined as number | undefined,
  _testQuantity: undefined as number | undefined,
  _testWeight: undefined as number | undefined,
}

export function StartWorkflowForm({
  onSubmit,
  loading,
}: {
  onSubmit: (input: typeof defaultOrder) => Promise<void>
  loading: boolean
}) {
  const [order, setOrder] = useState(defaultOrder)

  const advancedFields = useMemo(
    () => [
      { key: '_testAmount', label: 'Test amount (force payment fail when too high)' },
      { key: '_testQuantity', label: 'Test quantity (force inventory fail when too high)' },
      { key: '_testWeight', label: 'Test weight (force shipment fail when too heavy)' },
    ],
    []
  )

  const handleSubmit = async () => {
    await onSubmit(order)
    setOrder({
      ...defaultOrder,
      orderId: 'ORD-' + Math.floor(Math.random() * 99999),
    })
  }

  return (
    <div className="glass rounded-2xl p-6 border border-slate-700/60 gradient-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Start Order Workflow</h2>
          <p className="text-sm text-slate-300">
            Provide minimal order details. Use advanced knobs to simulate failures.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium disabled:opacity-60"
        >
          {loading ? 'Starting...' : 'Start Workflow'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Order ID"
              value={order.orderId}
              onChange={v => setOrder(o => ({ ...o, orderId: v }))}
            />
            <Field
              label="User ID"
              value={order.userId}
              onChange={v => setOrder(o => ({ ...o, userId: v }))}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Items</p>
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3"
              >
                <Field
                  label="SKU"
                  value={item.sku}
                  onChange={v =>
                    setOrder(o => {
                      const items = [...o.items]
                      items[idx] = { ...items[idx], sku: v }
                      return { ...o, items }
                    })
                  }
                />
                <Field
                  label="Name"
                  value={item.name}
                  onChange={v =>
                    setOrder(o => {
                      const items = [...o.items]
                      items[idx] = { ...items[idx], name: v }
                      return { ...o, items }
                    })
                  }
                />
                <Field
                  label="Qty"
                  type="number"
                  value={String(item.quantity)}
                  onChange={v =>
                    setOrder(o => {
                      const items = [...o.items]
                      items[idx] = { ...items[idx], quantity: Number(v) || 0 }
                      return { ...o, items }
                    })
                  }
                />
                <Field
                  label="Price"
                  type="number"
                  value={String(item.price)}
                  onChange={v =>
                    setOrder(o => {
                      const items = [...o.items]
                      items[idx] = { ...items[idx], price: Number(v) || 0 }
                      return { ...o, items }
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Street"
              value={order.shippingAddress.street}
              onChange={v =>
                setOrder(o => ({
                  ...o,
                  shippingAddress: { ...o.shippingAddress, street: v },
                }))
              }
            />
            <Field
              label="City"
              value={order.shippingAddress.city}
              onChange={v =>
                setOrder(o => ({
                  ...o,
                  shippingAddress: { ...o.shippingAddress, city: v },
                }))
              }
            />
            <Field
              label="Country"
              value={order.shippingAddress.country}
              onChange={v =>
                setOrder(o => ({
                  ...o,
                  shippingAddress: { ...o.shippingAddress, country: v },
                }))
              }
            />
            <Field
              label="Postal Code"
              value={order.shippingAddress.postalCode}
              onChange={v =>
                setOrder(o => ({
                  ...o,
                  shippingAddress: { ...o.shippingAddress, postalCode: v },
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-200 font-medium">Advanced (failure tests)</p>
            <div className="mt-3 space-y-2">
              {advancedFields.map(f => (
                <Field
                  key={f.key}
                  label={f.label}
                  type="number"
                  value={String(order[f.key as keyof typeof order] ?? '')}
                  onChange={v =>
                    setOrder(o => ({
                      ...o,
                      [f.key]: v === '' ? undefined : Number(v),
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-2 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Saga path</p>
            <p>1) Validate → 2) Charge (compensate: Refund) → 3) Reserve (Release) →</p>
            <p>4) Ship (Cancel) → 5) Notify → 6) Complete</p>
            <p className="text-slate-400">
              On failures, compensations run in reverse order to unwind side effects.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


