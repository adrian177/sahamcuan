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
    const status =
      typeof (e as { status?: unknown })?.status === "number"
        ? (e as { status: number }).status
        : undefined;
    const msg = e instanceof Error ? e.message : String(e);

    let pesan = "Analisis gagal karena kesalahan tak terduga.";
    if (status === 401 || status === 403 || /api[_ ]?key|permission|unauthenticated/i.test(msg)) {
      pesan = "API key Gemini tidak valid atau tidak berizin. Periksa GEMINI_API_KEY di .env.local.";
    } else if (status === 429 || /quota|rate limit|resource[_ ]?exhausted/i.test(msg)) {
      pesan = "Kuota atau batas laju Gemini terlampaui. Tunggu beberapa saat lalu coba lagi.";
    } else if (msg.startsWith("format JSON")) {
      pesan = `Hasil analisis tidak valid: ${msg}`;
    } else if (e instanceof Error) {
      pesan = `Analisis gagal: ${msg}`;
    }
    return NextResponse.json({ pesan }, { status: 500 });
  }
}
