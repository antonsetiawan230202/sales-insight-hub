## Dynamic data refresh for Quotations & EI files

Today the app parses each Excel once on upload and stores the parsed rows in a persisted Zustand store. New rows added to the source .xlsx files on disk don't show up until the user manually re-uploads and replaces the file. This plan makes the app pick up new data automatically (or with one click) without losing filters, targets, or the current view.

Two mechanisms are added side by side so it works everywhere (browser + the Electron .exe build):

### 1. Live-linked source files (Chromium / Electron)
Use the **File System Access API** (`window.showOpenFilePicker`) which is available in Chrome, Edge, and the Electron build we already ship.

- New action on each drop zone: **"Link source file"** (in addition to the existing Choose / Drag&drop).
- On pick, we store the returned `FileSystemFileHandle` in **IndexedDB** (handles can't go in `localStorage`). Key: `quotations-handle` / `ei-handle`.
- On app start, if a handle exists, request permission (`handle.queryPermission` → `requestPermission`) and read the file. If the modified time differs from what's stored, re-parse.
- Add a **"Refresh"** button next to each linked file that re-reads and re-parses on demand.
- Add an **"Auto-refresh"** toggle (default on when a handle is linked) that polls `handle.getFile().lastModified` every 30 s; when it changes, re-parse silently and toast "Updated: +N new rows".
- Linked-file status shown in the drop zone: filename, last-refreshed timestamp, row count, and a small "Live" badge.

### 2. Merge / append re-upload (universal fallback)
For browsers without File System Access (Safari, Firefox) and for users who prefer manual control:

- The existing upload flow gains a mode switch: **Replace** (current behaviour) vs **Merge** (default going forward).
- Merge = parse the new file, then union its rows with the current store rows, deduping by a stable key:
  - Quotations key: `quotationNo` (fallback to `${quotationDate}|${customer}|${idr}`).
  - EI key: `invoiceRef || jobNumber || `${customerPo}|${orderDate}|${customer}``.
- New rows are appended; existing keys are updated in place (so status/probability edits in the source file win). Deleted rows in the source are NOT removed in Merge mode — a "Replace" action is still available if the user wants a clean reload.
- Toast summarises the diff: "Loaded 1,240 rows: +37 new, 12 updated, 1,191 unchanged".

### 3. Store & parser changes
- `src/lib/dashboard-store.ts`
  - Add `mergeQuotations(rows)` and `mergeEi(rows)` that dedupe by the keys above and return a `{added, updated, unchanged}` summary.
  - Add `sources: { quotations?: LinkedSource; ei?: LinkedSource }` where `LinkedSource = { fileName; lastModified; lastRefreshedAt; autoRefresh }`. Persisted (handles are NOT here — those live in IndexedDB).
  - Add `setSource(kind, source)` and `clearSource(kind)`.
- `src/lib/parse-quotations.ts` / `src/lib/parse-ei-report.ts`: ensure each parsed row exposes the dedupe key described above (compute if missing; no schema break).
- New `src/lib/file-handle-store.ts`: tiny IndexedDB wrapper (`idb-keyval` or ~30 lines of native IDB) for the two handles.
- New `src/hooks/use-live-source.ts`: reads a stored handle, sets up polling, exposes `{ refresh, status, lastModified }`.

### 4. UI changes
- `src/components/dashboard/FileUploadCard.tsx`
  - Each `DropZone` gains: **Link** button (calls `showOpenFilePicker`), **Refresh** button (visible when linked), **Auto-refresh** switch, and shows `Live · updated 2 min ago`.
  - The existing Choose/Drop path stays and now defaults to Merge; a small kebab menu offers "Replace instead".
- If the File System Access API is unavailable, hide the Link/Auto-refresh controls and keep Merge upload only. Show a one-line hint: "Auto-refresh requires Chrome, Edge, or the desktop app."

### 5. Electron
- No native changes needed — the packaged app already runs Chromium, so `showOpenFilePicker` and IndexedDB work out of the box.
- On first launch after this change, existing users' data stays intact (persisted store is untouched); they only see the new Link/Refresh controls.

### 6. Empty / permission states
- If a linked handle loses permission (browser cleared it, user reopened the app), show a "Reconnect" prompt in the drop zone instead of failing silently.
- If the file is renamed/moved, `getFile()` throws — surface a toast and offer to re-link.

### Out of scope
- Watching a whole folder or cloud drive (OneDrive/Google Drive/SharePoint). Requires their APIs and auth.
- Server-side ingestion / scheduled sync. This app is client-only by design.
- Row-level deletion detection in Merge mode (documented as a trade-off; Replace still available).
- Repackaging the Windows .exe — separate step on request once you've validated in the web preview.

### Technical notes
- Handles must be stored in IndexedDB; `localStorage`/`JSON.stringify` will silently drop them.
- Permissions need a user gesture the first time per session — the Refresh button provides that gesture; polling continues silently after.
- Merge diff runs off the parsed row arrays with a `Map` keyed by the dedupe key: O(n).
- All reports (Overview, Management, Financial) automatically reflect updates because they read from the same Zustand arrays via `useMemo`.
