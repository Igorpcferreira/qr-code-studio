import { SELO_PERMANENCIA } from '@/lib/site';

const INCREMENTOS = [
  { n: 0, nome: 'Fundação e ferramental', estado: 'em curso' },
  { n: 1, nome: 'Núcleo: matriz, capacidade, contraste, unidades', estado: 'a fazer' },
  { n: 2, nome: 'Display list e renderers SVG/PNG', estado: 'a fazer' },
  { n: 3, nome: 'Verificação de leitura e dano simulado', estado: 'a fazer' },
  { n: 4, nome: 'Design system', estado: 'a fazer' },
  { n: 5, nome: 'Interface do gerador', estado: 'a fazer' },
  { n: 6, nome: 'As 14 molduras', estado: 'a fazer' },
  { n: 7, nome: 'Exportação em PDF', estado: 'a fazer' },
  { n: 8, nome: 'Rotas, PWA e acabamento', estado: 'a fazer' },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-[1100px] px-8 py-16">
      <div className="mb-14 flex w-fit items-center gap-3 border border-ultramarine px-4 py-2">
        <span className="size-2 bg-ultramarine" aria-hidden="true" />
        <span className="type-mono text-accent-text">{SELO_PERMANENCIA}</span>
      </div>

      <h1 className="type-display mb-4 max-w-[900px]">Não expira porque não passa por nós</h1>
      <p className="type-body mb-16 max-w-[620px] text-fg-muted">
        QR Code estático, vetorial, de graça. Sem cadastro, sem limite, sem servidor no meio.
      </p>

      <section aria-labelledby="estado" className="border border-hairline bg-surface-card">
        <h2 id="estado" className="type-eyebrow border-b border-hairline px-6 py-4">
          Refatoração da Fase 1 · estado dos incrementos
        </h2>
        <ol className="type-mono">
          {INCREMENTOS.map((inc) => (
            <li
              key={inc.n}
              className="grid grid-cols-[3rem_1fr_auto] gap-4 border-b border-hairline px-6 py-3 last:border-b-0"
            >
              <span className="text-fg-muted">{String(inc.n).padStart(2, '0')}</span>
              <span>{inc.nome}</span>
              <span className={inc.estado === 'em curso' ? 'text-ultramarine' : 'text-fg-muted'}>
                {inc.estado}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <p className="type-small mt-8 text-fg-muted">
        O gerador entra no incremento 5. Esta página é andaime: existe para validar tokens, tipografia e o
        pipeline de build.
      </p>
    </main>
  );
}
