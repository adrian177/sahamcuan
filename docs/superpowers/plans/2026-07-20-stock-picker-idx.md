# Stock Picker IDX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi web lokal (localhost) yang merekomendasikan maksimal 3 saham IDX via analisis real-time Claude API + web search, sesuai spec `docs/superpowers/specs/2026-07-20-stock-picker-idx-design.md`.

**Architecture:** Next.js 15 App Router. Satu halaman client component; satu API route `POST /api/analyze` yang memanggil Claude (`claude-sonnet-5`) satu kali dengan server tool `web_search_20260209` (maks 8 pencarian), memvalidasi JSON hasil dengan Zod (1x retry), dan mengembalikannya ke frontend. Riwayat 5 pencarian di `localStorage`. Logika jam pasar WIB dipisah sebagai fungsi murni.

**Tech Stack:** Next.js 15 + TypeScript + Tailwind CSS v4, `@anthropic-ai/sdk`, `zod`, Vitest.

## Global Constraints

- Bahasa UI & seluruh copy: **Indonesia**. Dark mode permanen (tidak ada toggle).
- Warna aksen: primer `#8b5cf6` (violet), sekunder `#06b6d4` (cyan).
- Model: `claude-sonnet-5` (persis string ini — sesuai spec yang disetujui user). Tool: `{ type: "web_search_20260209", name: "web_search", max_uses: 8 }`.
- `ANTHROPIC_API_KEY` hanya di `.env.local`, tidak pernah dikirim ke browser.
- Maksimal 3 saham; boleh 0. Riwayat maksimal 5 entri (FIFO).
- Jendela ideal 15:30–15:45 WIB; peringatan 15:45–16:00; tombol tidak pernah diblokir.
- Semua waktu dihitung sebagai WIB (UTC+7) dari `Date` yang diberikan — fungsi murni, tidak membaca jam sistem sendiri.
- Commit setelah setiap task selesai. Platform: Windows, shell Git Bash.
- Direktori project: `C:\Users\Dimas\OneDrive\Desktop\claude\SAHAMCUAN` (sudah berisi `.git` dan `docs/` — scaffold tidak boleh menimpanya).

---

### Task 1: Scaffold Next.js + Vitest

**Files:**
- Create: seluruh scaffold Next.js di root repo (via temp folder), `vitest.config.ts`, `.env.local.example`
- Modify: `package.json` (script `test`), `.gitignore`

**Interfaces:**
- Produces: project Next.js jalan (`npm run dev`), `npm test` jalan (Vitest), alias `@/*` aktif.

- [ ] **Step 1: Scaffold ke folder sementara lalu pindahkan** (folder root sudah berisi `.git` + `docs`, create-next-app menolak folder tidak kosong)

```bash
cd "/c/Users/Dimas/OneDrive/Desktop/claude/SAHAMCUAN"
npx create-next-app@latest tmp-scaffold --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
# pindahkan isi (termasuk dotfiles) ke root, lalu hapus folder temp
mv tmp-scaffold/.gitignore tmp-scaffold/* .
rm -rf tmp-scaffold
```

- [ ] **Step 2: Install dependensi runtime & test**

```bash
npm install @anthropic-ai/sdk zod
npm install -D vitest
```

- [ ] **Step 3: Buat `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Tambah script test di `package.json`**

Di objek `"scripts"`, tambahkan:

```json
"test": "vitest run"
```

- [ ] **Step 5: Buat `.env.local.example`**

```
# Salin file ini menjadi .env.local lalu isi API key dari https://platform.claude.com
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 6: Smoke test — buat `tests/smoke.test.ts`, jalankan, lalu hapus**

```ts
import { expect, test } from "vitest";

test("vitest berjalan", () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: `1 passed`. Setelah lulus: `rm tests/smoke.test.ts` (task berikutnya mengisi folder `tests/`).

- [ ] **Step 7: Verifikasi dev server**

Run: `npm run dev` (background) lalu `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`. Matikan server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + Vitest"
```

---

### Task 2: Logika jam pasar WIB (`lib/marketHours.ts`)

**Files:**
- Create: `lib/marketHours.ts`
- Test: `tests/marketHours.test.ts`

**Interfaces:**
- Produces:
  - `type StatusSesi = { level: "ideal" | "kritis" | "luar-jam" | "tutup"; pesan: string }`
  - `statusSesi(now: Date): StatusSesi`
  - `skenario(now: Date): "penutupan-hari-ini" | "pembukaan-besok"`
  - `formatWIB(now: Date): string` — contoh `"Minggu, 20 Jul 2026 14.05 WIB"`
- Aturan (semua dihitung di zona WIB = UTC+7):
  - Sabtu/Minggu → `tutup`
  - Hari kerja 15:30–15:44 → `ideal` ("Jendela ideal — hasil siap sebelum penutupan")
  - Hari kerja 15:45–15:59 → `kritis` ("Kemungkinan hasil selesai setelah pasar tutup")
  - Hari kerja 09:00–15:29 → `luar-jam` ("Di luar jam ideal — data intraday belum final")
  - Hari kerja sebelum 09:00 atau ≥16:00 → `tutup` ("Pasar tutup — analisis untuk pembukaan besok/Senin")
  - `skenario`: hari kerja dan jam WIB < 15:50 → `"penutupan-hari-ini"`, selain itu `"pembukaan-besok"`

- [ ] **Step 1: Tulis test yang gagal — `tests/marketHours.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/marketHours'` (atau setara).

- [ ] **Step 3: Implementasi `lib/marketHours.ts`**

```ts
// Semua logika waktu di file ini dihitung pada zona WIB (UTC+7),
// diturunkan murni dari Date yang diberikan agar mudah dites.

export type StatusSesi = {
  level: "ideal" | "kritis" | "luar-jam" | "tutup";
  pesan: string;
};

const MENIT = (jam: number, menit: number) => jam * 60 + menit;

type WaktuWIB = { hari: number; menit: number }; // hari: 0=Minggu..6=Sabtu

function keWIB(now: Date): WaktuWIB {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const wib = new Date(utcMs + 7 * 3_600_000);
  return { hari: wib.getDay(), menit: MENIT(wib.getHours(), wib.getMinutes()) };
}

function hariBursa(hari: number): boolean {
  return hari >= 1 && hari <= 5;
}

export function statusSesi(now: Date): StatusSesi {
  const { hari, menit } = keWIB(now);
  if (!hariBursa(hari)) {
    return { level: "tutup", pesan: "Pasar tutup — analisis untuk pembukaan besok/Senin" };
  }
  if (menit >= MENIT(15, 30) && menit < MENIT(15, 45)) {
    return { level: "ideal", pesan: "Jendela ideal — hasil siap sebelum penutupan" };
  }
  if (menit >= MENIT(15, 45) && menit < MENIT(16, 0)) {
    return { level: "kritis", pesan: "Kemungkinan hasil selesai setelah pasar tutup" };
  }
  if (menit >= MENIT(9, 0) && menit < MENIT(15, 30)) {
    return { level: "luar-jam", pesan: "Di luar jam ideal — data intraday belum final" };
  }
  return { level: "tutup", pesan: "Pasar tutup — analisis untuk pembukaan besok/Senin" };
}

export function skenario(now: Date): "penutupan-hari-ini" | "pembukaan-besok" {
  const { hari, menit } = keWIB(now);
  if (hariBursa(hari) && menit < MENIT(15, 50)) return "penutupan-hari-ini";
  return "pembukaan-besok";
}

export function formatWIB(now: Date): string {
  const teks = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return `${teks} WIB`;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/marketHours.ts tests/marketHours.test.ts
git commit -m "feat: logika status sesi pasar & jendela waktu WIB"
```

---

### Task 3: Skema hasil analisis + ekstraksi JSON (`lib/schema.ts`)

**Files:**
- Create: `lib/schema.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces:
  - `HasilAnalisisSchema` (Zod) dan `type HasilAnalisis = z.infer<typeof HasilAnalisisSchema>`
  - `ekstrakJson(text: string): unknown` — mengambil objek JSON dari teks bebas (dengan/ tanpa pagar ```json), melempar `Error("Tidak ada JSON pada respons")` bila tidak ada.
- Struktur `HasilAnalisis` (semua string bebas kecuali disebutkan):
  - `dibuatPada: string`
  - `skenario: "penutupan-hari-ini" | "pembukaan-besok"`
  - `kondisiPasar: { arahIhsg, support, resistance, netAsing, sentimenGlobal }`
  - `saham: []` maks 3 × `{ kode, nama, hargaTerkini, skor: { total, katalis, konsensus, momentum, fundamental } (angka 0–100), alasan: [{ poin, sumber, tanggal }] (1–4), trading: { entry, target, cutloss }, risiko: string[] (min 1) }`
  - `kandidatGugur: [{ kode, alasanGugur }]` — optional, default `[]`
  - `catatan: string` — optional (dipakai saat 0 kandidat)

- [ ] **Step 1: Tulis test yang gagal — `tests/schema.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL — modul `@/lib/schema` belum ada.

- [ ] **Step 3: Implementasi `lib/schema.ts`**

```ts
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
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts tests/schema.test.ts
git commit -m "feat: skema Zod hasil analisis + ekstraksi JSON"
```

---

### Task 4: Riwayat pencarian (`lib/history.ts`)

**Files:**
- Create: `lib/history.ts`
- Test: `tests/history.test.ts`

**Interfaces:**
- Consumes: `HasilAnalisis` dari `@/lib/schema`.
- Produces:
  - `type EntriRiwayat = { id: string; dibuatPada: string; kode: string[]; hasil: HasilAnalisis }`
  - `type StorageMinimal = Pick<Storage, "getItem" | "setItem" | "removeItem">`
  - `bacaRiwayat(storage: StorageMinimal): EntriRiwayat[]` — data rusak → reset (removeItem) dan kembalikan `[]`
  - `tambahRiwayat(storage: StorageMinimal, hasil: HasilAnalisis): EntriRiwayat[]` — entri baru di depan, maksimal 5 (yang tertua terbuang)
  - Konstanta kunci: `"sahamcuan-riwayat"`

- [ ] **Step 1: Tulis test yang gagal — `tests/history.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL — modul `@/lib/history` belum ada.

- [ ] **Step 3: Implementasi `lib/history.ts`**

```ts
import type { HasilAnalisis } from "@/lib/schema";

export const KUNCI_RIWAYAT = "sahamcuan-riwayat";
const MAKS_ENTRI = 5;

export type EntriRiwayat = {
  id: string;
  dibuatPada: string;
  kode: string[];
  hasil: HasilAnalisis;
};

export type StorageMinimal = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function bacaRiwayat(storage: StorageMinimal): EntriRiwayat[] {
  const mentah = storage.getItem(KUNCI_RIWAYAT);
  if (!mentah) return [];
  try {
    const data = JSON.parse(mentah);
    if (!Array.isArray(data)) throw new Error("bukan array");
    return data as EntriRiwayat[];
  } catch {
    storage.removeItem(KUNCI_RIWAYAT);
    return [];
  }
}

export function tambahRiwayat(storage: StorageMinimal, hasil: HasilAnalisis): EntriRiwayat[] {
  const entri: EntriRiwayat = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dibuatPada: hasil.dibuatPada,
    kode: hasil.saham.map((s) => s.kode),
    hasil,
  };
  const daftar = [entri, ...bacaRiwayat(storage)].slice(0, MAKS_ENTRI);
  try {
    storage.setItem(KUNCI_RIWAYAT, JSON.stringify(daftar));
  } catch {
    // storage penuh — riwayat tidak tersimpan, aplikasi tetap jalan
  }
  return daftar;
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test`
Expected: semua PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/history.ts tests/history.test.ts
git commit -m "feat: riwayat 5 pencarian terakhir (FIFO, tahan data rusak)"
```

---

### Task 5: Panggilan Claude + API route (`lib/claude.ts`, `app/api/analyze/route.ts`)

**Files:**
- Create: `lib/claude.ts`, `app/api/analyze/route.ts`
- Test: `tests/claude.test.ts` (hanya bagian murni: builder prompt)

**Interfaces:**
- Consumes: `HasilAnalisisSchema`, `ekstrakJson` dari `@/lib/schema`; `skenario`, `formatWIB` dari `@/lib/marketHours`.
- Produces:
  - `buatPromptPengguna(now: Date): string` — pesan user berisi waktu WIB + skenario (fungsi murni, diekspor untuk test)
  - `analisisSaham(): Promise<HasilAnalisis>` — 1 panggilan Claude + web search, validasi Zod, 1x retry bila JSON rusak; melempar `Error` berpesan Indonesia bila gagal.
  - Route `POST /api/analyze` → 200 `HasilAnalisis` | 500 `{ pesan: string }`.

- [ ] **Step 1: Tulis test yang gagal — `tests/claude.test.ts`**

```ts
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
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test`
Expected: FAIL — modul `@/lib/claude` belum ada.

- [ ] **Step 3: Implementasi `lib/claude.ts`**

Catatan teknis yang wajib diikuti:
- Model `claude-sonnet-5`; tool `web_search_20260209` (`max_uses: 8`); `max_tokens: 16000`.
- Server tool bisa berhenti dengan `stop_reason: "pause_turn"` — lanjutkan dengan mengirim ulang percakapan + konten assistant (maks 5 kali).
- JSON diambil dari gabungan seluruh blok `text`, divalidasi Zod; gagal → ulang seluruh panggilan sekali lagi.

```ts
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
  return HasilAnalisisSchema.parse(ekstrakJson(teks));
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
```

- [ ] **Step 4: Implementasi `app/api/analyze/route.ts`**

```ts
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
```

- [ ] **Step 5: Jalankan test + typecheck**

Run: `npm test` lalu `npx tsc --noEmit`
Expected: test PASS, tanpa error TypeScript.

- [ ] **Step 6: Verifikasi route tanpa API key**

Run: jalankan `npm run dev` **tanpa** `.env.local`, lalu:
`curl -s -X POST http://localhost:3000/api/analyze`
Expected: HTTP 500 dengan JSON `{"pesan":"ANTHROPIC_API_KEY belum diisi. ..."}`. Matikan server. (Panggilan Claude sungguhan diverifikasi manual di Task 7 — tidak dites otomatis karena berbiaya.)

- [ ] **Step 7: Commit**

```bash
git add lib/claude.ts app/api/analyze/route.ts tests/claude.test.ts
git commit -m "feat: endpoint analisis Claude + web search dengan validasi Zod"
```

---

### Task 6: UI — halaman utama, kartu saham, riwayat

**Files:**
- Create: `components/StockCard.tsx`, `components/HistoryList.tsx`
- Modify: `app/page.tsx` (ganti seluruh isi), `app/layout.tsx` (metadata + dark), `app/globals.css` (biarkan import Tailwind; hapus sisa boilerplate bila ada)

**Interfaces:**
- Consumes: `HasilAnalisis` (`@/lib/schema`), `statusSesi`, `formatWIB` (`@/lib/marketHours`), `bacaRiwayat`, `tambahRiwayat`, `EntriRiwayat` (`@/lib/history`).
- Produces: satu halaman dark mode berbahasa Indonesia. Tidak ada test unit (visual) — verifikasi via dev server.

- [ ] **Step 1: `app/layout.tsx` — metadata & latar gelap**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Picker IDX",
  description: "Rekomendasi saham IDX berbasis analisis real-time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: `components/StockCard.tsx`**

```tsx
import type { HasilAnalisis } from "@/lib/schema";

type Saham = HasilAnalisis["saham"][number];

function BarSkor({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-800">
        <div className="h-1.5 rounded bg-[#06b6d4]" style={{ width: `${nilai}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums text-zinc-300">{nilai}</span>
    </div>
  );
}

export default function StockCard({ saham }: { saham: Saham }) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#8b5cf6]">{saham.kode}</h3>
          <p className="text-sm text-zinc-400">{saham.nama}</p>
          <p className="mt-1 text-sm">Harga terkini: <span className="font-semibold">{saham.hargaTerkini}</span></p>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums text-[#06b6d4]">{saham.skor.total}</div>
          <div className="text-xs text-zinc-500">skor total</div>
        </div>
      </header>

      <div className="space-y-1.5">
        <BarSkor label="Katalis (30%)" nilai={saham.skor.katalis} />
        <BarSkor label="Konsensus (25%)" nilai={saham.skor.konsensus} />
        <BarSkor label="Momentum (25%)" nilai={saham.skor.momentum} />
        <BarSkor label="Fundamental (20%)" nilai={saham.skor.fundamental} />
      </div>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Alasan dipilih</h4>
        <ul className="space-y-1 text-sm text-zinc-300">
          {saham.alasan.map((a, i) => (
            <li key={i}>
              • {a.poin}{" "}
              <span className="text-xs text-zinc-500">({a.sumber}, {a.tanggal})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Entry</div>
          <div className="font-semibold">{saham.trading.entry}</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Target</div>
          <div className="font-semibold text-emerald-400">{saham.trading.target}</div>
        </div>
        <div className="rounded-lg bg-zinc-800 p-2">
          <div className="text-xs text-zinc-500">Cutloss</div>
          <div className="font-semibold text-rose-400">{saham.trading.cutloss}</div>
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-sm font-semibold text-rose-300">Risiko</h4>
        <ul className="space-y-1 text-sm text-zinc-400">
          {saham.risiko.map((r, i) => (
            <li key={i}>⚠ {r}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
```

- [ ] **Step 3: `components/HistoryList.tsx`**

```tsx
import type { EntriRiwayat } from "@/lib/history";

export default function HistoryList({
  daftar,
  onPilih,
}: {
  daftar: EntriRiwayat[];
  onPilih: (entri: EntriRiwayat) => void;
}) {
  if (daftar.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-zinc-400">Riwayat pencarian</h2>
      <ul className="space-y-1.5">
        {daftar.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onPilih(e)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-sm hover:border-[#8b5cf6]"
            >
              <span className="text-zinc-400">{e.dibuatPada}</span>{" "}
              <span className="font-semibold text-zinc-200">
                {e.kode.length > 0 ? e.kode.join(", ") : "Tidak ada kandidat"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: `app/page.tsx` — halaman utama (ganti seluruh isi)**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { HasilAnalisis } from "@/lib/schema";
import { statusSesi, formatWIB } from "@/lib/marketHours";
import { bacaRiwayat, tambahRiwayat, type EntriRiwayat } from "@/lib/history";
import StockCard from "@/components/StockCard";
import HistoryList from "@/components/HistoryList";

const TAHAP_LOADING = [
  "Mencari rekomendasi sekuritas terbaru…",
  "Memeriksa kondisi IHSG & dana asing…",
  "Memindai katalis & sentimen global…",
  "Menyusun skor dan memilih saham…",
];

const WARNA_BADGE: Record<string, string> = {
  ideal: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  kritis: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  "luar-jam": "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  tutup: "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

export default function Home() {
  const [jam, setJam] = useState<Date | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [tahap, setTahap] = useState(0);
  const [hasil, setHasil] = useState<HasilAnalisis | null>(null);
  const [dariRiwayat, setDariRiwayat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<EntriRiwayat[]>([]);
  const [bukaGugur, setBukaGugur] = useState(false);

  useEffect(() => {
    setJam(new Date());
    setRiwayat(bacaRiwayat(window.localStorage));
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!memuat) return;
    const t = setInterval(() => setTahap((x) => (x + 1) % TAHAP_LOADING.length), 8000);
    return () => clearInterval(t);
  }, [memuat]);

  async function cari() {
    setMemuat(true);
    setTahap(0);
    setGalat(null);
    setDariRiwayat(false);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.pesan ?? "Analisis gagal.");
      setHasil(data);
      setRiwayat(tambahRiwayat(window.localStorage, data));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Analisis gagal.");
    } finally {
      setMemuat(false);
    }
  }

  const status = jam ? statusSesi(jam) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 pb-16">
      <header className="space-y-2 pt-4 text-center">
        <h1 className="text-2xl font-bold">
          Stock Picker <span className="text-[#8b5cf6]">IDX</span>
        </h1>
        {jam && status && (
          <div className="space-y-1.5">
            <p className="text-sm tabular-nums text-zinc-400">{formatWIB(jam)}</p>
            <span className={`inline-block rounded-full border px-3 py-1 text-xs ${WARNA_BADGE[status.level]}`}>
              {status.pesan}
            </span>
          </div>
        )}
      </header>

      <button
        onClick={cari}
        disabled={memuat}
        className="w-full rounded-xl bg-[#8b5cf6] py-4 text-lg font-semibold text-white transition hover:bg-[#7c3aed] disabled:opacity-60"
      >
        {memuat ? (
          <span className="flex items-center justify-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {TAHAP_LOADING[tahap]}
          </span>
        ) : (
          "Cari Saham Terbaik"
        )}
      </button>
      {memuat && (
        <p className="text-center text-xs text-zinc-500">
          Analisis memakan waktu 1–2 menit karena mencari data terbaru dari web.
        </p>
      )}

      {galat && (
        <div className="space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          <p>Analisis gagal: {galat}</p>
          <button onClick={cari} className="rounded-lg bg-rose-500/20 px-3 py-1.5 font-semibold hover:bg-rose-500/30">
            Coba lagi
          </button>
        </div>
      )}

      {hasil && (
        <section className="space-y-4">
          {dariRiwayat && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Data lama — diambil {hasil.dibuatPada}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Data diambil: {hasil.dibuatPada} · Skenario:{" "}
            {hasil.skenario === "penutupan-hari-ini" ? "beli di penutupan hari ini" : "beli di pembukaan besok"}
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <h2 className="mb-2 font-semibold text-[#06b6d4]">Kondisi Pasar</h2>
            <dl className="grid grid-cols-1 gap-1 text-zinc-300 sm:grid-cols-2">
              <div><dt className="inline text-zinc-500">IHSG: </dt><dd className="inline">{hasil.kondisiPasar.arahIhsg}</dd></div>
              <div><dt className="inline text-zinc-500">Net asing: </dt><dd className="inline">{hasil.kondisiPasar.netAsing}</dd></div>
              <div><dt className="inline text-zinc-500">Support: </dt><dd className="inline">{hasil.kondisiPasar.support}</dd></div>
              <div><dt className="inline text-zinc-500">Resistance: </dt><dd className="inline">{hasil.kondisiPasar.resistance}</dd></div>
              <div className="sm:col-span-2"><dt className="inline text-zinc-500">Global: </dt><dd className="inline">{hasil.kondisiPasar.sentimenGlobal}</dd></div>
            </dl>
          </div>

          {hasil.saham.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-300">
              <p className="font-semibold">Tidak ada saham yang layak hari ini.</p>
              {hasil.catatan && <p className="mt-2 text-zinc-400">{hasil.catatan}</p>}
            </div>
          ) : (
            hasil.saham.map((s) => <StockCard key={s.kode} saham={s} />)
          )}

          {hasil.kandidatGugur.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900">
              <button
                onClick={() => setBukaGugur((x) => !x)}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-zinc-400"
              >
                {bukaGugur ? "▾" : "▸"} Kandidat gugur ({hasil.kandidatGugur.length})
              </button>
              {bukaGugur && (
                <ul className="space-y-1 px-4 pb-4 text-sm text-zinc-400">
                  {hasil.kandidatGugur.map((k, i) => (
                    <li key={i}>
                      <span className="font-semibold text-zinc-300">{k.kode}</span> — {k.alasanGugur}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <HistoryList
        daftar={riwayat}
        onPilih={(e) => {
          setHasil(e.hasil);
          setDariRiwayat(true);
          setGalat(null);
        }}
      />

      <footer className="border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
        <strong>Disclaimer:</strong> Aplikasi ini bukan nasihat keuangan. Data diambil dari sumber publik yang
        bisa tertunda (±10 menit) atau tidak akurat. Level entry/target/cutloss berasal dari analis pihak
        ketiga. Segala keputusan beli/jual dan risikonya sepenuhnya menjadi tanggung jawab pengguna.
      </footer>
    </main>
  );
}
```

- [ ] **Step 5: Verifikasi render + typecheck**

Run: `npx tsc --noEmit`, lalu `npm run dev` dan `curl -s http://localhost:3000 | grep -o "Cari Saham Terbaik" | head -1`
Expected: tanpa error TS; curl menghasilkan `Cari Saham Terbaik`. Cek juga visual di browser (dark, badge status muncul). Matikan server.

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "feat: UI halaman utama dark mode + kartu saham + riwayat"
```

---

### Task 7: Verifikasi end-to-end + README

**Files:**
- Create: `README.md` (ganti boilerplate create-next-app)

**Interfaces:**
- Consumes: seluruh aplikasi. Butuh `ANTHROPIC_API_KEY` asli dari user — **berhenti dan minta user mengisi `.env.local`** bila belum ada.

- [ ] **Step 1: Pastikan `.env.local` terisi**

Cek keberadaan `.env.local` dengan `ANTHROPIC_API_KEY`. Bila belum ada, minta user mengisinya (jangan pernah meminta user menempelkan key ke chat — cukup minta mereka membuat file). Jangan lanjut ke Step 2 tanpa key.

- [ ] **Step 2: Uji pencarian sungguhan (±$0.10–0.30)**

Run: `npm run dev`, buka `http://localhost:3000`, klik **Cari Saham Terbaik**. Tunggu 1–2 menit.
Expected:
- Loading bertahap tampil, tombol nonaktif selama proses.
- Hasil muncul: kondisi pasar terisi, 0–3 kartu saham dengan skor + alasan bersumber + entry/target/cutloss + risiko.
- Entri baru muncul di riwayat; klik entri riwayat menampilkan hasil dengan banner "Data lama".
- Disclaimer tampil di footer.

Bila JSON gagal divalidasi dua kali berturut-turut, periksa pesan error, sesuaikan PROMPT_SISTEM (perjelas format), dan ulangi.

- [ ] **Step 3: Tulis `README.md`**

```markdown
# Stock Picker IDX

Aplikasi lokal untuk merekomendasikan maksimal 3 saham IDX berdasarkan analisis
real-time Claude API + web search. Bukan nasihat keuangan — keputusan akhir di
tangan pengguna.

## Setup

1. `npm install`
2. Salin `.env.local.example` menjadi `.env.local`, isi `ANTHROPIC_API_KEY`
   (buat di https://platform.claude.com).
3. `npm run dev` lalu buka http://localhost:3000

## Cara pakai

Jalankan pada **15:30–15:45 WIB** hari bursa (jendela ideal), klik
**Cari Saham Terbaik**, tunggu 1–2 menit. Biaya per pencarian ±$0.10–0.30.
Riwayat 5 pencarian terakhir tersimpan di browser.

## Perintah

- `npm run dev` — jalankan server lokal
- `npm test` — unit test (Vitest)

Spec & rencana: `docs/superpowers/specs/`, `docs/superpowers/plans/`.
```

- [ ] **Step 4: Jalankan seluruh test terakhir kali**

Run: `npm test && npx tsc --noEmit`
Expected: semua PASS, tanpa error TS.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README setup & cara pakai"
```
