import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { analisisSaham } from "@/lib/claude";

export const maxDuration = 300;

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { pesan: "ANTHROPIC_API_KEY belum diisi. Salin .env.local.example menjadi .env.local lalu isi API key Anda, kemudian restart server." },
      { status: 500 },
    );
  }
  try {
    const hasil = await analisisSaham();
    return NextResponse.json(hasil);
  } catch (e) {
    let pesan = "Analisis gagal karena kesalahan tak terduga.";
    if (e instanceof Anthropic.AuthenticationError) {
      pesan = "API key tidak valid. Periksa ANTHROPIC_API_KEY di .env.local.";
    } else if (e instanceof Anthropic.RateLimitError) {
      pesan = "Terkena batas laju API. Tunggu sebentar lalu coba lagi.";
    } else if (e instanceof Anthropic.APIConnectionError) {
      pesan = "Tidak bisa terhubung ke Claude API. Periksa koneksi internet.";
    } else if (e instanceof Anthropic.APIError) {
      pesan = `Claude API error (${e.status}): ${e.message}`;
    } else if (e instanceof Error) {
      pesan = `Hasil analisis tidak valid: ${e.message}`;
    }
    return NextResponse.json({ pesan }, { status: 500 });
  }
}
