// LutaPalitos · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Jogo de luta de palitos no estilo dos stick fights dos anos 2000: barra de
// vida, soco, chute, defesa, pulo, sangue, rounds e K.O. Três modos: contra a
// CPU, 2 jogadores no mesmo teclado e Demo (CPU x CPU, roda sozinho, ideal
// pra tela de espera de site e sistema).
// Controles:
//   P1: A/D anda · W pula · S defende · F soco · G chute
//   P2: ←/→ anda · ↑ pula · ↓ defende · K soco · L chute
//   Contra a CPU, as setas e K/L também controlam o P1. P pausa.
//   No celular: botões na tela (modo contra a CPU).
// Props:
//   tema?: "claro" | "escuro"   tema inicial (padrão "claro"); o botão sol/lua do HUD alterna
//   onTemaChange?: (tema) => void   avisa quando o jogador troca o tema
//   accent?: string        cor do P1 e dos destaques (padrão "#0057FF")
//   corP2?: string         cor do P2 (padrão "#F5183B")
//   sangue?: boolean       false troca o sangue por faísca (sites corporativos)
//   modoInicial?: "cpu" | "2p" | "demo"   modo que roda atrás do menu (padrão "demo")
//   dificuldade?: "Fácil" | "Normal" | "Difícil"   nível da CPU (padrão "Normal")
//   variacao?: "Clássico" | "Turbo" | "Lua" | "Golpe forte"   preset inicial
//   tempoRound?: number    segundos por round (padrão 60)
//   vitoriasParaVencer?: number   rounds pra ganhar a partida (padrão 2)
// Requisitos: React 18+ e Tailwind CSS 3+. Zero dependências.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

/* ============================== lógica pura ============================== */

export const MUNDO = { L: 960, A: 540, chao: 468, minX: 40, maxX: 920 };

export type Acao = "parado" | "andando" | "pulo" | "soco" | "chute" | "defesa" | "atingido" | "nocaute" | "vitoria";
export type Entrada = { esq: boolean; dir: boolean; pulo: boolean; defesa: boolean; soco: boolean; chute: boolean };
export const SEM_ENTRADA: Entrada = { esq: false, dir: false, pulo: false, defesa: false, soco: false, chute: false };

export type Golpe = { total: number; ativoIni: number; ativoFim: number; alcance: number; altura: number; dano: number; empurrao: number; atordoa: number };
export const GOLPES: Record<"soco" | "chute", Golpe> = {
  soco: { total: 16, ativoIni: 4, ativoFim: 8, alcance: 60, altura: 112, dano: 6, empurrao: 4, atordoa: 14 },
  chute: { total: 26, ativoIni: 9, ativoFim: 15, alcance: 72, altura: 64, dano: 11, empurrao: 8, atordoa: 22 },
};

export type Fisica = { gravidade: number; impulsoPulo: number; velocidade: number; multDano: number };
export const FISICA_PADRAO: Fisica = { gravidade: 0.8, impulsoPulo: -15, velocidade: 4.2, multDano: 1 };

export type Lutador = {
  x: number; y: number; vx: number; vy: number; dir: 1 | -1;
  vida: number; acao: Acao; t: number; acertou: boolean; noChao: boolean;
  fase: number; atordoa: number; vidaFantasma: number;
};

export type Particula = { x: number; y: number; vx: number; vy: number; vida: number; sangue: boolean; tam: number };
export type Mancha = { x: number; r: number; alpha: number };
export type Evento = "golpe" | "defesa" | "nocaute";

export type Estado = {
  p: [Lutador, Lutador];
  particulas: Particula[];
  manchas: Mancha[];
  hitstop: number;
  tremor: number;
  anterior: [Entrada, Entrada];
  eventos: Evento[];
};

export const criarLutador = (x: number, dir: 1 | -1): Lutador => ({
  x, y: MUNDO.chao, vx: 0, vy: 0, dir, vida: 100, acao: "parado", t: 0, acertou: false, noChao: true, fase: 0, atordoa: 0, vidaFantasma: 100,
});

export const criarEstado = (): Estado => ({
  p: [criarLutador(300, 1), criarLutador(660, -1)],
  particulas: [],
  manchas: [],
  hitstop: 0,
  tremor: 0,
  anterior: [{ ...SEM_ENTRADA }, { ...SEM_ENTRADA }],
  eventos: [],
});

/** Defesa de frente absorve 85% do dano (nunca zera: defesa não é imortalidade). */
export const calcularDano = (base: number, defendendo: boolean) => (defendendo ? Math.max(1, Math.round(base * 0.15)) : base);

/** Círculo de acerto do golpe, só nos quadros ativos. */
export function caixaGolpe(l: Lutador): { x: number; y: number; r: number; golpe: Golpe } | null {
  if (l.acao !== "soco" && l.acao !== "chute") return null;
  const g = GOLPES[l.acao];
  if (l.t < g.ativoIni || l.t > g.ativoFim) return null;
  return { x: l.x + g.alcance * l.dir, y: l.y - g.altura, r: 16, golpe: g };
}

/** Corpo como retângulo (largura 36, altura 150) contra um círculo. */
export function atingiuCorpo(l: Lutador, cx: number, cy: number, r: number) {
  const px = Math.max(l.x - 18, Math.min(cx, l.x + 18));
  const py = Math.max(l.y - 150, Math.min(cy, l.y));
  return (cx - px) ** 2 + (cy - py) ** 2 <= r * r;
}

const controlavel = (a: Acao) => a === "parado" || a === "andando" || a === "pulo" || a === "defesa";

function espirrar(e: Estado, x: number, y: number, dir: number, qtd: number, sangue: boolean) {
  for (let i = 0; i < qtd; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.3) * 1.6;
    const vel = 2 + Math.random() * 6;
    e.particulas.push({ x, y, vx: Math.cos(ang) * vel * 0.6 + dir * (1 + Math.random() * 3), vy: Math.sin(ang) * vel, vida: 40 + Math.random() * 30, sangue, tam: 2 + Math.random() * 3 });
  }
}

/** Avança um quadro (60 por segundo). Entradas de soco/chute contam só na borda (apertou agora). */
export function passo(e: Estado, entradas: [Entrada, Entrada], opt: { sangue: boolean; fisica?: Fisica } = { sangue: true }) {
  const f = opt.fisica ?? FISICA_PADRAO;
  e.eventos = [];
  if (e.tremor > 0) e.tremor -= 1;
  if (e.hitstop > 0) {
    e.hitstop -= 1;
    return;
  }

  for (let i = 0; i < 2; i++) {
    const l = e.p[i];
    const o = e.p[1 - i];
    const ent = entradas[i];
    const ant = e.anterior[i];
    const apertouSoco = ent.soco && !ant.soco;
    const apertouChute = ent.chute && !ant.chute;
    const apertouPulo = ent.pulo && !ant.pulo;
    l.t += 1;
    l.vidaFantasma += (l.vida - l.vidaFantasma) * 0.06;

    if (controlavel(l.acao) && l.noChao) l.dir = o.x >= l.x ? 1 : -1;

    if (l.acao === "atingido" && l.t >= l.atordoa && l.noChao) l.acao = "parado";
    if ((l.acao === "soco" || l.acao === "chute") && l.t >= GOLPES[l.acao].total) l.acao = l.noChao ? "parado" : "pulo";

    if (controlavel(l.acao)) {
      const eixo = (ent.dir ? 1 : 0) - (ent.esq ? 1 : 0);
      if (apertouSoco || apertouChute) {
        l.acao = apertouChute ? "chute" : "soco";
        l.t = 0;
        l.acertou = false;
        if (l.noChao) l.vx = 0;
      } else if (ent.defesa && l.noChao) {
        l.acao = "defesa";
        l.vx = 0;
      } else if (apertouPulo && l.noChao) {
        l.vy = f.impulsoPulo;
        l.noChao = false;
        l.acao = "pulo";
        l.vx = eixo * f.velocidade;
      } else if (l.noChao) {
        const recuando = eixo !== 0 && eixo !== l.dir;
        l.vx = eixo * f.velocidade * (recuando ? 0.75 : 1);
        l.acao = eixo ? "andando" : "parado";
        if (eixo) l.fase += 0.22;
      }
    }

    // Física
    if (!l.noChao) l.vy += f.gravidade;
    if (l.acao === "atingido" || l.acao === "nocaute") l.vx *= l.noChao ? 0.82 : 0.98;
    l.x = Math.max(MUNDO.minX, Math.min(MUNDO.maxX, l.x + l.vx));
    l.y += l.vy;
    if (l.y >= MUNDO.chao) {
      l.y = MUNDO.chao;
      l.vy = 0;
      if (!l.noChao) {
        l.noChao = true;
        if (l.acao === "pulo") l.acao = "parado";
      }
    }
  }

  // Corpos não se atravessam no chão
  const [a, b] = e.p;
  const dist = b.x - a.x;
  if (Math.abs(dist) < 36 && a.noChao && b.noChao && a.acao !== "nocaute" && b.acao !== "nocaute") {
    const empurra = (36 - Math.abs(dist)) / 2;
    const s = dist >= 0 ? 1 : -1;
    a.x = Math.max(MUNDO.minX, a.x - empurra * s);
    b.x = Math.min(MUNDO.maxX, Math.max(MUNDO.minX, b.x + empurra * s));
  }

  // Acertos
  for (let i = 0; i < 2; i++) {
    const l = e.p[i];
    const o = e.p[1 - i];
    const hb = caixaGolpe(l);
    if (!hb || l.acertou || o.acao === "nocaute" || !atingiuCorpo(o, hb.x, hb.y, hb.r)) continue;
    l.acertou = true;
    const g = hb.golpe;
    const defendendo = o.acao === "defesa" && o.dir === -l.dir;
    const dano = calcularDano(Math.round(g.dano * f.multDano), defendendo);
    o.vida = Math.max(0, o.vida - dano);
    if (defendendo) {
      o.vx = l.dir * g.empurrao * 0.6;
      espirrar(e, hb.x, hb.y, l.dir, 6, false);
      e.hitstop = 3;
      e.eventos.push("defesa");
    } else {
      o.acao = "atingido";
      o.t = 0;
      o.atordoa = g.atordoa;
      o.vx = l.dir * g.empurrao;
      if (l.acao === "chute" || !o.noChao) {
        o.vy = -4;
        o.noChao = false;
      }
      espirrar(e, hb.x, hb.y, l.dir, opt.sangue ? 18 : 10, opt.sangue);
      e.hitstop = 5;
      e.tremor = 6;
      e.eventos.push("golpe");
    }
    if (o.vida <= 0) {
      o.acao = "nocaute";
      o.t = 0;
      o.vx = l.dir * 7;
      o.vy = -7;
      o.noChao = false;
      espirrar(e, hb.x, hb.y, l.dir, opt.sangue ? 36 : 16, opt.sangue);
      e.tremor = 16;
      e.hitstop = 10;
      e.eventos.push("nocaute");
    }
  }

  // Partículas e manchas no chão
  for (const pt of e.particulas) {
    pt.vy += 0.45;
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vida -= 1;
    if (pt.y >= MUNDO.chao) {
      if (pt.sangue && e.manchas.length < 90) e.manchas.push({ x: pt.x, r: pt.tam * (1.2 + Math.random()), alpha: 0.9 });
      pt.vida = 0;
    }
  }
  e.particulas = e.particulas.filter((pt) => pt.vida > 0);
  for (const m of e.manchas) m.alpha *= 0.9985;

  e.anterior = [{ ...entradas[0] }, { ...entradas[1] }];
}

export type Dificuldade = "Fácil" | "Normal" | "Difícil";
export type MemoriaCPU = { espera: number; defendendo: number };
const NIVEL: Record<Dificuldade, { defesa: number; espera: [number, number]; agressao: number }> = {
  "Fácil": { defesa: 0.06, espera: [34, 70], agressao: 0.5 },
  Normal: { defesa: 0.18, espera: [20, 46], agressao: 0.75 },
  "Difícil": { defesa: 0.4, espera: [10, 26], agressao: 0.95 },
};

/** Decide a entrada da CPU pra este quadro. `rnd` injetável pra teste. */
export function entradaCPU(eu: Lutador, op: Lutador, mem: MemoriaCPU, nivel: Dificuldade, rnd: () => number = Math.random): Entrada {
  const ent: Entrada = { ...SEM_ENTRADA };
  if (!controlavel(eu.acao) || op.acao === "nocaute") return ent;
  const cfg = NIVEL[nivel];
  const dist = Math.abs(op.x - eu.x);
  const frente = op.x >= eu.x ? "dir" : "esq";
  const tras = frente === "dir" ? "esq" : "dir";

  if (mem.defendendo > 0) {
    mem.defendendo -= 1;
    ent.defesa = true;
    return ent;
  }
  if ((op.acao === "soco" || op.acao === "chute") && dist < 120 && op.t < 6 && rnd() < cfg.defesa) {
    mem.defendendo = 12;
    ent.defesa = true;
    return ent;
  }
  if (mem.espera > 0) {
    mem.espera -= 1;
    if (dist < 50 && rnd() < 0.5) ent[tras] = true;
    return ent;
  }
  if (dist > 92) {
    ent[frente] = rnd() < cfg.agressao;
    if (rnd() < 0.012) ent.pulo = true;
    return ent;
  }
  if (rnd() < 0.55) ent.soco = true;
  else ent.chute = true;
  const [min, max] = cfg.espera;
  mem.espera = Math.round(min + rnd() * (max - min));
  return ent;
}

/* ================================ desenho ================================ */

type Pose = { inc: number; agacha: number; coxaF: number; canelaF: number; coxaT: number; canelaT: number; bracoF: number; anteF: number; bracoT: number; anteT: number };

function pose(l: Lutador, tempo: number): Pose {
  const base: Pose = { inc: 0.04, agacha: Math.sin(tempo * 0.09) * 1.5, coxaF: 0.3, canelaF: 0.08, coxaT: -0.3, canelaT: -0.4, bracoF: 0.7, anteF: 2.3, bracoT: 0.4, anteT: 2.0 };
  switch (l.acao) {
    case "andando": {
      const s = Math.sin(l.fase);
      return { ...base, coxaF: 0.5 * s, canelaF: 0.5 * s - 0.5 * Math.max(0, -s), coxaT: -0.5 * s, canelaT: -0.5 * s - 0.5 * Math.max(0, s), agacha: Math.abs(s) * 2 };
    }
    case "pulo":
      return { ...base, coxaF: 1.0, canelaF: -0.3, coxaT: 0.3, canelaT: -1.1, bracoF: 1.4, anteF: 2.6, bracoT: 1.1, anteT: 2.4 };
    case "soco": {
      const g = GOLPES.soco;
      if (l.t < g.ativoIni) return { ...base, bracoF: 0.35, anteF: 2.7, inc: -0.05 };
      const p = l.t <= g.ativoFim ? 1 : Math.max(0, 1 - (l.t - g.ativoFim) / (g.total - g.ativoFim));
      return { ...base, inc: 0.04 + 0.16 * p, bracoF: 0.7 + 0.87 * p, anteF: 2.3 - 0.73 * p, coxaF: 0.45, coxaT: -0.45 };
    }
    case "chute": {
      const g = GOLPES.chute;
      if (l.t < g.ativoIni) return { ...base, coxaF: 1.0, canelaF: -0.5, inc: -0.1 };
      const p = l.t <= g.ativoFim ? 1 : Math.max(0, 1 - (l.t - g.ativoFim) / (g.total - g.ativoFim));
      return { ...base, inc: -0.3 * p, coxaF: 0.3 + 1.27 * p, canelaF: 0.08 + 1.49 * p, coxaT: -0.15, canelaT: -0.15, bracoT: 0.9, anteT: 1.6 };
    }
    case "defesa":
      return { ...base, inc: -0.08, agacha: 6, bracoF: 1.05, anteF: 2.95, bracoT: 0.95, anteT: 2.85, coxaF: 0.45, canelaF: -0.1, coxaT: -0.4, canelaT: -0.5 };
    case "atingido":
      return { ...base, inc: -0.45, bracoF: -0.4, anteF: 0.2, bracoT: -0.8, anteT: -0.3, coxaF: 0.5, canelaF: 0.3 };
    case "nocaute":
      return { ...base, inc: -0.2, bracoF: -0.6, anteF: -0.4, bracoT: -1.0, anteT: -0.8, coxaF: 0.2, canelaF: 0.2, coxaT: -0.1, canelaT: 0, agacha: 0 };
    case "vitoria":
      return { ...base, bracoF: 2.7, anteF: 3.0, bracoT: 2.6, anteT: 3.0, agacha: Math.abs(Math.sin(tempo * 0.15)) * -6 };
    default:
      return base;
  }
}

/** Paleta do desenho no canvas por tema. Escuro = visual original. */
const CORES = {
  escuro: {
    ceu: ["#0E1422", "#070A10"], grade: "rgba(255,255,255,0.035)", marca: "rgba(255,255,255,0.025)", chao: "#0B0F17", linhaChao: "rgba(255,255,255,0.18)",
    sombraChao: "rgba(0,0,0,0.35)", brilho: 10, sombraLutador: "", olho: "#0B0F17", faisca: "#FFD27A",
    barraFundo: "rgba(255,255,255,0.08)", barraFantasma: "rgba(255,214,102,0.85)", barraBorda: "rgba(255,255,255,0.25)", vidaBaixa: "#F5183B",
    texto: "#fff", rodadaOk: "#FFD666", rodadaVazia: "rgba(255,255,255,0.15)", letreiroBorda: "rgba(0,0,0,0.6)", letreiro: "#fff", sub: "rgba(255,255,255,0.75)",
  },
  claro: {
    ceu: ["#FFFFFF", "#EEF2F8"], grade: "rgba(15,23,42,0.06)", marca: "rgba(15,23,42,0.045)", chao: "#E3E8F0", linhaChao: "rgba(15,23,42,0.28)",
    sombraChao: "rgba(15,23,42,0.18)", brilho: 4, sombraLutador: "rgba(15,23,42,0.28)", olho: "#FFFFFF", faisca: "#D97706",
    barraFundo: "rgba(15,23,42,0.08)", barraFantasma: "rgba(245,158,11,0.75)", barraBorda: "rgba(15,23,42,0.25)", vidaBaixa: "#C8102E",
    texto: "#0B1220", rodadaOk: "#F59E0B", rodadaVazia: "rgba(15,23,42,0.15)", letreiroBorda: "rgba(255,255,255,0.9)", letreiro: "#0B1220", sub: "#4B5565",
  },
} satisfies Record<Tema, Record<string, string | number | string[]>>;
type Paleta = (typeof CORES)[Tema];

/** Escurece uma cor #rgb/#rrggbb (no claro os palitos precisam de mais contraste). */
function escurecer(cor: string, f = 0.72): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return cor;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
}

function desenharLutador(ctx: CanvasRenderingContext2D, l: Lutador, cor: string, tempo: number, c: Paleta) {
  const ps = pose(l, tempo);
  const d = l.dir;
  const membro = (ox: number, oy: number, ang: number, len: number) => [ox + Math.sin(ang) * len * d, oy + Math.cos(ang) * len] as const;

  // Sombra no chão
  ctx.fillStyle = c.sombraChao;
  ctx.beginPath();
  ctx.ellipse(l.x, MUNDO.chao + 4, 26 * Math.max(0.4, 1 - (MUNDO.chao - l.y) / 300), 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (l.acao === "nocaute") {
    // Cai de costas e fica no chão
    const ang = -d * Math.min(Math.PI / 2, l.t * 0.09);
    ctx.translate(l.x, l.y);
    ctx.rotate(ang);
    ctx.translate(-l.x, -l.y);
  }
  const qx = l.x;
  const qy = l.y - 62 + ps.agacha;
  const [px, py] = membro(qx, qy, Math.PI + ps.inc, 54);
  const [cx, cy] = membro(px, py, Math.PI + ps.inc, 15);
  const [ox, oy] = membro(px, py, ps.inc, 4);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = cor;
  ctx.shadowColor = c.sombraLutador || cor;
  ctx.shadowBlur = c.brilho;
  if (c.sombraLutador) ctx.shadowOffsetY = 2;
  ctx.lineWidth = 6;

  const linha = (pts: (readonly [number, number])[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  };

  // Membros de trás mais apagados dão profundidade
  ctx.globalAlpha = 0.65;
  const jT = membro(qx, qy, ps.coxaT, 32);
  linha([[qx, qy], jT, membro(jT[0], jT[1], ps.canelaT, 32)]);
  const cT = membro(ox, oy, ps.bracoT + ps.inc, 25);
  linha([[ox, oy], cT, membro(cT[0], cT[1], ps.anteT + ps.inc, 24)]);
  ctx.globalAlpha = 1;

  linha([[qx, qy], [px, py]]);
  const jF = membro(qx, qy, ps.coxaF, 32);
  linha([[qx, qy], jF, membro(jF[0], jF[1], ps.canelaF, 32)]);
  const cF = membro(ox, oy, ps.bracoF + ps.inc, 25);
  linha([[ox, oy], cF, membro(cF[0], cF[1], ps.anteF + ps.inc, 24)]);

  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  // Olho, pra saber pra onde o palito olha
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = c.olho;
  ctx.beginPath();
  ctx.arc(cx + 5 * d, cy - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenhar(ctx: CanvasRenderingContext2D, e: Estado, o: { cores: [string, string]; nomes: [string, string]; vitorias: [number, number]; meta: number; tempo: number; relogio: number; letreiro: string; sub: string; tema: Tema }) {
  const { L, A, chao } = MUNDO;
  const c = CORES[o.tema];
  const cores: [string, string] = o.tema === "claro" ? [escurecer(o.cores[0]), escurecer(o.cores[1])] : o.cores;
  ctx.save();
  if (e.tremor > 0) ctx.translate((Math.random() - 0.5) * e.tremor, (Math.random() - 0.5) * e.tremor);

  // Cenário
  const ceu = ctx.createLinearGradient(0, 0, 0, A);
  ceu.addColorStop(0, c.ceu[0]);
  ceu.addColorStop(1, c.ceu[1]);
  ctx.fillStyle = ceu;
  ctx.fillRect(-20, -20, L + 40, A + 40);
  ctx.strokeStyle = c.grade;
  ctx.lineWidth = 1;
  for (let x = 0; x <= L; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, chao);
    ctx.stroke();
  }
  ctx.fillStyle = c.marca;
  ctx.font = "800 120px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FLOWCORE", L / 2, chao - 40);
  ctx.fillStyle = c.chao;
  ctx.fillRect(-20, chao, L + 40, A - chao + 20);
  ctx.strokeStyle = c.linhaChao;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, chao);
  ctx.lineTo(L, chao);
  ctx.stroke();

  for (const m of e.manchas) {
    ctx.fillStyle = `rgba(150,10,24,${m.alpha})`;
    ctx.beginPath();
    ctx.ellipse(m.x, chao + 2, m.r * 1.8, m.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  desenharLutador(ctx, e.p[0], cores[0], o.tempo, c);
  desenharLutador(ctx, e.p[1], cores[1], o.tempo, c);

  for (const p of e.particulas) {
    ctx.fillStyle = p.sangue ? "#C1121F" : c.faisca;
    ctx.globalAlpha = Math.min(1, p.vida / 20);
    ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD: barras de vida, nomes, rounds e relógio
  const barra = (i: 0 | 1) => {
    const l = e.p[i];
    const w = 360;
    const x = i === 0 ? 32 : L - 32 - w;
    const y = 30;
    ctx.fillStyle = c.barraFundo;
    ctx.fillRect(x, y, w, 18);
    const larg = (v: number) => (w * Math.max(0, v)) / 100;
    ctx.fillStyle = c.barraFantasma;
    ctx.fillRect(i === 0 ? x + w - larg(l.vidaFantasma) : x, y, larg(l.vidaFantasma), 18);
    ctx.fillStyle = l.vida > 30 ? cores[i] : c.vidaBaixa;
    ctx.fillRect(i === 0 ? x + w - larg(l.vida) : x, y, larg(l.vida), 18);
    ctx.strokeStyle = c.barraBorda;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 17);
    ctx.fillStyle = c.texto;
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = i === 0 ? "left" : "right";
    ctx.fillText(o.nomes[i], i === 0 ? x : x + w, y - 8);
    for (let r = 0; r < o.meta; r++) {
      ctx.fillStyle = r < o.vitorias[i] ? c.rodadaOk : c.rodadaVazia;
      ctx.beginPath();
      ctx.arc(i === 0 ? x + 8 + r * 18 : x + w - 8 - r * 18, y + 34, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  barra(0);
  barra(1);
  ctx.fillStyle = c.texto;
  ctx.textAlign = "center";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText(String(Math.max(0, Math.ceil(o.relogio))), L / 2, 52);

  if (o.letreiro) {
    ctx.font = "900 84px system-ui, sans-serif";
    ctx.lineWidth = 8;
    ctx.strokeStyle = c.letreiroBorda;
    ctx.strokeText(o.letreiro, L / 2, A / 2 - 10);
    ctx.fillStyle = c.letreiro;
    ctx.fillText(o.letreiro, L / 2, A / 2 - 10);
    if (o.sub) {
      ctx.font = "600 22px system-ui, sans-serif";
      ctx.fillStyle = c.sub;
      ctx.fillText(o.sub, L / 2, A / 2 + 30);
    }
  }
}

/* =============================== componente =============================== */

type Modo = "cpu" | "2p" | "demo";
type Tela = "menu" | "jogando" | "pausado" | "fim";
type NomeVariacao = "Clássico" | "Turbo" | "Lua" | "Golpe forte";
const VARIACOES: Record<NomeVariacao, Fisica> = {
  "Clássico": FISICA_PADRAO,
  Turbo: { gravidade: 1.0, impulsoPulo: -17, velocidade: 5.6, multDano: 1.2 },
  Lua: { gravidade: 0.38, impulsoPulo: -11, velocidade: 3.8, multDano: 1 },
  "Golpe forte": { ...FISICA_PADRAO, multDano: 2.2 },
};
const LINK = "https://flowcoresolucoes.com.br/codigos";
const CHAVE_RECORDE = "flowcore-game-luta-palitos-recorde";

/** Vitórias contra a CPU guardadas no navegador (localStorage pode estar bloqueado). */
function lerRecorde(): number {
  try {
    return Number(localStorage.getItem(CHAVE_RECORDE)) || 0;
  } catch {
    return 0;
  }
}
function salvarRecorde(v: number) {
  try {
    localStorage.setItem(CHAVE_RECORDE, String(v));
  } catch {
    /* modo privado: segue sem salvar */
  }
}
const TECLAS_P1 = { esq: ["a"], dir: ["d"], pulo: ["w"], defesa: ["s"], soco: ["f"], chute: ["g"] };
const TECLAS_P2 = { esq: ["arrowleft"], dir: ["arrowright"], pulo: ["arrowup"], defesa: ["arrowdown"], soco: ["k"], chute: ["l"] };
const BLOQUEAR = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown", " "]);

/* --------------------------------- tema --------------------------------- */

export type Tema = "claro" | "escuro";
// Paleta do tema: vira CSS vars na raiz (classes) e é lida pelo canvas.
const TEMAS: Record<Tema, Record<string, string>> = {
  claro: {
    "--fc-bg": "#F7F8FB", "--fc-surface": "#FFFFFF", "--fc-surface-2": "#F1F4F9",
    "--fc-border": "#E3E8F0", "--fc-border-strong": "#CBD3E1",
    "--fc-text": "#0B1220", "--fc-muted": "#4B5565", "--fc-subtle": "#8A94A6",
    "--fc-pos": "#059669", "--fc-neg": "#E11D48", "--fc-warn": "#D97706",
    "--fc-shadow": "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -16px rgba(16,24,40,.18)",
  },
  escuro: {
    "--fc-bg": "#0B0F17", "--fc-surface": "rgba(255,255,255,0.03)", "--fc-surface-2": "rgba(255,255,255,0.06)",
    "--fc-border": "rgba(255,255,255,0.10)", "--fc-border-strong": "rgba(255,255,255,0.25)",
    "--fc-text": "#FFFFFF", "--fc-muted": "rgba(255,255,255,0.60)", "--fc-subtle": "rgba(255,255,255,0.40)",
    "--fc-pos": "#34D399", "--fc-neg": "#FB7185", "--fc-warn": "#FBBF24",
    "--fc-shadow": "0 24px 48px -24px rgba(0,0,0,.6)",
  },
};

function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] transition-colors hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        {escuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}

type Props = {
  tema?: Tema;
  onTemaChange?: (tema: Tema) => void;
  accent?: string;
  corP2?: string;
  sangue?: boolean;
  modoInicial?: Modo;
  dificuldade?: Dificuldade;
  variacao?: NomeVariacao;
  tempoRound?: number;
  vitoriasParaVencer?: number;
};

/* ------------------------------ como jogar ------------------------------ */

// Controles por modo, mostrados no menu e na pausa ("ou" vira separador).
type Grupo = [string[], string];
const CONTROLES: Record<"cpu" | "2p", { titulo: string; linhas: { rot: string; grupos: Grupo[] }[] }> = {
  cpu: {
    titulo: "Contra a CPU",
    linhas: [
      {
        rot: "",
        grupos: [
          [["A", "D", "ou", "←", "→"], "mover"],
          [["W", "ou", "↑"], "pular"],
          [["S", "ou", "↓"], "defender"],
          [["F", "ou", "K"], "soco"],
          [["G", "ou", "L"], "chute"],
          [["P"], "pausa"],
        ],
      },
    ],
  },
  "2p": {
    titulo: "2 jogadores",
    linhas: [
      { rot: "P1", grupos: [[["A", "D", "W", "S"], "mover"], [["F"], "soco"], [["G"], "chute"]] },
      { rot: "P2", grupos: [[["←", "→", "↑", "↓"], "mover"], [["K"], "soco"], [["L"], "chute"]] },
    ],
  },
};
const TOQUE = "Use os botões abaixo do jogo: ◀ ▶ andam, ▲ pula, Defesa, Soco e Chute (contra a CPU)";
const RESUMO = {
  cpu: "A/D ou ←/→ mover · W/↑ pular · S/↓ defender · F/K soco · G/L chute · P pausa",
  "2p": "P1: A D W S + F soco, G chute · P2: setas + K soco, L chute · P pausa",
};
const RESUMO_TOQUE = "Botões abaixo do jogo";

function ComoJogar({ modos, className = "" }: { modos: ("cpu" | "2p")[]; className?: string }) {
  return (
    <div className={`max-w-xl text-xs text-[var(--fc-muted)] ${className}`}>
      <div className="hidden space-y-2.5 sm:block">
        {modos.map((m) => (
          <div key={m} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fc-subtle)]">{CONTROLES[m].titulo}</p>
            {CONTROLES[m].linhas.map((l) => (
              <div key={l.rot} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                {l.rot && <span className="font-semibold text-[var(--fc-text)]">{l.rot}</span>}
                {l.grupos.map(([teclas, acao]) => (
                  <span key={acao} className="inline-flex items-center gap-1">
                    {teclas.map((t, i) =>
                      t === "ou" ? (
                        <span key={i} className="text-[10px] text-[var(--fc-subtle)]">
                          ou
                        </span>
                      ) : (
                        <kbd key={i} className="rounded-md border border-[var(--fc-border)] bg-[var(--fc-surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fc-text)]">
                          {t}
                        </kbd>
                      ),
                    )}
                    <span className="ml-0.5">{acao}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-center sm:hidden">{TOQUE}</p>
    </div>
  );
}

export default function LutaPalitos({
  accent = "#0057FF",
  tema = "claro",
  onTemaChange,
  corP2 = "#F5183B",
  sangue: sangueInicial = true,
  modoInicial = "demo",
  dificuldade: difInicial = "Normal",
  variacao = "Clássico",
  tempoRound = 60,
  vitoriasParaVencer = 2,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [temaAtual, setTemaAtual] = useState<Tema>(tema);
  useEffect(() => setTemaAtual(tema), [tema]);
  const temaRef = useRef<Tema>(tema);
  temaRef.current = temaAtual;
  const alternarTema = () => {
    const novo: Tema = temaAtual === "claro" ? "escuro" : "claro";
    setTemaAtual(novo);
    onTemaChange?.(novo);
    rootRef.current?.focus();
  };
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tela, setTela] = useState<Tela>("menu");
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [dificuldade, setDificuldade] = useState<Dificuldade>(difInicial);
  const [nomeVar, setNomeVar] = useState<NomeVariacao>(variacao);
  const [sangue, setSangue] = useState(sangueInicial);
  const [vencedor, setVencedor] = useState("");
  const [recorde, setRecorde] = useState(0);
  useEffect(() => setRecorde(lerRecorde()), []);

  // Estado do jogo em refs: o loop roda a 60 fps sem re-render do React.
  const jogo = useRef({
    e: criarEstado(),
    teclas: new Set<string>(),
    toque: { ...SEM_ENTRADA },
    mem: [{ espera: 20, defendendo: 0 }, { espera: 40, defendendo: 0 }] as [MemoriaCPU, MemoriaCPU],
    round: 1,
    vitorias: [0, 0] as [number, number],
    relogio: tempoRound,
    fase: "intro" as "intro" | "luta" | "ko" | "fimRound",
    faseT: 0,
    tempo: 0,
    letreiro: "",
    sub: "",
    visivel: true,
  });
  const cfg = useRef({ modo, dificuldade, fisica: VARIACOES[nomeVar], sangue, tela, tempoRound, vitoriasParaVencer, cores: [accent, corP2] as [string, string] });
  cfg.current = { modo: tela === "menu" ? "demo" : modo, dificuldade, fisica: VARIACOES[nomeVar], sangue, tela, tempoRound, vitoriasParaVencer, cores: [accent, corP2] };

  const novaPartida = useCallback(() => {
    const j = jogo.current;
    j.e = criarEstado();
    j.round = 1;
    j.vitorias = [0, 0];
    j.relogio = cfg.current.tempoRound;
    j.fase = "intro";
    j.faseT = 0;
  }, []);

  const novoRound = useCallback(() => {
    const j = jogo.current;
    const manchas = j.e.manchas;
    j.e = criarEstado();
    j.e.manchas = manchas; // o sangue do round anterior fica no chão
    j.relogio = cfg.current.tempoRound;
    j.fase = "intro";
    j.faseT = 0;
  }, []);

  const comecar = (m: Modo) => {
    setModo(m);
    setVencedor("");
    jogo.current.teclas.clear();
    novaPartida();
    setTela("jogando");
    rootRef.current?.focus();
  };

  // Canvas nítido em qualquer tela: escala pela largura do container e pelo devicePixelRatio.
  useEffect(() => {
    const area = areaRef.current;
    const cv = canvasRef.current;
    if (!area || !cv) return;
    const ajustar = () => {
      const w = area.clientWidth;
      const dpr = Math.min(2, cv.ownerDocument.defaultView?.devicePixelRatio ?? 1);
      cv.style.width = `${w}px`;
      cv.style.height = `${(w * MUNDO.A) / MUNDO.L}px`;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(((w * MUNDO.A) / MUNDO.L) * dpr);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  // Pausa quando o jogo sai da tela (economiza CPU na página).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => (jogo.current.visivel = en.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Loop principal com passo fixo de 1/60 s.
  useEffect(() => {
    let raf = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let temaDesenhado: Tema | null = null;
    const DT = 1000 / 60;

    const entradaHumana = (mapa: typeof TECLAS_P1, extra?: typeof TECLAS_P2): Entrada => {
      const t = jogo.current.teclas;
      const k = (lista: string[], lista2?: string[]) => lista.some((x) => t.has(x)) || !!lista2?.some((x) => t.has(x));
      const toque = jogo.current.toque;
      return {
        esq: k(mapa.esq, extra?.esq) || toque.esq,
        dir: k(mapa.dir, extra?.dir) || toque.dir,
        pulo: k(mapa.pulo, extra?.pulo) || toque.pulo,
        defesa: k(mapa.defesa, extra?.defesa) || toque.defesa,
        soco: k(mapa.soco, extra?.soco) || toque.soco,
        chute: k(mapa.chute, extra?.chute) || toque.chute,
      };
    };

    const quadro = () => {
      const j = jogo.current;
      const c = cfg.current;
      j.tempo += 1;
      j.faseT += 1;

      if (j.fase === "intro") {
        j.letreiro = j.faseT < 70 ? `ROUND ${j.round}` : "LUTE!";
        j.sub = "";
        if (j.faseT > 105) {
          j.fase = "luta";
          j.faseT = 0;
          j.letreiro = "";
        }
      }

      let ents: [Entrada, Entrada] = [{ ...SEM_ENTRADA }, { ...SEM_ENTRADA }];
      if (j.fase === "luta") {
        const [p1, p2] = j.e.p;
        ents = [
          c.modo === "demo" ? entradaCPU(p1, p2, j.mem[0], c.dificuldade) : entradaHumana(TECLAS_P1, c.modo === "cpu" ? TECLAS_P2 : undefined),
          c.modo === "2p" ? entradaHumana(TECLAS_P2) : entradaCPU(p2, p1, j.mem[1], c.dificuldade),
        ];
        j.relogio -= 1 / 60;
      }

      // Câmera lenta no nocaute
      if (j.fase !== "ko" || j.faseT % 3 === 0) passo(j.e, ents, { sangue: c.sangue, fisica: c.fisica });

      if (j.fase === "luta") {
        const [p1, p2] = j.e.p;
        const ko = j.e.eventos.includes("nocaute");
        if (ko || j.relogio <= 0) {
          j.fase = "ko";
          j.faseT = 0;
          j.letreiro = ko ? "K.O.!" : "TEMPO!";
          const venceu: -1 | 0 | 1 = p1.vida === p2.vida ? -1 : p1.vida > p2.vida ? 0 : 1;
          if (venceu !== -1) j.vitorias[venceu] += 1;
          j.sub = venceu < 0 ? "Empate" : `${venceu === 0 ? nomes(c.modo)[0] : nomes(c.modo)[1]} vence o round`;
        }
      } else if (j.fase === "ko" && j.faseT > 170) {
        const [p1, p2] = j.e.p;
        const v = p1.vida > p2.vida ? p1 : p2.vida > p1.vida ? p2 : null;
        if (v) v.acao = "vitoria";
        const campeao = j.vitorias.findIndex((n) => n >= c.vitoriasParaVencer);
        if (campeao >= 0) {
          j.fase = "fimRound";
          j.faseT = 0;
          j.letreiro = `${nomes(c.modo)[campeao]} VENCE!`.toUpperCase();
          j.sub = "";
          // No Demo (tela de espera) a partida recomeça sozinha mais abaixo.
          if (c.modo !== "demo" && c.tela === "jogando") {
            setVencedor(nomes(c.modo)[campeao]);
            setTela("fim");
            if (c.modo === "cpu" && campeao === 0) {
              const novo = lerRecorde() + 1;
              salvarRecorde(novo);
              setRecorde(novo);
            }
          }
        } else {
          j.round += 1;
          novoRound();
        }
      } else if (j.fase === "fimRound" && c.modo === "demo" && j.faseT > 200) {
        novaPartida();
      }
    };

    const loop = (agora: number) => {
      raf = requestAnimationFrame(loop);
      const j = jogo.current;
      const dt = Math.min(100, agora - ultimo);
      ultimo = agora;
      if (!j.visivel) return;
      // Pausado: só redesenha se o tema mudou.
      const pausado = cfg.current.tela === "pausado";
      if (pausado && temaDesenhado === temaRef.current) return;
      if (!pausado) acumulado += dt;
      while (acumulado >= DT) {
        quadro();
        acumulado -= DT;
      }
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      const s = cv.width / MUNDO.L;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      desenhar(ctx, j.e, {
        cores: cfg.current.cores,
        nomes: nomes(cfg.current.modo),
        vitorias: j.vitorias,
        meta: cfg.current.vitoriasParaVencer,
        tempo: j.tempo,
        relogio: j.relogio,
        // Com o menu aberto o título dele ocupa o centro; o letreiro do Demo some.
        letreiro: cfg.current.tela === "menu" ? "" : j.letreiro,
        sub: cfg.current.tela === "menu" ? "" : j.sub,
        tema: temaRef.current,
      });
      temaDesenhado = temaRef.current;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [novaPartida, novoRound]);

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    const k = ev.key.toLowerCase();
    if (BLOQUEAR.has(k)) ev.preventDefault();
    if (k === "p" && (tela === "jogando" || tela === "pausado")) {
      setTela(tela === "jogando" ? "pausado" : "jogando");
      return;
    }
    if (tela === "menu" && (k === " " || k === "enter")) {
      comecar("cpu");
      return;
    }
    jogo.current.teclas.add(k);
  };
  const onKeyUp = (ev: KeyboardEvent<HTMLDivElement>) => jogo.current.teclas.delete(ev.key.toLowerCase());
  const onBlur = () => {
    jogo.current.teclas.clear();
    if (tela === "jogando") setTela("pausado");
  };

  const botaoToque = (campo: keyof Entrada, rotulo: string, classe = "") => (
    <button
      type="button"
      aria-label={rotulo}
      onPointerDown={(ev: PointerEvent) => {
        ev.preventDefault();
        jogo.current.toque[campo] = true;
      }}
      onPointerUp={() => (jogo.current.toque[campo] = false)}
      onPointerLeave={() => (jogo.current.toque[campo] = false)}
      onPointerCancel={() => (jogo.current.toque[campo] = false)}
      className={`flex h-14 touch-none select-none items-center justify-center rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] text-xs font-semibold text-[var(--fc-text)] active:bg-[var(--fc-border)] ${classe}`}
    >
      {rotulo}
    </button>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={onBlur}
      style={{ ...TEMAS[temaAtual], "--accent": accent } as CSSProperties}
      className="relative mx-auto w-full max-w-5xl select-none overflow-hidden rounded-3xl border border-[var(--fc-border)] bg-[var(--fc-bg)] p-3 shadow-[var(--fc-shadow)] text-[var(--fc-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Luta de Palitos</span>
          <BotaoTema tema={temaAtual} onClick={alternarTema} />
          <span className="rounded-full border border-[var(--fc-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--fc-muted)]">
            {tela === "menu" ? "Demo" : modo === "2p" ? "2 jogadores" : "vs CPU"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-xs text-[var(--fc-muted)]">
            Vitórias vs CPU <b className="ml-1 font-semibold tabular-nums text-[var(--fc-text)]">{recorde}</b>
          </span>
          {(["Fácil", "Normal", "Difícil"] as Dificuldade[]).map((d) => (
            <button key={d} type="button" onClick={() => setDificuldade(d)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${dificuldade === d ? "border-[var(--fc-border-strong)] bg-[var(--fc-surface-2)] text-[var(--fc-text)]" : "border-[var(--fc-border)] text-[var(--fc-muted)] hover:text-[var(--fc-text)]"}`}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => setSangue((s) => !s)} className="rounded-full border border-[var(--fc-border)] px-3 py-1 text-xs text-[var(--fc-muted)] transition-colors hover:text-[var(--fc-text)]">
            {sangue ? "Sangue: ligado" : "Sangue: desligado"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-[var(--fc-subtle)]">Variações</span>
        {(Object.keys(VARIACOES) as NomeVariacao[]).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNomeVar(n)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${nomeVar === n ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] hover:border-[var(--fc-border-strong)] hover:text-[var(--fc-text)]"}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div ref={areaRef} className="relative w-full">
        <canvas ref={canvasRef} className="block w-full touch-none rounded-2xl" aria-label="Luta de palitos" role="img" />

        {tela !== "jogando" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--fc-bg)_55%,transparent)] p-4 text-center backdrop-blur-[1px]">
            {tela === "menu" && (
              <>
                <p className="text-2xl font-semibold tracking-tight sm:text-4xl">Luta de Palitos</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => comecar("cpu")} className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_32px_-8px_var(--accent)] transition hover:brightness-110">
                    Jogar contra a CPU
                  </button>
                  <button type="button" onClick={() => comecar("2p")} className="hidden rounded-full border border-[var(--fc-border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--fc-text)] transition hover:bg-[var(--fc-surface-2)] sm:block">
                    2 jogadores
                  </button>
                </div>
                <ComoJogar modos={["cpu", "2p"]} className="hidden sm:block" />
                <p className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</p>
              </>
            )}
            {tela === "pausado" && (
              <>
                <p className="text-lg font-semibold">Pausado</p>
                <button type="button" onClick={() => (setTela("jogando"), rootRef.current?.focus())} className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white">
                  Continuar
                </button>
                <ComoJogar modos={[modo === "2p" ? "2p" : "cpu"]} className="hidden sm:block" />
                <p className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</p>
              </>
            )}
            {tela === "fim" && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--fc-muted)]">Fim de luta</p>
                <p className="text-3xl font-semibold">{vencedor} venceu</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => comecar(modo)} className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white">
                    Revanche
                  </button>
                  <button type="button" onClick={() => (setTela("menu"), novaPartida())} className="rounded-full border border-[var(--fc-border-strong)] px-6 py-2.5 text-sm font-semibold text-[var(--fc-text)]">
                    Menu
                  </button>
                </div>
              </>
            )}
            <a href={LINK} target="_blank" rel="noopener" className="text-[10px] text-[var(--fc-subtle)] hover:text-[var(--fc-muted)]">
              Criado por FlowCore Soluções LTDA
            </a>
          </div>
        )}
      </div>

      {/* Controles de toque (P1, contra a CPU) */}
      <div className="mt-3 grid grid-cols-6 gap-2 sm:hidden">
        {botaoToque("esq", "◀")}
        {botaoToque("pulo", "▲")}
        {botaoToque("dir", "▶")}
        {botaoToque("defesa", "Defesa")}
        {botaoToque("soco", "Soco", "text-[var(--fc-text)]")}
        {botaoToque("chute", "Chute", "text-[var(--fc-text)]")}
      </div>

      {/* Como jogar no celular: fica fora do canvas, que é pequeno na tela estreita */}
      {tela !== "jogando" && <ComoJogar modos={[]} className="mx-auto mt-3 w-fit rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-3 sm:hidden" />}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[var(--fc-border)] pt-3 text-center sm:justify-between sm:text-left">
        <span className="hidden text-[11px] text-[var(--fc-muted)] sm:inline">{RESUMO[tela !== "menu" && modo === "2p" ? "2p" : "cpu"]}</span>
        <span className="text-[11px] text-[var(--fc-muted)] sm:hidden">{RESUMO_TOQUE}</span>
        <a href={LINK} target="_blank" rel="noopener" className="text-[11px] text-[var(--fc-subtle)] transition-colors hover:text-[var(--fc-muted)]">
          Criado por FlowCore Soluções LTDA
        </a>
      </div>
    </div>
  );
}

function nomes(m: Modo): [string, string] {
  if (m === "demo") return ["CPU Azul", "CPU Vermelha"];
  if (m === "2p") return ["Jogador 1", "Jogador 2"];
  return ["Você", "CPU"];
}
