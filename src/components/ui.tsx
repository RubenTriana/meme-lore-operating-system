import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/ui'

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn('card', className)}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'amber' | 'green' | 'blue' | 'red' }>) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}

export function Button({ children, className, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={cn('button', className)} {...props}>{children}</button>
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return <div className={cn('progress', className)} aria-label={`${Math.round(value)}%`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}
