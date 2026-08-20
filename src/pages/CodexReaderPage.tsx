import { ChevronLeft, ChevronRight, Eye, Layers3, Printer, ScrollText, Type } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CodexDropCap } from '@/components/codex/CodexDropCap'
import { DROP_CAP_MOTIFS } from '@/components/codex/codexDropCapMotifs'
import { SeedGlyph } from '@/components/codex/SeedGlyph'
import codexSource from '../../codice_voluntad_increada/compiled/CODICE_MASTER.md?raw'
import clayMemoirSource from '../../codice_voluntad_increada/compiled/CODICE_MEMORIAS_BAYESIANAS_CLAY_CANDIDATO.md?raw'
import artifactLayers from '../../codice_voluntad_increada/systems/artifact_layers.json'
import artifactTextOverrides from '../../codice_voluntad_increada/systems/artifact_text_overrides.json'
import symbolicApparatus from '../../codice_voluntad_increada/systems/mathematical_apparatus.json'
import '@/styles/codex-typography.css'
import './codex-reader.css'

type ReadingLayer = 'complete' | 'copy' | 'hands'
type FontScale = 'compact' | 'regular' | 'large'
type CodexEdition = 'artifact' | 'master' | 'clay-memoir'
type HandId = 'anterior' | 'custodio' | 'exegeta' | 'raspada' | 'imposible'

interface CodexBlock { text: string; isGloss: boolean; isDialogue: boolean }
interface CodexBook { roman: string; title: string; blocks: CodexBlock[] }
interface MarginNote { anchor: number; label: string; title: string; text: string; alternative: string; side: 'left' | 'right' }
interface ArtifactFragment {
  id: string; book: number; shelfmark: string; archetype: string; support: string; attributedAge: string; provenance: string
  hands: HandId[]; propheticVoice: string; damage: string[]; damageCause: string; reliability: string; contamination: string
}
interface SeedOccurrence { book: number; anchor: number; operator: 'bind' | 'invert' | 'suspend' | 'repeat' | 'witness' | 'branch' | 'seal'; lines: string[][]; note: string }
interface MathematicalEntry { id: string; book: number; mark: string; title: string; explanation: string; postulate: string }

const EDITIONS: Record<CodexEdition, { label: string; source: string; note: string }> = {
  artifact: { label: 'Reconstrucción material', source: codexSource, note: 'Facsímil candidato · capas históricas hipotéticas' },
  master: { label: 'Transcripción diplomática', source: codexSource, note: 'Texto maestro conservado sin atribución material' },
  'clay-memoir': { label: 'Escolio matemático atribuido a Clay', source: clayMemoirSource, note: 'Transcripción moderna apócrifa · separada del artefacto' },
}

const BOOK_NOTES: Record<number, MarginNote[]> = {
  0: [
    { anchor: 1, label: 'α', title: 'Sitio no repartido', text: 'La copia tardía dice vacío. Bajo ella parece sobrevivir un signo de apertura.', alternative: 'La ausencia podría no preceder al reparto: quizá sea lo que el reparto todavía no alcanzó.', side: 'left' },
    { anchor: 5, label: 'β', title: 'Hilo devuelto', text: 'Agua, tiempo y distancia comparten aquí una misma palabra perdida.', alternative: 'El Custodio confiesa que eligió “agua”; la lectura temporal permanece abierta.', side: 'right' },
  ],
  1: [
    { anchor: 0, label: 'α', title: 'La dirección cortada', text: 'El dibujo conserva cinco radios. El título doctrinal solo reconoce cuatro.', alternative: 'El exterior puede haber sido una dirección o una herida creada por el recorte.', side: 'left' },
    { anchor: 6, label: 'β', title: 'Cuerda de duelo', text: 'La zona tocada por agua fue repasada durante generaciones.', alternative: 'Rescate, frontera y espera continúan usando el mismo signo.', side: 'right' },
  ],
  2: [
    { anchor: 0, label: 'α', title: 'La vara', text: 'La costura separa “servir” de “mandar” y vuelve dudosa la continuidad.', alternative: 'Tal vez fueron dos relatos unidos para producir una doctrina sobre la medida.', side: 'left' },
    { anchor: 4, label: 'β', title: 'Cuenta sin mano', text: 'Una tinta gris aparece debajo del hilo y no sobre él.', alternative: 'La anomalía demuestra una intervención material, no la identidad de quien intervino.', side: 'right' },
  ],
  3: [
    { anchor: 0, label: 'α', title: 'Nombre raspado', text: 'La palabra anterior sigue visible con luz oblicua; no puede restituirse con certeza.', alternative: 'Donde el Exégeta escribió obediencia, otra mano creyó leer memoria.', side: 'left' },
    { anchor: 2, label: 'β', title: 'La venda', text: 'El margen cambia de dirección al llegar al pliegue.', alternative: 'La corrección pudo ser escrita mientras la hoja todavía envolvía otra cosa.', side: 'right' },
  ],
  4: [
    { anchor: 0, label: 'α', title: 'Doce o dieciséis', text: 'Solo ocho tiras conservan muescas; el total pertenece al montaje.', alternative: 'La corona de doce podría ser una reconstrucción doctrinal de un conjunto mayor.', side: 'left' },
    { anchor: 4, label: 'β', title: 'Custodia distribuida', text: 'Las perforaciones coinciden, pero las fibras no.', alternative: 'Alguien reunió piezas que quizá nunca habían compartido soporte.', side: 'right' },
  ],
  5: [
    { anchor: 0, label: 'α', title: 'Dos llaves', text: 'El reverso conserva un relato anterior que no pudo recuperarse.', alternative: 'La elección visible fue escrita sobre otra elección perdida.', side: 'left' },
    { anchor: 2, label: 'β', title: 'Sentencia tardía', text: 'La palabra “santo” usa la tinta del título, no la del relato.', alternative: 'La doctrina pudo convertir un fracaso misericordioso en ejemplo de obediencia.', side: 'right' },
  ],
  6: [
    { anchor: 0, label: 'α', title: 'La cuarta columna', text: 'El espacio central fue preparado, pero quedó vacío.', alternative: 'La ausencia puede ser pérdida, prohibición o parte activa del rito.', side: 'left' },
    { anchor: 4, label: 'β', title: 'Corrección móvil', text: 'Copias separadas sustituyen “voz” por “casa” en el mismo lugar.', alternative: 'La coincidencia no autoriza todavía a nombrar la Mano Imposible.', side: 'right' },
  ],
  7: [
    { anchor: 0, label: 'α', title: 'Traducción enfrentada', text: 'La columna derecha vuelve mandato lo que la izquierda conserva como temor.', alternative: 'La casa protectora y la casa carcelaria quizá procedan del mismo testimonio.', side: 'left' },
    { anchor: 4, label: 'β', title: 'Voz compuesta', text: 'El parche cubre un verbo; debajo parece decir recordar o devorar.', alternative: 'No puede decidirse si la voz imita cuidado o aprende a reclamarlo.', side: 'right' },
  ],
  8: [
    { anchor: 0, label: 'α', title: 'Moneda no vista', text: 'El círculo fue tocado hasta desgastar el centro.', alternative: 'El gesto repetido sugiere uso ritual, no una ilustración ornamental.', side: 'left' },
    { anchor: 6, label: 'β', title: 'Final quemado', text: 'Dos copias ofrecen palabras distintas después de “empieza”.', alternative: 'La pérdida preserva la enseñanza de convertirse en cierre definitivo.', side: 'right' },
  ],
}

const SEED_OCCURRENCES: SeedOccurrence[] = [
  { book: 0, anchor: 2, operator: 'suspend', lines: [['S01','S02','S10'],['S04','S12','S09'],['S13','S16'],['S06','S01','S15']], note: 'El Custodio escribió “sitio”; el signo central permanece sin concordar.' },
  { book: 4, anchor: 1, operator: 'bind', lines: [['S11','S09','S02'],['S12','S10','S11'],['S15','S16','S13']], note: 'Tres tiras repiten la relación; ninguna conserva el mismo último signo.' },
  { book: 6, anchor: 2, operator: 'branch', lines: [['S13','S03','S14'],['S02','S05'],['S09','S06','S02'],['S08','S04','S11'],['S16']], note: 'La quinta línea no admite lectura conocida.' },
  { book: 8, anchor: 3, operator: 'seal', lines: [['S12','S13','S09'],['S01','S03','S16']], note: 'El fuego interrumpe la segunda operación antes del sello.' },
]

const FRAGMENTS = artifactLayers.fragments as ArtifactFragment[]
const MATHEMATICAL_ENTRIES = symbolicApparatus.mathematics as MathematicalEntry[]
const HAND_NAMES: Record<HandId, string> = { anterior: 'Mano Anterior', custodio: 'Mano del Custodio', exegeta: 'Mano del Exégeta', raspada: 'Mano Raspada', imposible: 'Mano Imposible' }
const LACUNAE: Record<number, number> = { 0: 3, 1: 5, 3: 1, 4: 2, 7: 3, 8: 5 }
const DIAGRAM_ANCHORS: Record<number, number> = { 1: 0, 4: 0, 6: 1, 8: 0 }

function parseCodex(source: string): CodexBook[] {
  const firstBook = source.indexOf('## I.')
  if (firstBook < 0) return []
  return source.slice(firstBook).split(/\n(?=##\s+[IVX]+\.)/).map((section) => {
    const [heading, ...body] = section.trim().split('\n')
    const match = heading.match(/^##\s+([IVX]+)\.\s+(.+)$/)
    const blocks = body.join('\n').trim().split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, isGloss: /^\*[^*]+\*$/.test(text), isDialogue: text.startsWith('—') }))
    return { roman: match?.[1] ?? '', title: match?.[2] ?? heading, blocks }
  })
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, index) => part.startsWith('*') && part.endsWith('*')
    ? <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>
    : <Fragment key={`${part}-${index}`}>{part}</Fragment>)
}

function renderOpening(text: string, bookIndex: number) {
  const letter = text.charAt(0)
  const remainder = text.slice(1)
  const rubricMatch = remainder.match(/^(\S+(?:\s+\S+)?)([\s\S]*)$/)
  return <>
    <CodexDropCap letter={letter} motif={DROP_CAP_MOTIFS[bookIndex % DROP_CAP_MOTIFS.length]} />
    {rubricMatch
      ? <><span className="opening-rubric">{renderInline(rubricMatch[1])}</span><span>{renderInline(rubricMatch[2])}</span></>
      : renderInline(remainder)}
  </>
}

function artifactText(text: string) {
  return artifactTextOverrides.replacements.reduce((result, entry) => result.replace(entry.from, entry.to), text)
}

function SeedLanguageBlock({ occurrence }: { occurrence: SeedOccurrence }) {
  return <figure className={`seed-inscription operator-${occurrence.operator}`} aria-label="Fragmento indescifrado de Lengua Semilla">
    <div className="seed-lines">{occurrence.lines.map((line, row) => <div key={row} className="seed-line">{line.map((id, index) => <SeedGlyph key={`${id}-${index}`} id={id} />)}</div>)}</div>
    <figcaption>{occurrence.note}</figcaption>
  </figure>
}

function RitualDiagram({ bookIndex }: { bookIndex: number }) {
  if (bookIndex === 1) return <figure className="ritual-diagram diagram-directions"><svg viewBox="0 0 260 220" role="img" aria-label="Mapa ritual de cinco direcciones, una recortada">
    <circle cx="130" cy="110" r="24" /><circle cx="130" cy="110" r="58" className="faint" />
    <path d="M130 86V25M154 110h61M130 134v61M106 110H45M148 92l45-45" />
    <path className="erased" d="M177 63l30-30M182 75l35-35" /><circle cx="130" cy="21" r="5" /><circle cx="219" cy="110" r="5" /><circle cx="130" cy="199" r="5" /><circle cx="41" cy="110" r="5" /><circle className="missing" cx="200" cy="40" r="8" />
  </svg><figcaption>Rueda de los bordes. El quinto radio sobrevive donde fue cortado.</figcaption></figure>
  if (bookIndex === 4) return <figure className="ritual-diagram"><svg viewBox="0 0 260 220" role="img" aria-label="Corona ritual incompleta de doce nombres">
    <circle cx="130" cy="110" r="56" className="faint" /><circle cx="130" cy="110" r="18" className="missing" />
    {Array.from({ length: 12 }, (_, index) => { const a = (index * Math.PI * 2) / 12 - Math.PI / 2; const x = 130 + Math.cos(a) * 83; const y = 110 + Math.sin(a) * 83; return index > 7 ? <circle key={index} cx={x} cy={y} r="7" className="missing" /> : <g key={index}><line x1="130" y1="110" x2={x} y2={y} className="faint" /><circle cx={x} cy={y} r="7" /></g> })}
  </svg><figcaption>El número doce pertenece al montaje; cuatro lugares solo existen como restitución.</figcaption></figure>
  if (bookIndex === 6) return <figure className="ritual-diagram"><svg viewBox="0 0 260 220" role="img" aria-label="Tres puertas proféticas y una cuarta ausente">
    <path d="M28 182V60h50v122M105 182V40h50v142M182 182V70h50v112" /><path className="faint" d="M0 182h260M92 182V22h76v160" /><path className="erased" d="M91 28h78M91 34h78" />
    <circle cx="53" cy="117" r="7" /><circle cx="130" cy="111" r="7" /><circle cx="207" cy="122" r="7" />
  </svg><figcaption>Tres anuncios rodean un espacio preparado para otra voz.</figcaption></figure>
  return <figure className="ritual-diagram"><svg viewBox="0 0 260 220" role="img" aria-label="Sello ritual de una moneda no observada">
    <circle cx="130" cy="108" r="78" /><path d="M130 30v156" /><path className="faint" d="M130 48c-35 14-35 106 0 120M130 48c35 14 35 106 0 120" /><circle cx="130" cy="108" r="13" className="missing" /><path className="touched" d="M93 153c20 12 54 12 74 0" />
  </svg><figcaption>El centro fue desgastado por contacto; ninguna cara conserva nombre.</figcaption></figure>
}

function blockHand(block: CodexBlock, index: number, fragment: ArtifactFragment): HandId {
  if (block.isGloss) return 'raspada'
  if (index === fragment.damage.length + 1 && fragment.hands.includes('exegeta')) return 'exegeta'
  return 'custodio'
}

function visibleByLayer(hand: HandId, layer: ReadingLayer) {
  if (layer === 'complete') return true
  if (layer === 'copy') return hand === 'custodio' || hand === 'anterior'
  return hand === 'exegeta' || hand === 'raspada' || hand === 'imposible'
}

function romanFolio(index: number) { return ['III','VII','XIII','XVII','XXI','XXV','XXIX','XXXIII','XXXIX'][index] ?? String(index + 1) }

export function CodexReaderPage() {
  const [edition, setEdition] = useState<CodexEdition>('artifact')
  const [bookIndex, setBookIndex] = useState(0)
  const [layer, setLayer] = useState<ReadingLayer>('complete')
  const [fontScale, setFontScale] = useState<FontScale>('regular')
  const [selectedNote, setSelectedNote] = useState(0)
  const editionDetails = EDITIONS[edition]
  const books = useMemo(() => parseCodex(editionDetails.source), [editionDetails.source])
  const book = books[bookIndex]
  const fragment = FRAGMENTS[bookIndex]
  const notes = BOOK_NOTES[bookIndex] ?? []
  const activeNote = notes[selectedNote] ?? notes[0]
  const seedOccurrence = edition === 'artifact' ? SEED_OCCURRENCES.find((entry) => entry.book === bookIndex) : undefined
  const modernMath = edition === 'clay-memoir' ? MATHEMATICAL_ENTRIES.filter((entry) => entry.book === bookIndex) : []

  if (!book || !fragment) return null

  const goToBook = (next: number) => { setBookIndex((next + books.length) % books.length); setSelectedNote(0) }
  const changeEdition = (next: CodexEdition) => { setEdition(next); setBookIndex(0); setSelectedNote(0) }

  return <div className={`codex-archive edition-${edition}`}>
    <header className="codex-archive-header">
      <Link to="/" className="codex-return">← Archivo general</Link>
      <div className="codex-title-seal" aria-hidden="true"><SeedGlyph id="S15" /><SeedGlyph id="S02" /></div>
      <div><p>Reconstrucción incompleta · consulta restringida</p><h1>El Códice de la Voluntad Increada</h1><span>Ninguna mano conserva autoridad final</span></div>
    </header>

    <details className="codex-collation">
      <summary><ScrollText size={15} /><span>Mesa de cotejo</span><small>{fragment.shelfmark}</small></summary>
      <div className="codex-controls">
        <button onClick={() => goToBook(bookIndex - 1)} aria-label="Fragmento anterior"><ChevronLeft size={17} /></button>
        <label><span>Testimonio</span><select value={edition} onChange={(event) => changeEdition(event.target.value as CodexEdition)}>{(Object.entries(EDITIONS) as [CodexEdition, typeof EDITIONS[CodexEdition]][]).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
        <label><span>Fragmento</span><select value={bookIndex} onChange={(event) => goToBook(Number(event.target.value))}>{books.map((item, index) => <option key={item.roman} value={index}>{FRAGMENTS[index]?.id} · {item.title}</option>)}</select></label>
        <button onClick={() => goToBook(bookIndex + 1)} aria-label="Fragmento siguiente"><ChevronRight size={17} /></button>
        <div className="codex-layer-control" aria-label="Capas visibles"><Layers3 size={15} />{([['copy','Copia'],['complete','Todas las manos'],['hands','Intervenciones']] as const).map(([value, label]) => <button key={value} className={layer === value ? 'active' : ''} onClick={() => setLayer(value)} aria-pressed={layer === value}>{label}</button>)}</div>
        <div className="codex-type-control" aria-label="Tamaño del texto"><Type size={15} />{(['compact','regular','large'] as const).map((scale, index) => <button key={scale} className={fontScale === scale ? 'active' : ''} onClick={() => setFontScale(scale)} aria-label={`Tamaño ${scale}`}>{index === 0 ? 'A' : index === 1 ? 'A⁺' : 'A⁺⁺'}</button>)}</div>
        <Link className="codex-specimen-link" to="/codice/tipografia"><Type size={15} /> Sistema tipográfico</Link>
        <button className="codex-print" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
      </div>
    </details>

    <main className={`codex-artifact archetype-${fragment.archetype} font-${fontScale} layer-${layer}`} data-fragment={fragment.id}>
      <div className="artifact-fibers" aria-hidden="true" />
      <div className="artifact-stain" aria-hidden="true" />
      {fragment.archetype === 'sewn-leaf' && <div className="artifact-seam" aria-hidden="true" />}
      {fragment.archetype === 'folded-leaf' && <div className="artifact-fold" aria-hidden="true" />}
      {fragment.archetype === 'reconstructed-fragment' && <div className="artifact-mount" aria-hidden="true" />}
      <header className="artifact-running-head"><span>{fragment.shelfmark}</span><i aria-hidden="true">✣</i><span>{fragment.id}</span></header>

      <div className="artifact-page-grid">
        <aside className="artifact-margin margin-left" aria-label="Glosas del margen izquierdo">{notes.map((note, index) => note.side === 'left' && <button key={note.label} onClick={() => setSelectedNote(index)} className={selectedNote === index ? 'selected' : ''}><sup>{note.label}</sup><strong>{note.title}</strong><span>{note.text}</span></button>)}</aside>

        <article className="artifact-copy">
          <header className="artifact-book-heading"><small>{edition === 'artifact' ? 'Concordancia tardía de la Mano del Exégeta' : 'Transcripción editorial separada'}</small><span>LIBER {book.roman}</span><h2>{book.title}</h2><p>{edition === 'artifact' ? 'Rúbrica del copista · ausente en las capas anteriores' : editionDetails.note}</p></header>
          {DIAGRAM_ANCHORS[bookIndex] === 0 && edition === 'artifact' && <RitualDiagram bookIndex={bookIndex} />}
          <div className="artifact-columns">
            {book.blocks.map((block, originalIndex) => {
              const hand = blockHand(block, originalIndex, fragment)
              if (!visibleByLayer(hand, layer)) return null
              const anchors = notes.map((note, index) => ({ ...note, index })).filter((note) => note.anchor === originalIndex)
              const displayText = edition === 'artifact' ? artifactText(block.text) : block.text
              return <Fragment key={`${originalIndex}-${block.text.slice(0, 18)}`}>
                <p className={`hand-${hand} ${block.isDialogue ? 'is-dialogue' : ''} ${originalIndex === 0 ? 'is-opening' : ''}`} data-hand={HAND_NAMES[hand]}>
                  {originalIndex === 0 ? renderOpening(displayText, bookIndex) : renderInline(displayText)}
                  {anchors.map((note) => <button key={note.label} className="artifact-note-anchor" onClick={() => setSelectedNote(note.index)} aria-label={`Abrir glosa ${note.label}`}>{note.label}</button>)}
                </p>
                {seedOccurrence?.anchor === originalIndex && <SeedLanguageBlock occurrence={seedOccurrence} />}
                {DIAGRAM_ANCHORS[bookIndex] === originalIndex + 1 && edition === 'artifact' && <RitualDiagram bookIndex={bookIndex} />}
                {LACUNAE[bookIndex] === originalIndex && edition === 'artifact' && <div className="artifact-lacuna"><span>fibra perdida</span><i>la restitución moderna omite cinco a once signos</i></div>}
                {bookIndex === 3 && originalIndex === 0 && edition === 'artifact' && <div className="artifact-erasure"><del>obediencia</del><ins>¿memoria?</ins></div>}
                {bookIndex === 7 && originalIndex === 3 && edition === 'artifact' && <p className="hand-imposible impossible-line" data-hand="Mano Imposible">La casa recuerda una voz que todavía no ha entrado.</p>}
              </Fragment>
            })}
          </div>
        </article>

        <aside className="artifact-margin margin-right" aria-label="Glosas del margen derecho">{notes.map((note, index) => note.side === 'right' && <button key={note.label} onClick={() => setSelectedNote(index)} className={selectedNote === index ? 'selected' : ''}><sup>{note.label}</sup><strong>{note.title}</strong><span>{note.text}</span></button>)}</aside>
      </div>

      <footer className="artifact-footer"><span>{fragment.hands.map((hand) => HAND_NAMES[hand]).join(' · ')}</span><strong>{romanFolio(bookIndex)}</strong><span>{fragment.damage[0]}</span></footer>
    </main>

    <section className="codex-reading-desk" aria-label="Cédula editorial moderna">
      <div className="desk-heading"><Eye size={16} /><div><p>Cédula moderna · separada del artefacto</p><h2>{fragment.id} / {activeNote?.title}</h2></div><span>confianza {fragment.reliability}</span></div>
      <div className="desk-grid">
        <blockquote>{activeNote?.alternative}</blockquote>
        <dl><div><dt>Soporte</dt><dd>{fragment.support}</dd></div><div><dt>Procedencia</dt><dd>{fragment.provenance}</dd></div><div><dt>Daño causal</dt><dd>{fragment.damageCause}</dd></div><div><dt>Voz atribuida</dt><dd>{fragment.propheticVoice}</dd></div></dl>
      </div>
      {modernMath.length > 0 && <div className="modern-scholia"><p>Escolios matemáticos de atribución dudosa</p>{modernMath.map((entry) => <article key={entry.id}><span>{entry.mark}</span><div><strong>{entry.title}</strong><p>{entry.explanation}</p><em>{entry.postulate}</em></div></article>)}</div>}
    </section>
  </div>
}
