import { Component, type ErrorInfo, type PropsWithChildren } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryState { error?: Error }

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('MEME LOS render failure', error, info) }
  render() {
    if (this.state.error) return <main className="validation-screen"><section className="card validation-card"><AlertTriangle size={28} /><p className="eyebrow">Renderer isolated</p><h1>This view hit a recoverable error.</h1><p>{this.state.error.message}</p><button className="button" onClick={() => this.setState({ error: undefined })}>Try again</button></section></main>
    return this.props.children
  }
}
