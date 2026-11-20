// The profile photo and "the jobs I'm after" on the account page.
//
// Photo
//   * Optional, private to the person, shown only on their own account page.
//     Never sent to any AI service and never shared with anyone.
//   * The page shrinks it to a 600 pixel square JPEG before upload. We accept
//     only JPEG, up to 1.5 MB, and strip any hidden extras (camera details and
//     location tags) before saving, in case a phone left them in.
//   * Kept in the private storage bucket in the person's own folder, so
//     deleting the account deletes it with everything else.
//
// The jobs I'm after
//   * Up to 8 job titles the person saves, typed or picked from the AI's
//     suggestions ("Jobs your CV could suit").

const express = require("express");

const BUCKET = "documents";
const MAX_BYTES = 1.5 * 1024 * 1024;
const pathFor = (userId) => `${userId}/profile-photo.jpg`;

// Keep only what a picture needs: drop every APPn segment except APP0 (JFIF),
// plus comments. That removes EXIF (including GPS location), XMP and the like.
function stripJpeg(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // start of scan: the rest is the picture
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

async function stateFor(admin, userId) {
  if (!admin) return null;
  const { data, error } = await admin.from("profiles").select("photo_updated_at, search_roles").eq("id", userId).maybeSingle();
  if (error) return null;
  let roles = [];
  try { roles = JSON.parse((data && data.search_roles) || "[]"); } catch (_) { roles = []; }
  return { hasPhoto: Boolean(data && data.photo_updated_at), photoAt: (data && data.photo_updated_at) || null, roles: Array.isArray(roles) ? roles : [] };
}

async function fileFor(admin, userId) {
  if (!admin) return null;
  const { data, error } = await admin.storage.from(BUCKET).download(pathFor(userId));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

function mount(api, h) {
  const raw = express.raw({ type: ["image/jpeg"], limit: MAX_BYTES });

  api.post("/photo", h.writeLimit, h.needUser, raw, async (req, res) => {
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "Photos aren't switched on yet." });
    const clean = stripJpeg(req.body);
    if (!clean) return res.status(400).json({ error: "That doesn't look like a photo we can use. Please try a JPEG or PNG picture." });
    const up = await admin.storage.from(BUCKET).upload(pathFor(req.user.id), clean, { contentType: "image/jpeg", upsert: true });
    if (up.error) { console.error("[photo] upload:", up.error.message); return res.status(500).json({ error: "We couldn't save your photo just now. Please try again." }); }
    const { error } = await admin.from("profiles").update({ photo_updated_at: new Date().toISOString() }).eq("id", req.user.id);
    if (error) { console.error("[photo] profile:", error.message); return res.status(500).json({ error: "We couldn't save your photo just now. Please try again." }); }
    res.json({ ok: true, message: "Photo saved. Only you can see it." });
  });

  api.get("/photo", h.needUser, async (req, res) => {
    const pic = await fileFor(h.adminClient(), req.user.id).catch(() => null);
    if (!pic) return res.status(404).end();
    res.set({ "Cache-Control": "private, no-store", "Content-Type": "image/jpeg" });
    res.send(pic);
  });

  api.post("/photo/delete", h.writeLimit, h.requireJson, h.needUser, async (req, res) => {
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "Photos aren't switched on yet." });
    const { error: e1 } = await admin.storage.from(BUCKET).remove([pathFor(req.user.id)]);
    const { error: e2 } = await admin.from("profiles").update({ photo_updated_at: null }).eq("id", req.user.id);
    if (e1 || e2) { console.error("[photo] delete:", (e1 || e2).message); return res.status(500).json({ error: "We couldn't delete your photo just now. Please try again." }); }
    res.json({ ok: true, message: "Photo deleted." });
  });

  api.post("/roles", h.writeLimit, h.requireJson, h.needUser, async (req, res) => {
    const admin = h.adminClient();
    if (!admin) return res.status(503).json({ error: "This isn't switched on yet." });
    const list = (Array.isArray(req.body.roles) ? req.body.roles : [])
      .map((r) => String(r || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80))
      .filter(Boolean);
    const roles = [...new Set(list)].slice(0, 8);
    const { error } = await admin.from("profiles").update({ search_roles: JSON.stringify(roles) }).eq("id", req.user.id);
    if (error) { console.error("[roles]", error.message); return res.status(500).json({ error: "We couldn't save that just now. Please try again." }); }
    res.json({ ok: true, roles });
  });
}

module.exports = { mount, stateFor, fileFor, stripJpeg, pathFor, MAX_BYTES };
