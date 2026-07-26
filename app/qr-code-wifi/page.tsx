import type { Metadata } from 'next';
import { PaginaGerador } from '@/components/generator/PaginaGerador';

export const metadata: Metadata = {
  title: 'Gerador de QR Code de Wi-Fi, grátis e vetorial',
  description:
    'Conecte visitantes à rede sem ditar a senha. QR Code de Wi-Fi estático em SVG, PDF vetorial ou PNG, com verificação automática de leitura. Nada sai do seu navegador.',
  alternates: { canonical: '/qr-code-wifi/' },
};

export default function QrCodeWifi() {
  return (
    <PaginaGerador
      titulo="QR Code de Wi-Fi para a recepção, a mesa ou a vitrine"
      subtitulo="Nome da rede e senha ficam codificados no próprio desenho. Quem escaneia entra na rede sem digitar nada — e o código continua valendo enquanto a senha valer."
    />
  );
}
