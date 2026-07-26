import type { Metadata } from 'next';
import { PaginaGerador } from '@/components/generator/PaginaGerador';

export const metadata: Metadata = {
  title: 'Gerador de QR Code em lote a partir de CSV',
  description:
    'Suba uma planilha CSV e baixe centenas de QR Codes estáticos num ZIP, em SVG ou PNG. Cada peça é decodificada de volta antes de entrar no pacote. Tudo no seu navegador.',
  alternates: { canonical: '/qr-code-em-lote/' },
};

export default function QrCodeEmLote() {
  return (
    <PaginaGerador
      titulo="QR Code em lote, direto de uma planilha"
      subtitulo="Configure uma peça e aplique a todas as linhas do CSV. O ZIP sai montado no seu navegador, e cada código é decodificado de volta antes de entrar nele."
    />
  );
}
