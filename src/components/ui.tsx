import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/utils/ui'

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section className={cn('card', className)} {...props}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'amber' | 'green' | 'blue' | 'red' }>) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}

export function Button({ children, className, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={cn('button', className)} {...props}>{children}</button>
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const bounded = Math.min(100, Math.max(0, value))
  return <div className={cn('progress', className)} role="progressbar" aria-label={`${Math.round(bounded)}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bounded)}><span style={{ width: `${bounded}%` }} /></div>
}
