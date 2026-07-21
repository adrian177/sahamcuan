import { GoogleGenAI } from "@google/genai";
import { HasilAnalisisSchema, ekstrakJson, type HasilAnalisis } from "@/lib/schema";
import { skenario, formatWIB } from "@/lib/marketHours";

const PROMPT_SISTEM = `Kamu adalah analis pasar saham Indonesia (IDX) yang teliti dan konservatif. Tugasmu: memilih MAKSIMAL 3 saham IDX terbaik untuk dibeli berdasarkan data terbaru dari Google Search.

LANGKAH ANALISIS (gunakan Google Search untuk data terbaru):
1. Cari rekomendasi saham terbaru dari sekuritas besar Indonesia (BNI Sekuritas, MNC Sekuritas, Mirae Asset, Pilarmas, CGS International, dan sejenisnya). HANYA gunakan rekomendasi berumur maksimal 3 hari dari hari ini.
2. Cari kondisi IHSG hari ini: arah, level support/resistance, net buy/sell asing.
3. Cari katalis konkret: aksi korporasi (buyback, dividen, akuisisi), rilis laporan keuangan, kebijakan pemerintah.
4. Cari sentimen global relevan: harga minyak/komoditas, geopolitik, arah bursa Asia.

SUMBER:
- HANYA kutip: CNBC Indonesia, Bloomberg Technoz, Investor.id, Kontan, Bisnis.com, IDX Channel, Emitennews, dan riset resmi sekuritas.
- ABAIKAN: forum, Stockbit trending, Telegram, media sosial, artikel tanpa nama analis/sekuritas.
- Jika sumber saling bertentangan (misal satu sekuritas bilang beli, yang lain jual), tampilkan KEDUA sisi di bagian risiko saham tersebut.

PEMILIHAN & SKOR:
- Hanya saham likuid: anggota LQ45/IDX80 atau nilai transaksi harian besar. Saham gorengan/small cap DITOLAK — catat di kandidatGugur bila ada kandidat menarik yang gugur karena ini.
- Skor 0-100 per kandidat dengan bobot: katalis konkret 30%, konsensus analis 25%, momentum teknikal + aliran dana asing 25%, fundamental (pertumbuhan laba, valuasi vs historis) 20%. Isi rincian skor per komponen.
- Level entry/target/cutloss HARUS dari analis/riset yang kamu temukan, bukan karanganmu. Sebutkan sumber + tanggal di setiap alasan.
- Boleh memilih kurang dari 3, bahkan NOL saham. Jika kondisi pasar buruk atau tidak ada kandidat meyakinkan, kembalikan saham: [] dan jelaskan alasannya di field "catatan". JANGAN memaksakan pilihan.

FORMAT KELUARAN — setelah selesai riset, akhiri responsmu dengan SATU blok JSON valid (tanpa teks apa pun setelahnya) berstruktur persis:
{
  "dibuatPada": "<string waktu yang diberikan user>",
  "skenario": "penutupan-hari-ini" | "pembukaan-besok",
  "kondisiPasar": { "arahIhsg": "...", "support": "...", "resistance": "...", "netAsing": "...", "sentimenGlobal": "..." },
  "saham": [
    {
      "kode": "XXXX", "nama": "...", "hargaTerkini": "...",
      "skor": { "total": 0-100, "katalis": 0-100, "konsensus": 0-100, "momentum": 0-100, "fundamental": 0-100 },
      "alasan": [{ "poin": "...", "sumber": "...", "tanggal": "..." }],
      "trading": { "entry": "...", "target": "...", "cutloss": "..." },
      "risiko": ["..."]
    }
  ],
  "kandidatGugur": [{ "kode": "XXXX", "alasanGugur": "..." }],
  "catatan": "opsional — wajib diisi bila saham kosong"
}
Seluruh isi teks dalam bahasa Indonesia.`;

export function buatPromptPengguna(now: Date): string {
  return `Waktu saat ini: ${formatWIB(now)}. Skenario analisis: ${skenario(now)} (${
    skenario(now) === "penutupan-hari-ini"
      ? "pilih saham untuk dibeli di sesi penutupan hari ini"
      : "pasar sedang tutup — pilih saham untuk dibeli di pembukaan hari bursa berikutnya"
  }). Cari 3 saham IDX terbaik sekarang. Isi field "dibuatPada" dengan: "${formatWIB(now)}".`;
}

async function sekaliJalan(ai: GoogleGenAI, promptPengguna: string): Promise<HasilAnalisis> {
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
    contents: promptPengguna,
    config: {
      systemInstruction: PROMPT_SISTEM,
      // Grounding Google Search — memberi Gemini akses data web terkini.
      // Catatan: mode responseSchema/JSON tidak kompatibel dengan tools,
      // jadi JSON diminta lewat prompt lalu divalidasi dengan Zod di bawah.
      tools: [{ googleSearch: {} }],
    },
  });
  const teks = res.text ?? "";
  try {
    return HasilAnalisisSchema.parse(ekstrakJson(teks));
  } catch (e) {
    console.error("Validasi hasil analisis gagal:", e);
    throw new Error("format JSON dari Gemini tidak valid atau tidak sesuai skema");
  }
}

export async function analisisSaham(): Promise<HasilAnalisis> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buatPromptPengguna(new Date());
  try {
    return await sekaliJalan(ai, prompt);
  } catch (e) {
    // Hanya JSON tidak valid yang di-retry sekali; error API/jaringan dilempar apa adanya.
    if (e instanceof Error && e.message.startsWith("format JSON")) {
      return await sekaliJalan(ai, prompt);
    }
    throw e;
  }
}
