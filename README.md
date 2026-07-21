# Stock Picker IDX

Aplikasi lokal yang merekomendasikan maksimal 3 saham IDX untuk dibeli,
berdasarkan analisis **real-time** memakai **Gemini API + grounding Google
Search** — bukan data statis. Bukan nasihat keuangan; keputusan akhir
sepenuhnya di tangan pengguna.

## Setup

1. `npm install`
2. Salin `.env.local.example` menjadi `.env.local`, isi `GEMINI_API_KEY`
   (buat di https://aistudio.google.com/apikey).
3. `npm run dev` lalu buka http://localhost:3000

> **Catatan tier:** grounding Google Search membutuhkan project Gemini yang
> billing-nya aktif (tier berbayar). Model biasa jalan di free tier, tapi
> pencarian web real-time tidak. Biaya grounding sangat kecil untuk pemakaian
> pribadi. Model default `gemini-flash-latest` (bisa diubah lewat
> `GEMINI_MODEL` di `.env.local`).

## Cara pakai

Jalankan pada **15:30–15:45 WIB** hari bursa (jendela ideal), klik
**Cari Saham Terbaik**, tunggu ±1–2 menit. Di luar jam itu aplikasi tetap
jalan dengan peringatan yang sesuai (mis. pasar tutup → analisis diarahkan
untuk pembukaan hari bursa berikutnya). Riwayat 5 pencarian terakhir tersimpan
di browser (localStorage).

## Cara kerja

- `POST /api/analyze` memanggil Gemini satu kali dengan tool `googleSearch`
  aktif. Model mencari sendiri: rekomendasi sekuritas ≤3 hari, kondisi IHSG,
  katalis, dan sentimen global — lalu menyusun skor berbobot (katalis 30%,
  konsensus 25%, momentum + dana asing 25%, fundamental 20%) dan memilih
  maksimal 3 saham likuid (LQ45/IDX80).
- Hasil dikembalikan sebagai JSON, divalidasi dengan Zod (`lib/schema.ts`);
  bila JSON tidak valid, ada satu kali percobaan ulang.
- Logika status sesi pasar WIB murni ada di `lib/marketHours.ts`.

## Perintah

- `npm run dev` — jalankan server lokal
- `npm test` — unit test (Vitest)
- `npx tsc --noEmit` — pemeriksaan tipe

Spec & rencana: `docs/superpowers/specs/`, `docs/superpowers/plans/`.

## Disclaimer

Aplikasi ini **bukan nasihat keuangan**. Data diambil dari sumber publik yang
bisa tertunda atau tidak akurat. Level entry/target/cutloss berasal dari analis
pihak ketiga. Segala keputusan beli/jual dan risikonya sepenuhnya menjadi
tanggung jawab pengguna.
