// Identify Your Options: the trait bank ("What makes you good at stuff") and the
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

// "How you work best": calm, either-or questions. Answers are private.
const WORK_STYLE = [
  { id: "noise", q: "Where do you work best?", a: ["Somewhere quiet", "Somewhere with a buzz", "Either is fine"] },
  { id: "pace", q: "What sort of day suits you?", a: ["The same routine each day", "Something different every day", "A mix of both"] },
  { id: "people", q: "Who do you like to spend your day with?", a: ["Mostly people", "Mostly tasks, things or screens", "A bit of both"] },
  { id: "hands", q: "How do you like to work?", a: ["Hands-on, on my feet", "At a desk or screen", "A mix of both"] },
  { id: "scale", q: "What do you notice first?", a: ["The small details", "The big picture", "Both, depending on the day"] },
  { id: "instructions", q: "How do you like to be told what to do?", a: ["Written down", "Told, or shown", "Either works"] },
  { id: "learn", q: "How do you learn best?", a: ["By doing it", "By watching someone first", "By reading or studying", "By talking it through"] },
  { id: "where", q: "Indoors or out?", a: ["Indoors", "Outdoors", "Don't mind"] },
];

module.exports = { TRAIT_GROUPS, TRAITS, VALUES, PILES, WORK_STYLE };
