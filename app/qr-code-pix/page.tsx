import type { Metadata } from 'next';
import { PaginaGerador } from '@/components/generator/PaginaGerador';

export const metadata: Metadata = {
  title: 'Gerador de QR Code Pix estático, grátis e vetorial',
  description:
    'Gere o BR Code do Pix com chave, nome, cidade e valor opcional. Payload EMV do Banco Central com CRC-16 conferido, em SVG, PDF vetorial ou PNG. Nada sai do seu navegador.',
  alternates: { canonical: '/qr-code-pix/' },
};

export default function QrCodePix() {
  return (
    <PaginaGerador
      titulo="QR Code Pix que não depende de ninguém para funcionar"
      subtitulo="O BR Code estático carrega chave, nome e cidade dentro do próprio desenho. Não existe redirecionamento nem consulta a servidor — e por isso não existe o que desligar."
    />
  );
}
