/**
 * Download local.
 *
 * Blob e object URL: o arquivo é montado na memória do navegador e entregue
 * dali. Nenhum byte trafega — o teste E2E de rede zero cobre isso, e é a
 * promessa central do produto.
 */

function entregar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nome;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  // Sem revogar, o blob fica retido até a aba fechar.
  URL.revokeObjectURL(url);
}

export function baixarSvg(svg: string, nome: string): void {
  entregar(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), nome);
}

export function baixarPng(canvas: HTMLCanvasElement, nome: string): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        rejeitar(new Error('Não foi possível gerar o PNG.'));
        return;
      }
      entregar(blob, nome);
      resolver();
    }, 'image/png');
  });
}

export function baixarBytes(bytes: Uint8Array, nome: string, tipo: string): void {
  entregar(new Blob([bytes as unknown as BlobPart], { type: tipo }), nome);
}
