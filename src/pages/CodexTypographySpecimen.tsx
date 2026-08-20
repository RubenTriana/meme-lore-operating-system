import { Link } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { CodexDropCap } from '@/components/codex/CodexDropCap'
import { SeedGlyph } from '@/components/codex/SeedGlyph'
import '@/styles/codex-typography.css'
import './codex-typography-specimen.css'

const SPANISH_REPERTOIRE = 'á é í ó ú · Á É Í Ó Ú · ñ Ñ · ü Ü · ¿? · ¡! · «comillas» · —raya— · …'

export function CodexTypographySpecimen() {
  return <main className="codex-type-specimen">
    <header className="type-specimen-header">
      <Link to="/codice"><ArrowLeft size={15} /> Volver al Códice</Link>
      <p>Instrumento interno de cotejo · no pertenece al artefacto</p>
      <h1>Sistema tipográfico del Códice</h1>
      <span>Dos familias históricas, cinco manos, una escritura no humana.</span>
    </header>

    <section className="type-specimen-paper" aria-labelledby="hands-title">
      <header><span>SPECIMEN · TABULA I</span><h2 id="hands-title">Las manos transmitidas</h2><p>{SPANISH_REPERTOIRE}</p></header>
      <div className="type-hand-grid">
        <article className="specimen-hand specimen-exegete"><small>Mano del Exégeta · EB Garamond</small><h3>LIBER IV · DE LA PUERTA</h3><p>La autoridad ordena, clasifica y nombra. <em>La ligadura sirve al ritmo</em>; la rúbrica, a la jerarquía.</p><b>0123456789 · ANNO MCCXLVII</b></article>
        <article className="specimen-hand specimen-custodian"><small>Mano del Custodio · Alegreya</small><p><CodexDropCap letter="N" motif="water" /><span className="opening-rubric">o llamaron vacío</span> al silencio. Lo llamaron sitio todavía no repartido, y conservaron la duda sin volverla ley.</p><blockquote>—¿Puede una medida acompañar sin poseer aquello que mide?</blockquote></article>
        <article className="specimen-hand specimen-scratched"><small>Mano Raspada · Alegreya itálica</small><p>No esperaron. Nadie espera cuando el agua sube. Esta línea fue añadida con otra presión y desde otro margen.</p></article>
        <article className="specimen-hand specimen-impossible"><small>Mano Imposible · EB Garamond regularizada</small><p>La casa recuerda una voz que todavía no ha entrado.</p><b>O O O · 0 0 0 · α β</b></article>
        <article className="specimen-hand specimen-modern"><small>Intervención moderna · Inter / DM Mono</small><p>Transcripción diplomática. Confianza media; restitución editorial entre corchetes.</p><code>CVI-F04 · fol. XVII · [5–11 signos]</code></article>
      </div>
    </section>

    <section className="type-feature-grid" aria-label="Pruebas OpenType y de repertorio">
      <article><small>Ligaduras dosificadas</small><p className="feature-ligatures">afligido · oficio · ficción · finalidad</p><code>liga · kern</code></article>
      <article><small>Versalitas auténticas</small><p className="feature-small-caps">Voluntad Increada · Liber Primus</p><code>smcp · c2sc</code></article>
      <article><small>Números antiguos</small><p className="feature-oldstyle">0123456789 · 1472 · folio XXIX</p><code>onum · pnum</code></article>
      <article><small>Cursivas reales</small><p className="feature-italic">¿Quién decidió que el miedo no merecía cuidado?</p><code>archivo itálico propio</code></article>
    </section>

    <section className="type-capitals" aria-labelledby="capitals-title">
      <header><small>Capitulares dibujadas · texto seleccionable</small><h2 id="capitals-title">Letra, mundo y memoria</h2></header>
      <div><p><CodexDropCap letter="A" motif="seed" />La semilla conserva la posibilidad que el suelo todavía no ha elegido.</p><p><CodexDropCap letter="P" motif="door" />Por la puerta entra también aquello que la casa juró mantener afuera.</p><p><CodexDropCap letter="Y" motif="star" />Y en el cielo quedó una herida con la forma exacta de una ruta.</p></div>
    </section>

    <section className="type-seed-specimen" aria-labelledby="seed-title">
      <div><small>Mano Anterior · sistema vectorial propio</small><h2 id="seed-title">Lengua Semilla</h2><p>No adopta una tipografía histórica humana. Conserva primitivas, operadores y variantes indescifradas.</p></div>
      <figure><div>{['S01','S04','S12','S09','S16','S03','S14','S06'].map((id) => <SeedGlyph key={id} id={id} />)}</div><figcaption>bind · witness · suspend · seal</figcaption></figure>
    </section>

    <section className="type-candidate-table" aria-labelledby="candidates-title">
      <header><small>Decisión documentada</small><h2 id="candidates-title">Familias consideradas</h2></header>
      <div role="table">
        <div role="row" className="candidate-heading"><span>Familia</span><span>Resultado</span><span>Lectura en el Códice</span></div>
        <div role="row"><strong>Alegreya</strong><b className="candidate-chosen"><Check size={13} /> Elegida</b><p>Ritmo caligráfico, cursiva real y excelente resistencia en lectura larga.</p></div>
        <div role="row"><strong>EB Garamond</strong><b className="candidate-chosen"><Check size={13} /> Elegida</b><p>Autoridad romana, versalitas, cifras antiguas y ligaduras históricas dosificables.</p></div>
        <div role="row"><strong>Cormorant Garamond</strong><b><X size={13} /> Descartada</b><p>Demasiado delicada y escénica en columnas pequeñas; funciona mejor como display.</p></div>
        <div role="row"><strong>IM FELL English</strong><b><X size={13} /> Descartada</b><p>Textura convincente, pero demasiado inglesa, irregular y teatral para el español extenso.</p></div>
        <div role="row"><strong>Junicode</strong><b><X size={13} /> Descartada</b><p>Riqueza medieval extraordinaria; densidad especializada innecesaria para este artefacto.</p></div>
      </div>
    </section>
  </main>
}
