import { describe, expect, test } from "vitest";
import { statusSesi, skenario, formatWIB } from "@/lib/marketHours";

// Helper: buat Date dari jam WIB (UTC+7). 2026-07-20 adalah Senin.
function wib(tanggal: string, jam: string): Date {
  return new Date(`${tanggal}T${jam}:00+07:00`);
}

describe("statusSesi", () => {
  test("Senin 15:30 WIB → ideal", () => {
    expect(statusSesi(wib("2026-07-20", "15:30")).level).toBe("ideal");
  });
  test("Senin 15:44 WIB → ideal (batas atas)", () => {
    expect(statusSesi(wib("2026-07-20", "15:44")).level).toBe("ideal");
  });
  test("Senin 15:45 WIB → kritis", () => {
    expect(statusSesi(wib("2026-07-20", "15:45")).level).toBe("kritis");
  });
  test("Senin 15:59 WIB → kritis", () => {
    expect(statusSesi(wib("2026-07-20", "15:59")).level).toBe("kritis");
  });
  test("Senin 10:00 WIB → luar-jam", () => {
    expect(statusSesi(wib("2026-07-20", "10:00")).level).toBe("luar-jam");
  });
  test("Senin 08:59 WIB → tutup", () => {
    expect(statusSesi(wib("2026-07-20", "08:59")).level).toBe("tutup");
  });
  test("Senin 16:00 WIB → tutup", () => {
    expect(statusSesi(wib("2026-07-20", "16:00")).level).toBe("tutup");
  });
  test("Minggu siang → tutup", () => {
    expect(statusSesi(wib("2026-07-19", "13:00")).level).toBe("tutup");
  });
  test("Sabtu → tutup walau jam 15:30", () => {
    expect(statusSesi(wib("2026-07-18", "15:30")).level).toBe("tutup");
  });
  test("setiap level punya pesan tidak kosong", () => {
    for (const d of [wib("2026-07-20", "15:30"), wib("2026-07-20", "15:50"), wib("2026-07-20", "10:00"), wib("2026-07-19", "13:00")]) {
      expect(statusSesi(d).pesan.length).toBeGreaterThan(0);
    }
  });
});

describe("skenario", () => {
  test("Senin 15:00 WIB → penutupan-hari-ini", () => {
    expect(skenario(wib("2026-07-20", "15:00"))).toBe("penutupan-hari-ini");
  });
  test("Senin 15:50 WIB → pembukaan-besok", () => {
    expect(skenario(wib("2026-07-20", "15:50"))).toBe("pembukaan-besok");
  });
  test("Minggu → pembukaan-besok", () => {
    expect(skenario(wib("2026-07-19", "10:00"))).toBe("pembukaan-besok");
  });
});

describe("formatWIB", () => {
  test("mengandung 'WIB'", () => {
    expect(formatWIB(wib("2026-07-20", "15:30"))).toContain("WIB");
  });
});
