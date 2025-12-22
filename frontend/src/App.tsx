import './App.css'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  History,
  Settings,
  Terminal,
  Code2,
  Database,
  Cloud,
  ChevronRight,
  Search,
  Zap,
  Github,
  Play,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_BASE } from './api/client'
import { listWorkflows, startWorkflow, getWorkflow } from './api/workflows'
import { SagaVisualizer } from './components/SagaVisualizer'
import { WorkflowForm } from './components/WorkflowForm'
import { Badge } from './components/ui/Badge'
import { ToastBanner } from './components/Toast'
// Removed WorkflowSimulator - only real backend calls now
import type {
  Toast,
  WorkflowDetail,
  WorkflowInstance,
  WorkflowStats,
  WorkflowSummary,
} from './types'

// Removed simulator helper functions - only real backend calls now

function App() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [detail, setDetail] = useState<WorkflowDetail | null>(null)
  const [isSidebarOpen] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [loadingList, setLoadingList] = useState(false)
  // Removed mode toggle - always use real backend API

  const activeWorkflow: WorkflowInstance | null = useMemo(() => {
    if (!detail) return null
    const ctx = detail.workflow.context ?? {}
    return {
      ...detail.workflow,
      steps: detail.steps,
      compensations: detail.compensations,
      price: (ctx.total as number | undefined) ?? undefined,
      sku: Array.isArray(ctx.items) && ctx.items.length > 0 ? ctx.items[0].sku : undefined,
      quantity: Array.isArray(ctx.items) && ctx.items.length > 0 ? ctx.items[0].quantity : undefined,
      orderId: (ctx.orderId as string | undefined) ?? detail.workflow.id,
    }
  }, [detail])

  const stats: WorkflowStats = useMemo(() => {
    const norm = (s: string) => s.toLowerCase()
    return {
      total: workflows.length,
      completed: workflows.filter(w => norm(w.status) === 'completed').length,
      failed: workflows.filter(w => ['failed', 'cancelled'].includes(norm(w.status))).length,
      running: workflows.filter(w =>
        ['running', 'compensating'].includes(norm(w.status))
      ).length,
    }
  }, [workflows])

  const refreshList = async () => {
    setLoadingList(true)
    try {
      const data = await listWorkflows()
      setWorkflows(data.workflows)
      // Don't auto-select a workflow - let user click to view or use the form to create
    } catch (err) {
      setToast({ type: 'error', msg: (err as Error).message })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setLoadingList(false)
    }
  }

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const loadDetail = async (id: string) => {
    setActiveWorkflowId(id)
    try {
      const data = await getWorkflow(id)
      setDetail(data)
    } catch (err) {
      showToast('error', (err as Error).message)
    }
  }

  const handleStartWorkflow = async (input: unknown) => {
    console.log('[App] handleStartWorkflow called, input:', input)
    setIsProcessing(true)
    try {
      console.log('[App] Calling startWorkflow API...')
      const res = await startWorkflow(input)
      console.log('[App] startWorkflow response:', res)
      const newId = (res as any)?.workflowId
      showToast('success', 'Workflow started')
      await refreshList()
      if (newId) {
        await loadDetail(newId)
      }
    } catch (err) {
      console.error('[App] handleStartWorkflow error:', err)
      showToast('error', (err as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    refreshList()
  }, [])

  // Poll for workflow status updates when a workflow is active and running
  useEffect(() => {
    if (!activeWorkflowId || !detail) return

    const status = detail.workflow.status.toLowerCase()
    const isTerminal = ['completed', 'failed', 'compensated', 'cancelled'].includes(status)
    
    if (isTerminal) {
      console.log('[App] Workflow reached terminal state:', status)
      return
    }

    console.log('[App] Starting status polling for workflow:', activeWorkflowId)
    
    const pollInterval = setInterval(async () => {
      try {
        const updated = await getWorkflow(activeWorkflowId)
        setDetail(updated)
        
        // Also refresh the list to update sidebar
        const listData = await listWorkflows()
        setWorkflows(listData.workflows)
        
        const newStatus = updated.workflow.status.toLowerCase()
        if (['completed', 'failed', 'compensated', 'cancelled'].includes(newStatus)) {
          console.log('[App] Workflow finished with status:', newStatus)
          clearInterval(pollInterval)
        }
      } catch (err) {
        console.error('[App] Polling error:', err)
      }
    }, 1500) // Poll every 1.5 seconds

    return () => {
      console.log('[App] Stopping polling')
      clearInterval(pollInterval)
    }
  }, [activeWorkflowId, detail?.workflow.status])

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden selection:bg-blue-500/30">
      {/* Sidebar */}
      <aside
        className={`w-80 bg-[#0c0c0e] border-r border-zinc-800/50 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">FlowForge</h1>
          </div>
          <Settings className="w-5 h-5 text-zinc-500 hover:text-zinc-300 cursor-pointer" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-[1px] bg-zinc-800/50 border-b border-zinc-800/50">
          <div className="p-4 bg-[#0c0c0e]">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Completed</p>
            <p className="text-xl font-semibold text-emerald-400 mt-1">{stats.completed}</p>
          </div>
          <div className="p-4 bg-[#0c0c0e]">
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Failed</p>
            <p className="text-xl font-semibold text-rose-400 mt-1">{stats.failed}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                Workflow History
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshList}
                  disabled={loadingList}
                  className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50 transition-colors"
                >
                  {loadingList ? '...' : '↻'}
                </button>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                  {workflows.length}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {loadingList ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-zinc-500">Loading workflows...</p>
                </div>
              ) : workflows.length === 0 ? (
                <div className="py-12 text-center">
                  <Terminal className="w-8 h-8 text-zinc-700 mx-auto mb-3 opacity-20" />
                  <p className="text-xs text-zinc-600">No active workflows</p>
                </div>
              ) : (
                workflows.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => loadDetail(wf.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border ${
                      activeWorkflowId === wf.id
                        ? 'bg-blue-500/5 border-blue-500/30'
                        : 'border-transparent hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono text-blue-400">{wf.id}</span>
                      <Badge status={wf.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
                      <Zap className="w-3 h-3 text-zinc-600" />
                      {wf.currentStep ?? '—'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Github className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-xs font-medium">FlowForge Engine</p>
              <p className="text-[10px] text-zinc-500 font-mono">API {API_BASE || '/workflows (proxy)'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-8 bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-zinc-400 flex items-center gap-2">
              Workflows <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-100">
                {activeWorkflow ? activeWorkflow.id : 'New Saga Instance'}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {activeWorkflow && (
              <button
                onClick={() => {
                  setActiveWorkflowId(null)
                  setDetail(null)
                }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Play className="w-3 h-3" />
                New Workflow
              </button>
            )}
            <div className="relative group hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search traces..."
                className="bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500/50 w-64 transition-all"
              />
            </div>
            <div className="h-8 w-[1px] bg-zinc-800 mx-2" />
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Backend
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-8">
            <ToastBanner toast={toast} />

            {/* Active Workflow Visualization Section */}
            {activeWorkflow ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Left: Main Progress */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-bold">Execution Visualization</h3>
                        <p className="text-sm text-zinc-500">
                          Live orchestration of the Saga steps across distributed services
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge status={activeWorkflow.status} />
                        <p className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">
                          Instance {activeWorkflow.id}
                        </p>
                      </div>
                    </div>

                    <SagaVisualizer workflow={activeWorkflow} />

                    <div className="mt-8 pt-6 border-t border-zinc-800/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Order Reference
                        </p>
                        <p className="text-sm font-mono mt-1">{activeWorkflow.orderId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Started At
                        </p>
                        <p className="text-sm font-mono mt-1">
                          {new Date(activeWorkflow.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Total Value
                        </p>
                        <p className="text-sm font-mono mt-1 text-blue-400">
                          {activeWorkflow.price ? `$${activeWorkflow.price.toFixed(2)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          SKU
                        </p>
                        <p className="text-sm font-mono mt-1">
                          {activeWorkflow.sku ?? '—'} {activeWorkflow.quantity ? `(${activeWorkflow.quantity} units)` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Log Feed */}
                  <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-3">
                      <Terminal className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        Execution Events
                      </h3>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto font-mono text-xs">
                      {activeWorkflow.steps
                        .map(step => ({
                          ...step,
                          sort: new Date(step.startedAt).getTime(),
                        }))
                        .sort((a, b) => a.sort - b.sort)
                        .map((step, i) => (
                          <div key={`${step.stepName}-${i}`} className="flex gap-4 group">
                            <span className="text-zinc-600 shrink-0 w-20">
                              {step.startedAt ? new Date(step.startedAt).toLocaleTimeString() : '--:--'}
                            </span>
                            <span
                              className={`shrink-0 w-2 h-2 rounded-full mt-1 ${
                                step.status.toLowerCase() === 'completed'
                                  ? 'bg-emerald-500'
                                  : step.status.toLowerCase() === 'failed'
                                    ? 'bg-rose-500'
                                    : step.status.toLowerCase() === 'running'
                                      ? 'bg-blue-500'
                                      : 'bg-amber-500'
                              }`}
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-zinc-300">
                                {step.status} step:{' '}
                                <span className="text-blue-400">{step.stepName}</span>
                              </p>
                              {step.error && (
                                <p className="text-rose-400 mt-1 italic">
                                  ERR: {step.error.message}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      {activeWorkflow.status.toLowerCase() === 'completed' && (
                        <div className="text-emerald-500 font-bold border-t border-zinc-800/50 pt-2 mt-2">
                          SAGA_SUCCESS: Workflow transaction committed successfully.
                        </div>
                      )}
                      {activeWorkflow.status.toLowerCase() === 'compensated' && (
                        <div className="text-amber-500 font-bold border-t border-zinc-800/50 pt-2 mt-2">
                          SAGA_ROLLBACK: Workflow compensated successfully. Original state restored.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: State Viewer */}
                <div className="space-y-6">
                  <div className="bg-[#0c0c0e] border border-zinc-800/50 rounded-2xl p-6 shadow-xl h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Current State
                        </h3>
                      </div>
                      <button className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 hover:text-white transition-colors">
                        Copy JSON
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono text-blue-300/80 leading-relaxed overflow-x-auto">
                      {JSON.stringify(activeWorkflow, null, 2)}
                    </pre>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Empty State / Welcome Section */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-12">
                <div className="lg:col-span-2 space-y-12">
                  <div className="space-y-4">
                    <motion.h2
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent"
                    >
                      Durable Orchestration,
                      <br />
                      Simulated for Scale.
                    </motion.h2>
                    <p className="text-lg text-zinc-500 max-w-xl">
                      FlowForge allows you to build, test, and visualize distributed sagas with
                      automatic compensating actions. Launch a new workflow to see resilience in
                      action.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      {
                        icon: <Database />,
                        title: 'State Persistence',
                        desc: 'Durable state management for long-running processes.',
                      },
                      {
                        icon: <Cloud />,
                        title: 'Resilient Design',
                        desc: 'Automatic retries and recovery from infrastructure failures.',
                      },
                      {
                        icon: <History />,
                        title: 'Full Observability',
                        desc: 'Every step traced with granular event history and logs.',
                      },
                    ].map((feature, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl hover:border-zinc-700 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
                          {feature.icon}
                        </div>
                        <h4 className="font-bold text-zinc-200 mb-2">{feature.title}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">{feature.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Create Workflow Form Card */}
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#0c0c0e] border border-zinc-800 shadow-2xl rounded-2xl p-8 sticky top-8"
                  >
                    <div className="flex items-center gap-2 mb-6">
                      <Play className="w-4 h-4 text-blue-500 fill-blue-500" />
                      <h3 className="font-bold text-xl">New Workflow</h3>
                    </div>
                    <WorkflowForm onStart={handleStartWorkflow} isSubmitting={isProcessing} />
                  </motion.div>
                  {/* Decorative Gradient Background */}
                  <div className="absolute -inset-4 bg-blue-500/5 blur-2xl rounded-3xl -z-10" />
                </div>
              </div>
            )}

            {/* Global Error Banner placeholder */}
            <AnimatePresence>
              {false && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed bottom-8 right-8 max-w-md w-full bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex gap-4 shadow-2xl backdrop-blur-md"
                >
                  <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-400">Connection Interrupted</h4>
                    <p className="text-xs text-rose-300/70 mt-0.5 leading-relaxed">
                      Failed to fetch the latest traces from the orchestrator. Retrying in 5s...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Styles for mobile and interactions */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </div>
  )
}

export default App
