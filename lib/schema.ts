import { z } from "zod";

const Skor = z.object({
  total: z.number().min(0).max(100),
  katalis: z.number().min(0).max(100),
  konsensus: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100),
  fundamental: z.number().min(0).max(100),
});

const Alasan = z.object({
  poin: z.string().min(1),
  sumber: z.string().min(1),
  tanggal: z.string().min(1),
});

const Saham = z.object({
  kode: z.string().min(2).max(6),
  nama: z.string().min(1),
  hargaTerkini: z.string().min(1),
  skor: Skor,
  alasan: z.array(Alasan).min(1).max(4),
  trading: z.object({
    entry: z.string().min(1),
    target: z.string().min(1),
    cutloss: z.string().min(1),
  }),
  risiko: z.array(z.string().min(1)).min(1),
});

export const HasilAnalisisSchema = z.object({
  dibuatPada: z.string().min(1),
  skenario: z.enum(["penutupan-hari-ini", "pembukaan-besok"]),
  kondisiPasar: z.object({
    arahIhsg: z.string().min(1),
    support: z.string().min(1),
    resistance: z.string().min(1),
    netAsing: z.string().min(1),
    sentimenGlobal: z.string().min(1),
  }),
  saham: z.array(Saham).max(3),
  kandidatGugur: z.array(z.object({ kode: z.string().min(1), alasanGugur: z.string().min(1) })).optional().default([]),
  catatan: z.string().optional(),
});

export type HasilAnalisis = z.infer<typeof HasilAnalisisSchema>;

export function ekstrakJson(text: string): unknown {
  const pagar = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const sumber = pagar ? pagar[1] : text;
  const awal = sumber.indexOf("{");
  const akhir = sumber.lastIndexOf("}");
  if (awal === -1 || akhir <= awal) throw new Error("Tidak ada JSON pada respons");
  return JSON.parse(sumber.slice(awal, akhir + 1));
}
