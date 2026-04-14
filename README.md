# QR Code Studio

Aplicação web para gerar QR Codes a partir de uma URL informada pelo usuário, com validação amigável, interface moderna e download da imagem em PNG.

## Visão geral

O projeto foi construído como uma solução frontend-only porque esse problema não exige backend para entregar uma boa experiência. Isso reduz complexidade, facilita a execução local e mantém a manutenção simples.

A interface foi pensada para ser limpa, moderna e objetiva, com foco em:

- geração rápida de QR Code
- validação clara da URL
- feedback visual amigável
- download prático do QR Code em PNG

## Tecnologias utilizadas

- React 18
- TypeScript
- Vite
- qrcode
- CSS puro com arquitetura simples e organizada

## Funcionalidades

- campo de entrada para URL
- validação da URL informada
- geração do QR Code com um clique
- feedback visual em caso de erro ou sucesso
- download do QR Code em PNG
- interface responsiva e agradável visualmente

## Como instalar

### Pré-requisitos

- Node.js 18 ou superior
- npm 9 ou superior

### Instalação

```bash
npm install
```

## Como executar localmente

### Ambiente de desenvolvimento

```bash
npm run dev
```

Depois disso, abra o endereço exibido no terminal. Por padrão, o Vite costuma iniciar em:

```bash
http://localhost:5173
```

### Build de produção

```bash
npm run build
```

### Visualizar a build localmente

```bash
npm run preview
```

## Como usar

1. Abra a aplicação no navegador.
2. Informe uma URL válida no campo de entrada.
3. Clique em **Gerar QR Code**.
4. Veja a pré-visualização do QR Code.
5. Clique em **Baixar PNG** para salvar a imagem.

## Estrutura de pastas

```text
qr-code-studio/
├── public/
├── src/
│   ├── components/
│   │   ├── QrGeneratorCard.tsx
│   │   └── QrPreviewCard.tsx
│   ├── styles/
│   │   └── global.css
│   ├── utils/
│   │   └── url.ts
│   ├── App.tsx
│   └── main.tsx
├── .gitignore
├── index.html
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

## Decisões técnicas

### Por que React + TypeScript + Vite?

Essa stack entrega um ótimo equilíbrio entre produtividade, organização e experiência de desenvolvimento.

- **React** facilita a composição da interface em componentes reutilizáveis.
- **TypeScript** melhora a legibilidade e reduz erros com tipagem estática.
- **Vite** oferece setup rápido, execução leve e excelente experiência local.

### Por que frontend-only?

Como a geração do QR Code pode ser feita inteiramente no navegador, não há necessidade real de backend. Isso torna o projeto:

- mais simples de manter
- mais fácil de executar
- mais rápido de testar
- mais direto para o usuário final

## Validação da URL

A aplicação aceita apenas URLs com protocolo `http://` ou `https://`.

Exemplos válidos:

- `https://www.google.com`
- `http://meusite.com`

Exemplos inválidos:

- `google.com`
- `ftp://arquivo.com`
- texto sem formato de URL

## Possíveis melhorias futuras

- copiar a URL ou o QR Code para a área de transferência
- personalizar cores do QR Code
- exportar também em SVG
- salvar histórico local dos QR Codes gerados
- permitir inclusão de logotipo central no QR Code
- adicionar testes automatizados

## Scripts disponíveis

```bash
npm run dev
npm run build
npm run preview
```

## Resultado esperado

Ao executar o projeto, o usuário terá uma tela moderna onde poderá informar uma URL, gerar o QR Code instantaneamente e baixar a imagem em PNG.
