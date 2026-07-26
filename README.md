# QR Code Studio

**QR Codes nunca expiraram. Estavam te vendendo a data de validade.**

Gerador de QR Code estático, vetorial e gratuito. Roda inteiramente no navegador: o que você
digita nunca sai da sua máquina, e o arquivo gerado continua funcionando mesmo que este site
saia do ar.

---

## A tese

Um **QR estático** carrega o conteúdo codificado dentro do próprio desenho de módulos. Os
quadrados pretos e brancos _são_ o endereço. O leitor decodifica ali mesmo, no aparelho. Não
existe servidor intermediário e, por consequência, não existe nada para desligar. **Não pode
expirar** — é uma propriedade do formato, não um favor do serviço.

Um **QR dinâmico** codifica um link curto do domínio do provedor, que redireciona. É isso que
permite trocar o destino depois de imprimir, e é exatamente isso que permite desligar o código
quando a assinatura acaba. Os concorrentes pagos vendem dinâmico, muitas vezes sem deixar claro,
e frequentemente põem o download do estático atrás de paywall.

Este produto gera **exclusivamente QR estático** e trata isso como princípio. Não há
redirecionamento, encurtador nem rastreamento de leituras, porque qualquer um deles criaria a
dependência que o projeto existe para eliminar.

A consequência arquitetural é direta: nenhuma rota de API, nenhum banco, nenhuma conta. Custo de
operação zero é o que torna "de graça" sustentável de verdade.

---

## O que ele faz

- **Conteúdo:** URL e texto livre.
- **Saídas:** SVG e PDF vetoriais, PNG raster — todas geradas no navegador.
- **Ficha técnica:** versão, módulos, correção, capacidade, zona de silêncio e margem de dano,
  todos calculados a partir da especificação ISO/IEC 18004.
- **Personalização:** cor com indicador de contraste, logo central, 14 molduras de impressão.
- **Verificação automática de leitura** — o diferencial de engenharia, explicado abaixo.
- **Opções de gráfica:** papel A4/Carta/Etiqueta, marcas de corte, sangria de 3 mm e preto
  100% K.
- **Funciona offline** depois da primeira visita.

---

## A verificação automática de leitura

Depois de aplicar cor, logo e moldura, o resultado renderizado é **decodificado de volta** e
comparado com o conteúdo original. Se não bater, a exportação é bloqueada.

O diagnóstico não é heurística. Quando a leitura falha, o sistema roda **experimentos
controlados**: remove o logo e tenta de novo; devolve as cores ao padrão e tenta de novo; aumenta
a escala e tenta de novo. O primeiro que faz o código voltar a ler não é palpite — é a causa
isolada por eliminação, e a interface diz isso explicitamente.

Polaridade invertida é verificada antes de tudo, porque inverter as duas cores mantém a razão de
contraste **idêntica**: nenhum experimento de cor a distinguiria.

### O que isso descobriu

O limite de logo que o mercado publica está errado. Medido com jsQR e ZXing, que concordaram em
24 de 24 casos:

| Nível de correção | 10% | 16%   | 20% | 25%   |
| ----------------- | --- | ----- | --- | ----- |
| L                 | ✗   | ✗     | ✗   | ✗     |
| M                 | ✓   | ✗     | ✗   | ✗     |
| Q                 | ✓   | ✗     | ✗   | ✗     |
| **H**             | ✓   | **✓** | ✓   | **✗** |

O "25% da área com correção H" repetido por todo gerador **não passa em nenhum dos dois
decodificadores**. Ele confunde 30% de recuperação de _codewords_ com 30% de _área_, ignorando
que uma oclusão central concentra o dano em blocos contíguos. Aqui o teto é 16%, com margem sobre
o limite real de ~20%.

---

## Como rodar

Requer Node 22 ou mais recente.

```bash
npm install
npm run dev          # desenvolvimento em localhost:3000
npm run check        # typecheck + lint + formatação + testes + build
npm run test:e2e     # end-to-end contra o export estático
```

`npm run check` é o portão: precisa passar limpo antes de qualquer commit.

---

## Arquitetura

Detalhamento em [docs/ARQUITETURA.md](docs/ARQUITETURA.md). O essencial:

```
conteúdo ──▶ /core/qr ──▶ QrArtifact ──┐
                                        ├──▶ /core/frames ──▶ Scene ──┬──▶ SVG
      estilo, moldura, chamada ─────────┘   (14 funções puras)        ├──▶ PNG
                                                                      └──▶ PDF
                                                                 │
                                            /core/verify ◀───────┘  decodifica de volta
```

### As decisões que mais importaram

**Uma display list entre composição e desenho.** 14 molduras × 3 formatos seriam 42
implementações que precisariam concordar pixel a pixel. Com uma `Scene` intermediária em
milímetros, cada moldura é escrita **uma vez** como função pura e os renderers viram um `switch`
sem regra de negócio. A divergência entre formatos deixa de ser um risco a mitigar: some por
construção.

**Milímetro como unidade base, não pixel.** O produto existe para impressão; "1024 px" só
significa alguma coisa depois de escolhido o DPI.

**Merge de módulos em runs horizontais.** Medido num QR versão 8: o SVG cai de 69,6 KB para
8,6 KB. Depois do gzip a diferença encolhe muito, então o argumento de peso não é o tamanho do
arquivo — é que o designer abre **1 objeto em vez de 1.256** no editor vetorial.

**Verificação em Web Worker, com rasterizador puro.** O rasterizador não depende de canvas, o que
permite a suíte de ida e volta rodar no Node — e esse teste é o argumento central do produto.

**Fontes do PDF embutidas, não servidas.** Um `fetch`, mesmo da própria origem, abriria um caminho
de rede num produto cuja tese é que nada sai do navegador. As 441 KB de TTF viram 66 KB depois de
instanciar o Archivo variável e subsetar para Latin-1.

**`useReducer` em vez de biblioteca de estado.** O estado é um único objeto de configuração e
ninguém escreve nele de fora da árvore. O custo real de performance está na cadeia derivada, que
se resolve com `useMemo` e Web Worker.

### Stack

Next.js 16 (App Router, `output: 'export'`) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Vitest · Playwright · `qrcode` para a matriz · `jsqr` para a verificação · `pdf-lib` para o PDF.

---

## Correções ao material de origem

O brand board é autoritativo para decisões visuais, mas dois números dele não sobreviveram à
conferência, e um produto cuja tese é honestidade técnica não pode reproduzir um valor impossível:

- **`CAPACIDADE 1.782 / 2.303 bytes` para versão 6 nível H** não existe. O teto do formato em H é
  1.273 bytes, e em v6/H são 58. O desenho da ficha é seguido linha a linha; os valores são
  calculados.
- **`18,4 : 1` de contraste para Carbon sobre branco** — pela fórmula WCAG 2.x o valor é 19,14.
- **Steel `#6E7280` como texto secundário nos dois modos** não passa em AA: dá 4,36:1 sobre Quiet
  e 3,99:1 sobre Carbon, contra o mínimo de 4,5:1. Ajustado por tema mantendo o mesmo matiz.
- **Ultramarine como texto sobre fundo escuro** dá 2,64:1. O board acerta ao dizer que ele serve
  em texto pequeno — mas só sobre claro. No modo escuro é clareado para continuar legível.

Os dois primeiros estão ancorados em teste; os dois últimos, confirmados pelo Lighthouse.

---

## Testes

248 testes unitários e 23 end-to-end. Lighthouse: **98 em performance, 100 em
acessibilidade, boas práticas e SEO**. Os testes que valem menção:

- **Ida e volta** — gerar, compor, rasterizar, decodificar e comparar com a entrada, nos quatro
  níveis de correção e nas 14 molduras.
- **Equivalência do merge** — o `<path>` mesclado cobre exatamente os mesmos módulos que um
  retângulo por módulo, verificado por comparação de conjuntos e por rasterização pixel a pixel
  contra uma segunda implementação.
- **Geometria do PDF** — o fluxo de conteúdo é lido de volta e a matriz reconstruída, o que prova
  que o PDF desenha o código certo sem precisar de um rasterizador de PDF.
- **Tabela de capacidade** — as 160 células conferidas contra a biblioteca, mais uma verificação
  comportamental de fronteira independente da origem da tabela.
- **Rede zero** — fluxo completo de exportação sem uma requisição fora da origem.
- **`border-radius: 0`** — varredura do DOM computado.

---

## Roadmap

Em [docs/ROADMAP.md](docs/ROADMAP.md). O destaque da próxima fase é o **Pix (BR Code)**: payload
EMV-MPM em TLV com checksum CRC16-CCITT, e o Pix estático é estático por natureza — encaixe
exato na tese da marca.

---

## Licença

MIT. As fontes Archivo e IBM Plex estão sob SIL Open Font License 1.1.
