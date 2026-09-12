# HVEN Space POS — aturan input & cloud

Setiap form yang **menambah / mengubah / menghapus** data harus lolos checklist ini.
Kalau dilewati, input kelihatan masuk lalu hilang (HP manager vs laptop).

## Wajib saat nambah field / form baru

1. **Tulis ke store dulu, baru sync.** `set({ ... })` lalu `nudgeCloud()`. Form UI: `await runCloudSync("local")` + toast sukses/gagal.
2. **Masukkan field ke `extractPayload`** (`src/lib/pos-cloud.ts`). Yang tidak diekstrak tidak pernah sampai VPS.
3. **Masukkan perubahan ke `payloadFingerprint`.** Sinkron membandingkan fingerprint, bukan “sudah di-set”. Field yang diabaikan (dulu: `blurb`, isi ledger) dianggap tidak berubah → tidak di-push.
4. **Merge jangan menimpa.** `unionById` / `keepById` — id lokal yang belum ada di remote **harus tetap**. Jangan `payload.x` menimpa seluruh array di `applyCloud`.
5. **Hapus = tombstone**, bukan filter lokal. `expenseGone` / `productGone` (dan sejenisnya). `unionById` tidak pernah menghapus baris yang masih ada di device lain.
6. **Saldo uang = replay ledger**, bukan objek `moneyBooks` yang di-pick utuh. Tiap gerak uang = baris `LedgerEntry` baru (`setor`, `setor-gopay`, `expense-cash`, `expense-bank`, `expense-sisih`, `sale-cash`, `void-cash`, `sisih-gaji`).
7. **Jangan `applyCloud` setelah push sukses.** Itu yang menimpa setor GoPay. Push dulu (`reason: "local"`), pull lalu `keepById` dengan state lokal.
8. **Foto besar lewat gudang foto**, bukan JSON (`flushMenuPhotos` / absen). JSON hanya marker `cloud:id`.
9. **Python VPS `LIST_KEYS` + `KEEP_FIELDS`** ikut field baru (`image`, `blurb`, `pay`, `nota`, `updatedAt`). String-list tombstone (`expenseGone`) merge terpisah, bukan `union_id`.
11. **Form `useEffect` jangan bergantung ke array store** (`recipes`, `products`, `orders`). Sync 3 detik akan mereset nama/deskripsi yang sedang diketik. Reset form hanya saat modal buka / id record berubah.

## Pola uang rekening

| Jenis | Rekening operasional | Laci kasir | Sisih gaji |
|---|---|---|---|
| Setor tunai | + | − | — |
| Setor GoPay | + | — | — |
| Pengeluaran tunai | — | − | — |
| Pengeluaran non tunai | − | — | — |
| Gaji | — | — | − |
| Sisih harian | — | — | +280rb/hari dari 13 Sep 2026 |

## File yang hampir selalu ikut

- `src/lib/store.ts` — action + `applyCloud` + persist
- `src/lib/pos-cloud.ts` — extract, merge, fingerprint, `keepById`
- `src/lib/types.ts` — jenis ledger / replay
- `src/components/cloud-sync.tsx` — push-first local, jangan applyCloud di `pushNow` ok
- `cloud/hven-cloud.py` — `LIST_KEYS`, `KEEP_FIELDS`, tombstone
- Form view terkait — `runCloudSync("local")` setelah simpan
