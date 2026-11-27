// Beyond the Obvious: the trait bank ("What makes you good at stuff") and the
// values cards. Wording approved by Neil on 26 Nov 2026: change it only with his OK.
//
// Rules (from the signed-off spec):
//   - People pick the traits that sound like them. No test, no score, no label,
//     and nobody is ever asked whether they're neurodivergent.
//   - Every trait they pick needs one real example, from work or from life.
//   - Traits connect to roles. Labels never do.
//   - The "What helps me" side is private. It never goes to the AI, and only
//     reaches the report if the person chooses.
//
// words:  what to look for in an occupation's duties, skills, behaviours and
//         keywords (Skills England data) when matching.
// styles: O*NET work styles this trait lines up with (matched loosely by name).

const TRAIT_GROUPS = ["Focus and thinking", "Detail and accuracy", "Energy and pace", "People and communication", "Structure and routine", "Making, fixing and creating", "Life experience"];

const t = (id, group, card, kinds, helps, words, styles) => ({ id, group, card, kinds, helps: helps || "", words, styles });
const TRAITS = [
  t("lock-in", "Focus and thinking", "I lock in on things I love for hours", "Research, coding, editing, craft trades", "Time without interruptions",
    ["research", "develop", "code", "software", "edit", "craft", "analyse", "investigate", "design"], ["persist", "persever", "achievement", "independen"]),
  t("pictures", "Focus and thinking", "I think in pictures and patterns", "Design, engineering, CAD, architectural technician", "Diagrams rather than long text",
    ["design", "drawing", "cad", "model", "engineer", "technical drawings", "layout", "visual"], ["innovat", "analytical"]),
  t("connections", "Focus and thinking", "I see connections other people miss", "Analysis, investigation, planning, problem-solving roles", "",
    ["analys", "data", "investigat", "plan", "problem", "diagnos", "evaluate", "insight"], ["analytical", "innovat"]),
  t("why", "Focus and thinking", "I ask \"why\" until it makes sense", "Testing, quality, research, training", "Knowing the reason behind an instruction",
    ["test", "quality", "research", "root cause", "train", "audit", "improve"], ["analytical", "intellectual", "curiosity"]),
  t("doing", "Focus and thinking", "I learn fastest by doing", "Trades, apprenticeships, hospitality, care", "Show me, then let me try",
    ["practical", "hands-on", "install", "repair", "prepare", "service", "care", "maintain", "operate"], ["adaptab", "initiative"]),
  t("memory", "Focus and thinking", "I remember facts and details really well", "Product-based customer service, pharmacy support, archives, logistics", "",
    ["product knowledge", "records", "stock", "pharmacy", "archive", "inventory", "catalogue", "regulations"], ["detail", "dependab"]),
  t("detail", "Detail and accuracy", "I spot the detail everyone else misses", "Quality control, data, audit, lab work", "",
    ["quality", "inspect", "accura", "data", "audit", "laborator", "check", "verify", "precision"], ["detail"]),
  t("properly", "Detail and accuracy", "I like things done properly, not quickly", "Inspection, compliance, finance admin, joinery", "Clear standards to work to",
    ["standard", "compliance", "regulation", "inspect", "finish", "joinery", "procedure", "accura"], ["detail", "dependab", "integrity", "cautious"]),
  t("not-right", "Detail and accuracy", "I notice when something's not right", "Health and safety, maintenance, security", "",
    ["health and safety", "hazard", "risk", "maintenance", "fault", "security", "safeguard", "monitor"], ["detail", "cautious", "dependab"]),
  t("repeat", "Detail and accuracy", "I'm happy doing the same task well, again and again", "Production, warehousing, data entry, assembly", "",
    ["production", "assembl", "warehouse", "process", "data entry", "pick", "pack", "manufactur"], ["dependab", "self-control", "persist"]),
  t("calm", "Energy and pace", "I'm calm when everything's kicking off", "Emergency services, events, hospitality, front-line care", "",
    ["emergency", "incident", "pressure", "event", "hospitality", "front line", "crisis", "urgent", "patient"], ["stress", "self-control", "composure"]),
  t("energy", "Energy and pace", "I've got loads of energy and need to keep moving", "Hospitality, retail, delivery, fitness, outdoor work", "Variety and being on my feet",
    ["hospitality", "retail", "deliver", "fitness", "outdoor", "physical", "active", "site"], ["energy", "achievement", "initiative"]),
  t("fast", "Energy and pace", "I think fast on my feet", "Sales, events, customer-facing roles, kitchens", "",
    ["sales", "customer", "event", "kitchen", "negotiat", "respond", "service"], ["adaptab", "stress", "initiative"]),
  t("bursts", "Energy and pace", "I'm at my best in short bursts", "Project work, events, shift work, freelance", "Breaks between tasks",
    ["project", "event", "shift", "deadline", "campaign"], ["adaptab", "achievement"]),
  t("steady", "Energy and pace", "I like a slow, steady pace", "Admin, libraries, lab work, horticulture, care", "Not being rushed",
    ["administrat", "librar", "laborator", "horticultur", "care", "records", "garden"], ["dependab", "self-control", "cautious"]),
  t("straight", "People and communication", "I say it straight", "Inspection, compliance, safety, testing", "Honest feedback in return",
    ["inspect", "compliance", "safety", "test", "report", "assess", "feedback"], ["integrity"]),
  t("one-to-one", "People and communication", "I'm really good one-to-one", "Care, coaching, support work, hairdressing, advice roles", "Small groups rather than big meetings",
    ["care", "coach", "support", "client", "hair", "advice", "mentor", "individual"], ["concern for others", "empathy", "social"]),
  t("open-up", "People and communication", "People open up to me", "Care, HR, support work, customer service, healthcare support", "",
    ["care", "patient", "wellbeing", "customer", "support", "human resources", "listen", "safeguard"], ["concern for others", "empathy", "social"]),
  t("things", "People and communication", "I'm better with things than with people", "Engineering, maintenance, warehousing, IT, lab work", "",
    ["engineer", "maintenance", "warehouse", "it ", "network", "laborator", "equipment", "machine"], ["independen", "analytical"]),
  t("stand-up", "People and communication", "I stand up for people", "Advocacy, support work, HR, youth work", "",
    ["advoca", "support", "human resources", "youth", "equality", "inclusion", "rights", "safeguard"], ["integrity", "concern for others", "leadership"]),
  t("explain", "People and communication", "I'm great at explaining things", "Training, teaching assistant, tech support, sales", "",
    ["train", "teach", "learner", "explain", "support", "demonstrat", "present", "sales"], ["social", "leadership", "cooperat"]),
  t("write", "People and communication", "I'd rather write than talk", "Admin, content, data, email and chat support", "Instructions written down",
    ["written", "write", "content", "document", "administrat", "data", "report", "correspond"], ["independen", "detail"]),
  t("routine", "Structure and routine", "Routine makes me brilliant", "Logistics, process and operations roles", "A predictable day",
    ["logistic", "process", "operation", "schedule", "procedure", "warehouse", "transport"], ["dependab", "self-control"]),
  t("checklist", "Structure and routine", "I love a checklist", "Admin, compliance, quality, kitchen prep, facilities", "",
    ["checklist", "compliance", "quality", "facilit", "administrat", "procedure", "prep"], ["detail", "dependab"]),
  t("expected", "Structure and routine", "I like knowing exactly what's expected", "Manufacturing, finance admin, lab work, public sector roles", "Clear, written expectations",
    ["manufactur", "finance", "laborator", "public sector", "procedure", "policy", "standard operating"], ["dependab", "cautious"]),
  t("organising", "Structure and routine", "I'm good at sorting and organising", "Stock control, admin, events, logistics, libraries", "",
    ["stock", "administrat", "event", "logistic", "librar", "organis", "plan", "schedul", "coordinat"], ["detail", "dependab", "initiative"]),
  t("take-apart", "Making, fixing and creating", "I like taking things apart to see how they work", "Engineering, mechanics, electrical, IT repair", "",
    ["engineer", "mechanic", "electric", "repair", "fault", "diagnos", "maintain", "vehicle"], ["analytical", "innovat", "persist"]),
  t("hands", "Making, fixing and creating", "I'm good with my hands", "Trades, catering, hair and beauty, construction, horticulture", "",
    ["construct", "catering", "food", "hair", "beauty", "horticultur", "install", "tool", "carpent", "plumb"], ["achievement", "dependab"]),
  t("ideas", "Making, fixing and creating", "I'm full of ideas", "Marketing, design, content, product development, enterprise", "Someone to help me finish things",
    ["marketing", "design", "content", "creative", "product", "campaign", "brand", "develop"], ["innovat", "initiative"]),
  t("problem", "Making, fixing and creating", "I come alive when there's a problem to solve", "Design, engineering, digital, events", "",
    ["problem", "solution", "design", "engineer", "digital", "troubleshoot", "improve"], ["analytical", "innovat", "persist"]),
  t("outdoors", "Making, fixing and creating", "I'm happiest outdoors", "Horticulture, construction, land-based work, outdoor education, delivery", "",
    ["outdoor", "horticultur", "land", "construct", "agricultur", "environment", "garden", "forest", "deliver"], ["energy", "independen"]),
  t("fair", "Making, fixing and creating", "I care about getting it fair and right", "Compliance, HR, payroll, public sector roles", "",
    ["compliance", "human resources", "payroll", "public sector", "policy", "fair", "equality", "regulat"], ["integrity", "cautious"]),
  t("keep-going", "Life experience", "I keep going when things are hard", "Any role; shown through real examples", "",
    [], ["persist", "persever", "stress", "achievement"]),
  t("juggled", "Life experience", "I've juggled a lot at once", "Admin, operations, hospitality management, events", "",
    ["administrat", "operation", "hospitality", "event", "coordinat", "manage", "multiple", "priorit"], ["adaptab", "stress", "initiative"]),
  t("looked-after", "Life experience", "I've looked after someone", "Care, health support, education support, customer service", "Hours that fit around caring",
    ["care", "health", "patient", "education", "support", "customer", "wellbeing"], ["concern for others", "dependab", "empathy"]),
  t("self-taught", "Life experience", "I've taught myself things", "Digital, IT, trades, self-employment", "",
    ["digital", "software", "it ", "trade", "self-employ", "enterprise", "learn"], ["initiative", "independen", "achievement"]),
];

// Values cards. People sort every card into Must have, Nice to have or Not
// bothered, then rank their top five Must haves.
// onet: O*NET work values this card lines up with.
const v = (id, label, plain, words, onet) => ({ id, label, plain, words, onet });
const VALUES = [
  v("helping", "Helping people", "My work makes someone's day better", ["care", "support", "patient", "customer", "wellbeing", "help"], ["relationships"]),
  v("local", "Making a difference locally", "I can see the good I do in my own town", ["community", "local", "public", "council"], ["relationships"]),
  v("creative", "Being creative", "I get to make, design or come up with things", ["design", "creative", "content", "develop"], ["independence", "achievement"]),
  v("hands", "Using my hands", "I make or fix real, physical things", ["install", "repair", "construct", "make", "build", "tool"], ["achievement"]),
  v("learning", "Learning new things", "I'm always picking up something new", ["learn", "develop", "train", "technolog"], ["achievement"]),
  v("getting-on", "Getting on", "There's a clear way to move up", [], ["recognition", "achievement"]),
  v("steady-pay", "Steady pay and security", "I know where I stand every month", [], ["working conditions", "support"]),
  v("hours", "Hours that fit my life", "My work fits around family, health or caring", [], ["working conditions"]),
  v("close", "Working close to home", "Short or no commute", [], ["working conditions"]),
  v("calm", "A calm workplace", "Quiet, settled, not chaotic", [], ["working conditions", "support"]),
  v("variety", "Variety", "No two days the same", ["variety", "range", "different"], ["independence", "achievement"]),
  v("routine", "A good routine", "I know what my day looks like", ["procedure", "process", "schedule"], ["support", "working conditions"]),
  v("team", "Being part of a team", "I'm working with people, not on my own", ["team", "colleague", "collaborat"], ["relationships"]),
  v("alone", "Working on my own", "Left to get on with it", ["independent", "own initiative", "lone"], ["independence"]),
  v("trusted", "Being trusted", "No one breathing down my neck", ["autonom", "responsib", "independent"], ["independence"]),
  v("recognised", "Being recognised", "My effort is noticed and thanked", [], ["recognition"]),
  v("leading", "Leading others", "I get to guide and look after a team", ["lead", "manage", "supervis", "team leader"], ["recognition"]),
  v("challenged", "Being challenged", "Work that stretches me", ["complex", "problem", "challeng"], ["achievement"]),
  v("fairness", "Fairness", "Everyone gets treated the same, and properly", ["equality", "fair", "inclusion"], ["support", "relationships"]),
  v("honesty", "Honesty", "I can be open, and people are open with me", ["integrity", "honest", "ethic"], ["relationships"]),
  v("fun", "Fun at work", "A laugh with the people around me", [], ["relationships"]),
  v("planet", "Looking after the planet", "My work does no harm, or does some good", ["sustainab", "environment", "green", "energy", "recycl"], []),
  v("outdoors", "Being outdoors", "Fresh air, not four walls", ["outdoor", "land", "site", "garden", "agricultur"], []),
  v("balance", "Balance", "Work doesn't take over my health or home life", [], ["working conditions"]),
];

const PILES = ["must", "nice", "no"];

// "How you work best" (reworded 27 Nov 2026 so it reads like choosing a job, not
// being assessed). "a" are the stored answers the matching uses; "show" is what
// people see. "pic" is a small picture word for the choice cards.
const WORK_STYLE = [
  { id: "noise", q: "Which sounds like a better place to work?", a: ["Somewhere quiet", "Somewhere with a buzz", "Either is fine"], show: ["A quiet office or workshop", "A busy kitchen or shop floor", "Either sounds good"], pic: ["\u{1F5C2}", "\u{1F373}", "\u{1F44D}"] },
  { id: "pace", q: "Which sounds like a better week?", a: ["The same routine each day", "Something different every day", "A mix of both"], show: ["The same jobs each day, done really well", "Something different every day", "A bit of both"], pic: ["\u{1F4C5}", "\u{1F3B2}", "\u{1F504}"] },
  { id: "people", q: "Who would you rather spend your shift with?", a: ["Mostly people", "Mostly tasks, things or screens", "A bit of both"], show: ["Customers, clients or a team", "Tools, machines, screens or plants", "A bit of both"], pic: ["\u{1F465}", "\u{1F527}", "\u{1F504}"] },
  { id: "hands", q: "Where would you rather be?", a: ["Hands-on, on my feet", "At a desk or screen", "A mix of both"], show: ["On my feet, hands-on", "At a desk or screen", "A bit of both"], pic: ["\u{1F6E0}", "\u{1F4BB}", "\u{1F504}"] },
  { id: "scale", q: "Which job would you rather have?", a: ["The small details", "The big picture", "Both, depending on the day"], show: ["Making sure every detail is spot on", "Planning how it all fits together", "Either, depending on the day"], pic: ["\u{1F50D}", "\u{1F5FA}", "\u{1F504}"] },
  { id: "instructions", q: "Which sounds like a better first day?", a: ["Written down", "Told, or shown", "Either works"], show: ["A clear checklist to work through", "Someone showing me round", "Either works"], pic: ["\u{1F4CB}", "\u{1F91D}", "\u{1F44D}"] },
  { id: "learn", q: "How would you pick up a new job fastest?", a: ["By doing it", "By watching someone first", "By reading or studying", "By talking it through"], show: ["Having a go", "Watching someone first", "Reading or a course", "Talking it through"], pic: ["\u{1F3AF}", "\u{1F440}", "\u{1F4D6}", "\u{1F4AC}"] },
  { id: "where", q: "Which sounds better?", a: ["Indoors", "Outdoors", "Don't mind"], show: ["Indoors", "Out in the fresh air", "Don't mind"], pic: ["\u{1F3E2}", "\u{1F333}", "\u{1F44D}"] },
];

// "Here's what we heard": picking likely answers out of the person's own story.
// Plain word rules, no AI, so it works on every AI setting. Nothing is decided:
// the person sees each one as a chip and keeps or removes it.
const HEARD = [
  ["noise", "Somewhere quiet", /\b(quiet|peace(ful)?|calm|on my own|by myself|headphones|no distractions)\b/i],
  ["noise", "Somewhere with a buzz", /\b(busy|buzz(ing)?|lively|packed|rush|banter|hectic|atmosphere)\b/i],
  ["pace", "The same routine each day", /\b(routine|same every|every day the same|regular|predictable|knew what (i was|to)|set hours)\b/i],
  ["pace", "Something different every day", /\b(different every|variety|never the same|something new|mix of things|no two days)\b/i],
  ["people", "Mostly people", /\b(people|customers?|team|guests?|clients?|kids|children|friends|helping (someone|people|out)|chatting)\b/i],
  ["people", "Mostly tasks, things or screens", /\b(computer|screen|spreadsheet|machine|engine|tools?|garden(ing)?|plants?|data|code|fix(ed|ing)?)\b/i],
  ["hands", "Hands-on, on my feet", /\b(hands|built|build(ing)?|made|making|fix(ed|ing)?|cook(ed|ing)?|garden(ing)?|lift(ing)?|on my feet|physical|practical)\b/i],
  ["hands", "At a desk or screen", /\b(desk|computer|laptop|office|screen|typing|spreadsheet|online)\b/i],
  ["scale", "The small details", /\b(detail|checked|check(ing)?|accurate|exactly|spotted|mistakes?|perfect)\b/i],
  ["scale", "The big picture", /\b(planned|planning|organised (the|it all|everything)|ideas?|the whole thing|big picture|in charge)\b/i],
  ["instructions", "Written down", /\b(written|list|checklist|notes|instructions|step by step)\b/i],
  ["instructions", "Told, or shown", /\b(showed me|shown|talked me through|explained it)\b/i],
  ["learn", "By doing it", /\b(by doing|trial and error|had a go|have a go|practis(e|ing)|learn(t|ed) on the job)\b/i],
  ["learn", "By watching someone first", /\b(watched|watching|showed me|youtube)\b/i],
  ["learn", "By reading or studying", /\b(read(ing)?|course|studied|studying|online course|book)\b/i],
  ["learn", "By talking it through", /\b(talked it through|asked (lots of )?questions|chatted it through)\b/i],
  ["where", "Outdoors", /\b(outside|outdoors?|garden|field|site|fresh air|allotment|walk(ing)?|park|beach)\b/i],
  ["where", "Indoors", /\b(inside|indoors|office|kitchen|shop|warehouse|classroom|studio)\b/i],
];
function heard(story) {
  const t = String(story || "");
  const out = [];
  for (const [id, answer, re] of HEARD) {
    if (out.some((h) => h.id === id)) continue; // one per question, first match wins
    if (re.test(t)) {
      const w = WORK_STYLE.find((x) => x.id === id);
      out.push({ id, answer, label: w.show[w.a.indexOf(answer)] });
    }
  }
  return out;
}

// Strengths, said the way the people who know you would say it (Idea 3, 27 Nov 2026).
// Built from the approved first-person cards; "card" is still what's saved and matched.
function said(card) {
  return card
    .replace(/^I'm\b/, "You're").replace(/^I've\b/, "You've").replace(/^I'd\b/, "You'd").replace(/^I\b/, "You")
    .replace(/\bI've\b/g, "you've").replace(/\bI'm\b/g, "you're").replace(/\bI\b/g, "you")
    .replace(/\bmyself\b/g, "yourself").replace(/\bmy\b/g, "your").replace(/\bme\b/g, "you")
    .replace(/^You love a checklist$/, "You love a checklist")
    .replace(/^Routine makes me brilliant$/, "Routine makes you brilliant")
    .replace(/^People open up to me$/, "People open up to you");
}
TRAITS.forEach((tr) => { tr.said = said(tr.card); });

module.exports = { TRAIT_GROUPS, TRAITS, VALUES, PILES, WORK_STYLE, HEARD, heard };
