import { Logo } from '@/components/brand/Logo';
import { SeloPermanencia } from '@/components/brand/SeloPermanencia';
import { Gerador } from '@/components/generator/Gerador';

export default function Home() {
  return (
    <>
      <header className="border-hairline bg-surface-card flex flex-wrap items-center gap-5 border-b px-8 py-5">
        <Logo size={40} title="QR Code Studio" />
        <span className="font-display text-[17px] font-black tracking-tight uppercase">QR Code Studio</span>
        <SeloPermanencia className="ml-auto" />
      </header>

      <main className="mx-auto max-w-[1200px] px-8 py-14">
        <h1 className="type-display mb-4 max-w-[900px]">Não expira porque não passa por nós</h1>
        <p className="type-body text-fg-muted mb-12 max-w-[620px]">
          QR Code estático, vetorial, de graça. Sem cadastro, sem limite, sem servidor no meio.
        </p>

        <Gerador />
      </main>

      <footer className="border-hairline text-fg-muted type-mono mt-16 flex flex-wrap justify-between gap-4 border-t px-8 py-5">
        <span>Tudo acontece no seu navegador · nenhuma requisição carrega o que você digita</span>
        <span>Código aberto · MIT</span>
      </footer>
    </>
  );
}
