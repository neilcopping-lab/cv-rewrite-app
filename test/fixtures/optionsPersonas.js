// Identify Your Options: test personas for every target market, and TEST FIXTURE
// occupations shaped like Skills England data. The occupations are written for
// testing only (not copied from Skills England) and are never shown to anyone.
// The people are made up. Each one stands for one of the app's target markets.

const occ = (code, title, level, route, keywords, duties, skills, knowledge, behaviours, apprenticeship = true) => ({
  code, title: "TEST FIXTURE: " + title, level, route, overview: `TEST FIXTURE: ${title}.`, summary: "", pathway: "", soc: "",
  jobTitles: [title], keywords, duties, skills, knowledge, behaviours, products: apprenticeship ? ["Apprenticeship standard"] : [], onet: null,
});

const OCCUPATIONS = [
  occ("OCC9201", "Care worker", 2, "Care services", ["care", "support", "wellbeing"],
    ["Support people with personal care and daily living", "Promote wellbeing and independence"],
    ["Communicate with patients and families with empathy", "Record care notes accurately", "Follow safeguarding procedures"],
    ["Person-centred care", "Health and safety in care settings"], ["Compassion", "Patience", "Reliable"]),
  occ("OCC9202", "Commis chef", 2, "Catering and hospitality", ["kitchen", "food", "hospitality"],
    ["Prepare and cook food in a busy kitchen", "Keep the kitchen clean and safe"],
    ["Prepare dishes to the standard set", "Work under pressure during service", "Use knives and kitchen tools safely"],
    ["Food safety and hygiene", "Allergen rules"], ["Team working", "Calm under pressure"]),
  occ("OCC9203", "Warehouse operative", 2, "Transport and logistics", ["warehouse", "stock", "logistics"],
    ["Pick, pack and dispatch orders", "Check and record stock"],
    ["Pick and pack orders accurately", "Use scanners to record stock", "Follow the daily process and schedule"],
    ["Stock control systems", "Manual handling"], ["Reliable", "Follows procedure"]),
  occ("OCC9204", "Customer service practitioner", 2, "Sales, marketing and procurement", ["customer", "service"],
    ["Deal with customer queries in person, by phone and online", "Resolve complaints"],
    ["Listen to customers and resolve problems", "Record customer details accurately", "Explain products and services clearly"],
    ["Products and services", "Data protection"], ["Patience", "Positive attitude"]),
  occ("OCC9205", "Business administrator", 3, "Business and administration", ["administration", "office", "records"],
    ["Organise diaries, meetings and records", "Produce documents and reports"],
    ["Organise and file records accurately", "Write clear emails and documents", "Plan and prioritise workload"],
    ["Office systems and software", "Data protection"], ["Organised", "Reliable"]),
  occ("OCC9206", "Horticulture operative", 2, "Agriculture, environmental and animal care", ["outdoor", "horticulture", "garden"],
    ["Plant, maintain and look after gardens and green spaces outdoors"],
    ["Use hand tools and machinery safely", "Maintain lawns, beds and planting", "Identify plants and pests"],
    ["Plant care and horticulture", "Environmental sustainability"], ["Works safely", "Enjoys working outdoors"]),
  occ("OCC9207", "Software developer", 4, "Digital", ["software", "code", "digital"],
    ["Design, write and test software", "Solve technical problems"],
    ["Write code to a set standard", "Test software and fix faults", "Analyse problems and design solutions"],
    ["Programming languages", "Software testing", "Data security"], ["Problem solving", "Attention to detail"]),
  occ("OCC9208", "Data technician", 3, "Digital", ["data", "analysis", "spreadsheets"],
    ["Collect, check and report on data"],
    ["Check data for accuracy and errors", "Analyse data in spreadsheets", "Present findings in reports"],
    ["Data quality", "Data protection"], ["Attention to detail", "Analytical"]),
  occ("OCC9209", "Quality inspector", 3, "Engineering and manufacturing", ["quality", "inspection"],
    ["Inspect products against the standard"],
    ["Inspect products for faults and record results accurately", "Use measuring equipment to check accuracy"],
    ["Quality standards and procedures", "Health and safety"], ["Attention to detail", "Says it straight"]),
  occ("OCC9210", "Electrician", 3, "Construction and the built environment", ["electrical", "install", "repair"],
    ["Install, test and repair electrical systems"],
    ["Install wiring and electrical equipment", "Find and repair electrical faults", "Use hand tools safely"],
    ["Electrical regulations", "Health and safety on site"], ["Works safely", "Problem solving"]),
  occ("OCC9211", "Teaching assistant", 3, "Education and early years", ["education", "learners", "support"],
    ["Support learners in class", "Help teachers prepare lessons"],
    ["Explain things clearly to learners", "Support learners with additional needs", "Keep records of progress"],
    ["Safeguarding children", "How children learn"], ["Patience", "Encouraging"]),
  occ("OCC9212", "Junior content producer", 3, "Creative and design", ["content", "design", "creative"],
    ["Plan and produce content for websites and social media"],
    ["Write and edit content", "Create images and video", "Come up with campaign ideas"],
    ["Brand guidelines", "Copyright"], ["Creative", "Meets deadlines"]),
  occ("OCC9213", "Operations manager", 5, "Business and administration", ["operations", "manage", "team"],
    ["Lead a team and run day-to-day operations"],
    ["Plan and coordinate resources", "Lead and manage a team", "Solve operational problems"],
    ["Budgets and finance", "Employment law basics"], ["Leadership", "Decisive"], false),
  occ("OCC9214", "Senior leader", 7, "Business and administration", ["strategy", "leadership"],
    ["Set strategy for an organisation"], ["Set strategy", "Lead change"], ["Corporate finance"], ["Vision"], false),
];

const P = (id, market, profile) => ({ id, market, profile });
const PERSONAS = [
  P("returner", "Returner (long time out of work)", {
    cvText: "Retail assistant 2009 to 2015. Served customers, handled cash, kept the shop floor tidy and stocked. Career break 2015 to 2026 to raise my children.",
    traits: [{ id: "juggled", example: "Ran a busy home with three children, school runs, after-school clubs and the PTA rota every week." },
             { id: "open-up", example: "Other parents at the school gate always come to me when something's worrying them." }],
    values: { hours: "must", close: "must", team: "nice", helping: "must" }, topValues: ["hours", "helping"],
    workStyle: { people: "Mostly people", where: "Indoors" }, qualification: "gcse", experienceYears: 6,
    goodDay: "Helping people, with hours that fit around the school run.", life: { doing: "Raising my children and helping run the school PTA." } }),
  P("carer", "Long-term carer", {
    cvText: "",
    traits: [{ id: "looked-after", example: "I've looked after my mum full time for eight years: medication rounds, appointments and her daily care." },
             { id: "calm", example: "When mum has a fall I stay calm, check she's safe and call the right people." },
             { id: "organising", example: "I keep all of mum's appointments, letters and medication in a system that never misses a date." }],
    values: { helping: "must", hours: "must", local: "nice" }, topValues: ["helping", "hours"],
    workStyle: { people: "Mostly people" }, qualification: "gcse", experienceYears: 8,
    goodDay: "Making someone's day better.", life: { doing: "Caring for my mum full time." } }),
  P("ill", "Living with a long-term illness", {
    cvText: "Office administrator 2012 to 2020. Organised diaries and meetings, filed records, wrote letters and reports, managed the office supplies budget.",
    traits: [{ id: "write", example: "I wrote all the letters and reports for a team of twelve, and people said they were the clearest they got." },
             { id: "organising", example: "I set up a filing system for the office that the team still uses." }],
    values: { hours: "must", calm: "must", alone: "nice", balance: "must" }, topValues: ["hours", "balance", "calm"],
    workStyle: { noise: "Somewhere quiet", hands: "At a desk or screen", instructions: "Written down" }, qualification: "alevel", experienceYears: 8,
    goodDay: "A quiet morning getting through my admin, with breaks when I need them.", life: { doing: "Getting my health back on track and doing an online course." },
    private: { howIWorkBest: "I have ME, so I need flexible hours and to work from home some days.", helps: { write: "Written instructions" }, include: false } }),
  P("neurodivergent", "Neurodivergent, no label needed", {
    cvText: "Stock assistant at a supermarket for 3 years. Checked deliveries, rotated stock and kept the stock records.",
    traits: [{ id: "detail", example: "I found errors in the weekly stock counts that had been missed for months, and fixed the process." },
             { id: "lock-in", example: "I taught myself spreadsheets and built a stock tracker over a weekend because I got hooked on it." },
             { id: "routine", example: "I do my best work when I know my shift pattern and tasks in advance." }],
    values: { routine: "must", calm: "must", alone: "must", challenged: "nice" }, topValues: ["routine", "calm"],
    workStyle: { noise: "Somewhere quiet", pace: "The same routine each day", people: "Mostly tasks, things or screens", scale: "The small details", instructions: "Written down" },
    qualification: "level2", experienceYears: 3, goodDay: "Quiet, clear tasks, getting the numbers right.",
    life: { interests: "Spreadsheets, model railways, collecting data on train timetables." } }),
  P("changer", "Career changer", {
    cvText: "Head chef, 15 years. Ran kitchens of up to 12 staff, planned menus, managed food costs and budgets, trained apprentices, handled suppliers and stock, kept food safety records.",
    traits: [{ id: "calm", example: "Ran a 200-cover Saturday service when two chefs called in sick, and every plate went out on time." },
             { id: "explain", example: "Trained eight apprentice chefs, three of whom now run their own kitchens." },
             { id: "juggled", example: "Managed menus, rotas, suppliers and budgets at the same time for years." }],
    values: { leading: "must", "getting-on": "must", balance: "must", team: "nice" }, topValues: ["balance", "leading"],
    workStyle: { people: "Mostly people", pace: "Something different every day" }, qualification: "level3", experienceYears: 15,
    goodDay: "Leading a team, but home in time for tea.", life: { doing: "Looking for a change from the late nights in kitchens." } }),
  P("neet", "Young person not in work or study (NEET)", {
    cvText: "",
    traits: [{ id: "self-taught", example: "I taught myself to edit videos on my phone and post them for my mates' football team." },
             { id: "ideas", example: "I came up with the logo and name for my friend's clothing page and it got 2,000 followers." }],
    values: { creative: "must", fun: "must", learning: "must" }, topValues: ["creative", "learning"],
    workStyle: { hands: "At a desk or screen" }, qualification: "gcse", experienceYears: 0,
    goodDay: "Making videos and designs with people my age.", life: { interests: "Video editing, football, designing logos." } }),
  P("undecided", "Struggling to decide a direction", {
    cvText: "Bar staff 2 years, then call centre adviser 1 year. Served customers, dealt with complaints on the phone, recorded customer details.",
    traits: [{ id: "fast", example: "On a packed Friday night I kept the bar moving and the queue happy." },
             { id: "outdoors", example: "Every weekend I'm out walking or helping on my uncle's allotment." }],
    values: { variety: "must", outdoors: "nice", team: "must" }, topValues: ["variety", "team"],
    workStyle: { where: "Don't mind", people: "A bit of both" }, qualification: "gcse", experienceYears: 3,
    goodDay: "Something different every day with a good team.", life: { interests: "Walking, gardening, football." } }),
];

// Turn a persona into what the matching sees: the same rule the app uses
// (CV, good day, life answers and trait examples; private notes left out).
function profileOf(p) {
  const a = p.profile;
  const personText = [a.cvText, a.goodDay, ...Object.values(a.life || {}), ...(a.traits || []).map((t) => t.example)].filter(Boolean).join("\n");
  return { personText, traits: a.traits, values: a.values, topValues: a.topValues, workStyle: a.workStyle, qualification: a.qualification, experienceYears: a.experienceYears, private: a.private || null };
}

module.exports = { OCCUPATIONS, PERSONAS, profileOf };
