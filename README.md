# Luta de Palitos

> Luta 2D de palitos no estilo dos stick fights dos anos 2000, com vida, soco, chute, defesa, sangue e K.O. Contra a CPU, 2 jogadores ou modo Demo que luta sozinho na tela de espera.

**Ver ao vivo, com preview e manual:** https://flowcoresolucoes.com.br/codigos/game-luta-palitos

Criado por **FlowCore Soluções LTDA**.

## Como jogar

- `A` `D` andar (ou ← →)
- `W` pular (ou ↑)
- `S` defender (ou ↓)
- `F` soco (ou K)
- `G` chute (ou L)
- `P` pausar
- **No celular:** Botões na tela: ◀ ▲ ▶, Defesa, Soco e Chute. No modo 2 jogadores o P2 usa setas + K soco e L chute.

## Arquivos

- [`src/LutaPalitos.tsx`](src/LutaPalitos.tsx)

## Como instalar

1. **Tenha um projeto React com Tailwind** Já tem (Vite, Next.js, Remix)? Pule este passo. Se não, crie um em 1 minuto e adicione ./src/**/*.{ts,tsx} ao content do tailwind.config.

   ```bash
   npm create vite@latest minha-app -- --template react-ts
   cd minha-app
   npm install -D tailwindcss@3 postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Crie o arquivo src/components/LutaPalitos.tsx** Copie o conteúdo de `src/LutaPalitos.tsx` deste repositório. Ele é um arquivo só, sem dependência além de React.
3. **Use na sua página**

   ```tsx
   import LutaPalitos from "./components/LutaPalitos";
   
   <LutaPalitos accent="#0057FF" sangue={false} dificuldade="Difícil" />
   ```

4. **Personalize** Textos, dados e a cor de destaque (prop accent) são props com valor padrão. Troque pelos da sua marca ou ligue na sua API.

## Tema e cor

Abre em tema claro. Use `tema="escuro"` para o escuro e `accent` para a cor de destaque:

```tsx
<LutaPalitos accent="#0057FF" sangue={false} dificuldade="Difícil" />
```

## Licença

MIT. Pode usar em projeto pessoal ou comercial, de graça. A única condição é manter a linha **“Criado por FlowCore Soluções LTDA”** (ou o crédito de adaptação) onde ela está.

---

Precisa disso integrado no seu sistema? A [FlowCore](https://flowcoresolucoes.com.br) desenvolve sob medida.
