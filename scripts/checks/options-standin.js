// Weekly check harness for Identify Your Options: a stand-in signed-in account and
// TEST FIXTURE occupations. Not part of the app.
const path = require("path");
const APP = path.resolve(__dirname, "../..");
const express = require(APP + "/node_modules/express");
const app = express();
app.use(express.json({ limit: "2mb" }));
const rows = { options_profiles: new Map(), job_hunt: [] };
function sb() {
  return { from(t) {
    const q = { _eq: null,
      select() { return q; }, eq(k, v) { q._eq = v; return q; },
      async maybeSingle() { return { data: rows.options_profiles.get(q._eq) || null, error: null }; },
      async upsert(row) { rows.options_profiles.set(row.user_id, { ...(rows.options_profiles.get(row.user_id) || {}), ...row }); return { error: null }; },
      insert(row) { const id = "11111111-2222-3333-4444-555555555555"; rows.job_hunt.push({ id, ...row }); return { select() { return { async single() { return { data: { id }, error: null }; } }; } }; },
    };
    return q;
  } };
}
const LEVEL = process.env.AI_LEVEL || "essentials";
app.use((req, res, next) => { req.user = { id: "u1", email: "test@example.com", aiLevel: LEVEL }; req.sb = sb(); next(); });
app.get("/api/master/text", (req, res) => res.json({ text: "" }));
require(APP + "/lib/options/routes").mount(app, { accountsOn: () => true });
if (!process.env.NO_DATA) require(APP + "/lib/options/careerData")._setForTests(require("./options-fixture.json"));
app.use(express.static(path.join(APP, "public")));
app.use("/account", express.static(path.join(APP, "accounts/public")));
app.listen(3399, () => console.log("harness on 3399"));
