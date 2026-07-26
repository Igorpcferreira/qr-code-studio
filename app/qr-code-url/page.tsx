import type { Metadata } from 'next';
import { PaginaGerador } from '@/components/generator/PaginaGerador';

export const metadata: Metadata = {
  title: 'Gerador de QR Code para URL, grátis e vetorial',
  description:
    'Transforme qualquer endereço num QR Code estático. Baixe em SVG, PDF vetorial ou PNG, com verificação automática de leitura. Nada sai do seu navegador.',
  alternates: { canonical: '/qr-code-url/' },
};

export default function QrCodeUrl() {
  return (
    <PaginaGerador
      titulo="QR Code de URL, vetorial e sem prazo de validade"
      subtitulo="Cole o endereço, escolha o tamanho e baixe. O código carrega a URL dentro do próprio desenho — não passa por servidor nenhum e não pode ser desligado."
    />
  );
}
