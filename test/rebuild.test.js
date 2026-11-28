// The rebuilt CV writer (28 Nov 2026): no role goes missing, dates come from
// the CV, nothing is left with a hole in it, and the honesty check takes out
// whole lines.
const test = require("node:test");
const assert = require("node:assert");
const record = require("../lib/careerRecord");
const { assembleHistory, sourceOf, applyRead } = require("../lib/cvWriter");
const readability = require("../lib/readability");
const { removeContaining } = require("../lib/fabricationChecker");
const { sanitizeForOutput } = require("../lib/sanitize");

const CV = `Neil Copping
Tate
Senior Manager / Billing Consultant                     October 2017 to 2026
Managing a team of senior permanent consultants
Awards International Ltd
General Manager and Marketing Manager                   March 2015 to September 2017
Whitbread PLC, Premier Inn
National Food and Beverage Operations Manager           January 1999 to June 2007
Responsible for 72 Premier Inn hotels with a combined turnover of £36 million
Whitbread PLC
Graduate Recruitment and Training Manager               October 1997 to January 1999`;

const rec = () => record.verify(record.clean({
  name: "Neil Copping", currentTitle: "Senior Manager / Billing Consultant",
  roles: [
    { company: "Tate", title: "Senior Manager / Billing Consultant", dates: "October 2017 to 2026", relevance: "high", source: "Managing a team of senior permanent consultants" },
    { company: "Awards International Ltd", title: "General Manager and Marketing Manager", dates: "March 2015 to September 2017", relevance: "medium" },
    { company: "Whitbread PLC, Premier Inn", title: "National Food and Beverage Operations Manager", dates: "January 1999 to June 2007", relevance: "high" },
  ],
}), CV);

test("career record: facts are checked against the CV word for word", () => {
  const r = rec();
  assert.deepEqual(r.roles.map((x) => x.checks), [[], [], []]);
  const wrong = record.verify(record.clean({ roles: [{ company: "Tate", title: "Head of Recruitment", dates: "2015 to 2026" }] }), CV);
  assert.deepEqual(wrong.roles[0].checks, ["title", "dates"]);
});

test("career record: a date range in the CV that no role covers is pointed out", () => {
  const r = rec();
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /october 1997 to january 1999/);
});

test("career record: old but relevant roles get full detail, and nothing is dropped by default", () => {
  const r = rec();
  assert.deepEqual(r.roles.map((x) => x.level), ["full", "full", "full"]);
  const edited = record.applyEdits(r, { roles: [{ id: "r1", level: "full" }, { id: "r2", level: "out" }, { id: "r3", level: "short", dates: "Jan 1999 to Jun 2007" }] });
  assert.deepEqual(record.onCv(edited).map((x) => x.id), ["r1", "r3"]);
  assert.equal(edited.roles[2].dates, "Jan 1999 to Jun 2007");
});

test("history: every kept role is on the CV with the record's facts, whatever the AI returns", () => {
  const r = rec();
  // The AI forgot the Whitbread role and got Tate's dates wrong.
  const written = { roles: [
    { id: "r1", dates: "2015 to 2026", responsibilities: [{ text: "Led a team of consultants in two offices.", from: "A1" }], achievements: [] },
    { id: "r2", responsibilities: [{ text: "Ran sales and marketing.", from: "cv" }], achievements: [] },
  ] };
  const exp = assembleHistory(r, written, [{ question: "Teams?", answer: "Home Counties and Nottingham" }]);
  assert.deepEqual(exp.map((x) => x.company), ["Tate", "Awards International Ltd", "Whitbread PLC, Premier Inn"]);
  assert.equal(exp[0].dates, "October 2017 to 2026");
  assert.deepEqual(exp[0].sources.responsibilities, ["answer"]);
});

test("where a line came from: CV, answer or story bank", () => {
  const answers = [{ question: "a", answer: "x" }, { question: "b", answer: "y", fromStory: true }];
  assert.equal(sourceOf("cv", answers), "cv");
  assert.equal(sourceOf("A1", answers), "answer");
  assert.equal(sourceOf("A2", answers), "story");
});

test("readability: lines with holes are taken out whole, good lines stay", () => {
  const cv = {
    personalStatement: "I lead teams. At Awards I managed a team of consultants , and at Tate I managed more. I love a KPI.",
    experience: [{ responsibilities: ["Built a client relationship with a at Tate over nine years.", "Grew it from basic admin recruitment to all roles."], achievements: ["Won Newcomer of the Year at Tate in 2018 to and featured in the top 10."], sources: { responsibilities: ["cv", "answer"], achievements: ["cv"] } }],
    skills: [{ skill: "Leadership", proof: "Managed a team across at Tate." }, { skill: "CRM", proof: "Daily CRM use." }],
    skillSources: ["cv", "answer"],
    interests: ["Music"], interestSources: ["cv"], skillsMatch: [],
  };
  const removed = readability.gate(cv);
  assert.equal(removed.length, 4);
  assert.equal(cv.personalStatement, "I lead teams. I love a KPI.");
  assert.deepEqual(cv.experience[0].responsibilities, ["Grew it from basic admin recruitment to all roles."]);
  assert.deepEqual(cv.experience[0].sources.responsibilities, ["answer"]);
  assert.deepEqual(cv.skills.map((s) => s.skill), ["CRM"]);
  assert.deepEqual(cv.skillSources, ["answer"]);
});

test("honesty check removes the whole line or sentence, never just the words", () => {
  const cv = {
    personalStatement: "I lead teams. I'm developing a £700 million proposal with Compass. I love a KPI.",
    experience: [{ company: "Tate", title: "Consultant", dates: "2017 to 2026", responsibilities: ["Built a relationship with a travel tech client over nine years.", "Managed senior consultants."], achievements: [], sources: { responsibilities: ["cv", "cv"], achievements: [] } }],
    skills: [], skillsMatch: [{ requirement: "Growth", proof: "A £700 million proposal." }], interests: [], education: [],
  };
  assert.equal(removeContaining(cv, "£700 million"), true);
  assert.equal(cv.personalStatement, "I lead teams. I love a KPI.");
  assert.deepEqual(cv.skillsMatch, []);
  removeContaining(cv, "travel tech");
  assert.deepEqual(cv.experience[0].responsibilities, ["Managed senior consultants."]);
  assert.equal(removeContaining(cv, "not on the cv"), false);
  assert.equal(readability.gate(cv).length, 0);
});

test("the hiring manager's read can drop repeats but never empty a role", () => {
  const cv = { experience: [{ responsibilities: ["Grew revenue by 77%."], achievements: [], sources: { responsibilities: ["cv"], achievements: [] } }, { responsibilities: ["Led a team."], achievements: ["Grew revenue by 77%."], sources: { responsibilities: ["cv"], achievements: ["cv"] } }], skills: [] };
  applyRead(cv, { dropLines: ["[r2] Grew revenue by 77%."], verdict: "Good", issues: ["77% appears twice"] });
  // Both lines match the text, but the first role would be emptied, so it keeps its line.
  assert.deepEqual(cv.experience[0].responsibilities, ["Grew revenue by 77%."]);
  assert.deepEqual(cv.experience[1].achievements, []);
  assert.equal(cv.read.verdict, "Good");
});

test("output keeps the person's choice of full or short, at any age of role", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ company: "C" + i, title: "T", dates: "2000", responsibilities: ["a", "b", "c", "d", "e"], achievements: ["x", "y"], level: i === 7 ? "full" : "short" }));
  const out = sanitizeForOutput({ header: { name: "N" }, experience: many });
  assert.equal(out.experience[7].responsibilities.length, 5); // old but full
  assert.equal(out.experience[0].responsibilities.length, 2);  // short
  assert.equal(out.experience[0].level, undefined);
});

test("where a line came from is worked out from the words, not the AI's label", () => {
  const { attribute } = require("../lib/cvWriter");
  const cvText = "Managing a team of senior permanent consultants. Winner of the Newcomer of the Year award.";
  const answers = [{ question: "Team?", answer: "I managed a team of consultants in our Home Counties office and in our Nottingham office" }, { question: "Fun", answer: "Ipswich Town fan, gigs and festivals", fromStory: true }];
  assert.equal(attribute("Managed consultants across the Home Counties and Nottingham offices", cvText, answers, "cv"), "answer");
  assert.equal(attribute("Winner of the Newcomer of the Year award", cvText, answers, "A1"), "cv");
  assert.equal(attribute("Ipswich Town fan who loves gigs and festivals", cvText, answers, "cv"), "story");
});
