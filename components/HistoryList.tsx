import type { EntriRiwayat } from "@/lib/history";

export default function HistoryList({
  daftar,
  onPilih,
}: {
  daftar: EntriRiwayat[];
  onPilih: (entri: EntriRiwayat) => void;
}) {
  if (daftar.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-zinc-400">Riwayat pencarian</h2>
      <ul className="space-y-1.5">
        {daftar.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onPilih(e)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm hover:border-[#8b5cf6]"
            >
              <span className="text-zinc-400">{e.dibuatPada}</span>{" "}
              <span className="font-semibold text-zinc-200">
                {e.kode.length > 0 ? e.kode.join(", ") : "Tidak ada kandidat"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
