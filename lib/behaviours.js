// Key skills and behaviours: the tick boxes on the master CV.
//
// People tick the things that sound like them, in their own words. Each tick
// becomes a strength on their CV, written here in advance, so no AI is
// involved and nobody's ticks are ever sent anywhere.
//
// The list deliberately includes traits that many people with ADHD, autism,
// dyslexia and other kinds of neurodivergence recognise in themselves, written
// as everyday strengths. No item names a condition, and nothing about a
// condition is stored or printed: only the strengths people choose.
//
// Each entry: [id, tick-box wording, CV strength, CV line]

const GROUPS = [
  {
    id: "focus", title: "How you focus",
    items: [
      ["deep-focus", "When something grabs me, I can lose myself in it for hours", "Deep focus", "Concentrates for long stretches on complex or detailed work."],
      ["specialist", "I learn everything I can about the subjects I care about", "Specialist knowledge", "Builds deep, detailed knowledge in areas of interest and keeps it up to date."],
      ["bursts", "I get a huge amount done in short, intense bursts", "High output under deadlines", "Delivers a lot in a short time when a deadline or busy spell demands it."],
      ["switching", "I can switch quickly between lots of different jobs", "Multi-tasking", "Moves quickly between tasks and keeps several things going at once."],
      ["busy", "I'm at my best when there's a lot going on", "Thrives in busy environments", "Stays effective, and often at their best, when it's hectic."],
      ["routine", "I like a steady routine where I know what's coming", "Consistency", "Works to the same reliable standard, day in, day out."],
      ["repetitive", "I'm comfortable with repetitive tasks other people find boring", "Accuracy on repeated tasks", "Keeps quality and accuracy high on repetitive work."],
    ],
  },
  {
    id: "thinking", title: "How you think and solve problems",
    items: [
      ["patterns", "I spot patterns and connections other people miss", "Pattern spotting", "Notices trends, links and problems that others overlook."],
      ["big-picture", "I see the big picture quickly", "Big-picture thinking", "Quickly sees how the parts fit together and where things are heading."],
      ["visual", "I think in pictures, diagrams or systems", "Visual and systems thinking", "Understands and explains how processes and systems work as a whole."],
      ["ideas", "I come up with lots of ideas, fast", "Generating ideas", "Comes up with a steady flow of new ideas and options."],
      ["angles", "I look at problems from unusual angles", "Creative problem solving", "Finds practical solutions by looking at problems differently."],
      ["how-it-works", "I like to understand exactly how things work", "Analytical thinking", "Breaks problems down and gets to the root cause."],
      ["why", "I keep asking 'why' until things make sense", "Curiosity", "Asks the questions that get to the bottom of things."],
      ["fix-process", "I quickly see when a process isn't working and how to fix it", "Improving processes", "Spots what's slowing a process down and suggests a better way."],
      ["logic", "I like decisions to be based on facts and logic", "Logical decision-making", "Weighs up the facts and makes clear, reasoned decisions."],
    ],
  },
  {
    id: "detail", title: "How you handle detail",
    items: [
      ["detail", "I notice small details and mistakes other people overlook", "Attention to detail", "Picks up small errors and details before they become problems."],
      ["standards", "I like things done properly and accurately", "High standards", "Takes care to get things right and to a high standard."],
      ["procedures", "I'm good at following set processes and rules", "Following procedures", "Works carefully to set processes, rules and safety standards."],
      ["memory", "I remember facts, figures and details easily", "Strong memory for detail", "Recalls facts, figures, names and procedures accurately."],
      ["numbers", "I'm good with numbers or data", "Working with numbers and data", "Comfortable handling figures, records and data accurately."],
      ["checks", "I'm thorough and I check my work", "Thoroughness", "Checks work carefully and hands it over complete."],
      ["senses", "I notice sounds, smells or changes that other people don't", "Alert to surroundings", "Quick to notice changes, faults or risks in the work environment."],
    ],
  },
  {
    id: "people", title: "How you work with people",
    items: [
      ["direct", "I'm honest and direct, and I say what I mean", "Clear, honest communication", "Says things clearly and honestly, so people know where they stand."],
      ["loyal", "I'm loyal to the people and places I work with", "Loyalty", "Committed to the team and the organisation, and sticks with them."],
      ["at-ease", "I'm easy to talk to and good at putting people at ease", "Putting people at ease", "Friendly and approachable with customers and colleagues alike."],
      ["empathy", "I notice how other people are feeling", "Empathy", "Picks up on how people are feeling and responds with care."],
      ["explain", "I'm good at explaining things simply", "Explaining things clearly", "Turns complicated information into plain, simple steps."],
      ["teach", "I enjoy helping and teaching other people", "Training and supporting others", "Enjoys showing others how to do things and helping them improve."],
      ["team", "I enjoy being part of a team", "Teamwork", "Works well alongside others and pulls their weight."],
      ["own", "I'm happy working on my own", "Working independently", "Gets on with the job without needing close supervision."],
      ["persuade", "I'm good at persuading people or selling", "Persuasion and sales", "Builds a good case and brings people round to it."],
      ["fair", "I care a lot about fairness and doing the right thing", "Strong sense of fairness", "Treats people fairly and does the right thing, even when it's hard."],
    ],
  },
  {
    id: "doing", title: "How you get things done",
    items: [
      ["reliable", "I turn up when I say I will, and I'm on time", "Reliability", "Dependable, punctual and does what they say they'll do."],
      ["brief", "Give me clear instructions and I'll get on with it", "Works well from a clear brief", "Takes clear instructions and gets the job done without fuss."],
      ["hands-on", "I'm practical and like hands-on work", "Practical and hands-on", "Learns by doing and is happiest getting stuck in."],
      ["organised", "I use lists, plans and systems to stay organised", "Organisation", "Uses plans, lists and systems to keep on top of the work."],
      ["initiative", "I'm quick to start and like to get stuck in", "Taking the initiative", "Spots what needs doing and gets on with it."],
      ["persist", "I keep going until a problem is solved", "Determination", "Sticks with problems until they're solved."],
      ["trusted", "I can be trusted with money, keys or private information", "Trustworthy", "Can be relied on with cash, keys and confidential information."],
      ["speak-up", "If something isn't right, I say so", "Speaks up about problems", "Raises problems and risks early so they can be put right."],
    ],
  },
  {
    id: "pressure", title: "How you handle pressure and change",
    items: [
      ["crisis", "I stay calm when things go wrong", "Calm under pressure", "Keeps a clear head and acts quickly when things go wrong."],
      ["difficult", "I can stay calm with upset or difficult people", "Handling difficult situations", "Deals calmly and fairly with complaints and difficult conversations."],
      ["adapt", "I adapt quickly when plans change", "Adaptability", "Adjusts quickly when plans, priorities or rotas change."],
      ["new-things", "I'm happy to try new things and new ways of working", "Open to new approaches", "Willing to try new methods and learn from what works."],
      ["bounce", "I bounce back from setbacks", "Resilience", "Learns from setbacks and keeps going."],
    ],
  },
  {
    id: "drive", title: "What drives you",
    items: [
      ["energy", "I throw myself into work I care about", "Energy and enthusiasm", "Brings energy and commitment to the work."],
      ["pride", "I care about doing a job I'm proud of", "Pride in the work", "Takes ownership of their work and cares about the result."],
      ["learner", "I'm always learning something new", "Keen to learn", "Picks up new skills quickly and keeps learning."],
      ["customers", "I like making someone's day better", "Customer focus", "Goes out of their way to give people a good experience."],
      ["purpose", "I work best when I can see why a job matters", "Driven by purpose", "Most motivated when they can see the difference the work makes."],
    ],
  },
];

const ALL = [];
for (const g of GROUPS) for (const [id, tick, title, line] of g.items) ALL.push({ id, group: g.id, tick, title, line });
const BY_ID = new Map(ALL.map((b) => [b.id, b]));

// For the page: the groups and their tick boxes (no CV wording needed there).
const catalogue = () => GROUPS.map((g) => ({ id: g.id, title: g.title, items: g.items.map(([id, tick, title]) => ({ id, tick, title })) }));

// Keep only real ids, in list order, no repeats.
const clean = (ids) => {
  const want = new Set((Array.isArray(ids) ? ids : []).map(String));
  return ALL.filter((b) => want.has(b.id)).map((b) => b.id);
};

// The CV skills rows for the ticked behaviours.
const toSkills = (ids) => clean(ids).map((id) => ({ skill: BY_ID.get(id).title, proof: BY_ID.get(id).line }));

module.exports = { GROUPS, ALL, catalogue, clean, toSkills };
