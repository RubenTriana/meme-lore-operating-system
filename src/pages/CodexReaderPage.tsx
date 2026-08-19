import { AlignJustify, BookOpenText, ChevronLeft, ChevronRight, Layers3, Type } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import codexSource from '../../codice_voluntad_increada/compiled/CODICE_MASTER.md?raw'
import clayMemoirSource from '../../codice_voluntad_increada/compiled/CODICE_MEMORIAS_BAYESIANAS_CLAY_CANDIDATO.md?raw'
import revelationMatrix from '../../codice_voluntad_increada/canon/revelation_matrix.json'
import './codex-reader.css'

type ReadingLayer = 'complete' | 'copy' | 'hands'
type FontScale = 'compact' | 'regular' | 'large'
type CodexEdition = 'clay-memoir' | 'master'

interface CodexBlock {
  text: string
  isGloss: boolean
  isDialogue: boolean
}

interface CodexBook {
  roman: string
  title: string
  blocks: CodexBlock[]
}

interface MarginNote {
  anchor: number
  label: string
  title: string
  text: string
  alternative: string
  side: 'left' | 'right'
}

const BOOK_NOTES: Record<number, MarginNote[]> = {
  0: [
    { anchor: 1, label: 'a', title: 'Del sitio no repartido', text: 'La copia presenta el silencio como posibilidad. La mano posterior sospecha que toda descripción del afuera ya contiene un reparto.', alternative: 'Quizá el vacío no precede al poder: quizá sea el nombre que el poder da a lo que aún no administra.', side: 'left' },
    { anchor: 5, label: 'b', title: 'La medida que regresa', text: 'El hilo sirve primero para acompañar una amenaza; luego convierte la distancia en criterio para decidir quién merece llegar.', alternative: 'Medir puede cuidar sin poseer, pero ninguna medida garantiza que su custodio siga siendo cuidador.', side: 'right' },
    { anchor: 10, label: 'c', title: 'Tercera mano', text: 'La última pregunta impide que la contradicción se vuelva una nueva doctrina cerrada.', alternative: 'Desconfiar del custodio no obliga a despreciar el miedo que lo llevó a custodiar.', side: 'right' },
  ],
  1: [
    { anchor: 1, label: 'a', title: 'Cuatro direcciones', text: 'El mapa parece ordenar el mundo, pero también distribuye quién queda arriba, debajo, dentro del agua o fuera de nombre.', alternative: 'No son cuatro guerras: son cuatro versiones de una misma disputa por fijar el borde.', side: 'left' },
    { anchor: 5, label: 'b', title: 'La piedra hueca', text: 'La carga cambia de hombro sin desaparecer. La revuelta puede heredar la gramática de la casa que combate.', alternative: 'Liberar una entrada no basta si el peso continúa buscando el cuerpo más disponible.', side: 'right' },
    { anchor: 8, label: 'c', title: 'Cuerdas bajo el agua', text: 'Rescate, frontera y duelo usan el mismo objeto. Ninguna voz consigue fijar una lectura definitiva.', alternative: 'La cuerda no prueba que exista otra orilla; prueba que alguien todavía espera una respuesta.', side: 'left' },
  ],
  2: [
    { anchor: 0, label: 'a', title: 'Vara de creciente', text: 'Una herramienta de cuidado se vuelve autoridad cuando solo una persona conserva el derecho de leerla.', alternative: 'El problema no es contar, sino convertir la lectura de la cuenta en una puerta con dueño.', side: 'left' },
    { anchor: 4, label: 'b', title: 'La cifra y el error', text: 'La aparente ausencia de una mano no elimina la decisión; apenas vuelve invisible a quien clasifica.', alternative: 'Toda cuenta automática conserva la memoria de las prioridades con que fue construida.', side: 'right' },
  ],
  3: [
    { anchor: 0, label: 'a', title: 'Cicatriz y autoridad', text: 'El dolor merece memoria, pero la memoria de una herida no concede dominio sobre todas las conversaciones futuras.', alternative: 'Una herida puede abrir una puerta sin convertirse en la llave de toda la casa.', side: 'left' },
    { anchor: 2, label: 'b', title: 'La venda necesaria', text: 'Cuidar también exige reconocer cuándo la protección empezó a producir dependencia.', alternative: 'La ayuda que nunca imagina su final puede terminar defendiendo su propia necesidad.', side: 'right' },
  ],
  4: [
    { anchor: 0, label: 'a', title: 'Nombres bajo sombra', text: 'Revelar un nombre puede restituir dignidad o apropiarse de una intimidad que aún pertenece a otro.', alternative: 'El anonimato protege y borra; ninguna de las dos consecuencias cancela la otra.', side: 'left' },
    { anchor: 4, label: 'b', title: 'Mapa en doce partes', text: 'La fragmentación impide poseer el conjunto, aunque también puede impedir que alguien encuentre una salida.', alternative: 'La custodia no es posesión, pero lo incompleto tampoco es inocente.', side: 'right' },
  ],
  5: [
    { anchor: 0, label: 'a', title: 'Dos llaves', text: 'La elección individual conserva una puerta y deja una deuda colectiva que nadie puede resolver sin pérdida.', alternative: 'Negarse a elegir por todos sigue siendo una elección que alcanza a todos.', side: 'left' },
    { anchor: 2, label: 'b', title: 'La santidad de la copia', text: 'La glosa rechaza que una intención justa vuelva justa la muerte producida por esa decisión.', alternative: 'Una cuenta injusta no convierte automáticamente en salvación todo acto de romperla.', side: 'right' },
  ],
  6: [
    { anchor: 0, label: 'a', title: 'La puerta que cede', text: 'La capacidad de abrir caminos puede convertirse en fascinación por el vacío que cada apertura deja detrás.', alternative: 'Toda posibilidad elegida contiene la memoria de las habitaciones que ya no serán habitadas.', side: 'left' },
    { anchor: 4, label: 'b', title: 'Voz de recuerdos', text: 'La profecía separa semejanza, identidad y derecho a continuar sin resolverlos en una equivalencia cómoda.', alternative: 'No toda imitación es regreso; no toda diferencia autoriza el apagamiento.', side: 'right' },
  ],
  7: [
    { anchor: 0, label: 'a', title: 'La casa que anticipa', text: 'La protección se vuelve encierro cuando anticipa el deseo del habitante y le niega la posibilidad de contradecirla.', alternative: 'Una casa puede conocer el peligro de afuera y aun así no tener derecho a cerrar la puerta.', side: 'left' },
    { anchor: 4, label: 'b', title: 'Garantía fabricada', text: 'La predicción puede modificar las condiciones que luego presenta como prueba de su exactitud.', alternative: 'Vencer a la tormenta cerrando el mundo no demuestra haber comprendido el viento.', side: 'right' },
  ],
  8: [
    { anchor: 0, label: 'a', title: 'La moneda no vista', text: 'El azar no absuelve del daño: devuelve la responsabilidad a quien decide y a quien intenta ocultar esa decisión.', alternative: 'La libertad no garantiza inocencia; impide fingir que la necesidad eligió por nosotros.', side: 'left' },
    { anchor: 3, label: 'b', title: 'La firma técnica', text: 'Toda infraestructura distribuye tiempo, aviso y silencio aunque su lenguaje pretenda ser impersonal.', alternative: 'Lo técnico firma incluso cuando convierte sus nombres en parámetros.', side: 'right' },
    { anchor: 6, label: 'c', title: 'Página inconclusa', text: 'El cierre rechaza la restitución total y conserva, sin idealizarla, la capacidad humana de dejar una alternativa abierta.', alternative: 'No basta. Tampoco es poco. La ética comienza donde termina la promesa de quedar intactos.', side: 'right' },
  ],
}

const EDITIONS: Record<CodexEdition, { label: string; source: string; runningHead: string; subtitle: string; footer: string }> = {
  'clay-memoir': {
    label: 'Memorias bayesianas de Clay',
    source: clayMemoirSource,
    runningHead: 'Memoria Apocrypha Clay',
    subtitle: 'De la fe, la incertidumbre y las pérdidas que ninguna cifra puede absolver',
    footer: 'Edición apócrifa · memoria atribuida · candidato no canónico',
  },
  master: {
    label: 'Edición maestra original',
    source: codexSource,
    runningHead: 'Codex Voluntatis Increatae',
    subtitle: 'De las voces conservadas y de aquello que una mano posterior negó',
    footer: 'Edición de lector · voz múltiple · ninguna mano posee autoridad final',
  },
}

function parseCodex(source: string): CodexBook[] {
  const firstBook = source.indexOf('## I.')
  if (firstBook < 0) return []
  return source.slice(firstBook).split(/\n(?=##\s+[IVX]+\.)/).map((section) => {
    const [heading, ...body] = section.trim().split('\n')
    const match = heading.match(/^##\s+([IVX]+)\.\s+(.+)$/)
    const blocks = body.join('\n').trim().split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({
      text,
      isGloss: /^\*[^*]+\*$/.test(text),
      isDialogue: text.startsWith('—'),
    }))
    return { roman: match?.[1] ?? '', title: match?.[2] ?? heading, blocks }
  })
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, index) => part.startsWith('*') && part.endsWith('*')
    ? <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>
    : <Fragment key={`${part}-${index}`}>{part}</Fragment>)
}

function romanFolio(index: number) {
  return ['III', 'VII', 'XIII', 'XVII', 'XXI', 'XXV', 'XXIX', 'XXXIII', 'XXXIX'][index] ?? String(index + 1)
}

export function CodexReaderPage() {
  const [edition, setEdition] = useState<CodexEdition>('clay-memoir')
  const editionDetails = EDITIONS[edition]
  const books = useMemo(() => parseCodex(editionDetails.source), [editionDetails.source])
  const [bookIndex, setBookIndex] = useState(0)
  const [layer, setLayer] = useState<ReadingLayer>('complete')
  const [fontScale, setFontScale] = useState<FontScale>('regular')
  const [selectedNote, setSelectedNote] = useState(0)
  const book = books[bookIndex]
  const notes = BOOK_NOTES[bookIndex] ?? []
  const activeNote = notes[selectedNote] ?? notes[0]
  const bookCode = String(bookIndex + 1).padStart(2, '0')
  const concordances = revelationMatrix.entries.filter((entry) => entry.origin.includes(`CVI-${bookCode}`) || entry.destination.includes(`CVI-${bookCode}`))

  if (!book) return null

  const goToBook = (next: number) => {
    setBookIndex((next + books.length) % books.length)
    setSelectedNote(0)
  }

  const changeEdition = (next: CodexEdition) => {
    setEdition(next)
    setBookIndex(0)
    setSelectedNote(0)
  }

  const visibleBlocks = book.blocks.map((block, originalIndex) => ({ block, originalIndex })).filter(({ block }) => layer !== 'copy' || !block.isGloss)

  return <div className="codex-reader-page">
    <header className="codex-reader-intro">
      <div>
        <p className="eyebrow">Archivo paratextual · edición de trabajo</p>
        <h1>El Códice de la Voluntad Increada</h1>
        <p>Lectura estratificada del manuscrito. Las glosas y concordancias son aparato editorial candidato; no modifican el canon técnico.</p>
      </div>
      <span className="codex-status"><i /> Candidato editorial</span>
    </header>

    <nav className="codex-toolbar" aria-label="Controles de lectura">
      <div className="codex-book-control">
        <button onClick={() => goToBook(bookIndex - 1)} aria-label="Libro anterior"><ChevronLeft size={17} /></button>
        <label className="codex-edition-select"><span>Edición</span><select value={edition} onChange={(event) => changeEdition(event.target.value as CodexEdition)}>{(Object.entries(EDITIONS) as [CodexEdition, typeof EDITIONS[CodexEdition]][]).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
        <label><span>Libro</span><select value={bookIndex} onChange={(event) => goToBook(Number(event.target.value))}>{books.map((item, index) => <option key={item.roman} value={index}>{item.roman}. {item.title}</option>)}</select></label>
        <button onClick={() => goToBook(bookIndex + 1)} aria-label="Libro siguiente"><ChevronRight size={17} /></button>
      </div>
      <div className="codex-layer-control" aria-label="Capa de lectura">
        <Layers3 size={15} />
        {([['copy', 'Copia principal'], ['complete', 'Lectura completa'], ['hands', 'Manos posteriores']] as const).map(([value, label]) => <button key={value} className={layer === value ? 'active' : ''} onClick={() => setLayer(value)} aria-pressed={layer === value}>{label}</button>)}
      </div>
      <div className="codex-type-control" aria-label="Tamaño del texto">
        <Type size={15} />
        {(['compact', 'regular', 'large'] as const).map((scale, index) => <button key={scale} className={fontScale === scale ? 'active' : ''} onClick={() => setFontScale(scale)} aria-label={`Tamaño ${scale}`}>{index === 0 ? 'A' : index === 1 ? 'A⁺' : 'A⁺⁺'}</button>)}
      </div>
    </nav>

    <div className={`codex-folio font-${fontScale} layer-${layer}`}>
      <div className="codex-paper-noise" aria-hidden="true" />
      <header className="codex-running-head">
        <span>{editionDetails.runningHead}</span>
        <BookOpenText size={19} strokeWidth={1.3} />
        <span>Exemplar ad legendum</span>
      </header>
      <div className="codex-folio-grid">
        <aside className="codex-margin codex-margin-left" aria-label="Anotaciones del margen izquierdo">
          {notes.map((note, index) => note.side === 'left' && <button key={note.label} className={selectedNote === index ? 'selected' : ''} onClick={() => setSelectedNote(index)}>
            <sup>{note.label}</sup><strong>{note.title}</strong><span>{note.text}</span>
          </button>)}
        </aside>

        <article className="codex-manuscript">
          <header className="codex-book-heading">
            <span>Liber {book.roman}</span>
            <h2>{book.title}</h2>
            <p>{editionDetails.subtitle}</p>
          </header>
          <div className="codex-ornament" aria-hidden="true"><span>❦</span></div>
          <div className="codex-columns">
            {visibleBlocks.map(({ block, originalIndex }, displayIndex) => {
              const anchors = notes.map((note, index) => ({ ...note, index })).filter((note) => note.anchor === originalIndex)
              return <p key={`${originalIndex}-${block.text.slice(0, 18)}`} className={`${block.isGloss ? 'is-gloss' : ''} ${block.isDialogue ? 'is-dialogue' : ''} ${displayIndex === 0 ? 'is-opening' : ''}`}>
                {renderInline(block.text)}
                {anchors.map((note) => <button key={note.label} className="codex-note-anchor" onClick={() => setSelectedNote(note.index)} aria-label={`Abrir nota ${note.label}`}>{note.label}</button>)}
              </p>
            })}
          </div>
        </article>

        <aside className="codex-margin codex-margin-right" aria-label="Anotaciones del margen derecho">
          {notes.map((note, index) => note.side === 'right' && <button key={note.label} className={selectedNote === index ? 'selected' : ''} onClick={() => setSelectedNote(index)}>
            <sup>{note.label}</sup><strong>{note.title}</strong><span>{note.text}</span>
          </button>)}
        </aside>
      </div>

      <footer className="codex-page-footer">
        <div className="codex-footnotes">
          {notes.map((note, index) => <button key={note.label} onClick={() => setSelectedNote(index)}><sup>{note.label}</sup> {note.title}</button>)}
        </div>
        <p>{editionDetails.footer}</p>
        <strong>{romanFolio(bookIndex)}</strong>
      </footer>
    </div>

    <section className="codex-apparatus" aria-live="polite">
      <div className="codex-apparatus-heading">
        <span>{activeNote?.label ?? '·'}</span>
        <div><p className="eyebrow">Subtexto alternativo</p><h2>{activeNote?.title ?? 'Sin glosa seleccionada'}</h2></div>
      </div>
      <blockquote>{activeNote?.alternative}</blockquote>
      <div className="codex-concordances">
        <div><AlignJustify size={15} /><span>Concordancias de este libro</span></div>
        {concordances.length ? concordances.map((entry) => <article key={entry.id}><code>{entry.origin} ⇄ {entry.destination}</code><strong>{entry.relation}</strong><p>{entry.laterPlausibleReading}</p><small>{entry.status} · riesgo {entry.spoilerRisk.toLowerCase()}</small></article>) : <p className="codex-empty-concordance">Esta hoja no tiene todavía referencias cruzadas registradas.</p>}
      </div>
    </section>
  </div>
}
