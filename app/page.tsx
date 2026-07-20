"use client";

import { useEffect, useState } from "react";
import type { HasilAnalisis } from "@/lib/schema";
import { statusSesi, formatWIB } from "@/lib/marketHours";
import { bacaRiwayat, tambahRiwayat, type EntriRiwayat } from "@/lib/history";
import StockCard from "@/components/StockCard";
import HistoryList from "@/components/HistoryList";

const TAHAP_LOADING = [
  "Mencari rekomendasi sekuritas terbaru…",
  "Memeriksa kondisi IHSG & dana asing…",
  "Memindai katalis & sentimen global…",
  "Menyusun skor dan memilih saham…",
];

const WARNA_BADGE: Record<string, string> = {
  ideal: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  kritis: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  "luar-jam": "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  tutup: "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

export default function Home() {
  const [jam, setJam] = useState<Date | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [tahap, setTahap] = useState(0);
  const [hasil, setHasil] = useState<HasilAnalisis | null>(null);
  const [dariRiwayat, setDariRiwayat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<EntriRiwayat[]>([]);
  const [bukaGugur, setBukaGugur] = useState(false);

  useEffect(() => {
    setJam(new Date());
    setRiwayat(bacaRiwayat(window.localStorage));
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!memuat) return;
    const t = setInterval(() => setTahap((x) => (x + 1) % TAHAP_LOADING.length), 8000);
    return () => clearInterval(t);
  }, [memuat]);

  async function cari() {
    setMemuat(true);
    setTahap(0);
    setGalat(null);
    setDariRiwayat(false);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.pesan ?? "Analisis gagal.");
      setHasil(data);
      setRiwayat(tambahRiwayat(window.localStorage, data));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Analisis gagal.");
    } finally {
      setMemuat(false);
    }
  }

  const status = jam ? statusSesi(jam) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 pb-16">
      <header className="space-y-2 pt-4 text-center">
        <h1 className="text-2xl font-bold">
          Stock Picker <span className="text-[#8b5cf6]">IDX</span>
        </h1>
        {jam && status && (
          <div className="space-y-1.5">
            <p className="text-sm tabular-nums text-zinc-400">{formatWIB(jam)}</p>
            <span className={`inline-block rounded-full border px-3 py-1 text-xs ${WARNA_BADGE[status.level]}`}>
              {status.pesan}
            </span>
          </div>
        )}
      </header>

      <button
        onClick={cari}
        disabled={memuat}
        className="w-full rounded-xl bg-[#8b5cf6] py-4 text-lg font-semibold text-white transition hover:bg-[#7c3aed] disabled:opacity-60"
      >
        {memuat ? (
          <span className="flex items-center justify-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {TAHAP_LOADING[tahap]}
          </span>
        ) : (
          "Cari Saham Terbaik"
        )}
      </button>
      {memuat && (
        <p className="text-center text-xs text-zinc-500">
          Analisis memakan waktu 1–2 menit karena mencari data terbaru dari web.
        </p>
      )}

      {galat && (
        <div className="space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          <p>Analisis gagal: {galat}</p>
          <button onClick={cari} className="rounded-lg bg-rose-500/20 px-3 py-1.5 font-semibold hover:bg-rose-500/30">
            Coba lagi
          </button>
        </div>
      )}

      {hasil && (
        <section className="space-y-4">
          {dariRiwayat && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Data lama — diambil {hasil.dibuatPada}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Data diambil: {hasil.dibuatPada} · Skenario:{" "}
            {hasil.skenario === "penutupan-hari-ini" ? "beli di penutupan hari ini" : "beli di pembukaan besok"}
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <h2 className="mb-2 font-semibold text-[#06b6d4]">Kondisi Pasar</h2>
            <dl className="grid grid-cols-1 gap-1 text-zinc-300 sm:grid-cols-2">
              <div><dt className="inline text-zinc-500">IHSG: </dt><dd className="inline">{hasil.kondisiPasar.arahIhsg}</dd></div>
              <div><dt className="inline text-zinc-500">Net asing: </dt><dd className="inline">{hasil.kondisiPasar.netAsing}</dd></div>
              <div><dt className="inline text-zinc-500">Support: </dt><dd className="inline">{hasil.kondisiPasar.support}</dd></div>
              <div><dt className="inline text-zinc-500">Resistance: </dt><dd className="inline">{hasil.kondisiPasar.resistance}</dd></div>
              <div className="sm:col-span-2"><dt className="inline text-zinc-500">Global: </dt><dd className="inline">{hasil.kondisiPasar.sentimenGlobal}</dd></div>
            </dl>
          </div>

          {hasil.saham.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-300">
              <p className="font-semibold">Tidak ada saham yang layak hari ini.</p>
              {hasil.catatan && <p className="mt-2 text-zinc-400">{hasil.catatan}</p>}
            </div>
          ) : (
            hasil.saham.map((s) => <StockCard key={s.kode} saham={s} />)
          )}

          {hasil.kandidatGugur.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900">
              <button
                onClick={() => setBukaGugur((x) => !x)}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-zinc-400"
              >
                {bukaGugur ? "▾" : "▸"} Kandidat gugur ({hasil.kandidatGugur.length})
              </button>
              {bukaGugur && (
                <ul className="space-y-1 px-4 pb-4 text-sm text-zinc-400">
                  {hasil.kandidatGugur.map((k, i) => (
                    <li key={i}>
                      <span className="font-semibold text-zinc-300">{k.kode}</span> — {k.alasanGugur}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <HistoryList
        daftar={riwayat}
        onPilih={(e) => {
          setHasil(e.hasil);
          setDariRiwayat(true);
          setGalat(null);
        }}
      />

      <footer className="border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
        <strong>Disclaimer:</strong> Aplikasi ini bukan nasihat keuangan. Data diambil dari sumber publik yang
        bisa tertunda (±10 menit) atau tidak akurat. Level entry/target/cutloss berasal dari analis pihak
        ketiga. Segala keputusan beli/jual dan risikonya sepenuhnya menjadi tanggung jawab pengguna.
      </footer>
    </main>
  );
}
