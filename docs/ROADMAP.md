# Roadmap

As fases 1, 2 e 3 estão concluídas. O que segue está fora do escopo entregue e listado aqui para
não se perder.

---

## ~~Fase 1 — núcleo, renderers, molduras e PDF~~ CONCLUÍDA

Matriz, display list, verificação de leitura por decodificação, sistema de marca, interface do
gerador, 14 molduras, PDF vetorial com fontes embutidas, rotas de SEO e PWA offline.

## ~~Fase 2 — tipos de conteúdo~~ CONCLUÍDA

Nove tipos: URL, texto, **Pix (BR Code)**, Wi-Fi, contato (vCard), e-mail, SMS, telefone e
geolocalização.

O Pix ganhou o segundo nível de verificação que esta seção previa: além de decodificar o desenho de
volta, o BR Code é remontado a partir do TLV e o CRC-16 é conferido.

## ~~Fase 3 — lote e histórico~~ CONCLUÍDA

CSV → muitos QRs → ZIP, num Web Worker com progresso e verificação por linha. Histórico local em
IndexedDB, com a configuração inteira restaurável.

## ~~Forma e cor dos módulos~~ CONCLUÍDA

Cinco formas — clássico, arredondado, pontos, losango e circuito — como lista de primitivas em
unidades de módulo, consumida pelos quatro renderizadores. Paletas prontas e cor própria para os
marcadores de canto. A verificação de leitura ganhou o experimento que isola a forma como causa.

---

## O que faria sentido depois

Nada disto está prometido. É o que a arquitetura já comporta e alguém pediria primeiro.

### Lote de Pix

Hoje o lote atende URL e texto — os dois tipos cujo conteúdo é um valor único. Uma planilha de
cobranças (valor e identificador por linha, chave e recebedor fixos) é o próximo caso com demanda
real, e cai bem no mesmo laço: só o mapeamento de colunas muda.

Um CSV que preenchesse os doze campos de um vCard já seria outra coisa — um mapeador de esquema, não
um lote.

### Logo vetorial no PDF

Hoje o logo não entra no PDF. Embutir imagem exigiria decodificar PNG/JPEG dentro do chunk, e um
logo rasterizado num arquivo vendido como vetorial seria contraditório. A saída correta é converter
o logo em traçado quando ele for SVG, e recusar raster com uma explicação. SVG e PNG seguem levando
o logo.

### Texto do SVG em contorno

O `<text>` exportado referencia a família da fonte. Uma gráfica sem Archivo instalado substitui a
fonte. O `@pdf-lib/fontkit` já está no projeto e sabe extrair contornos de glifo; dá para reusá-lo.
Vale a pena quando alguém de fato levar um SVG com moldura para impressão.

---

## Dívidas conhecidas

Registradas com o motivo, não como pendência esquecida.

### O eixo de rotação do teste de dano satura

Mede sempre 45°, em todos os níveis de correção, porque os três padrões de localização tornam o QR
invariante a rotação. Fica fora do relatório padrão por não informar nada, mas continua disponível
sob demanda.

### `jsqr` está parado na versão 1.4.0

Sem releases há anos. Mitigado com versão fixada, interface `Decodificador` isolada e a suíte
própria de ida e volta. Trocar por `zxing-wasm` é reescrever um arquivo — mas custaria 440 KB gzip
contra 56 KB, e na investigação os dois concordaram em 24 de 24 casos.

### O lote é limitado a 2.000 linhas

Teto da interface, não do algoritmo. Acima disso o gargalo é memória do navegador para segurar
todas as peças antes de fechar o ZIP; resolver de verdade exigiria escrever o ZIP em fluxo, com
`File System Access API` ou `showSaveFilePicker`, que não existe em todos os navegadores.

### O PNG do lote não usa filtro adaptativo

Todas as linhas saem com filtro zero. Para um desenho de dois tons os filtros do PNG ajudam pouco —
eles existem para fotografia — mas num lote com moldura colorida haveria alguns por cento a ganhar.
Não medido, porque o custo do arquivo maior recai sobre o disco do usuário, não sobre a rede.

### `npm audit` reporta 9 vulnerabilidades high

Todas transitivas e sem correção upstream: `postcss` e `sharp`/libvips via `next`,
`brace-expansion` → `minimatch` na cadeia do ESLint. Não exploráveis neste projeto — `sharp` não
roda com `images.unoptimized` e export estático, e o `postcss` só processa CSS próprio em build.

---

## Deliberadamente fora de escopo, para sempre

Não são pendências. São coisas que o produto **não vai fazer**, porque fariam dele outra coisa:

- Redirecionamento, encurtador ou QR dinâmico.
- Rastreamento de leituras.
- Conta de usuário, plano pago, limite de uso.
- Analytics de terceiros.
- Histórico sincronizado entre dispositivos.

Qualquer um deles exigiria um servidor, e um servidor é exatamente o que pode ser desligado.
