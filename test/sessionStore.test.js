// A CV in progress must survive the app restarting, and be gone once the
// three-hour session is over (as the privacy notice promises).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const { FileSessionStore } = require("../lib/fileSessionStore");

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "cp-sessions-")); }
function api(store) {
  return {
    get: promisify(store.get.bind(store)),
    set: promisify(store.set.bind(store)),
    destroy: promisify(store.destroy.bind(store)),
  };
}
const sess = (msFromNow) => ({ cookie: { expires: new Date(Date.now() + msFromNow).toISOString() }, cv: { cvText: "Jordan Ellis", cv: { header: { name: "Jordan" } } } });

test("work in progress survives a restart (a fresh store reading the same folder)", async () => {
  const dir = tmpDir();
  await api(new FileSessionStore({ dir, sweepEveryMs: 0 })).set("abcDEF123_-xyz", sess(60000));
  const after = await api(new FileSessionStore({ dir, sweepEveryMs: 0 })).get("abcDEF123_-xyz");
  assert.equal(after.cv.cvText, "Jordan Ellis");
});

test("an expired session is not handed back and its file is deleted", async () => {
  const dir = tmpDir();
  const s = new FileSessionStore({ dir, sweepEveryMs: 0 });
  await api(s).set("expiredSession01", sess(-1000));
  assert.equal(await api(s).get("expiredSession01"), null);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.existsSync(path.join(dir, "expiredSession01.json")), false);
});

test("the sweep clears expired sessions and keeps live ones", async () => {
  const dir = tmpDir();
  const s = new FileSessionStore({ dir, sweepEveryMs: 0 });
  await api(s).set("liveSession0001", sess(60000));
  await api(s).set("deadSession0001", sess(-60000));
  fs.writeFileSync(path.join(dir, "brokenSession01.json"), "{not json");
  const removed = await s.sweep();
  assert.equal(removed, 2);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["liveSession0001.json"]);
});

test("destroy removes the file, and odd session ids can't escape the folder", async () => {
  const dir = tmpDir();
  const s = new FileSessionStore({ dir, sweepEveryMs: 0 });
  await api(s).set("../../etc/passwd", sess(60000));
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^[0-9a-f]{64}\.json$/);
  await api(s).destroy("../../etc/passwd");
  assert.equal(fs.readdirSync(dir).length, 0);
  await api(s).destroy("neverExisted01"); // no error
});
