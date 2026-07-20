import { describe, expect, test } from "vitest";
import { buatPromptPengguna } from "@/lib/claude";

describe("buatPromptPengguna", () => {
  test("hari bursa sebelum 15:50 → skenario penutupan hari ini", () => {
    const p = buatPromptPengguna(new Date("2026-07-20T15:00:00+07:00")); // Senin
    expect(p).toContain("penutupan-hari-ini");
    expect(p).toContain("WIB");
  });
  test("akhir pekan → skenario pembukaan besok", () => {
    const p = buatPromptPengguna(new Date("2026-07-19T10:00:00+07:00")); // Minggu
    expect(p).toContain("pembukaan-besok");
  });
});
