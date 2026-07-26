import Link from 'next/link';
import type { Metadata } from 'next';
import { Logo } from '@/components/brand/Logo';
import { SeloPermanencia } from '@/components/brand/SeloPermanencia';

export const metadata: Metadata = {
  title: 'QR estático ou dinâmico: a diferença que ninguém explica',
  description:
    'Um QR estático carrega o endereço dentro do próprio desenho e não pode expirar. Um dinâmico codifica um link do provedor, que pode ser desligado. A diferença técnica, sem marketing.',
  alternates: { canonical: '/qr-estatico-vs-dinamico/' },
};

/**
 * A página-tese.
 *
 * Existe por dois motivos que se reforçam: é o conteúdo que realmente ranqueia
 * numa busca por "QR code expira", e é onde a promessa do produto é explicada
 * com o raciocínio técnico inteiro à mostra, em vez de virar slogan.
 */

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-hairline flex flex-col gap-4 border-t pt-10">
      <h2 className="type-h2">{titulo}</h2>
      <div className="type-body text-fg-muted flex max-w-[70ch] flex-col gap-4">{children}</div>
    </section>
  );
}

export default function EstaticoVsDinamico() {
  return (
    <>
      <header className="border-hairline bg-surface-card flex flex-wrap items-center gap-5 border-b px-8 py-5">
        <Link href="/" className="flex items-center gap-5">
          <Logo size={40} title="QR Code Studio" />
          <span className="font-display text-[17px] font-black tracking-tight uppercase">QR Code Studio</span>
        </Link>
        <SeloPermanencia className="ml-auto" />
      </header>

      <main className="mx-auto flex max-w-[900px] flex-col gap-10 px-8 py-14">
        <div className="flex flex-col gap-5">
          <h1 className="type-h1 max-w-[20ch]">QR Codes nunca expiraram</h1>
          <p className="type-body text-fg-muted max-w-[70ch]">
            Estavam te vendendo a data de validade. A diferença entre um QR estático e um dinâmico é técnica,
            verificável, e quase nunca explicada por quem cobra assinatura.
          </p>
        </div>

        <Secao titulo="O que é um QR estático">
          <p>
            Um QR estático carrega o conteúdo codificado{' '}
            <strong className="text-fg">dentro do próprio desenho de módulos</strong>. Os quadradinhos pretos
            e brancos <em>são</em> o endereço. O leitor decodifica ali mesmo, no aparelho, sem consultar
            ninguém.
          </p>
          <p>
            Não existe servidor intermediário. Por consequência, não existe nada para desligar. Um QR estático
            impresso numa etiqueta em 2015 continua levando ao mesmo lugar hoje, mesmo que a ferramenta que o
            gerou tenha fechado. Isso não é generosidade de quem gerou — é uma propriedade do formato.
          </p>
        </Secao>

        <Secao titulo="O que é um QR dinâmico">
          <p>
            Um QR dinâmico não codifica o seu endereço. Codifica{' '}
            <strong className="text-fg">um link curto do domínio do provedor</strong>, que redireciona para o
            destino real.
          </p>
          <p>
            É isso que permite trocar o destino depois de imprimir — a única vantagem legítima do modelo. E é
            exatamente isso que permite{' '}
            <strong className="text-fg">desligar o código quando a assinatura acaba</strong>, ou quando a
            empresa encerra as atividades. O papel continua na parede; o link morre.
          </p>
          <p>
            Também significa que cada leitura passa pelo servidor do provedor, que sabe quando, onde e quantas
            vezes o seu código foi escaneado.
          </p>
        </Secao>

        <Secao titulo="Como saber qual você tem">
          <p>
            Aponte a câmera e olhe o endereço antes de abrir. Se aparecer um domínio que você não reconhece —
            encurtadores e domínios do próprio gerador — o código é dinâmico e depende daquele serviço. Se
            aparecer o seu endereço, é estático.
          </p>
        </Secao>

        <Secao titulo="O que este gerador faz">
          <p>
            Gera <strong className="text-fg">exclusivamente QR estático</strong>, e trata isso como princípio,
            não como limitação. Não há redirecionamento, encurtador nem rastreamento de leituras, porque
            qualquer um deles criaria a dependência que o produto existe para eliminar.
          </p>
          <p>
            A consequência é que a aplicação é inteiramente client-side: nenhuma rota de API, nenhum banco,
            nenhuma conta. O que você digita nunca sai do seu navegador — dá para conferir na aba Rede do seu
            próprio navegador, e há teste automatizado que falha se qualquer requisição escapar.
          </p>
          <p>
            Custo de operação zero é o que torna &ldquo;de graça&rdquo; sustentável de verdade. Não há plano
            pago para o qual empurrar você depois.
          </p>
        </Secao>

        <Secao titulo="E a verificação de leitura">
          <p>
            Depois de aplicar cor, logo ou moldura, o código gerado é{' '}
            <strong className="text-fg">decodificado de volta</strong> e comparado com o que você digitou. Se
            não bater, a exportação é bloqueada e a causa aparece — isolada por experimento controlado, não
            por palpite.
          </p>
          <p>
            Foi assim que descobrimos que o limite de logo que o mercado publica está errado: o &ldquo;25% da
            área com correção H&rdquo; não passa em nenhum dos dois decodificadores que testamos. O limite
            real fica perto de 20%, e aqui o teto é 16%.
          </p>
        </Secao>

        <div className="border-hairline flex flex-wrap items-center gap-5 border-t pt-10">
          <Link
            href="/"
            className="bg-ultramarine hover:bg-ultramarine-deep font-ui px-5 py-3.5 text-sm font-semibold text-white transition-colors"
          >
            Gerar um QR estático agora
          </Link>
          <span className="type-small text-fg-muted">Sem cadastro, sem limite, sem servidor no meio.</span>
        </div>
      </main>
    </>
  );
}
