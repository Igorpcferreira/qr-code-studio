import { Logo } from '@/components/brand/Logo';
import { SeloPermanencia } from '@/components/brand/SeloPermanencia';

const INCREMENTOS = [
  { n: 0, nome: 'Fundação e ferramental', estado: 'pronto' },
  { n: 1, nome: 'Núcleo: matriz, capacidade, contraste, unidades', estado: 'pronto' },
  { n: 2, nome: 'Display list e renderers SVG/PNG', estado: 'pronto' },
  { n: 3, nome: 'Verificação de leitura e dano simulado', estado: 'pronto' },
  { n: 4, nome: 'Design system', estado: 'em curso' },
  { n: 5, nome: 'Interface do gerador', estado: 'a fazer' },
  { n: 6, nome: 'As 14 molduras', estado: 'a fazer' },
  { n: 7, nome: 'Exportação em PDF', estado: 'a fazer' },
  { n: 8, nome: 'Rotas, PWA e acabamento', estado: 'a fazer' },
] as const;

const COR_ESTADO: Record<string, string> = {
  pronto: 'text-success',
  'em curso': 'text-ultramarine',
  'a fazer': 'text-fg-muted',
};

export default function Home() {
  return (
    <>
      <header className="border-hairline bg-surface-card flex items-center gap-5 border-b px-8 py-5">
        <Logo size={40} title="QR Code Studio" />
        <span className="font-display text-[17px] font-black tracking-tight uppercase">QR Code Studio</span>
        <SeloPermanencia className="ml-auto" />
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-16">
        <h1 className="type-display mb-4 max-w-[900px]">Não expira porque não passa por nós</h1>
        <p className="type-body text-fg-muted mb-16 max-w-[620px]">
          QR Code estático, vetorial, de graça. Sem cadastro, sem limite, sem servidor no meio.
        </p>

        <section aria-labelledby="estado" className="border-hairline bg-surface-card border">
          <h2 id="estado" className="type-eyebrow border-hairline border-b px-6 py-4">
            Refatoração da Fase 1 · estado dos incrementos
          </h2>
          <ol className="type-mono">
            {INCREMENTOS.map((inc) => (
              <li
                key={inc.n}
                className="border-hairline grid grid-cols-[3rem_1fr_auto] gap-4 border-b px-6 py-3 last:border-b-0"
              >
                <span className="text-fg-muted">{String(inc.n).padStart(2, '0')}</span>
                <span>{inc.nome}</span>
                <span className={COR_ESTADO[inc.estado]}>{inc.estado}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="type-small text-fg-muted mt-8">
          O gerador entra no incremento 5. Esta página é andaime: existe para validar tokens, tipografia e o
          pipeline de build.
        </p>
      </main>
    </>
  );
}
