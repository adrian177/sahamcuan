import Anthropic from "@anthropic-ai/sdk";
import { HasilAnalisisSchema, ekstrakJson, type HasilAnalisis } from "@/lib/schema";
import { skenario, formatWIB } from "@/lib/marketHours";

const PROMPT_SISTEM = `Kamu adalah analis pasar saham Indonesia (IDX) yang teliti dan konservatif. Tugasmu: memilih MAKSIMAL 3 saham IDX terbaik untuk dibeli berdasarkan data terbaru dari web search.

LANGKAH ANALISIS (gunakan web search, maksimal 8 pencarian):
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

FORMAT KELUARAN — setelah selesai riset, akhiri responsmu dengan SATU blok JSON valid (tanpa teks setelahnya) berstruktur persis:
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

const MAKS_LANJUTAN = 5;

async function sekaliJalan(client: Anthropic, promptPengguna: string): Promise<HasilAnalisis> {
  const alat: Anthropic.Messages.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 8 },
  ];
  let messages: Anthropic.MessageParam[] = [{ role: "user", content: promptPengguna }];

  let response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 16000,
    system: PROMPT_SISTEM,
    tools: alat,
    messages,
  });

  // Server tool (web search) bisa berhenti sementara dengan pause_turn — lanjutkan.
  let lanjutan = 0;
  while (response.stop_reason === "pause_turn" && lanjutan < MAKS_LANJUTAN) {
    lanjutan += 1;
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: PROMPT_SISTEM,
      tools: alat,
      messages,
    });
  }

  const teks = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  try {
    return HasilAnalisisSchema.parse(ekstrakJson(teks));
  } catch (e) {
    console.error("Validasi hasil analisis gagal:", e);
    throw new Error("format JSON dari Claude tidak valid atau tidak sesuai skema");
  }
}

export async function analisisSaham(): Promise<HasilAnalisis> {
  const client = new Anthropic({ timeout: 9 * 60 * 1000 });
  const prompt = buatPromptPengguna(new Date());
  try {
    return await sekaliJalan(client, prompt);
  } catch (e) {
    // JSON rusak / validasi gagal → satu kali retry penuh; error API dilempar apa adanya.
    if (e instanceof Anthropic.APIError) throw e;
    return await sekaliJalan(client, prompt);
  }
}
