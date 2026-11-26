// Identify Your Options: the career data.
//
// Every career option shown to a job seeker comes from official, licensed data.
// Nothing is made up and nothing is typed in by hand.
//
//   Skills England occupational maps   the backbone: occupations, levels, routes,
//                                       typical job titles, duties and KSBs.
//                                       Open Government Licence v3.0. Needs a free
//                                       API key (SKILLS_ENGLAND_API_KEY), and any
//                                       product using it must show the Skills
//                                       England logo and an attribution statement.
//   O*NET 30.2 Database                 work styles and work values per occupation.
//                                       Creative Commons Attribution 4.0. US data,
//                                       linked to the Skills England occupations by
//                                       job title, and only used where the link is
//                                       a close one.
//   National Careers Service profiles   to be added once DfE confirms the licence.
//
// The data is built by fetch() below and kept in data/careers.json. If the file
// isn't there and the key is set, the server builds it in the background when it
// starts, so the live app fills itself. Until then the app says the career
// options aren't ready yet, rather than showing anything invented.

const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_FILE = process.env.CAREERS_FILE || path.join(__dirname, "..", "..", "data", "careers.json");
const CACHE_FILE = path.join(os.tmpdir(), "comquat-careers.json");
const SE_BASE = "https://occupational-maps-api.skillsengland.education.gov.uk/api/v1";
const ONET_VERSION = process.env.ONET_VERSION || "30_2";
const ONET_ZIP = `https://www.onetcenter.org/dl_files/database/db_${ONET_VERSION}_text.zip`;
const SE_EXPAND = [
  "occupation.overview", "occupation.summary", "occupation.soc", "occupation.maphierarchy",
  "occupation.typicaljobtitles", "occupation.dutiesKSB", "occupation.keywords", "occupation.products",
].join(",");

const ATTRIBUTION = {
  skillsEngland: "Contains public sector information from Skills England, licensed under the Open Government Licence v3.0. © Skills England 2025.",
  onet: `This page includes information from the O*NET ${ONET_VERSION.replace("_", ".")} Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. Comquat has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.`,
};

let cached = null;
let building = null;

function load() {
  if (cached) return cached;
  for (const f of [DATA_FILE, CACHE_FILE]) {
    try {
      const d = JSON.parse(fs.readFileSync(f, "utf8"));
      if (d && Array.isArray(d.occupations) && d.occupations.length) { cached = d; return d; }
    } catch (_) {}
  }
  return null;
}

function status() {
  const d = load();
  if (d) return { ready: true, count: d.occupations.length, builtAt: d.builtAt, sources: d.sources, attribution: ATTRIBUTION };
  return { ready: false, building: !!building, keySet: !!process.env.SKILLS_ENGLAND_API_KEY, attribution: ATTRIBUTION };
}

// ── helpers that read the API's answers without assuming exact field names ──
const lc = (s) => String(s || "").toLowerCase();
function pick(obj, ...names) {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = Object.keys(obj);
  for (const n of names) {
    const k = keys.find((x) => lc(x) === lc(n));
    if (k !== undefined && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}
function texts(v) {
  if (v === undefined || v === null) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(texts);
  if (typeof v === "object") {
    const t = pick(v, "title", "name", "description", "detail", "text", "value", "jobTitle");
    return t !== undefined ? texts(t) : [];
  }
  return [String(v)];
}
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Every occupation code (OCC followed by digits) anywhere in an answer.
function occupationCodes(node, out = new Set()) {
  if (typeof node === "string") { if (/^OCC\d+$/i.test(node.trim())) out.add(node.trim().toUpperCase()); return out; }
  if (Array.isArray(node)) { node.forEach((n) => occupationCodes(n, out)); return out; }
  if (node && typeof node === "object") Object.values(node).forEach((n) => occupationCodes(n, out));
  return out;
}

function ksbList(occ, kind) {
  const block = pick(occ, "dutiesKSB", "ksbs", "ksb") || occ;
  const list = pick(block, kind, kind + "s") || [];
  return texts(list).map(stripHtml).filter(Boolean);
}

function normaliseOccupation(raw) {
  const occ = pick(raw, "occupation") || raw;
  const hierarchy = pick(occ, "mapHierarchy", "maphierarchy", "hierarchy") || {};
  const levelRaw = pick(hierarchy, "technicalLevel", "level") ?? pick(occ, "level", "technicalLevel");
  const level = parseInt(String(texts(levelRaw)[0] || levelRaw || "").replace(/\D/g, ""), 10) || null;
  const soc = pick(occ, "soc", "socCode", "standardOccupationalClassification");
  const products = texts(pick(occ, "products", "technicalEducationProducts")).map(stripHtml).filter(Boolean);
  return {
    code: String(pick(occ, "occupationCode", "code", "id") || "").toUpperCase(),
    title: stripHtml(texts(pick(occ, "occupationTitle", "title", "name"))[0] || ""),
    overview: stripHtml(texts(pick(occ, "overview"))[0] || ""),
    summary: stripHtml(texts(pick(occ, "summary", "occupationalSummary"))[0] || "").slice(0, 1200),
    level,
    route: stripHtml(texts(pick(hierarchy, "route", "routeName"))[0] || ""),
    pathway: stripHtml(texts(pick(hierarchy, "pathway", "pathwayName"))[0] || ""),
    soc: String(texts(pick(soc || {}, "code", "socCode"))[0] || texts(soc)[0] || "").trim(),
    jobTitles: [...new Set(texts(pick(occ, "typicalJobTitles", "typicaljobtitles", "jobTitles")).map(stripHtml).filter(Boolean))].slice(0, 30),
    keywords: [...new Set(texts(pick(occ, "keywords")).map(stripHtml).filter(Boolean))].slice(0, 40),
    duties: ksbList(occ, "duty").slice(0, 30),
    knowledge: ksbList(occ, "knowledge").slice(0, 40),
    skills: ksbList(occ, "skill").slice(0, 40),
    behaviours: ksbList(occ, "behaviour").slice(0, 20),
    products: products.slice(0, 10),
    onet: null,
  };
}

// ── O*NET: tab-separated text files inside the database zip ─────────────────
function readTsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split("\t");
  return lines.map((l) => { const c = l.split("\t"); const o = {}; head.forEach((h, i) => (o[h] = c[i])); return o; });
}
const titleTokens = (s) => new Set(lc(s).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["and", "the", "for", "with", "level", "apprentice", "assistant"].includes(w)));
function similarity(a, b) {
  const A = titleTokens(a), B = titleTokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0; A.forEach((w) => B.has(w) && n++);
  return n / (A.size + B.size - n);
}

function onetTables(zipBuffer) {
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(zipBuffer);
  const get = (name) => {
    const e = zip.getEntries().find((x) => x.entryName.toLowerCase().endsWith("/" + name.toLowerCase()) || x.entryName.toLowerCase() === name.toLowerCase());
    return e ? readTsv(e.getData().toString("utf8")) : [];
  };
  const occ = get("Occupation Data.txt");
  const alt = get("Alternate Titles.txt");
  const styles = get("Work Styles.txt");
  const values = get("Work Values.txt");
  const byCode = new Map();
  occ.forEach((r) => byCode.set(r["O*NET-SOC Code"], { code: r["O*NET-SOC Code"], title: r.Title, titles: [r.Title], styles: {}, values: {} }));
  alt.forEach((r) => { const o = byCode.get(r["O*NET-SOC Code"]); if (o && o.titles.length < 40) o.titles.push(r["Alternate Title"]); });
  // Work styles: the newer Impact scale (WI, -3 to +3) or the older Importance scale (IM, 1 to 5).
  styles.forEach((r) => {
    const o = byCode.get(r["O*NET-SOC Code"]); if (!o) return;
    const scale = r["Scale ID"]; const v = parseFloat(r["Data Value"]);
    if (isNaN(v)) return;
    if (scale === "WI") o.styles[r["Element Name"]] = Math.round(((v + 3) / 6) * 100) / 100;
    else if (scale === "IM" && o.styles[r["Element Name"]] === undefined) o.styles[r["Element Name"]] = Math.round(((v - 1) / 4) * 100) / 100;
  });
  // Work values: the Extent scale (EX, 1 to 7).
  values.forEach((r) => {
    const o = byCode.get(r["O*NET-SOC Code"]); if (!o || r["Scale ID"] !== "EX") return;
    const v = parseFloat(r["Data Value"]); if (!isNaN(v)) o.values[r["Element Name"]] = Math.round(((v - 1) / 6) * 100) / 100;
  });
  return [...byCode.values()].filter((o) => Object.keys(o.styles).length || Object.keys(o.values).length);
}

// Link each Skills England occupation to its closest O*NET occupation by job
// title. Only close links are kept (similarity of 0.5 or more), and the link is
// recorded with its score so it can be checked.
function linkOnet(occupations, onet) {
  for (const o of occupations) {
    let best = null;
    for (const n of onet) {
      for (const t of [o.title, ...o.jobTitles.slice(0, 8)]) {
        for (const nt of n.titles) {
          const s = similarity(t, nt);
          if (!best || s > best.score) best = { score: s, code: n.code, title: n.title, styles: n.styles, values: n.values };
        }
      }
    }
    if (best && best.score >= 0.5) o.onet = { code: best.code, title: best.title, linkScore: Math.round(best.score * 100) / 100, styles: best.styles, values: best.values };
  }
}

async function getJson(url, key) {
  const res = await fetch(url, { headers: { "X-API-KEY": key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

// Build the whole data file. Takes a few minutes: one call per occupation, gently paced.
async function build({ key = process.env.SKILLS_ENGLAND_API_KEY, log = console.log, out = DATA_FILE } = {}) {
  if (!key) throw new Error("SKILLS_ENGLAND_API_KEY isn't set, so the Skills England data can't be fetched yet.");
  const routes = await getJson(`${SE_BASE}/Routes?expand=routes.links`, key);
  const codes = [...occupationCodes(routes)];
  log(`[careers] ${codes.length} occupations listed by Skills England`);
  const occupations = [];
  for (const code of codes) {
    try {
      const raw = await getJson(`${SE_BASE}/Occupations/${encodeURIComponent(code)}?expand=${SE_EXPAND}`, key);
      const o = normaliseOccupation(raw);
      if (!o.code) o.code = code;
      if (o.title) occupations.push(o);
    } catch (e) { log(`[careers] skipped ${code}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 250));
  }
  let onetNote = "not fetched";
  try {
    const res = await fetch(ONET_ZIP);
    if (!res.ok) throw new Error(`${res.status}`);
    const onet = onetTables(Buffer.from(await res.arrayBuffer()));
    linkOnet(occupations, onet);
    onetNote = `${occupations.filter((o) => o.onet).length} of ${occupations.length} occupations linked to O*NET`;
  } catch (e) { onetNote = `O*NET download failed (${e.message}); matching uses Skills England data only`; }
  log(`[careers] ${onetNote}`);
  const data = {
    builtAt: new Date().toISOString(),
    sources: [
      { name: "Skills England occupational maps", url: "https://occupational-maps.skillsengland.education.gov.uk/", licence: "Open Government Licence v3.0", attribution: ATTRIBUTION.skillsEngland },
      { name: `O*NET ${ONET_VERSION.replace("_", ".")} Database`, url: "https://www.onetcenter.org/database.html", licence: "CC BY 4.0", attribution: ATTRIBUTION.onet, note: onetNote },
    ],
    occupations,
  };
  const json = JSON.stringify(data);
  try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, json); }
  catch (_) { fs.writeFileSync(CACHE_FILE, json); }
  cached = data;
  return data;
}

// At server start: if there's no data yet and the key is set, build it in the background.
function ensure(log = console.log) {
  if (load() || building || !process.env.SKILLS_ENGLAND_API_KEY) return;
  building = build({ log }).catch((e) => log(`[careers] build failed: ${e.message}`)).finally(() => { building = null; });
}

function _setForTests(d) { cached = d; }

module.exports = { load, status, build, ensure, normaliseOccupation, occupationCodes, onetTables, linkOnet, similarity, ATTRIBUTION, _setForTests };
