import { describe, expect, test } from "vitest";
import { HasilAnalisisSchema, ekstrakJson } from "@/lib/schema";

const contohValid = {
  dibuatPada: "Senin, 20 Jul 2026 15.32 WIB",
  skenario: "penutupan-hari-ini",
  kondisiPasar: {
    arahIhsg: "Menguat 0,4% ke 7.850",
    support: "7.800",
    resistance: "7.900",
    netAsing: "Net buy Rp 350 miliar",
    sentimenGlobal: "Bursa Asia mayoritas hijau",
  },
  saham: [
    {
      kode: "BBRI",
      nama: "Bank Rakyat Indonesia",
      hargaTerkini: "5.200",
      skor: { total: 82, katalis: 85, konsensus: 80, momentum: 78, fundamental: 84 },
      alasan: [
        { poin: "Buyback Rp 3 T diumumkan", sumber: "CNBC Indonesia", tanggal: "19 Jul 2026" },
      ],
      trading: { entry: "5.150-5.200", target: "5.450", cutloss: "5.050" },
      risiko: ["Tekanan jual asing jika rupiah melemah"],
    },
  ],
  kandidatGugur: [{ kode: "XXXX", alasanGugur: "Likuiditas rendah, bukan LQ45/IDX80" }],
};

describe("HasilAnalisisSchema", () => {
  test("menerima payload valid", () => {
    expect(() => HasilAnalisisSchema.parse(contohValid)).not.toThrow();
  });
  test("menerima 0 saham (tidak ada yang layak)", () => {
    const nol = { ...contohValid, saham: [], catatan: "Tidak ada kandidat meyakinkan hari ini" };
    expect(HasilAnalisisSchema.parse(nol).saham).toHaveLength(0);
  });
  test("menolak lebih dari 3 saham", () => {
    const empat = { ...contohValid, saham: Array(4).fill(contohValid.saham[0]) };
    expect(() => HasilAnalisisSchema.parse(empat)).toThrow();
  });
  test("menolak skor di luar 0-100", () => {
    const rusak = structuredClone(contohValid);
    rusak.saham[0].skor.total = 150;
    expect(() => HasilAnalisisSchema.parse(rusak)).toThrow();
  });
  test("kandidatGugur default [] bila tidak ada", () => {
    const { kandidatGugur: _buang, ...tanpa } = contohValid;
    expect(HasilAnalisisSchema.parse(tanpa).kandidatGugur).toEqual([]);
  });
  test("menolak skenario tak dikenal", () => {
    expect(() => HasilAnalisisSchema.parse({ ...contohValid, skenario: "lusa" })).toThrow();
  });
});

describe("ekstrakJson", () => {
  test("JSON polos", () => {
    expect(ekstrakJson('{"a":1}')).toEqual({ a: 1 });
  });
  test("JSON dalam pagar ```json", () => {
    expect(ekstrakJson('Berikut hasilnya:\n```json\n{"a":1}\n```\nSelesai.')).toEqual({ a: 1 });
  });
  test("JSON di tengah teks bebas", () => {
    expect(ekstrakJson('Analisis selesai. {"a":{"b":2}} Demikian.')).toEqual({ a: { b: 2 } });
  });
  test("tanpa JSON → melempar error", () => {
    expect(() => ekstrakJson("tidak ada data")).toThrow("Tidak ada JSON pada respons");
  });
});
