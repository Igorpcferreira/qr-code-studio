# Handoff — continuação da refatoração

> Documento vivo. Atualizado ao fim de cada incremento.
> **Última atualização:** incremento 1 concluído.
>
> Se você é uma nova sessão retomando este trabalho: leia este arquivo inteiro, depois
> [PLANO.md](PLANO.md). O brand board em `docs/brand/` é autoritativo para qualquer decisão visual.

---

## 1. Onde estamos

|                             |                                           |
| --------------------------- | ----------------------------------------- |
| Branch                      | `refactor/fase-1` (publicada em `origin`) |
| Tag do estado anterior      | `v1.0.0` → commit `9f06e6b`               |
| Último incremento concluído | **1 — núcleo `/core/qr` e `/lib`**        |
| Próximo                     | **2 — `/core/scene` e renderers SVG/PNG** |
| `npm run check`             | passando                                  |
| Testes unitários            | 71 passando                               |
| `npm run test:e2e`          | 3 testes passando                         |

Deploy previsto na Vercel. Sem domínio próprio ainda — `src/lib/site.ts` resolve a URL a
partir de `NEXT_PUBLIC_SITE_URL`, depois `VERCEL_PROJECT_PRODUCTION_URL`, depois localhost.

---

## 2. Regras inegociáveis

Estas vêm do brief e do brand board. Violá-las é quebrar o produto, não apenas o estilo.

1. **Nunca commitar sem autorização explícita do Igor.** Ao fim de cada incremento: mostrar
   `git status`, `git diff --stat`, rodar `npm run check`, sugerir a mensagem e **parar**.
2. **Só QR estático.** Nada de redirecionamento, encurtador, rastreamento de scan ou qualquer
   dependência de servidor. Isso destruiria a tese da marca.
3. **Nada sai do navegador.** Sem analytics, sem CDN, sem rota de API. Já existe teste E2E que
   falha se qualquer requisição sair da origem.
4. **`border-radius: 0` em tudo.** Já garantido por construção: os namespaces `--radius-*`,
   `--shadow-*` e `--blur-*` do Tailwind foram zerados em `app/globals.css`, então as classes
   `rounded-*`, `shadow-*` e `blur-*` **não existem**. Há teste E2E varrendo o DOM computado.
5. **Zona de silêncio = 4 módulos, sempre.** É tipo literal em `QrArtifact`, sem parâmetro.
6. **Um acento só** (Ultramarine `#2C36F0`). Nenhuma cor secundária decorativa.
7. **No modo escuro, só a interface inverte.** O QR continua escuro sobre claro. As variáveis
   `--qr-dark` / `--qr-light` estão deliberadamente fora do `light-dark()`.
8. **Selo de permanência:** o texto vive em `SELO_PERMANENCIA` (`src/lib/site.ts`) e **nunca é
   reescrito**. Há teste unitário travando o literal.
9. **A chamada de ação é impressa, nunca codificada.** Máx. 24 caracteres, sempre caixa alta.
   O payload do QR jamais a contém.
10. **Logo central:** teto de **16% de área**, exclusivo do nível `H`. Se a verificação de
    leitura falhar, **bloquear a exportação** com o motivo exato.

---

## 3. Achados que custaram tempo — não redescubra

### `QRCode.create()` devolve coisas diferentes do que a documentação sugere

```
errorCorrectionLevel  →  { bit: number }   e NÃO a letra 'H'   (L=1, M=0, Q=3, H=2)
modules.get(row, col) →  number (0|1)      e NÃO boolean, e LINHA PRIMEIRO
```

O mapeamento de bits **não segue ordem alfabética nem de robustez**. Confirmar sempre por
teste, nunca de memória.

### O `get()` da matriz é `(linha, coluna)` — a armadilha mais perigosa do projeto

Escrever `get(x, y)` produz a matriz **transposta**, ou seja um QR espelhado. É traiçoeiro
porque a transposição mantém os três padrões de localização nos cantos certos, então o código
continua parecendo um QR válido, e **jsQR e ZXing leem espelhado sem reclamar** — só parte dos
leitores de celular falha. Eu mesmo cometi esse erro nos experimentos da investigação.

Por isso `create.ts` copia `modules.data` e indexa explicitamente por `y * size + x`, sem
nunca chamar `get()`. A convenção está confirmada contra o renderizador da própria biblioteca
(`lib/renderer/svg-tag.js`: `col = i % size`, `row = floor(i / size)`).

O teste decisivo está em `tests/unit/core/qr/create.test.ts`: o **módulo escuro** do padrão
ISO/IEC 18004 fica sempre em `(coluna 8, linha size - 8)`, e a posição transposta pertence à
informação de formato e varia. Há um segundo teste provando que a posição transposta de fato
varia — sem ele, o primeiro poderia passar por coincidência.

### A tabela de capacidade não é API pública

Só existe em `qrcode/lib/core/version.js`. O deep import funciona (o pacote não tem `exports`
map), mas é privado. Por isso `src/core/qr/capacity.ts` tem tabela própria, guardada por dois
testes: cross-check contra a lib e verificação comportamental de fronteira.

### O board tem números impossíveis na ficha técnica

`CAPACIDADE 1.782 / 2.303 bytes` para v6/H não existe — o teto do formato em H é 1.273 bytes,
e em v6/H são 58. **O desenho da ficha é fiel ao board; os valores são calculados de verdade.**

O board também erra o contraste: anuncia `18,4 : 1` para Carbon sobre branco, quando a fórmula
WCAG 2.x dá **19,14**. Ambos os números estão ancorados em teste.

### Correção a um número que eu mesmo publiquei na investigação

Na Etapa 1 afirmei que `#6E7280` sobre branco dava "≈3,5:1" e mesmo assim decodificava, o que
sugeriria um limiar conservador demais. Calculado de verdade, esse par dá **4,79:1** e portanto
**passa** no limiar de 4:1; o par que falhou dá **2,07:1**. Os dados medidos são **coerentes com
o limiar**, não evidência contra ele. Não repita a afirmação antiga em README ou copy.

### O limite de logo de 25% é folclore

Medido com jsQR e ZXing, que concordaram em 24/24 casos:

| Nível | 10% | 16%   | 20% | 25%   |
| ----- | --- | ----- | --- | ----- |
| L     | ✗   | ✗     | ✗   | ✗     |
| M     | ✓   | ✗     | ✗   | ✗     |
| Q     | ✓   | ✗     | ✗   | ✗     |
| H     | ✓   | **✓** | ✓   | **✗** |

### `Archivo Expanded` não existe no Google Fonts

O `<link>` do próprio board retorna HTTP 400. A largura expandida é o eixo `wdth` (62–125) da
variável Archivo — já configurado em `app/layout.tsx` via `axes: ['wdth']`.

### ESLint 10 quebra com o `eslint-plugin-react` embutido no `eslint-config-next`

`context.getFilename()` foi removida na v10. Resolvido declarando `settings.react.version`
explicitamente em `eslint.config.mjs` — não remova essa linha.

### O `.npmrc` do projeto é essencial

Sem ele o npm cai num registry corporativo que devolve 404 em `jsqr` e `pdf-lib`.

### Cuidado com servidor órfão na porta 4173

O `reuseExistingServer` do Playwright adota qualquer coisa que já esteja escutando. Um
`vite preview` esquecido fez os E2E rodarem contra o build antigo. Se um teste E2E falhar de
forma inexplicável, **confira primeiro quem está na 4173**:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
```

### `npm audit` reporta 9 high, 3 em produção

Todas transitivas e sem correção upstream: `postcss` e `sharp`/libvips via `next`,
`brace-expansion`→`minimatch` na cadeia do ESLint. Não exploráveis aqui (`sharp` não roda com
`images.unoptimized` + export estático). Conhecido e aceito — não "conserte" com `--force`.

---

## 4. O que falta, em ordem

Detalhamento completo em [PLANO.md](PLANO.md) §8. Resumo executável:

### ~~Incremento 1 — `/core/qr` e `/lib`~~ CONCLUÍDO

Entregue: `QrArtifact` (`core/qr/types.ts`, `create.ts`) com `Result` em vez de exceção,
porque conteúdo grande demais é estado normal da interface, não erro. Tabela de capacidade
com os dois guardas. `lib/contrast.ts` com **detecção de polaridade invertida** — inverter as
duas cores mantém a razão idêntica, então só o número jamais detectaria o problema.
`lib/units.ts` (inclui `ajustarParaModuloInteiro`, que evita costura no PNG) e
`lib/scan-distance.ts`. Tipos de `qrcode` escritos à mão em `src/types/qrcode.d.ts`.

**A API que o resto do projeto consome:**

```ts
criarArtefato(conteudo, nivel): ResultadoCriacao   // { ok: true, artefato } | { ok: false, erro }
artefato.isDark(x, y)                              // x = coluna, y = linha
artefato.sizeComQuietZone                          // size + 8, o que vai para o papel
avaliarContraste(moduloEscuro, moduloClaro)        // razão, nível, polaridadeInvertida, mensagem
avaliarImpressao({ ladoMm, modulosComQuietZone, dpi })
```

### Incremento 2 — `/core/scene` e renderers SVG/PNG ← PRÓXIMO

A display list descrita em PLANO.md §1. `renderSvg` com **`<path>` único** por runs
horizontais — medido: 69,7 KB → 8,2 KB num v8. Teste de equivalência pixel a pixel contra
um rect por módulo.

### Incremento 3 — `/core/verify`

`jsqr` fixado sem `^`, dentro de Web Worker com `OffscreenCanvas`, com debounce.
Ida e volta nos 4 níveis, com e sem logo. Teste de dano simulado (oclusão, ruído, borrão,
rotação) reportando margem de segurança.

### Incremento 4 — Design system

`Logo.tsx` com geometria 7:5:3 e **troca automática para o ícone cheio abaixo de 16px**.
Os 8 ícones do board. Componentes `/ui` nos 4 tipos × 3 estados, claro e escuro.

### Incremento 5 — Interface do gerador

Campo, prévia com quiet zone visível, **ficha técnica com números reais**, seletor de
correção, tamanho/DPI, cor com indicador de contraste, logo, relatório de verificação.
Estado com `useReducer` + Context. Aqui `src/lib/url.ts` volta a ser usado.

### Incremento 6 — As 14 molduras

8 do board + hang tag de roupa, grade N-up, cartão de visita, display de mesa, cartaz,
faixa horizontal. Todas como funções puras `=> Scene`.

### Incremento 7 — PDF

`pdf-lib` + `@pdf-lib/fontkit` em chunk `import()` disparado no clique. Fontes pré-subsetadas
em build. Papéis A4/Carta/Etiqueta 50, marcas de corte, sangria 3 mm, ficha no rodapé,
**preto 100% K via `cmyk()`**, N-up.

### Incremento 8 — Rotas, PWA e acabamento

`/`, `/qr-code-url`, `/qr-code-texto`, `/qr-estatico-vs-dinamico`. Sitemap, robots, OG.
Service worker escrito à mão (~60 linhas, sem `next-pwa`). Acessibilidade completa,
Lighthouse >95, **README novo em português como peça de portfólio**, `ROADMAP.md` com as
Fases 2 e 3, `ARQUITETURA.md`.

---

## 5. Comandos

```bash
npm run dev          # desenvolvimento
npm run check        # typecheck + lint + format + testes + build  ← o portão
npm run test:watch   # unitários em watch
npm run test:e2e     # E2E contra o export estático (roda build antes)
npm run preview      # serve out/ na 4173
```

`npm run check` precisa passar limpo antes de qualquer commit.

---

## 6. Fases futuras (fora deste escopo)

**Fase 2 — tipos de conteúdo:** Wi-Fi, e-mail, SMS, telefone, geo, vCard e **Pix (BR Code)**.
O Pix é payload EMV-MPM em TLV com CRC16-CCITT, e o Pix estático é estático por natureza —
encaixe perfeito na tese da marca e o diferencial mais forte para público brasileiro.

**Fase 3 — lote e histórico:** CSV → muitos QRs → ZIP. Histórico local em IndexedDB.
