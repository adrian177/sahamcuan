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
    return { level: "kritis", pesan: "Kemungkinan hasil selesai setelum pasar tutup" };
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
