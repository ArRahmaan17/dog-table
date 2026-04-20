# Changelog - VanillaDataTable

Semua perubahan signifikan pada proyek ini akan didokumentasikan di file ini.
 
## [1.2.0-beta.3] — 2026-04-20
### Added
* **Localization Support:** Menambahkan opsi `language` untuk menyesuaikan semua teks yang tampil di UI (search placeholder, empty state, pagination, dll).
* **Predefined Locales:** Menambahkan file lokalisasi bawaan untuk bahasa Inggris, Spanyol, Prancis, Jerman, Mandarin (Sederhana), dan Indonesia di dalam folder `src/locale`.
* **Dynamic Content Interpolation:** Mendukung placeholder seperti `{start}`, `{end}`, `{total}`, dan `{page}` pada teks lokalisasi.
* **API setLanguage:** Menambahkan metode `setLanguage(lang)` untuk mengganti bahasa tabel secara dinamis tanpa inisialisasi ulang.
* **Demo Localization V2:** Memperbarui demo `demo/localization.html` dengan fitur *language switcher* interaktif.

### Changed
* **Internal Structure:** Memindahkan opsi teks individual (`searchPlaceholder`, `emptyStateText`, dll) ke dalam objek `language` yang terpusat.
* **Package Exports:** Menambahkan sub-path exports pada `package.json` agar file locale bisa di-import langsung (`dog-table/locale/id`).

---

## [1.2.0-beta.2] — 2026-04-20
### Added
* **UX Improvements:** Implementasi *loading skeletons* animatif untuk meningkatkan feedback visual saat data sedang dimuat (remote).
* **Theme Support:** Menambahkan slot `skeleton` pada `ThemeManager` agar skeleton loading konsisten dengan preset Tailwind dan Bootstrap.

### Changed
* **Loading State:** `renderLoading()` sekarang merender baris skeleton berdasarkan `pageSize` saat ini, menggantikan teks loading statis.

---

## [1.2.0-beta.1] — 2026-04-20
### Added
* **Row Grouping:** Menambahkan dukungan `groupBy` dan `groupLabel` untuk menyisipkan header grup di dalam `<tbody>` setelah data diproses.
* **Expandable Row Detail:** Menambahkan `rowDetail.render()` dengan tombol toggle per baris, lazy rendering, dan API publik `toggleRowDetail`, `expandRowDetail`, serta `collapseRowDetail`.
* **Row Identity Support:** Menambahkan opsi `rowKey` agar state expand/collapse stabil saat sorting, filtering, dan pagination berubah.
* **Keyboard Sorting:** Header yang sortable sekarang bisa diaktifkan lewat tombol `Enter` dan `Space`, melengkapi atribut `aria-sort`.
* **Demo Coverage:** Menambahkan demo baru untuk grouping dan detail rows di `demo/grouping-detail.html`.

### Changed
* **Body Rendering Pipeline:** Transformasi render sekarang mendukung kombinasi grouping, detail rows, local processing, dan remote data.
* **Documentation:** README diperbarui untuk mendokumentasikan API grouping, row detail, hook baru `onRowToggle`, dan demo gallery yang diperluas.

### Fixed
* **Row Detail Colspan:** Loading, empty state, error state, dan detail rows sekarang menghitung jumlah kolom tampil secara benar saat kolom detail aktif.

## [1.1.0-beta.1] — 2024-05-20
### Added
* **Theme Engine (MVP 2 - Point 1):** Penambahan sistem *adapter* untuk styling. Sekarang library mendukung pergantian class secara dinamis.
* **Preset Support:** Menambahkan preset class bawaan untuk **Tailwind CSS** dan **Bootstrap 5**.
* **Class Mapping:** User sekarang bisa melakukan *override* class pada elemen spesifik (`table`, `thead`, `th`, `tr`, `td`) melalui konfigurasi awal.

---

## [1.0.0] — 2024-05-15
### Added (MVP 1 - Core Features)
* **Vanilla Core Engine:** Arsitektur berbasis Class JS yang ringan dan tanpa *dependency* luar.
* **Client-side Processing:** Pipeline pengolahan data otomatis (Filter -> Sort -> Paginate).
* **Interactive Sorting:** Dukungan pengurutan data untuk tipe string, number, dan date secara reaktif.
* **Global Search:** Fitur pencarian teks di seluruh kolom dengan performa yang dioptimalkan.
* **Pagination:** Navigasi halaman fungsional dengan kontrol *page size*.
* **Custom Cell Renderers:** Kemampuan untuk memformat konten cell menggunakan fungsi kustom (callback).
* **Type Safety:** Implementasi JSDoc/TypeScript interfaces untuk meminimalisir error pada input data.

### Fixed
* Memperbaiki isu *memory leak* pada event listener saat tabel di-render ulang.
* Sinkronisasi state pagination yang melompat saat melakukan filtering.

---

## [Planned] - Next Steps
* [x] **Server-side Adapter (AJAX):** Integrasi Fetch API untuk pengolahan data di sisi server.
* [x] **Row Features:** Implementasi *Expandable Row* (Row Detail) dan *Data Grouping*.
* [x] **UX Improvements:** Loading skeletons dan *empty state* yang lebih cantik.
* [ ] **Export Utilities:** Dukungan ekspor data ke format CSV atau Excel.
