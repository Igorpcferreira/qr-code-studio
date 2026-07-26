# Plano técnico — refatoração do QR Code Studio

> Documento de aprovação da Etapa 2. Nada é implementado antes do seu "pode seguir".
> Escrito depois da investigação da Etapa 1, com todos os números medidos em experimentos reais.

---

## 0. Decisões travadas

Vindas da Etapa 1 e das suas respostas:

| Decisão          | Escolha                                                                                             | Origem                             |
| ---------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Framework        | Next.js 16, App Router, `output: 'export'`                                                          | aprovado                           |
| Fonte no PDF     | Subset da marca, chunk carregado sob demanda                                                        | aprovado                           |
| Limite de logo   | Teto de 16% de área, só em H, exportação bloqueada se a verificação falhar                          | aprovado                           |
| Escopo extra     | Molduras 9–14 · PDF preto 100% K/spot · Teste de dano simulado · PWA offline + distância de leitura | aprovado                           |
| Estado           | `useReducer` + Context, sem Zustand                                                                 | argumentado na Etapa 1             |
| Decodificador    | `jsqr` (56 KB gzip) em Web Worker, não `zxing-wasm` (440 KB gzip)                                   | medido: concordaram em 24/24 casos |
| Renderização SVG | `<path>` único com runs horizontais                                                                 | medido: 69,7 KB → 8,2 KB           |

---

## 1. A decisão central de arquitetura: uma cena, três backends

O maior risco de execução deste projeto não é o motor de QR. É a **duplicação**: 14 molduras × 3 formatos de saída (SVG, PNG, PDF) = 42 implementações que precisam concordar pixel a pixel. Se cada renderer desenhar as molduras por conta própria, o critério de aceite _"as molduras renderizam corretamente em SVG e em PDF"_ vira impossível de sustentar.

A solução é interpor uma **display list** entre a composição e o desenho:

```
conteúdo ──▶ /core/qr ──▶ QrArtifact ──┐
                                        ├──▶ /core/frames ──▶ Scene ──┬──▶ renderSvg   ──▶ .svg
      estilo, moldura, chamada ─────────┘   (14 funções puras)        ├──▶ renderCanvas ──▶ .png
                                                                      └──▶ renderPdf   ──▶ .pdf
                                                                                 │
                                                          rasteriza ◀────────────┘
                                                                 │
                                                                 ▼
                                                          /core/verify ──▶ veredito + margem de dano
```

`Scene` é um grafo plano e burro de primitivas, em milímetros, sem nenhum conhecimento de QR nem de formato de saída:

```ts
export type SceneNode =
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: Paint;
      stroke?: Paint;
      strokeWidth?: number;
    }
  | { kind: 'path'; d: string; fill: Paint } // os módulos do QR
  | {
      kind: 'text';
      x: number;
      y: number;
      text: string;
      font: 'display' | 'mono';
      size: number;
      weight: 400 | 500 | 600 | 700 | 800 | 900;
      tracking: number;
      align: 'start' | 'middle' | 'end';
      fill: Paint;
      rotate?: 0 | -90;
    } // -90 = etiqueta vertical
  | { kind: 'image'; x: number; y: number; w: number; h: number; href: string };

export interface Scene {
  width: number;
  height: number; // mm
  background: Paint | null;
  nodes: SceneNode[];
  meta: SceneMeta; // ficha técnica, para molduras que a imprimem
}

/** Paint carrega RGB e CMYK juntos: SVG/PNG usam rgb, PDF usa cmyk quando pedido. */
export type Paint = { rgb: string; cmyk?: [number, number, number, number] };
```

O que isso compra:

- **Cada moldura é escrita uma vez**, como função pura `(QrArtifact, FrameOptions) => Scene`. Testável sem DOM, sem canvas, sem PDF.
- Os três renderers ficam triviais e sem lógica de negócio — um `switch` sobre `kind`.
- O `Paint` com CMYK opcional é o que viabiliza o **preto 100% K** sem duplicar as molduras: SVG e PNG leem `rgb`, o PDF lê `cmyk` quando o usuário marca a opção.
- A verificação de leitura roda sobre a `Scene` **já composta com moldura e logo** — que é o artefato que o usuário realmente vai imprimir, não sobre o QR nu.
- Milímetro como unidade base, não pixel: o produto é para impressão. Pixel vira uma conversão de saída (`px = mm / 25.4 * dpi`), não a fonte da verdade.

**Ajuste que proponho ao `QrArtifact` do brief.** Você especificou `matrix: boolean[][]`. Sugiro `Uint8Array` plana com acessor, e mantenho tudo o mais:

```ts
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrArtifact {
  readonly data: Uint8Array; // size × size, linha-maior, 0|1
  readonly size: number; // 21..177 (o moduleCount do brief)
  readonly version: number; // 1..40
  readonly errorCorrection: ErrorCorrection;
  readonly maskPattern: number;
  readonly quietZone: 4; // literal: não há como zerar
  readonly payload: string;
  readonly byteLength: number;
  readonly capacityBytes: number; // teto da versão+nível, para a ficha técnica
  isDark(x: number, y: number): boolean;
}
```

Motivo: a matriz é lida em três lugares quentes (gerar path, rasterizar para verificar, rasterizar para dano simulado) e num v40 são 31.329 células. `boolean[][]` aloca 178 arrays; a plana aloca um buffer. O `isDark()` preserva a legibilidade nos laços e ainda faz o _bounds check_ que o `boolean[][]` não faz. `quietZone: 4` como tipo literal implementa a regra do brief no compilador, não em runtime.

---

## 2. Estrutura de pastas

```
app/
  layout.tsx                     # fontes, tokens, <html lang="pt-BR">, tema
  page.tsx                       # home + gerador
  qr-code-url/page.tsx           # landing (SEO)
  qr-code-texto/page.tsx         # landing (SEO)
  qr-estatico-vs-dinamico/page.tsx   # a página-tese
  manifest.ts  sitemap.ts  robots.ts
  icon.svg  apple-icon.png  opengraph-image.png
src/
  components/
    brand/         Logo.tsx  SeloPermanencia.tsx  Icone.tsx
    ui/            Botao  Chip  ControleSegmentado  Campo  Slider  Caixa  Aviso
    generator/     CampoConteudo  Previa  FichaTecnica  PainelCor  SeletorCorrecao
                   PainelTamanho  PainelLogo  PainelMoldura  PainelExportacao
                   RelatorioVerificacao  DistanciaLeitura
  core/
    qr/            create.ts  capacity.ts  types.ts
    scene/         types.ts  build.ts
    render/        svg.ts  canvas.ts  pdf.ts  pdf-fonts.ts
    frames/        index.ts  + 14 arquivos, um por moldura
    verify/        decode.ts  damage.ts  worker.ts  client.ts
  lib/            contrast.ts  units.ts  download.ts  format.ts  scan-distance.ts
  state/          reducer.ts  context.tsx  selectors.ts
public/           sw.js  favicon.ico  fonts/*.subset.ttf
docs/             brand/  PLANO.md  ROADMAP.md  ARQUITETURA.md
tests/            unit/  e2e/  fixtures/
```

Uma diferença em relação ao esboço do brief: **`/core/scene` é novo** (justificado na seção 1) e `/core/frames` produz `Scene` em vez de string SVG.

---

## 3. Dependências — versões verificadas hoje

Consultadas no registry em 25/07/2026. O brief dizia "Next.js 15+"; o atual é o **16**.

### Produção

| Pacote                | Versão  | Papel                                    | Custo no cliente      |
| --------------------- | ------- | ---------------------------------------- | --------------------- |
| `next`                | 16.2.12 | App Router, export estático              | —                     |
| `react` / `react-dom` | 19.2.8  |                                          | —                     |
| `qrcode`              | 1.5.4   | só `create()`, entrada `browser`         | ~12 KB gzip           |
| `jsqr`                | 1.4.0   | verificação de leitura, dentro do Worker | 56 KB gzip            |
| `pdf-lib`             | 1.17.1  | PDF vetorial                             | 202 KB gzip, **lazy** |
| `@pdf-lib/fontkit`    | 1.1.1   | subset de fonte no PDF                   | 330 KB gzip, **lazy** |

### Desenvolvimento

`typescript` 5.9.3 · `tailwindcss` 4.3.3 + `@tailwindcss/postcss` 4.3.3 · `vitest` 4.1.10 + `@vitest/coverage-v8` · `@playwright/test` 1.62.0 · `eslint` 10.8.0 + `eslint-config-next` 16.2.12 · `prettier` 3.9.6 · `happy-dom` 20.11.1.

> **Correção ao que escrevi antes:** a `latest` do `typescript` é a **7.0.2**, que é a reescrita em Go (`tsgo`). Fico na linha 5 — **5.9.3** — porque o ferramental de lint com tipos e o `next build` ainda não têm suporte estabelecido para a 7. Migrar depois é trocar uma linha; começar na 7 seria importar instabilidade para dentro do incremento 0.

**Sai:** `vite`, `@vitejs/plugin-react`, `@types/qrcode` (escrevo os tipos na fronteira do `create()`, que é onde as armadilhas estão), toda a `src/styles/global.css`.

**Fica:** o [.npmrc](../.npmrc). Sem ele o npm desta máquina cai num registry corporativo que devolve 404 em `jsqr` e `pdf-lib` — bati nisso na investigação.

### Sobre `jsqr` estar parado na 1.4.0

É a fraqueza da escolha e não vou esconder: último release há anos. Mitigação em três camadas — versão **fixada sem `^`**, nossa suíte de ida e volta cobrindo os 4 níveis × 14 molduras × com e sem logo (qualquer regressão quebra o CI), e a interface `Decoder` isolada em `verify/decode.ts`, de modo que trocar por `zxing-wasm` é reescrever um arquivo. Testei os dois lado a lado: **concordaram em 24/24 casos**, então a robustez extra do WASM não se pagaria a 440 KB gzip.

---

## 4. Design system

### 4.1 Tokens — Tailwind 4, `@theme`

Valores literais do board, sem interpretação:

```css
@theme {
  --color-carbon: #0e0f14;
  --color-graphite: #1c1e26;
  --color-steel: #6e7280;
  --color-rule: #e1e3e9;
  --color-quiet: #f3f4f7;
  --color-white: #ffffff;
  --color-ultramarine: #2c36f0;
  --color-ultramarine-deep: #141c99;
  --color-success: #30a46c;
  --color-warning: #f5a524;
  --color-error: #e5484d;
  --radius-none: 0px;
}
```

`border-radius: 0` não fica sob disciplina humana. Vira **regra de ESLint + teste E2E** que varre o DOM renderizado e falha se qualquer elemento computar `border-radius` diferente de `0px`. É um critério de aceite; trato como teste.

### 4.2 Tipografia

Carregada por `next/font/google`, que **baixa e auto-hospeda em tempo de build** — nenhuma requisição a `fonts.gstatic.com` em runtime, o que sustenta a promessa de que nada sai do navegador.

```ts
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-display' });
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-ui',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-data',
});
```

**Correção ao board:** ele pede `Archivo Expanded` via `<link>`, mas essa família **não existe no Google Fonts** — a requisição do próprio board retorna HTTP 400, então hoje ele renderiza em Archivo normal. A largura expandida existe como **eixo `wdth` (62–125) da variável Archivo**. Entrego o que o board quis (`axes: ['wdth']` + `font-stretch` nos títulos), que é mais fiel que o que o board escreveu.

A escala (`DISPLAY 60/62 −3%` … `MONO 13/20`) vira utilitários `@utility` nomeados, com `font-variant-numeric: tabular-nums` embutido no mono. Nenhum tamanho solto no JSX.

### 4.3 Logo

`src/components/brand/Logo.tsx`, geometria 7:5:3 exata do brief (`viewBox 0 0 280 280`, anel `120/7 = 17.1429`), props `size` e `variant: 'padrao' | 'mono-preto' | 'mono-branco' | 'app'`.

A **regra de escala do board é implementada, não documentada**: abaixo de 16px o componente troca sozinho para o ícone de aplicativo cheio (fundo Ultramarine, localizadores brancos), porque o vão interno colapsa. Um teste unitário verifica a troca no limiar.

Geração de `favicon.ico`, `icon.svg`, `apple-icon.png` e `opengraph-image.png` — as três últimas via as convenções nativas de arquivo do App Router, o que evita um passo de build manual.

### 4.4 Ícones

Os 8 do board (baixar, copiar, vetor, imprimir, cor, tamanho, correção, cadeado), transcritos em `Icone.tsx` a partir dos `path` exatos do arquivo. Grid 24, traço 2, `fill="none"`, cantos retos. Conjunto fechado, tipado por união de string — sem biblioteca externa.

### 4.5 Modo escuro — a trava que o brief não mencionou

O board é explícito e vou codificar isso:

> _"No modo escuro, invertemos apenas a interface. O código continua escuro sobre claro para não falhar em scanners."_

A cor dos módulos é independente do tema da UI. Além disso, um **aviso de polaridade** que o board não previu: se o usuário escolher um módulo escuro mais claro que o módulo claro, avisar — muitos scanners não leem código invertido, e a razão de contraste sozinha não detecta essa inversão.

---

## 5. Regras técnicas — como cada uma é implementada

### 5.1 Contraste

`lib/contrast.ts`: luminância relativa WCAG, razão `(L1+0.05)/(L2+0.05)`. Limiar de aviso em 4:1 conforme o board.

Scanners usam diferença de refletância (ISO/IEC 15415), não a razão WCAG — então o número é um proxy, e a interface diz isso.

**Correção ao que afirmei na Etapa 1.** Eu havia estimado o par `#6E7280` sobre branco em ≈3,5:1 e concluído que ele "reprovava no limiar e mesmo assim decodificava". Calculado de verdade, esse par dá **4,79:1** e portanto **passa** no limiar; o par que falhou (`#B4B4B4`) dá **2,07:1**, não 1,9:1. Os dois pontos que medi são **coerentes com o limiar de 4:1**, e não evidência de que ele seja conservador demais. Os valores agora estão ancorados em teste (`tests/unit/lib/contrast.test.ts`).

O texto do aviso continua o do board — _"abaixo de 4:1 o código pode falhar em scanners"_ — e **quem dá o veredito final é a verificação real**, porque contraste não é a única causa de falha: logo, moldura e densidade de módulo derrubam a leitura sem alterar a razão.

**Segunda imprecisão do board.** Ele anuncia `18,4 : 1` para Carbon sobre branco; pela fórmula WCAG 2.x o valor é **19,14**. O desenho do componente é mantido, o número passa a ser calculado.

### 5.2 Logo central

Teto de **16% de área**, exclusivo de `H`, recalculado em módulos por versão (`lado = round(0.4 × size)`), com padding branco de 1 módulo ao redor. Se a verificação falhar, **o download é bloqueado** com o motivo exato.

O limite de 16% vem de medição, não de folclore. Meus dados, com logo alinhado ao grid, jsQR e ZXing concordando em todos os pontos:

| Nível      | 10% | 16%   | 20% | 25%   |
| ---------- | --- | ----- | --- | ----- |
| L (v3)     | ✗   | ✗     | ✗   | ✗     |
| M (v4)     | ✓   | ✗     | ✗   | ✗     |
| Q (v4)     | ✓   | ✗     | ✗   | ✗     |
| **H (v6)** | ✓   | **✓** | ✓   | **✗** |

O "25% com correção H" que todo concorrente publica **não passa em nenhum dos dois decodificadores**. Confunde 30% de recuperação de _codewords_ com 30% de _área_, ignorando que uma oclusão central concentra o dano em blocos contíguos. 16% é 20% com margem.

### 5.3 Zona de silêncio

`quietZone: 4` é tipo literal em `QrArtifact`, sem parâmetro que permita alterar. (O código atual usa `margin: 2` — já está em violação hoje.)

### 5.4 Nada sai do navegador

Fontes auto-hospedadas em build, sem analytics, sem CDN, sem rota de API, `output: 'export'`. **Um teste E2E do Playwright intercepta toda requisição de rede durante um fluxo completo** — digitar, gerar, personalizar, exportar nos três formatos — e falha se qualquer uma sair da própria origem. A promessa vira teste automatizado, não parágrafo de README.

---

## 6. Os quatro extras aprovados

### 6.1 Molduras 9–14

Somam-se às 8 do board, todas como funções puras `=> Scene`:

9. **Hang tag de roupa** — furo de cordão marcado, formato vertical de etiqueta. _O caso de uso que originou o projeto._
10. **Grade N-up** — 2×2, 3×3 ou 4×6 numa A4, com linhas de recorte entre as células.
11. **Cartão de visita** — 90×50 mm, QR + linha de texto.
12. **Display de mesa dobrável** — dois lados, linha de dobra pontilhada.
13. **Cartaz** — A4/A5, título em Display + subtítulo + QR grande.
14. **Faixa horizontal** — QR à esquerda, chamada à direita.

A regra da chamada de ação (**máximo 24 caracteres, sempre caixa alta, sempre impressa e nunca codificada**) é validada no reducer e coberta por teste: o payload do QR jamais contém o texto da chamada.

### 6.2 PDF em preto 100% K / cor spot

O `Paint` da `Scene` já carrega CMYK. Com a opção ligada, `renderPdf` usa `cmyk(0,0,0,1)` em vez de `rgb(0,0,0)` — gráfica e serigrafia rejeitam preto rico. É pouca implementação e nenhum gerador gratuito entrega. O painel avisa que a opção converte a saída para uma única chapa.

### 6.3 Teste de dano simulado

Extensão da verificação: sobre o `ImageData` já composto, aplicar degradações crescentes e decodificar a cada passo, reportando **a margem de segurança medida**:

| Eixo              | Faixa         | Saída                        |
| ----------------- | ------------- | ---------------------------- |
| Oclusão aleatória | 0–40% da área | "lê com até 22% de dano"     |
| Ruído gaussiano   | σ 0–64        | "tolera impressão granulada" |
| Borrão box        | raio 0–6 px   | "lê fora de foco até raio 4" |
| Rotação           | 0–45°         | "lê inclinado até 30°"       |

Roda no mesmo Worker, depois da verificação básica, sem bloquear a UI. Vira uma linha na ficha técnica: `MARGEM DE DANO 22%`.

### 6.4 PWA offline + distância de leitura

Service worker escrito à mão (~60 linhas) — sem `next-pwa`, que está defasado para o Next 16 e traria peso para um problema simples. Precache do export estático, estratégia _cache-first_ com atualização em segundo plano. O app passa a funcionar sem rede depois da primeira visita: **"não depende deste site" deixa de ser slogan e vira comportamento.**

`lib/scan-distance.ts` calcula, a partir do lado e do DPI: distância máxima de leitura (regra de 10:1), lado mínimo recomendado para uma distância alvo, e o tamanho do módulo em mm — avisando abaixo de 0,4 mm, onde a impressão comum começa a falhar.

---

## 7. Testes

| Alvo                 | Tipo     | O que garante                                                                                             |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| Tabela de capacidade | unit     | as 160 células conferidas contra `qrcode`; upgrade que mude a tabela quebra o CI antes de a ficha mentir  |
| `lib/contrast.ts`    | unit     | bordas: iguais, preto/branco, polaridade invertida, canal único                                           |
| `lib/units.ts`       | unit     | px↔mm↔DPI ida e volta em 150/300/600                                                                      |
| **Ida e volta**      | unit     | gerar → compor → rasterizar → decodificar → comparar, para **L/M/Q/H × 14 molduras × com e sem logo**     |
| Merge do SVG         | unit     | rasteriza o `<path>` único e compara **pixel a pixel** com um rect-por-módulo; qualquer divergência falha |
| Molduras             | snapshot | `Scene` serializada, uma por moldura                                                                      |
| Chamada de ação      | unit     | o payload nunca contém o texto da chamada                                                                 |
| Logo                 | unit     | >16% ou nível ≠ H é rejeitado antes de renderizar                                                         |
| Zero rede            | e2e      | fluxo completo sem uma requisição fora da origem                                                          |
| `border-radius: 0`   | e2e      | varredura do DOM computado                                                                                |
| Teclado              | e2e      | fluxo inteiro sem mouse, foco visível em cada parada                                                      |

`npm run check` = `typecheck && lint && format:check && test && build`. GitHub Actions roda em cada PR, em Node 22 e 24.

---

## 8. Incrementos entregáveis

Cada um termina com diff, `npm run check` verde e **parada para sua validação antes de commitar**. Na ordem que o brief pediu: núcleo primeiro, porque é onde está o risco.

| #     | Entrega                                  | Contém                                                                                                                                                                                                          |
| ----- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Fundação                                 | Next 16 + TS strict + Tailwind 4 + tokens, ESLint/Prettier, Vitest, Playwright, `npm run check`, GitHub Actions. Vite e `global.css` removidos. App ainda não funciona — é andaime.                             |
| **1** | `/core/qr` + `/lib`                      | `QrArtifact`, tabela de capacidade + teste das 160 células, contraste, unidades, distância de leitura. **Primeiro ponto em que o risco principal é eliminado.**                                                 |
| **2** | `/core/scene` + `/core/render` SVG e PNG | Display list, `renderSvg` com path único, `renderCanvas`. Teste de equivalência pixel a pixel.                                                                                                                  |
| **3** | `/core/verify`                           | Worker, jsQR, ida e volta nos 4 níveis, logo, dano simulado.                                                                                                                                                    |
| **4** | Design system                            | `Logo` com troca automática em 16px, 8 ícones, componentes `/ui` nos quatro tipos e três estados, claro e escuro.                                                                                               |
| **5** | UI do gerador                            | Campo, prévia com quiet zone visível, **ficha técnica com números reais**, correção, tamanho/DPI, cor com contraste, logo, relatório de verificação. Ponto em que o produto volta a funcionar de ponta a ponta. |
| **6** | `/core/frames`                           | As 14 molduras em SVG, com painel e prévia.                                                                                                                                                                     |
| **7** | PDF                                      | `pdf-lib` lazy, fontes subset, papéis, marcas de corte, sangria 3 mm, ficha no rodapé, preto 100% K, N-up.                                                                                                      |
| **8** | Rotas, PWA, acabamento                   | 4 páginas, sitemap, OG, service worker, acessibilidade completa, Lighthouse, **README novo**, `ROADMAP.md`, `ARQUITETURA.md`.                                                                                   |

---

## 9. Riscos remanescentes

| Risco                                                                     | Probabilidade                | Mitigação                                                                                                |
| ------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `jsqr` sem manutenção                                                     | média                        | versão fixa, interface `Decoder` isolada, suíte própria de ida e volta                                   |
| Tabela de capacidade em API privada do `qrcode`                           | baixa                        | tabela própria + teste cruzado que quebra no upgrade                                                     |
| Chunk de PDF pesado (~570 KB gzip)                                        | baixa                        | `import()` no clique, estado de carregamento, não afeta first-load nem Lighthouse                        |
| Molduras divergirem entre SVG e PDF                                       | **eliminado por construção** | uma `Scene`, três renderers burros                                                                       |
| 14 molduras × 4 níveis × 2 (logo) = 112 casos de ida e volta lentos no CI | média                        | matriz reduzida no pré-commit, completa no CI; medi 4–28 ms por decodificação, o conjunto fecha em ~10 s |
| Lighthouse < 95 por causa das fontes                                      | baixa                        | `display: 'swap'`, subset latin, auto-hospedagem, preload só do Display                                  |

---

## 10. Pendências — resolvidas em 25/07/2026

1. **Tag do estado atual** — autorizada e executada. `v1.0.0` aponta para `9f06e6b`, publicada no `origin`.
2. **Números da ficha técnica** — confirmado: o desenho do board é mantido pixel a pixel, os valores passam a ser calculados de verdade a partir da tabela ISO/IEC 18004.
3. **Domínio de produção** — deploy na Vercel. Em vez de fixar uma URL, `sitemap.ts`, `robots.ts` e as canônicas leem `NEXT_PUBLIC_SITE_URL`, com fallback para `VERCEL_PROJECT_PRODUCTION_URL` (injetada pela própria Vercel no build) e, por último, `http://localhost:3000`. Assim o preview e a produção ficam corretos sem nenhuma edição de código.

Plano aprovado. Execução a partir do incremento 0.
