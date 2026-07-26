import type { Metadata } from 'next';
import { PaginaGerador } from '@/components/generator/PaginaGerador';

export const metadata: Metadata = {
  title: 'Gerador de QR Code de texto livre',
  description:
    'Codifique qualquer texto num QR Code estático: recado, código de série, instrução. SVG, PDF vetorial e PNG, com verificação automática de leitura.',
  alternates: { canonical: '/qr-code-texto/' },
};

export default function QrCodeTexto() {
  return (
    <PaginaGerador
      titulo="QR Code de texto livre"
      subtitulo="Um recado, um código de série, uma instrução de uso. O texto fica codificado no próprio desenho e é lido direto pela câmera, sem abrir nada."
    />
  );
}
