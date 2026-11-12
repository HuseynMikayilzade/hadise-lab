/** Brauzerdə saxlanan anonim cihaz identifikatoru. Şəxsi məlumat deyil. */
const DEVICE_KEY = "hl:device-id";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    // Gizli rejim və ya bloklanmış storage: hər yükləmədə yeni id - server yenə də limitləri saxlayır.
    return crypto.randomUUID();
  }
}

/** Qəbzlər eksperimentin "epoch"una bağlıdır: təqdimatçı sıfırlayanda köhnələr avtomatik unudulur. */
const receiptKey = (scope: string) => `hl:receipts:${scope}`;

export function readReceipts<R>(scope: string): R[] {
  try {
    const raw = localStorage.getItem(receiptKey(scope));
    return raw ? (JSON.parse(raw) as R[]) : [];
  } catch {
    return [];
  }
}

export function storeReceipts<R>(scope: string, receipts: readonly R[]): void {
  try {
    localStorage.setItem(receiptKey(scope), JSON.stringify(receipts));
  } catch {
    /* storage əlçatan deyil - kritik deyil */
  }
}
