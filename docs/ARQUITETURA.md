# Arquitetura

Como o código está organizado e por quê. Para o que ainda falta, veja
[ROADMAP.md](ROADMAP.md); para retomar o trabalho, [HANDOFF.md](HANDOFF.md).

---

## O fluxo

```
conteúdo ──▶ /core/qr ──▶ QrArtifact ──┐
                                        ├──▶ /core/frames ──▶ Scene ──┬──▶ render/svg
      estilo, moldura, chamada ─────────┘   (14 funções puras)        ├──▶ render/canvas → PNG
                                                                      ├──▶ render/pdf
                                                                      └──▶ render/raster (puro)
                                                                                 │
                                                          /core/verify ◀─────────┘
                                                          decodifica de volta
```

Quatro camadas, cada uma ignorando a seguinte:

| Camada         | Responsabilidade              | Não sabe                |
| -------------- | ----------------------------- | ----------------------- |
| `/core/qr`     | conteúdo → matriz + metadados | que existe desenho      |
| `/core/frames` | matriz + estilo → cena        | que existe SVG ou PDF   |
| `/core/render` | cena → arquivo                | como a cena foi montada |
| `/core/verify` | cena → veredito               | que existe interface    |

---

## A decisão central: uma display list

14 molduras × 3 formatos de saída dariam 42 implementações que precisariam concordar pixel a
pixel. Se cada renderer desenhasse as molduras por conta própria, o critério "as molduras
renderizam corretamente em SVG e em PDF" seria impossível de sustentar.

A `Scene` (`core/scene/types.ts`) é um grafo plano de primitivas, em milímetros, sem nenhum
conhecimento de QR nem de formato:

```ts
type SceneNode =
  | { kind: 'rect'; x; y; w; h; fill?; stroke?; strokeWidth? }
  | { kind: 'qr'; x; y; side; artifact; dark; light }
  | { kind: 'text'; x; y; text; font; size; weight; tracking; align; fill; rotate? }
  | { kind: 'image'; x; y; w; h; href };
```

Consequências:

- **Cada moldura é escrita uma vez**, como função pura `(OpcoesMoldura) => Scene`. Testável sem
  DOM, sem canvas, sem PDF.
- Os renderers viram um `switch` sobre `kind`, sem regra de negócio.
- O `Paint` carrega **RGB e CMYK juntos**, e é isso que viabiliza o preto 100% K sem duplicar
  nenhuma moldura: SVG e PNG leem `rgb`, o PDF lê `cmyk` quando o usuário pede.
- A verificação roda sobre a cena **já composta**, que é o artefato que vai para o papel.

### Por que `{ kind: 'qr' }` e não `{ kind: 'path', d }`

O plano original guardava o caminho já resolvido. Com ele pronto, o rasterizador precisaria de um
interpretador completo de SVG path para poder verificar a leitura — justamente a feature que
sustenta o produto. Guardando o artefato, cada renderer resolve como lhe convém: o SVG emite um
`<path>` único, o rasterizador percorre módulos, o PDF desenha retângulos.

### Milímetro, não pixel

O produto existe para impressão. "1024 px" só significa alguma coisa depois de escolhido o DPI,
então pixel é uma conversão de saída (`px = mm / 25.4 × dpi`), nunca a fonte da verdade.

---

## As duas rotas de rasterização

De propósito, com papéis distintos:

| Função                           | Onde roda         | Para quê                        |
| -------------------------------- | ----------------- | ------------------------------- |
| `rasterizarCena` (puro, sem DOM) | Node e Web Worker | verificação de leitura e testes |
| `desenharCena` (Canvas2D)        | navegador         | prévia na tela e exportação PNG |

Só podem divergir em texto e imagem, que por construção ficam fora da área do código —
invariante checada por `nosSobrepondoOCodigo()`, que também protege a regra de que a chamada de
ação é impressa ao lado, nunca por cima.

O rasterizador puro existe para que a suíte de ida e volta rode no Node. Um rasterizador
dependente de canvas tornaria esse teste impossível fora do navegador, e ele é o argumento
central do produto.

---

## Armadilhas da biblioteca `qrcode`

Normalizadas na fronteira, em `core/qr/create.ts`, e documentadas porque custaram tempo:

```
errorCorrectionLevel  →  { bit: number }, não a letra   (L=1, M=0, Q=3, H=2)
modules.get(row, col) →  number, e LINHA PRIMEIRO
```

A segunda é a mais perigosa do projeto. Escrever `get(x, y)` produz a matriz **transposta** — um
QR espelhado. O erro é traiçoeiro porque a transposição mantém os três padrões de localização nos
cantos certos, e jsQR e ZXing leem espelhado sem reclamar: só parte dos leitores de celular
falha. Por isso `create.ts` copia `modules.data` e indexa explicitamente por `y * size + x`, e há
teste ancorado no **módulo escuro** do ISO/IEC 18004, que fica sempre em `(coluna 8, linha
size − 8)`.

A tabela de capacidade também não é API pública — só existe em `qrcode/lib/core/version.js`. Por
isso `core/qr/capacity.ts` tem tabela própria, guardada por dois testes: cross-check das 160
células contra a biblioteca, e verificação comportamental de fronteira independente da origem.

---

## Verificação de leitura

`verificarLeitura(cena)` recorta a cena para a região do código, rasteriza, decodifica e compara
com o payload. O recorte é o que um scanner de fato enxerga, e resolve um problema concreto:
molduras que repetem o código — grade recortável e display de mesa — apresentam vários conjuntos
de padrões de localização na mesma imagem, e o decodificador não sabe qual seguir.

Quando falha, o diagnóstico vem de **experimentos controlados**, não de heurística: remove o
logo, devolve as cores ao padrão, aumenta a escala. O primeiro que faz o código voltar a ler é a
causa isolada por eliminação, e o veredito carrega `confirmada: true`.

Polaridade invertida é checada antes de tudo, sem experimento: inverter as duas cores mantém a
razão de contraste idêntica, então nenhum teste de cor a distinguiria. O decodificador roda com
`dontInvert` justamente para que esse caso falhe aqui, e não no celular do usuário.

Tudo isso vive num Web Worker (`core/verify/worker.ts`) com debounce e política de
último-pedido-vence. A `Scene` inteira viaja para lá; só o `QrArtifact` precisa ser desidratado e
reidratado, porque `postMessage` descarta funções.

---

## Estado

`useReducer` local, sem Context e sem biblioteca. O estado é um único objeto de configuração e
ninguém escreve nele de fora da subárvore do `Gerador`. O custo real de performance está na
cadeia derivada (matriz → cena → verificação), resolvida com `useMemo` e o Worker.

`state/derivar.ts` é função pura fora dos componentes: a interface só chama e memoiza. Isso
mantém a lógica testável sem React e evita que um `useMemo` mal colocado recalcule a matriz a
cada tecla.

Duas regras de coerência moram no reducer, e existem para impedir arquivo quebrado:

- **Baixar o nível de correção descarta o logo**, porque logo central só é viável em H. Perda
  explícita é melhor que arquivo que não lê.
- **Trocar de unidade preserva o tamanho físico**; trocar o DPI em pixels reconverte o lado, para
  o tamanho impresso não mudar sem o usuário pedir.

---

## Divisão de bundle

|                                           | gzip                         |
| ----------------------------------------- | ---------------------------- |
| First-load                                | **206 KB**                   |
| Chunk de PDF (pdf-lib + fontkit + fontes) | 532 KB, `import()` no clique |

As fontes do PDF são **embutidas**, não servidas de `/public`: um `fetch`, mesmo da própria
origem, abriria um caminho de rede num produto cuja tese é que nada sai do navegador. As 441 KB
de TTF viram 66 KB depois de instanciar o Archivo variável em `wght=800/wdth=125` e subsetar para
Latin-1 e Latin Extended-A (`scripts/subset-fontes.py`).

---

## O que é garantido por construção

Regras que não dependem de disciplina humana:

| Regra                            | Como é garantida                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `border-radius: 0`               | os namespaces `--radius-*`, `--shadow-*` e `--blur-*` do Tailwind foram zerados: as classes **não existem**. Mais teste E2E varrendo o DOM computado |
| Zona de silêncio de 4 módulos    | tipo literal em `QrArtifact`, sem parâmetro que permita mudar                                                                                        |
| Nada sai do navegador            | `output: 'export'`, `fetch` proibido no ESLint, fontes auto-hospedadas, teste E2E que falha se qualquer requisição escapar                           |
| Chamada de ação nunca codificada | teste sobre as 14 molduras conferindo `meta.payload`                                                                                                 |
| Chamada nunca sobre os módulos   | `nosSobrepondoOCodigo()` sobre as 14 molduras                                                                                                        |
| Selo de permanência literal      | constante única, sem prop de texto no componente, com teste travando o literal                                                                       |
| Ficha técnica com números reais  | tabela ISO/IEC 18004 com dois testes de guarda                                                                                                       |
