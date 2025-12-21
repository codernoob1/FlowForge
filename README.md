# FlowForge 🚀

**Durable Workflow Orchestration with Automatic Compensation**

FlowForge is a production-ready workflow engine built on [Motia](https://motia.dev) that solves distributed transaction problems using the **Saga Pattern**. It ensures data consistency across multiple services without traditional two-phase commit (2PC) transactions.

---

## 🎯 What Problem Does FlowForge Solve?

### The Real-World Challenge

Imagine you're building an **e-commerce order processing system**:

```
Customer places order → Charge payment → Reserve inventory → Create shipment → Notify user
```

**What happens when something fails?**

- ❌ **Payment succeeds** but **inventory is out of stock** → Customer charged, no product shipped
- ❌ **Inventory reserved** but **payment fails** → Stock locked, no revenue
- ❌ **Shipment created** but **notification service crashes** → Order stuck in limbo

Traditional approaches fail because:
- **Microservices** can't use distributed transactions (2PC is slow and doesn't scale)
- **Network partitions** cause partial failures
- **Service crashes** leave inconsistent state
- **Manual rollback** is error-prone and slow

### FlowForge's Solution

FlowForge implements the **Saga Pattern** with **automatic compensation**:

✅ **Each step defines a compensation** (undo operation)  
✅ **On failure, compensations run automatically** in reverse order  
✅ **State is persisted** - survives crashes and restarts  
✅ **Idempotent operations** - safe to retry  
✅ **Full observability** - see every step and compensation  

---

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowForge Engine                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Workflow   │  │   Step       │  │ Compensation │    │
│  │   Registry   │  │   Executor   │  │   Handler    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Motia Framework (Event-Driven)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   State      │  │   Event      │  │   API       │    │
│  │   Manager    │  │   Bus        │  │   Server    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services (Your Business Logic)         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Payment    │  │   Inventory  │  │   Shipping  │    │
│  │   Service    │  │   Service    │  │   Service   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Order Workflow Example

```
┌─────────────────────────────────────────────────────────────┐
│                    Order Workflow                            │
│                                                              │
│  1. ValidateOrder                                            │
│     └─► Validates order data (no side effects)              │
│                                                              │
│  2. ChargePayment ───┐                                       │
│     └─► Charges $100 │                                       │
│                      │                                       │
│  3. ReserveInventory │                                       │
│     └─► Locks SKU-123│                                       │
│                      │                                       │
│  4. CreateShipment  │                                       │
│     └─► Creates label│                                       │
│                      │                                       │
│  5. NotifyUser      │                                       │
│     └─► Sends email  │                                       │
│                      │                                       │
│  6. Complete        │                                       │
│     └─► Marks done   │                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │  If step 4 fails:                                  │   │
│  │  1. CancelShipment  (undo step 4)                  │   │
│  │  2. ReleaseInventory (undo step 3)                │   │
│  │  3. RefundPayment   (undo step 2)                 │   │
│  │  └─► All compensations run automatically          │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Workflow Definitions                                │  │
│  │  - OrderWorkflow                                     │  │
│  │  - PaymentWorkflow                                   │  │
│  │  - InventoryWorkflow                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step Handlers (Event Steps)                         │  │
│  │  - validate-order.step.ts                           │  │
│  │  - charge-payment.step.ts                           │  │
│  │  - reserve-inventory.step.ts                        │  │
│  │  - create-shipment.step.ts                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Compensation Handlers                               │  │
│  │  - refund-payment.step.ts                           │  │
│  │  - release-inventory.step.ts                         │  │
│  │  - cancel-shipment.step.ts                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Engine Layer                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Workflow Engine (engine.ts)                        │  │
│  │  - Start workflows                                   │  │
│  │  - Execute steps sequentially                        │  │
│  │  - Handle step completion/failure                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Compensator (compensator.ts)                       │  │
│  │  - Trigger compensations on failure                  │  │
│  │  - Execute in reverse order                          │  │
│  │  - Track compensation status                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Persistence Layer (workflow-persistence.ts)         │  │
│  │  - Store workflow state                              │  │
│  │  - Track step executions                            │  │
│  │  - Record compensations                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Motia Framework                           │
│                                                              │
│  - Event-driven execution                                   │
│  - State management (Redis/Memory)                         │
│  - Type-safe APIs                                           │
│  - Hot reload & Workbench UI                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 Real-World Use Cases

### 1. E-Commerce Order Processing

**Problem**: Process orders across payment, inventory, and shipping services.

**Solution**:
```typescript
// Define workflow with compensations
const OrderWorkflow = {
  steps: [
    { name: 'ValidateOrder' },
    { name: 'ChargePayment', compensation: 'RefundPayment' },
    { name: 'ReserveInventory', compensation: 'ReleaseInventory' },
    { name: 'CreateShipment', compensation: 'CancelShipment' },
    { name: 'NotifyUser' },
    { name: 'Complete' },
  ]
}
```

**What happens on failure**:
- If `CreateShipment` fails → `CancelShipment` runs → `ReleaseInventory` runs → `RefundPayment` runs
- Customer gets refunded, inventory unlocked, no partial state

### 2. Multi-Service Data Migration

**Problem**: Migrate user data across 3 services atomically.

**Solution**:
```typescript
const MigrationWorkflow = {
  steps: [
    { name: 'BackupOldData' },
    { name: 'MigrateToServiceA', compensation: 'RollbackServiceA' },
    { name: 'MigrateToServiceB', compensation: 'RollbackServiceB' },
    { name: 'MigrateToServiceC', compensation: 'RollbackServiceC' },
    { name: 'VerifyMigration' },
    { name: 'DeleteOldData' },
  ]
}
```

**Failure handling**: If ServiceB migration fails, ServiceA is automatically rolled back.

### 3. Financial Transaction Processing

**Problem**: Transfer money between accounts with audit trail.

**Solution**:
```typescript
const TransferWorkflow = {
  steps: [
    { name: 'ValidateAccounts' },
    { name: 'DebitSource', compensation: 'CreditSource' },
    { name: 'CreditDestination', compensation: 'DebitDestination' },
    { name: 'RecordAuditLog' },
    { name: 'SendNotifications' },
  ]
}
```

**Guarantee**: Money never disappears - if credit fails, debit is automatically reversed.

### 4. Multi-Step Approval Workflow

**Problem**: Approve document through multiple reviewers.

**Solution**:
```typescript
const ApprovalWorkflow = {
  steps: [
    { name: 'SubmitDocument' },
    { name: 'Reviewer1Approve', compensation: 'RevokeApproval1' },
    { name: 'Reviewer2Approve', compensation: 'RevokeApproval2' },
    { name: 'FinalApproval', compensation: 'RevokeFinalApproval' },
    { name: 'PublishDocument' },
  ]
}
```

**Failure handling**: If Reviewer2 rejects, Reviewer1's approval is automatically revoked.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ or 22+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd flowfordge

# Install dependencies
npm install

# Start development server
npm run dev
```

### Start the Workbench

Open [`http://localhost:3000`](http://localhost:3000) to access the Motia Workbench - a visual interface for:
- Viewing workflow executions
- Inspecting step states
- Monitoring compensations
- Debugging failures

### Start a Workflow

**Via API**:
```bash
curl -X POST http://localhost:3000/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OrderWorkflow",
    "input": {
      "orderId": "ORD-123",
      "userId": "user-456",
      "items": [{
        "sku": "PROD-789",
        "name": "Widget",
        "quantity": 2,
        "price": 49.99
      }],
      "shippingAddress": {
        "street": "123 Main St",
        "city": "San Francisco",
        "country": "USA",
        "postalCode": "94102"
      }
    }
  }'
```

**Via Frontend**:
1. Open the frontend at `http://localhost:5173`
2. Fill in the order form
3. Click "Launch Saga Workflow"
4. Watch the visualization as steps execute

---

## 📖 How It Works

### 1. Define a Workflow

```typescript
// src/workflows/order-workflow.ts
export const OrderWorkflowDefinition: WorkflowDefinition = {
  type: 'OrderWorkflow',
  steps: [
    { name: 'ValidateOrder' },
    { name: 'ChargePayment', compensation: 'RefundPayment' },
    { name: 'ReserveInventory', compensation: 'ReleaseInventory' },
    { name: 'CreateShipment', compensation: 'CancelShipment' },
    { name: 'NotifyUser' },
    { name: 'Complete' },
  ],
}
```

### 2. Create Step Handlers

```typescript
// src/steps/order/charge-payment.step.ts
export const config: EventConfig = {
  type: 'event',
  name: 'ChargePayment',
  subscribes: ['order.charge-payment'],
  emits: ['engine.step-completed', 'engine.step-failed'],
}

export const handler: Handlers['ChargePayment'] = async (input, ctx) => {
  const { workflowId, context } = input
  const amount = context.total as number

  try {
    // Call payment service
    const result = await paymentService.charge(amount)
    
    // Emit success
    await ctx.emit({
      topic: 'engine.step-completed',
      data: { workflowId, stepName: 'ChargePayment', output: result },
    })
  } catch (error) {
    // Emit failure - engine will trigger compensation
    await ctx.emit({
      topic: 'engine.step-failed',
      data: { workflowId, stepName: 'ChargePayment', error },
    })
  }
}
```

### 3. Create Compensation Handlers

```typescript
// src/steps/order/refund-payment.step.ts
export const config: EventConfig = {
  type: 'event',
  name: 'RefundPayment',
  subscribes: ['compensate.RefundPayment'],
  emits: ['engine.compensation-completed'],
}

export const handler: Handlers['RefundPayment'] = async (input, ctx) => {
  const { workflowId, context } = input
  const transactionId = context.transactionId as string

  // Refund the payment
  await paymentService.refund(transactionId)
  
  await ctx.emit({
    topic: 'engine.compensation-completed',
    data: { workflowId, stepName: 'RefundPayment' },
  })
}
```

### 4. The Engine Orchestrates Everything

- **Starts workflow** → Executes first step
- **Step completes** → Advances to next step
- **Step fails** → Triggers compensations in reverse order
- **State persisted** → Survives crashes and restarts
- **Idempotent** → Safe to retry

---

## 🔍 Key Features

### ✅ Durable Execution

- **State persistence** - Workflows survive server restarts
- **Crash recovery** - Automatically resumes from last successful step
- **Idempotent operations** - Safe to retry without side effects

### ✅ Automatic Compensation

- **Reverse order execution** - Compensations run in opposite order of steps
- **Guaranteed execution** - Compensations always run on failure
- **Full audit trail** - Track every compensation execution

### ✅ Observability

- **Visual workflow execution** - See steps execute in real-time
- **Step-by-step history** - Inspect every execution
- **Compensation tracking** - Monitor rollback operations
- **Error details** - Full error context for debugging

### ✅ Type Safety

- **TypeScript throughout** - Compile-time type checking
- **Schema validation** - Zod schemas for input/output validation
- **Auto-generated types** - Types generated from step configs

---

## 📁 Project Structure

```
flowfordge/
├── src/
│   ├── workflows/           # Workflow definitions
│   │   ├── order-workflow.ts    # Order workflow definition
│   │   ├── engine.ts            # Workflow execution engine
│   │   ├── compensator.ts      # Compensation handler
│   │   └── types.ts             # Type definitions
│   │
│   ├── steps/
│   │   ├── api/             # API endpoints
│   │   │   ├── start-workflow.step.ts
│   │   │   ├── list-workflows.step.ts
│   │   │   └── get-workflow.step.ts
│   │   │
│   │   ├── order/           # Order processing steps
│   │   │   ├── validate-order.step.ts
│   │   │   ├── charge-payment.step.ts
│   │   │   ├── reserve-inventory.step.ts
│   │   │   ├── create-shipment.step.ts
│   │   │   ├── notify-user.step.ts
│   │   │   └── complete.step.ts
│   │   │
│   │   └── order/           # Compensation steps
│   │       ├── refund-payment.step.ts
│   │       ├── release-inventory.step.ts
│   │       └── cancel-shipment.step.ts
│   │
│   └── services/            # Business logic
│       ├── workflow-persistence.ts
│       ├── fake-externals.ts
│       └── pet-store.ts
│
├── frontend/                # React frontend for visualization
│   └── src/
│       ├── components/
│       │   ├── SagaVisualizer.tsx
│       │   └── WorkflowForm.tsx
│       └── services/
│           └── workflowSimulator.ts
│
├── motia.config.ts          # Motia configuration
└── package.json
```

---

## 🧪 Testing Failure Scenarios

FlowForge includes a **failure simulation** feature to test compensation logic:

### Via Frontend

1. Open the frontend form
2. Select a failure step (e.g., "Fail at CHARGE")
3. Launch workflow
4. Watch compensation execute automatically

### Via API

```bash
curl -X POST http://localhost:3000/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OrderWorkflow",
    "input": {
      "orderId": "ORD-TEST",
      "items": [{"sku": "TEST", "quantity": 1, "price": 1000}],
      "shippingAddress": {...},
      "_testAmount": 1000  # Forces payment failure (>500)
    }
  }'
```

**Expected behavior**:
1. `ValidateOrder` ✅ completes
2. `ChargePayment` ❌ fails (amount > 500)
3. Engine triggers compensation:
   - `RefundPayment` runs (nothing to refund, but logged)
   - Workflow marked as `COMPENSATED`

---

## 🎓 Understanding the Saga Pattern

### Traditional ACID Transactions (Not Suitable for Microservices)

```
BEGIN TRANSACTION
  UPDATE Account SET balance = balance - 100 WHERE id = 1
  UPDATE Account SET balance = balance + 100 WHERE id = 2
COMMIT
```

**Problems**:
- Requires distributed locks
- Slow across network boundaries
- Doesn't scale
- Single point of failure

### Saga Pattern (FlowForge's Approach)

```
Step 1: Debit Account 1 → Success ✅
Step 2: Credit Account 2 → Failure ❌
Compensation: Credit Account 1 → Runs automatically ✅
```

**Benefits**:
- No distributed locks
- Fast and scalable
- Resilient to failures
- Each step is independent

### Compensation vs Rollback

**Traditional rollback**: Undo changes in database
**Saga compensation**: Execute business logic to reverse effects

Example:
- **Rollback**: `UPDATE Account SET balance = balance + 100`
- **Compensation**: `refundPayment(transactionId)` - may include:
  - Reversing transaction
  - Sending notification
  - Updating audit log
  - Triggering fraud check

---

## 🔧 Development

### Commands

```bash
# Start development server (with hot reload)
npm run dev

# Start production server
npm run start

# Generate TypeScript types
npm run generate-types

# Build for production
npm run build
```

### Adding a New Workflow

1. **Define workflow** in `src/workflows/`:
```typescript
export const MyWorkflowDefinition: WorkflowDefinition = {
  type: 'MyWorkflow',
  steps: [
    { name: 'Step1', compensation: 'UndoStep1' },
    { name: 'Step2', compensation: 'UndoStep2' },
  ],
}
```

2. **Create step handlers** in `src/steps/`:
```typescript
export const config: EventConfig = {
  type: 'event',
  name: 'Step1',
  subscribes: ['my-workflow.step1'],
  emits: ['engine.step-completed', 'engine.step-failed'],
}
```

3. **Register workflow** in `src/workflows/index.ts`

4. **Generate types**: `npm run generate-types`

---

## 📚 Learn More

- **[Motia Documentation](https://motia.dev/docs)** - Complete framework docs
- **[Saga Pattern](https://microservices.io/patterns/data/saga.html)** - Pattern explanation
- **[AGENTS.md](./AGENTS.md)** - AI development guide

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and code of conduct.

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

Built with [Motia](https://motia.dev) - a unified backend framework for modern applications.

---

**FlowForge** - Making distributed transactions simple, reliable, and observable. 🚀
