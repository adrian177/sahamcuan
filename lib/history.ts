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
