import { describe, expect, test } from "vitest";
import { bacaRiwayat, tambahRiwayat } from "@/lib/history";
import type { HasilAnalisis } from "@/lib/schema";

function storagePalsu() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function hasilDummy(kode: string): HasilAnalisis {
  return {
    dibuatPada: `waktu-${kode}`,
    skenario: "penutupan-hari-ini",
    kondisiPasar: { arahIhsg: "-", support: "-", resistance: "-", netAsing: "-", sentimenGlobal: "-" },
    saham: [
      {
        kode,
        nama: "Emiten",
        hargaTerkini: "100",
        skor: { total: 80, katalis: 80, konsensus: 80, momentum: 80, fundamental: 80 },
        alasan: [{ poin: "p", sumber: "s", tanggal: "t" }],
        trading: { entry: "1", target: "2", cutloss: "0" },
        risiko: ["r"],
      },
    ],
    kandidatGugur: [],
  };
}

describe("riwayat", () => {
  test("kosong di awal", () => {
    expect(bacaRiwayat(storagePalsu())).toEqual([]);
  });

  test("tambah lalu baca kembali", () => {
    const s = storagePalsu();
    tambahRiwayat(s, hasilDummy("BBRI"));
    const daftar = bacaRiwayat(s);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].kode).toEqual(["BBRI"]);
    expect(daftar[0].hasil.saham[0].kode).toBe("BBRI");
  });

  test("entri terbaru di depan", () => {
    const s = storagePalsu();
    tambahRiwayat(s, hasilDummy("AAAA"));
    tambahRiwayat(s, hasilDummy("BBBB"));
    expect(bacaRiwayat(s)[0].kode).toEqual(["BBBB"]);
  });

  test("maksimal 5 entri, tertua terbuang", () => {
    const s = storagePalsu();
    for (const k of ["K1", "K2", "K3", "K4", "K5", "K6"]) tambahRiwayat(s, hasilDummy(k));
    const daftar = bacaRiwayat(s);
    expect(daftar).toHaveLength(5);
    expect(daftar.map((e) => e.kode[0])).toEqual(["K6", "K5", "K4", "K3", "K2"]);
  });

  test("data rusak → reset tanpa melempar", () => {
    const s = storagePalsu();
    s.setItem("sahamcuan-riwayat", "{bukan json");
    expect(bacaRiwayat(s)).toEqual([]);
    expect(s.getItem("sahamcuan-riwayat")).toBeNull();
  });
});
