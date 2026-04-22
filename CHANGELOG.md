# Changelog - VanillaDataTable

Semua perubahan signifikan pada proyek ini akan didokumentasikan di file ini.

## [1.3.1] — 2026-04-22
### Added
* **Demo Setup Snippets:** Menambahkan panel "Library setup" pada setiap demo utama agar pola import CSS, import module, dan konfigurasi awal bisa langsung disalin.

### Changed
* **Demo Gallery Refresh:** Memperbarui `demo/index.html` dengan layout gallery yang lebih informatif dan ringkas untuk membantu menjelajahi semua demo.
* **Formatting Demo Consistency:** Menyelaraskan `demo/formatting.html` dengan gaya demo lain dan mengubah contoh konfigurasi ke format kolom berbasis `key`.
* **Documentation Alignment:** README diperbarui agar referensi demo, preferensi konfigurasi kolom, dan dokumentasi penggunaan lebih konsisten dengan contoh terbaru.
 
## [1.3.0] — 2026-04-20
### Added
* **Formatter Engine (Phase 1):** Menambahkan sistem formatting cerdas berbasis **Intl API** untuk otomatisasi tampilan mata uang (`money`), tanggal (`datetime`), dan angka (`number`).
* **Inline Editor (Phase 2):** Implementasi plugin `EditorPlugin` yang memungkinkan pengeditan data langsung di sel tabel dengan dukungan callback `onCellSave`.
* **Live Sync (Phase 3):** Menambahkan fitur `autoRefresh` untuk sinkronisasi data otomatis secara berkala (polling) dilengkapi dengan UI indicator "Live/Paused" yang interaktif.
* **Hook Lifecycle (Phase 4):** Penambahan hook baru `onBeforeRefresh` (sebelum polling) dan `onDataUpdated` (saat data mentah berubah melalui fetch atau edit).
* **Column Accessor Support:** Mendukung properti `accessor` pada kolom (semua metode engine sekarang kompatibel dengan `key` maupun `accessor`).
* **Demo Updates:** Menambahkan demo `demo/formatting.html`, `demo/inline-editing.html`, dan `demo/live-sync.html`.

---

## [1.2.3] — 2026-04-20
### Changed
* **Architectural Refactor:** Memisahkan fitur Persistence, Selection, dan Export ke dalam sistem plugin di folder `src/plugin`.
* **Code Cleanliness:** Menguraikan logika engine utama menjadi modul yang lebih kecil dan maintainable.
* **Utilities:** Memindahkan fungsi bantuan (`escapeHtml`, `debounce`) ke file `src/utils.js`.

---

## [1.2.0] — 2026-04-20
### Added
* **Phase 1: State Persistence & URL Sync:** Menambahkan dukungan penyimpanan state tabel ke `localStorage`, `sessionStorage`, atau URL Query Parameters.
* **Phase 2: Selection & Bulk Actions:** Menambahkan fitur multi-select dengan kolom checkbox otomatis dan API `getSelectedData()`.
* **Phase 3: Column Visibility & Export:** Menambahkan API `toggleColumnVisibility` dan fitur ekspor data ke format CSV (`exportCSV`).
* **Advanced Features Demo:** Menambahkan demo baru di `demo/advanced-features.html` yang menggabungkan fitur persistence, selection, dan export.

### Changed
* **Internal:** Sinkronisasi state sekarang memicu `saveState` otomatis di setiap siklus `update()`.

### Fixed
* **Selection Sync:** Memperbaiki sinkronisasi *Select All* checkbox di header agar akurat terhadap data yang tampil.
* **Search Persistence:** Memperbaiki input pencarian agar terisi otomatis saat memuat state dari URL/Storage.
* **Row Detail Visibility:** Memperbaiki konflik event listener yang sempat menyebabkan *detail row* tidak bisa dibuka.
* **Colspan Calculation:** Memperbaiki perhitungan lebar kolom pada *detail row* dan *empty state* saat fitur seleksi aktif.

---

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
