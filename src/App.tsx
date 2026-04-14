import { useMemo, useState } from 'react';
import { toDataURL } from 'qrcode';
import { QrGeneratorCard } from './components/QrGeneratorCard';
import { QrPreviewCard } from './components/QrPreviewCard';
import { normalizeUrl, validateUrl } from './utils/url';

const DEFAULT_URL = 'https://www.example.com';

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const helperMessage = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }

    if (generatedUrl) {
      return 'QR Code gerado com sucesso. Agora você pode baixar a imagem em PNG.';
    }

    return 'Informe uma URL válida com http:// ou https:// para gerar o QR Code.';
  }, [errorMessage, generatedUrl]);

  const generateQrCode = async () => {
    const normalizedUrl = normalizeUrl(url);
    const validationResult = validateUrl(normalizedUrl);

    if (!validationResult.isValid) {
      setErrorMessage(validationResult.message);
      setGeneratedUrl('');
      setQrCodeDataUrl(null);
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage('');

      const dataUrl = await toDataURL(normalizedUrl, {
        width: 768,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff',
        },
      });

      setQrCodeDataUrl(dataUrl);
      setGeneratedUrl(normalizedUrl);
    } catch {
      setGeneratedUrl('');
      setQrCodeDataUrl(null);
      setErrorMessage('Não foi possível gerar o QR Code. Tente novamente em instantes.');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearGenerator = () => {
    setUrl('');
    setGeneratedUrl('');
    setQrCodeDataUrl(null);
    setErrorMessage('');
  };

  return (
    <main className="app-shell">
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <section className="hero">
        <span className="hero-badge">Projeto local • Frontend-only • Download em PNG</span>
        <h1>QR Code Studio</h1>
        <p>
          Gere QR Codes a partir de URLs com uma interface moderna, validação amigável e
          download pronto para uso.
        </p>
      </section>

      <section className="content-grid">
        <QrGeneratorCard
          url={url}
          onUrlChange={setUrl}
          onGenerate={generateQrCode}
          onClear={clearGenerator}
          isGenerating={isGenerating}
          helperMessage={helperMessage}
          hasError={Boolean(errorMessage)}
        />

        <QrPreviewCard qrCodeDataUrl={qrCodeDataUrl} generatedUrl={generatedUrl} />
      </section>
    </main>
  );
}
