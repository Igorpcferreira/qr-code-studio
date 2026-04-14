type QrPreviewCardProps = {
  qrCodeDataUrl: string | null;
  generatedUrl: string;
};

function buildFileName(url: string) {
  if (!url) {
    return 'qr-code.png';
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `qr-code-${host}.png`;
  } catch {
    return 'qr-code.png';
  }
}

export function QrPreviewCard({ qrCodeDataUrl, generatedUrl }: QrPreviewCardProps) {
  const fileName = buildFileName(generatedUrl);

  return (
    <article className="panel-card">
      <header className="panel-header">
        <div>
          <span className="panel-eyebrow">Pré-visualização</span>
          <h2>Seu QR Code aparece aqui</h2>
        </div>
        <div className="panel-icon" aria-hidden="true">
          []
        </div>
      </header>

      <div className="preview-box">
        {qrCodeDataUrl ? (
          <>
            <div className="qr-frame">
              <img src={qrCodeDataUrl} alt={`QR Code para ${generatedUrl}`} className="qr-image" />
            </div>
            <div className="preview-details">
              <span className="preview-label">URL gerada</span>
              <p title={generatedUrl}>{generatedUrl}</p>
            </div>
            <a className="download-button" href={qrCodeDataUrl} download={fileName}>
              Baixar PNG
            </a>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              QR
            </div>
            <strong>Nenhum QR Code gerado ainda</strong>
            <p>Preencha a URL ao lado e clique em “Gerar QR Code”.</p>
          </div>
        )}
      </div>
    </article>
  );
}
