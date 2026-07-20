# Stock Picker IDX — Design Spec

Tanggal: 2026-07-20
Status: Disetujui pengguna (brainstorming selesai)
Project Karyawan.ai: sahamcuan (`3FqWiyIE4UXbkDHpx5Do`)

## Tujuan

Aplikasi web lokal yang merekomendasikan **maksimal 3 saham IDX** untuk dibeli,
berdasarkan analisis real-time oleh Claude API dengan web search — bukan data
statis. Pola pakai utama: dijalankan manual oleh pengguna pada jendela
**15:30–15:45 WIB** hari bursa, untuk eksekusi beli di sesi penutupan
(pre-closing 15:50–16:00).

Bukan nasihat keuangan; keputusan akhir sepenuhnya di tangan pengguna, dan
disclaimer tampil permanen di aplikasi.

## Keputusan Kunci

| Keputusan | Pilihan |
|---|---|
| Mesin AI | Claude API (Sonnet) + tool `web_search` bawaan |
| Deployment | Lokal saja (`localhost:3000`), tanpa login, tanpa database |
| Jumlah saham | Maksimal 3; boleh kurang, boleh nol jika tidak ada yang layak |
| Pemicu | Manual (tombol), TIDAK otomatis; warning di luar jendela ideal |
| Stack | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Riwayat | 5 pencarian terakhir, hasil lengkap, di `localStorage` |
| Biaya | ±$0.10–$0.30 per pencarian; satu panggilan API per klik |

## Arsitektur

```
app/
  page.tsx              → halaman utama (satu-satunya halaman, client component)
  api/analyze/route.ts  → endpoint POST, timeout 5 menit
lib/
  claude.ts             → panggilan Claude API + web_search (maks ~8 pencarian)
  schema.ts             → tipe & validasi Zod hasil analisis
  marketHours.ts        → fungsi murni status sesi pasar & jendela waktu WIB
components/
  StockCard.tsx         → kartu hasil per saham
  HistoryList.tsx       → riwayat pencarian
```

`ANTHROPIC_API_KEY` di `.env.local`, tidak pernah menyentuh browser.

### Alur saat tombol ditekan

1. Frontend `POST /api/analyze`; tombol nonaktif; loading bertahap
   ("Mencari rekomendasi sekuritas…" → "Memeriksa kondisi IHSG…" →
   "Menyusun skor…") karena analisis makan ±1–2 menit.
2. Route memanggil Claude **satu kali** dengan tool `web_search` aktif.
   Claude mencari sendiri: rekomendasi sekuritas ≤3 hari, kondisi IHSG hari
   ini, katalis konkret, sentimen global — lalu menyusun skor dan memilih
   maksimal 3 saham.
3. Claude mengembalikan JSON terstruktur; route memvalidasi dengan Zod.
   JSON rusak → satu kali retry otomatis, lalu error dengan pesan jelas.
4. Frontend merender hasil dan menyimpan hasil lengkap ke `localStorage`
   (maksimal 5 entri, FIFO). Riwayat dibuka ulang tanpa panggilan API.

## Logika Analisis (prompt sistem)

1. **Sumber yang boleh dikutip**: CNBC Indonesia, Bloomberg Technoz,
   Investor.id, Kontan, Bisnis.com, IDX Channel, Emitennews, dan riset resmi
   sekuritas (BNI Sekuritas, MNC, Mirae, Pilarmas, CGS International, dll).
   Rekomendasi sekuritas wajib berumur ≤3 hari. Artikel tanpa nama
   analis/sekuritas diabaikan. Forum, Stockbit trending, Telegram, dan
   pom-pom media sosial dilarang dikutip.
2. **Skor 0–100 per kandidat**, bobot: katalis konkret 30%, konsensus analis
   25%, momentum teknikal + aliran dana asing 25%, fundamental (pertumbuhan
   laba, valuasi vs historis) 20%. Rincian skor per komponen ikut
   ditampilkan di output.
3. **Filter likuiditas**: hanya saham likuid (patokan praktis: anggota
   LQ45/IDX80 atau nilai transaksi harian besar). Saham gorengan/small cap
   ditolak; kandidat menarik yang gugur karena filter ini dicatat di
   `kandidatGugur`.
4. **Konflik sumber**: jika sekuritas saling bertentangan (beli vs jual),
   kedua sisi ditampilkan di bagian risiko saham tersebut.
5. **Boleh nol kandidat**: jika pasar buruk atau tidak ada yang meyakinkan,
   hasilnya "tidak ada yang layak hari ini" + alasan — tidak memaksakan.
6. **Sadar-waktu**: prompt menerima jam WIB saat dijalankan. Sebelum 15:50
   hari bursa → skenario "beli di penutupan hari ini"; setelah pasar tutup /
   akhir pekan → skenario "beli di pembukaan besok/Senin", disebut eksplisit
   di hasil.

## Struktur JSON Hasil (divalidasi Zod)

```
{
  dibuatPada: string (tanggal & jam WIB),
  skenario: "penutupan-hari-ini" | "pembukaan-besok",
  kondisiPasar: { arahIhsg, support, resistance, netAsing, sentimenGlobal },
  saham: [maks 3 ×] {
    kode, nama, hargaTerkini,
    skor: { total, katalis, konsensus, momentum, fundamental },
    alasan: [2–3 poin, masing-masing dengan nama sumber & tanggal],
    trading: { entry, target, cutloss },   // dari analis, bukan karangan
    risiko: [poin-poin, termasuk pendapat yang bertentangan]
  },
  kandidatGugur: [opsional] { kode, alasanGugur },
  disclaimer: string (teks tetap)
}
```

## Jendela Waktu & Status Sesi (lib/marketHours.ts)

Jadwal IDX yang jadi acuan: sesi reguler berakhir 15:49 WIB, pre-closing
15:50–16:00, post-trading s.d. 16:15.

| Kondisi | Indikator | Pesan |
|---|---|---|
| 15:30–15:45 hari bursa | Hijau | "Jendela ideal — hasil siap sebelum penutupan" |
| Jam pasar lain | Kuning | "Di luar jam ideal — data intraday belum final" |
| 15:45–16:00 | Kuning tegas | "Kemungkinan hasil selesai setelah pasar tutup" |
| Pasar tutup / akhir pekan | Biru | "Pasar tutup — analisis untuk pembukaan besok/Senin" |

Tombol tidak pernah diblokir — warning hanya informasi. Hari libur bursa
nasional TIDAK dideteksi (di luar scope); akhir pekan saja yang dideteksi.

Catatan yang ditampilkan ke pengguna: harga dari sumber berita/gratis
tertunda ±10 menit; level entry dari analis lebih andal daripada angka
harga di artikel.

## UI (satu halaman, dark mode permanen, mobile-friendly, bahasa Indonesia)

Aksen brand sahamcuan: ungu `#8b5cf6` (aksi utama), cyan `#06b6d4` (aksen
data). Susunan atas ke bawah:

1. Header: judul + jam WIB berjalan + badge status sesi pasar.
2. Tombol besar "Cari Saham Terbaik" → loading bertahap saat berjalan.
3. Panel kondisi pasar.
4. Kartu saham (maks 3): kode/nama/harga, skor total menonjol + bar per
   komponen, alasan bersumber, entry/target/cutloss, risiko. Nol kandidat →
   pesan + alasan.
5. Kandidat gugur (collapsible, jika ada).
6. Riwayat: 5 entri ringkas (tanggal + jam + kode saham). Klik → render
   ulang dari localStorage dengan banner "Data lama — diambil [tanggal jam]".
7. Footer: disclaimer permanen (bukan nasihat keuangan, data bisa
   tertunda/tidak akurat, keputusan di tangan pengguna).

## Error Handling

- Claude timeout / API error → "Analisis gagal: …" + tombol "Coba lagi".
  Tidak ada retry otomatis diam-diam (biaya).
- JSON tidak valid → satu retry otomatis, lalu error.
- `ANTHROPIC_API_KEY` kosong → pesan setup menuntun ("Isi ANTHROPIC_API_KEY
  di .env.local").
- `localStorage` rusak/penuh → riwayat direset tanpa mematikan aplikasi.

## Testing

- Vitest, unit test untuk: skema Zod (JSON valid/rusak/kosong), logika
  jendela waktu WIB (hari bursa vs akhir pekan, tiap rentang jam), rotasi
  riwayat 5 item (FIFO).
- `lib/marketHours.ts` fungsi murni (terima `Date` sebagai parameter) agar
  mudah dites tanpa mock rumit.
- Panggilan Claude sungguhan tidak dites otomatis (mahal); verifikasi manual
  satu pencarian nyata di akhir implementasi.

## Di Luar Scope (eksplisit)

- Deployment publik, login, database.
- Penjadwalan otomatis (bisa ditambah belakangan via Task Scheduler).
- Deteksi hari libur bursa nasional.
- Harga real-time / integrasi API market data berbayar.
- Eksekusi order — aplikasi hanya memberi analisis; jual/beli dilakukan
  pengguna sendiri di sekuritasnya.
