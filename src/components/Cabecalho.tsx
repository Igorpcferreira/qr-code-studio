import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { SeloPermanencia } from '@/components/brand/SeloPermanencia';
import { SeletorTema } from '@/components/SeletorTema';

/**
 * Cabeçalho compartilhado por todas as rotas.
 *
 * Extraído pelo mesmo motivo do rodapé: a página-tese tem layout próprio e
 * copiava a marca à mão, então qualquer acréscimo no cabeçalho — o seletor de
 * tema, por exemplo — nasceria em uma rota só.
 */
export function Cabecalho() {
  return (
    <header className="border-hairline bg-surface-card flex flex-wrap items-center gap-5 border-b px-8 py-5">
      <Link href="/" className="flex items-center gap-5">
        <Logo size={40} title="QR Code Studio" />
        <span className="font-display text-[17px] font-black tracking-tight uppercase">QR Code Studio</span>
      </Link>

      <div className="ml-auto flex flex-wrap items-center gap-6">
        <SeloPermanencia />
        <SeletorTema />
      </div>
    </header>
  );
}
