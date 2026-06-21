// QR sync: export the diary as deflated, chunked QR codes and merge them back on
// another device. Pipeline: entries -> JSON -> deflate-raw -> chunks -> QR byte mode.
// Each chunk carries a 4-byte header [version, sessionId, seq, total] so the importer
// can collect them in any order and avoid mixing two different export sessions.

const SYNC_VERSION = 1;
const CHUNK_PAYLOAD = 600;          // data bytes per QR (keeps QR ~v18-20, phone-scannable)
const HEADER_LEN = 4;

// --- compression (browser-native, no library) ---------------------------------

async function _runStream(stream, bytes) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const out = [];
  const reader = stream.readable.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out.push(value);
  }
  let len = 0;
  for (const c of out) len += c.length;
  const merged = new Uint8Array(len);
  let off = 0;
  for (const c of out) { merged.set(c, off); off += c.length; }
  return merged;
}

const deflate = (bytes) => _runStream(new CompressionStream('deflate-raw'), bytes);
const inflate = (bytes) => _runStream(new DecompressionStream('deflate-raw'), bytes);

// --- export -------------------------------------------------------------------

// Returns an array of Uint8Array, one per QR code.
async function buildSyncChunks() {
  const json = JSON.stringify(getEntries());
  const payload = await deflate(new TextEncoder().encode(json));
  const total = Math.max(1, Math.ceil(payload.length / CHUNK_PAYLOAD));
  const sid = Math.floor(Math.random() * 256);
  const chunks = [];
  for (let seq = 0; seq < total; seq++) {
    const slice = payload.subarray(seq * CHUNK_PAYLOAD, (seq + 1) * CHUNK_PAYLOAD);
    const chunk = new Uint8Array(HEADER_LEN + slice.length);
    chunk.set([SYNC_VERSION, sid, seq, total], 0);
    chunk.set(slice, HEADER_LEN);
    chunks.push(chunk);
  }
  return chunks;
}

// Draw a byte chunk as a QR code onto a canvas (byte mode, auto version, ECC M).
function renderChunkQR(canvas, chunk) {
  const binStr = String.fromCharCode.apply(null, chunk);
  const qr = qrcode(0, 'M');
  qr.addData(binStr, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const size = canvas.width;
  const scale = Math.floor(size / (n + quiet * 2));
  const origin = Math.floor((size - scale * (n + quiet * 2)) / 2) + quiet * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a1a1a';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(origin + c * scale, origin + r * scale, scale, scale);
      }
    }
  }
}

// --- import -------------------------------------------------------------------

// Parse a scanned chunk's header. Returns null if it isn't one of our chunks.
function parseChunkHeader(bytes) {
  if (!bytes || bytes.length < HEADER_LEN || bytes[0] !== SYNC_VERSION) return null;
  return { sid: bytes[1], seq: bytes[2], total: bytes[3] };
}

// Given a Map of seq -> chunk byte array (all same sid, all total present),
// strip headers and concat into the compressed payload.
function reassemble(chunkMap, total) {
  const parts = [];
  for (let seq = 0; seq < total; seq++) {
    parts.push(Uint8Array.from(chunkMap.get(seq)).subarray(HEADER_LEN));
  }
  let len = 0;
  for (const p of parts) len += p.length;
  const merged = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { merged.set(p, off); off += p.length; }
  return merged;
}

// Decompress an assembled payload and merge it into local storage.
async function applyImported(payload) {
  const json = new TextDecoder().decode(await inflate(payload));
  mergeByDay(JSON.parse(json));
}

// Day-granularity snapshot replace: every day present in the import replaces that
// day locally; days absent from the import are left untouched (so deletions within a
// synced day propagate, but untouched days are never clobbered).
function mergeByDay(imported) {
  const days = new Set(imported.map(e => e.datetime.slice(0, 10)));
  const kept = getEntries().filter(e => !days.has(e.datetime.slice(0, 10)));
  setEntries(kept.concat(imported));
}
