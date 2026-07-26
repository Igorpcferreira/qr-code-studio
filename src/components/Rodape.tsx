import Link from 'next/link';

/**
 * Rodapé compartilhado por todas as rotas.
 *
 * Existe como componente, e não copiado em cada página, por dois motivos que se
 * somam: as landings vivem de busca orgânica e precisam de caminho interno —
 * sem esta navegação cada rota seria uma ilha, alcançável só por quem já sabia
 * que ela existe — e a página-tese ficou sem rodapé nenhum justamente por ter
 * layout próprio. Um teste E2E percorre as sete rotas cobrando a autoria.
 */

const LINKEDIN = 'https://www.linkedin.com/in/igor-cferreira/';

const ATALHOS = [
  { href: '/qr-code-url/', rotulo: 'URL' },
  { href: '/qr-code-pix/', rotulo: 'Pix' },
  { href: '/qr-code-wifi/', rotulo: 'Wi-Fi' },
  { href: '/qr-code-texto/', rotulo: 'Texto' },
  { href: '/qr-code-em-lote/', rotulo: 'Lote por CSV' },
  { href: '/qr-estatico-vs-dinamico/', rotulo: 'Estático ou dinâmico?' },
] as const;

export function Rodape() {
  return (
    <footer className="border-hairline text-fg-muted mt-16 flex flex-col gap-5 border-t px-8 py-6">
      <nav aria-label="Geradores por tipo" className="type-mono flex flex-wrap gap-x-6 gap-y-2">
        {ATALHOS.map((atalho) => (
          <Link key={atalho.href} href={atalho.href} className="text-accent-link underline">
            {atalho.rotulo}
          </Link>
        ))}
      </nav>

      <div className="type-mono flex flex-wrap items-center justify-between gap-4">
        <span>Tudo acontece no seu navegador · nenhuma requisição carrega o que você digita</span>

        {/*
         * O único link para fora do site, e ele sai do rodapé, nunca do
         * gerador. `rel="me"` é o que declara autoria; `noopener` fecha o
         * acesso ao `window.opener` da aba nova.
         */}
        <span>
          Desenvolvido por{' '}
          <a
            href={LINKEDIN}
            target="_blank"
            rel="me noopener noreferrer"
            className="text-accent-link underline"
          >
            Igor de Castro
          </a>
        </span>
      </div>
    </footer>
  );
}
