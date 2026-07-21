import { NextResponse } from "next/server";
import { analisisSaham } from "@/lib/gemini";

export const maxDuration = 300;

export async function POST() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { pesan: "GEMINI_API_KEY belum diisi. Salin .env.local.example menjadi .env.local lalu isi API key Gemini Anda (dari Google AI Studio), kemudian restart server." },
      { status: 500 },
    );
  }
  try {
    const hasil = await analisisSaham();
    return NextResponse.json(hasil);
  } catch (e) {
    // Detail teknis (bisa berbahasa Inggris / JSON mentah dari SDK) hanya di log server,
    // tidak pernah dikirim ke pengguna — pesan ke pengguna selalu bahasa Indonesia.
    console.error("Analisis gagal:", e);

    const status =
      typeof (e as { status?: unknown })?.status === "number"
        ? (e as { status: number }).status
        : undefined;
    const msg = e instanceof Error ? e.message : String(e);

    let pesan = "Analisis gagal karena kesalahan tak terduga. Tunggu sebentar lalu coba lagi.";
    if (status === 401 || /api[_ ]?key|unauthenticated/i.test(msg)) {
      pesan = "API key Gemini tidak valid. Periksa GEMINI_API_KEY di .env.local.";
    } else if (status === 403 || /permission[_ ]?denied/i.test(msg)) {
      pesan = "Akses Gemini ditolak (403). Pastikan GEMINI_API_KEY valid dan Gemini API aktif untuk project Anda.";
    } else if (status === 429 || /quota|rate limit|resource[_ ]?exhausted/i.test(msg)) {
      pesan = "Kuota atau batas laju Gemini terlampaui — atau grounding Google Search belum aktif (perlu billing project aktif di Google AI Studio). Tunggu sebentar lalu coba lagi.";
    } else if (msg.startsWith("format JSON")) {
      pesan = `Hasil analisis tidak valid: ${msg}`;
    }
    // Cabang generik sengaja TIDAK menyisipkan msg mentah agar tidak bocor teks non-Indonesia.
    return NextResponse.json({ pesan }, { status: 500 });
  }
}
