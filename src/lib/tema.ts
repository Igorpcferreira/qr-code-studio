/**
 * Tema da interface.
 *
 * O CSS já resolvia claro e escuro por `light-dark()`, e o seletor manual só
 * precisa trocar o `color-scheme` — é o que `[data-theme]` faz em
 * `app/globals.css`. Faltava quem trocasse: sem este módulo, o site seguia a
 * preferência do sistema operacional e quem quisesse o contrário não tinha
 * como pedir.
 *
 * **O código não inverte.** A regra do board é explícita: no modo escuro
 * inverte-se apenas a interface, porque um QR claro sobre fundo escuro falha em
 * parte dos scanners. `--qr-dark` e `--qr-light` ficam deliberadamente fora do
 * `light-dark()`, e há teste E2E cobrando isso.
 */

export type Tema = 'claro' | 'escuro' | 'sistema';

export const CHAVE_TEMA = 'qr-tema';

/** Valor gravado no DOM e no armazenamento. `sistema` não grava atributo. */
const NO_DOM: Readonly<Record<Tema, string | null>> = {
  claro: 'light',
  escuro: 'dark',
  sistema: null,
};

const ouvintes = new Set<() => void>();

function notificar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Lê do DOM, não do armazenamento: o DOM é o que está de fato valendo. */
export function lerTema(): Tema {
  if (typeof document === 'undefined') return 'sistema';

  const atual = document.documentElement.dataset['theme'];
  if (atual === 'light') return 'claro';
  if (atual === 'dark') return 'escuro';
  return 'sistema';
}

export function definirTema(tema: Tema): void {
  const valor = NO_DOM[tema];

  if (valor === null) delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = valor;

  try {
    // Navegação privada pode recusar a escrita; o tema vale para esta aba mesmo assim.
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    /* sem persistência, e tudo bem */
  }

  notificar();
}

/** Assina mudanças, inclusive as feitas em outra aba. */
export function assinarTema(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  window.addEventListener('storage', aoMudar);

  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener('storage', aoMudar);
  };
}

/**
 * Script aplicado antes da primeira pintura.
 *
 * Precisa ser síncrono e inline: ler a preferência depois da hidratação faria a
 * página piscar no tema errado, e num site cuja primeira tela é um documento
 * técnico o flash é mais grosseiro do que em qualquer outro lugar.
 *
 * Escrito como string minificada à mão porque é a única forma de garantir que o
 * conteúdo do `<script>` seja exatamente isto — sem transpilação no meio.
 */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CHAVE_TEMA}');if(t==='claro')document.documentElement.dataset.theme='light';else if(t==='escuro')document.documentElement.dataset.theme='dark'}catch(e){}`;
