// Session store that keeps each working session as a small file on disk, so a
// CV in progress survives the app restarting (every publish restarts it). The
// old in-memory store lost everyone's work on each restart: step 4 had nothing
// to show and "Apply my answers and re-check" failed with "Generate a draft first".
//
// Files live next to the accounts database (the Render disk), one per session,
// and are deleted when the session ends (three hours, as the privacy notice
// says). A sweep clears anything expired every ten minutes and on start-up.
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { Store } = require("express-session");

const DEFAULT_TTL = 1000 * 60 * 60 * 3; // three hours, matches the session cookie

function safeName(sid) {
  const s = String(sid || "");
  return /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : crypto.createHash("sha256").update(s).digest("hex");
}

function expiryOf(sess) {
  const e = sess && sess.cookie && sess.cookie.expires;
  const t = e ? new Date(e).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now() + DEFAULT_TTL;
}

class FileSessionStore extends Store {
  constructor({ dir, sweepEveryMs = 10 * 60 * 1000 } = {}) {
    super();
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.sweep().catch(() => {});
    if (sweepEveryMs) {
      this._timer = setInterval(() => this.sweep().catch(() => {}), sweepEveryMs);
      if (this._timer.unref) this._timer.unref();
    }
  }

  file(sid) { return path.join(this.dir, safeName(sid) + ".json"); }

  get(sid, cb) {
    fsp.readFile(this.file(sid), "utf8").then(
      (raw) => {
        let rec;
        try { rec = JSON.parse(raw); } catch (_) { return cb(null, null); }
        if (!rec || !rec.sess || !(rec.expires > Date.now())) {
          this.destroy(sid, () => {});
          return cb(null, null);
        }
        cb(null, rec.sess);
      },
      (err) => (err.code === "ENOENT" ? cb(null, null) : cb(err))
    );
  }

  set(sid, sess, cb = () => {}) {
    const f = this.file(sid);
    const tmp = f + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
    let body;
    try { body = JSON.stringify({ expires: expiryOf(sess), sess }); } catch (e) { return cb(e); }
    fsp.writeFile(tmp, body, { mode: 0o600 })
      .then(() => fsp.rename(tmp, f)) // atomic swap, never a half-written file
      .then(() => cb(null), (e) => { fsp.unlink(tmp).catch(() => {}); cb(e); });
  }

  touch(sid, sess, cb = () => {}) {
    // Sessions don't roll, so there's nothing to extend. Leaving this as a
    // no-op saves a disk write on every request.
    cb(null);
  }

  destroy(sid, cb = () => {}) {
    fsp.unlink(this.file(sid)).then(() => cb(null), (e) => cb(e.code === "ENOENT" ? null : e));
  }

  // Delete every session past its end time (and any stray temp files).
  async sweep() {
    const now = Date.now();
    let names = [];
    try { names = await fsp.readdir(this.dir); } catch (_) { return 0; }
    let removed = 0;
    for (const n of names) {
      const f = path.join(this.dir, n);
      try {
        if (n.endsWith(".tmp")) {
          const st = await fsp.stat(f);
          if (now - st.mtimeMs > 60 * 1000) { await fsp.unlink(f); removed++; }
          continue;
        }
        if (!n.endsWith(".json")) continue;
        const rec = JSON.parse(await fsp.readFile(f, "utf8"));
        if (!(rec && rec.expires > now)) { await fsp.unlink(f); removed++; }
      } catch (_) {
        // Unreadable file: remove it rather than keep personal data around.
        try { await fsp.unlink(f); removed++; } catch (_) {}
      }
    }
    return removed;
  }
}

module.exports = { FileSessionStore };
