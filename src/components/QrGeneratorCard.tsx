type QrGeneratorCardProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
  helperMessage: string;
  hasError: boolean;
};

export function QrGeneratorCard({
  url,
  onUrlChange,
  onGenerate,
  onClear,
  isGenerating,
  helperMessage,
  hasError,
}: QrGeneratorCardProps) {
  return (
    <article className="panel-card">
      <header className="panel-header">
        <div>
          <span className="panel-eyebrow">Gerador</span>
          <h2>Transforme uma URL em QR Code</h2>
        </div>
        <div className="panel-icon" aria-hidden="true">
          #
        </div>
      </header>

      <div className="field-group">
        <label className="field-label" htmlFor="url-input">
          URL
        </label>
        <input
          id="url-input"
          type="text"
          className={`text-input ${hasError ? 'input-error' : ''}`}
          placeholder="https://seusite.com.br"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <p className={`helper-text ${hasError ? 'helper-text-error' : 'helper-text-success'}`}>
          {helperMessage}
        </p>
      </div>

      <div className="tips-box">
        <span className="tips-title">Boas práticas</span>
        <ul>
          <li>Use URLs completas com protocolo, como https://.</li>
          <li>Evite espaços no início ou no fim do texto.</li>
          <li>O arquivo baixado será gerado em formato PNG.</li>
        </ul>
      </div>

      <div className="actions-row">
        <button type="button" className="primary-button" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Gerando...' : 'Gerar QR Code'}
        </button>
        <button type="button" className="secondary-button" onClick={onClear} disabled={isGenerating}>
          Limpar
        </button>
      </div>
    </article>
  );
}
