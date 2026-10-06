// Marcas "redondas" do eixo Y cobrindo [min, max]. A faixa tem folga mínima (minSpan) para
// uma variação de 0,1 não virar um zigue-zague de ponta a ponta, e o passo nunca é menor
// que a precisão exibida, para não repetir rótulos.
export function niceTicks(min: number, max: number, decimals: number, minSpan = 2): number[] {
  if (max - min < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  min = Math.max(0, min);
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw - 1e-9)!;
  const step = Math.max(nice, 10 ** -decimals);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(decimals + 2)));
  return ticks;
}
