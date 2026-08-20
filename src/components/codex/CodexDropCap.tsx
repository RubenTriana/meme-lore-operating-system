import { DROP_CAP_PATHS, type DropCapMotif } from './codexDropCapMotifs'

export function CodexDropCap({ letter, motif }: { letter: string; motif: DropCapMotif }) {
  return <span className={`codex-drop-cap drop-cap-${motif}`} data-motif={motif} aria-label={letter}>
    <svg viewBox="0 0 96 96" aria-hidden="true">
      {(DROP_CAP_PATHS[motif] ?? DROP_CAP_PATHS.seed).map((path, index) => <path key={index} d={path} />)}
    </svg>
    <span aria-hidden="true">{letter}</span>
  </span>
}
