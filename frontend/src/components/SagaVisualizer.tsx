import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronRight, AlertCircle, RotateCcw, CheckCircle2 } from 'lucide-react'
import type { WorkflowInstance } from '../types'
import { SAGA_STEPS_CONFIG } from '../constants'

type Props = { workflow: WorkflowInstance }

const iconByStep: Record<string, React.ReactNode> = {
  VALIDATE: <ShieldIcon />,
  CHARGE: <ArrowRight className="w-6 h-6" />,
  RESERVE: <ArrowRight className="w-6 h-6" />,
  SHIP: <ArrowRight className="w-6 h-6" />,
  NOTIFY: <ArrowRight className="w-6 h-6" />,
  COMPLETE: <ArrowRight className="w-6 h-6" />,
}

export function SagaVisualizer({ workflow }: Props) {
  return (
    <div className="relative py-8 overflow-hidden">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
        {SAGA_STEPS_CONFIG.map((config, index) => {
          const step = findStep(workflow, config.id, config.label)
          const isLast = index === SAGA_STEPS_CONFIG.length - 1
          const status = step?.status ?? 'PENDING'
          const statusLower = status.toLowerCase()
          const isActive = status === 'ACTIVE'
          return (
            <React.Fragment key={config.id}>
              <div className="flex flex-col items-center group w-full md:w-auto">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -2 : 0,
                    borderColor:
                      status === 'COMPLETED'
                        ? '#10b981'
                        : status === 'FAILED'
                          ? '#f43f5e'
                          : status === 'REVERSED'
                            ? '#f59e0b'
                            : isActive
                              ? '#3b82f6'
                              : '#27272a',
                    boxShadow: isActive
                      ? '0 10px 30px rgba(59,130,246,0.25)'
                      : '0 8px 24px rgba(0,0,0,0.35)',
                  }}
                  className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm transition-all duration-500 relative overflow-hidden"
                >
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        key="pulse"
                        className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-blue-400/10 to-transparent"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.2, 0.6, 0.2] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    )}
                  </AnimatePresence>
                  <div
                    className={`transition-colors duration-500 ${
                      status === 'COMPLETED'
                        ? 'text-emerald-400'
                        : status === 'FAILED'
                          ? 'text-rose-400'
                          : status === 'REVERSED'
                            ? 'text-amber-400'
                            : status === 'ACTIVE'
                              ? 'text-blue-400'
                              : 'text-zinc-500'
                    }`}
                  >
                    {status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : status === 'FAILED' ? (
                      <AlertCircle className="w-6 h-6" />
                    ) : status === 'REVERSED' ? (
                      <RotateCcw className="w-6 h-6" />
                    ) : (
                      iconByStep[config.id] ?? <ArrowRight className="w-6 h-6" />
                    )}
                  </div>

                  {status === 'ACTIVE' && (
                    <motion.div
                      layoutId="active-ring"
                      className="absolute inset-0 rounded-2xl border-2 border-blue-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.2, 0.8, 0.2] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.div>

                <div className="mt-3 text-center">
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
                      status === 'ACTIVE' ? 'text-blue-400' : 'text-zinc-400'
                    }`}
                  >
                    {config.label}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                    {status || 'PENDING'}
                  </p>
                </div>
              </div>

              {!isLast && (
                <div className="hidden md:flex flex-1 items-center justify-center px-2">
                  <div className="h-[3px] w-full bg-zinc-900 border border-zinc-800/60 rounded-full overflow-hidden relative">
                    <AnimatePresence>
                      {statusLower === 'completed' && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="absolute inset-0 bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-emerald-500/60"
                        />
                      )}
                      {isActive && (
                        <motion.div
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/50 to-blue-400/0"
                        />
                      )}
                      {statusLower === 'failed' && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="absolute inset-0 bg-rose-500/50"
                        />
                      )}
                      {(statusLower === 'reversed' || workflow.status === 'COMPENSATING') && (
                        <motion.div
                          initial={{ x: '100%' }}
                          animate={{ x: 0 }}
                          className="absolute inset-0 bg-amber-500/50 flex items-center justify-center"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-500 animate-spin" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <ChevronRight className="absolute -right-1 -top-[5px] w-3 h-3 text-zinc-700" />
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-32 bg-blue-500/5 blur-[100px] pointer-events-none" />
    </div>
  )
}

function findStep(workflow: WorkflowInstance, id: string, label: string) {
  const steps = workflow.steps ?? []
  return (
    steps.find(s => s.id === id) ||
    steps.find(s => s.stepName === label) ||
    steps.find(s => s.stepName?.toLowerCase() === id.toLowerCase())
  )
}

function ShieldIcon() {
  return <ArrowRight className="w-6 h-6" />
}