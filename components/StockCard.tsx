import type { HasilAnalisis } from "@/lib/schema";

type Saham = HasilAnalisis["saham"][number];

function BarSkor({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-800">
        <div className="h-1.5 rounded bg-[#06b6d4]" style={{ width: `${nilai}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums text-zinc-300">{nilai}</span>
    </div>
  );
}

export default function StockCard({ saham }: { saham: Saham }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#8b5cf6]">{saham.kode}</h3>
          <p className="text-sm text-zinc-400">{saham.nama}</p>
          <p className="mt-1 text-sm">Harga terkini: <span className="font-semibold">{saham.hargaTerkini}</span></p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums text-[#06b6d4]">{saham.skor.total}</div>
          <div className="text-xs text-zinc-500">skor total</div>
        </div>
      </header>

      <div className="space-y-1.5">
        <BarSkor label="Katalis (30%)" nilai={saham.skor.katalis} />
        <BarSkor label="Konsensus (25%)" nilai={saham.skor.konsensus} />
        <BarSkor label="Momentum (25%)" nilai={saham.skor.momentum} />
        <BarSkor label="Fundamental (20%)" nilai={saham.skor.fundamental} />
      </div>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Alasan dipilih</h4>
        <ul className="space-y-1 text-sm text-zinc-300">
          {saham.alasan.map((a, i) => (
            <li key={i}>
              • {a.poin}{" "}
              <span className="text-xs text-zinc-500">({a.sumber}, {a.tanggal})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Entry</div>
          <div className="font-semibold">{saham.trading.entry}</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Target</div>
          <div className="font-semibold text-emerald-400">{saham.trading.target}</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Cutloss</div>
          <div className="font-semibold text-rose-400">{saham.trading.cutloss}</div>
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-rose-300">Risiko</h4>
        <ul className="space-y-1 text-sm text-zinc-400">
          {saham.risiko.map((r, i) => (
            <li key={i}>⚠ {r}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
