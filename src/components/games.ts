import type { GameModality, GameType } from "../db/types";

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  campeonato: "Campeonato",
  treino: "Treino de futebol",
  brincadeira: "Brincadeira",
};

export const GAME_TYPE_ICON: Record<GameType, string> = {
  campeonato: "🏆",
  treino: "⚽",
  brincadeira: "🎉",
};

// Classes completas para o Tailwind enxergar.
export const GAME_TYPE_CLASS: Record<GameType, string> = {
  campeonato: "bg-game-campeonato/15 text-game-campeonato",
  treino: "bg-game-treino/15 text-game-treino",
  brincadeira: "bg-game-brincadeira/15 text-game-brincadeira",
};

export const MODALITY_LABEL: Record<GameModality, string> = { futsal: "Futsal", society: "Society" };
