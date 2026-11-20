// The three ways into the CV builder: Create your 1st CV, Update your CV and
// Back to work. One builder, three sets of questions, tips and guide links.
//
// Everything people read about each journey lives here, so the page and the
// "write it up" step always agree. The page gets this through GET /api/master.
//
// Questions marked private are kept in the person's account for their own use
// and are never put on the CV or sent to the AI.

const GUIDE = "https://the-common-people.com/guide-cv.html";

// The seven builder steps. Each journey picks its own order.
const STEP_KEYS = ["about", "story", "strengths", "experience", "education", "interests", "download", "video"];
const VIDEO_GUIDE = "https://the-common-people.com/guide-video-intro.html";

// "From the guide" cards: one line from The CV That Gets Read and a link to
// the stop it comes from. Journeys can swap in their own line.
const GUIDE_CARDS = {
  about: { stop: "Stop 1", title: "Name. Contact. Easy to reach.", line: "Recruiters shouldn't have to hunt for how to contact you. Only add LinkedIn if it really reflects who you are.", url: GUIDE + "#stop-1" },
  story: { stop: "Stop 2", title: "Be a person, not a press release.", line: "A bit of your story, what you care about, where you do your best work and one real thing your life revolves around.", url: GUIDE + "#stop-2" },
  strengths: { stop: "Stop 3", title: "A scannable list. With receipts.", line: "Name the skill, then one punchy line that proves it: what you did, and what came of it.", url: GUIDE + "#stop-3" },
  experience: { stop: "Stop 4", title: "Tell the whole story.", line: "Latest first. What you did, then what came of it underneath. Always say why you left.", url: GUIDE + "#stop-4" },
  education: { stop: "Stop 6", title: "Don't be vague.", line: "Where, what, when and, if they're good, what you got. Vague education sections suggest you've something to hide.", url: GUIDE + "#stop-6" },
  interests: { stop: "Stop 5", title: "Underrated. Powerful.", line: "Interests are how a stranger finds a reason to like you before they've met you. Be specific and be real.", url: GUIDE + "#stop-5" },
  download: { stop: "Stop 7", title: "Hand them the answer key.", line: "For each job you really want, line your CV up against the advert. Tailor it for a job does that with you.", url: GUIDE + "#stop-7" },
  video: { stop: "Field Guide N\u00b002", title: "A person, then proof, then a promise.", line: "Open as a real person, tell two short work stories, close on what you stand for. Aim for 90 seconds. Two minutes is the ceiling.", url: VIDEO_GUIDE + "#route", linkText: "Read The 90 Seconds That Get You In The Room" },
};

// "Your 90 seconds": the four things you say, with the time each gets, from
// Field Guide N\u00b002. People get talking notes, never a script to read out.
const VIDEO_PARTS = [
  { id: "intro", title: "The intro, as a person", time: "15 to 25 seconds", from: 0, to: 20,
    putIn: "Your name, the role and the company, once. One line on how you got here. When you're at your best. One real, specific thing from outside work.",
    leaveOut: "\"I'm passionate about\". Saying sorry for sending a video. Every job you've ever had.",
    placeholder: "Hi, I'm (name), applying for (role)\nGot into it through...\nAt my best when...\nOutside work..." },
  { id: "story1", title: "Story one", time: "20 to 30 seconds", from: 20, to: 45,
    putIn: "Four lines: what was going on, what fell to you, what you did, what changed. A number if you have one. Say where it was.",
    leaveOut: "\"I'm a strong communicator\": show it, don't claim it. Jargon. Vague words like helped or worked on.",
    placeholder: "Where: \nWhat was going on: \nWhat I did: \nWhat changed: " },
  { id: "story2", title: "Story two", time: "20 to 30 seconds", from: 45, to: 70,
    putIn: "The same four lines, with a different skill on show. One line on why it matters for this job.",
    leaveOut: "A near copy of story one. A story with no result. A third story: two is the limit.",
    placeholder: "Where: \nWhat was going on: \nWhat I did: \nWhat changed: " },
  { id: "close", title: "The close, your values", time: "15 to 20 seconds", from: 70, to: 90,
    putIn: "Two or three things you'd bring, said as actions: \"tells the truth when it's awkward\", not \"honesty\". Then: CV attached, happy to chat. Wish them luck with the shortlist.",
    leaveOut: "\"I'm a team player\". \"I look forward to hearing from you\". A list of five value words.",
    placeholder: "You'd get someone who...\nWho...\nCV attached, happy to chat any time" },
];

// Before you press record. The safety ones apply to everyone, whatever their age.
const VIDEO_CHECKS = [
  { id: "landscape", group: "record", text: "Phone turned sideways (landscape)" },
  { id: "length", group: "record", text: "Aiming for 90 seconds, and definitely under two minutes" },
  { id: "notes", group: "record", text: "Notes put away: I'm telling it, not reading it" },
  { id: "energy", group: "record", text: "A smile before I press record, and a bit more energy than feels natural" },
  { id: "dressed", group: "record", text: "Dressed the way I would for the interview" },
  { id: "steady", group: "record", text: "Camera steady, at eye level, and I'm looking at the lens" },
  { id: "light", group: "record", text: "Facing the window or a lamp, with no bright light behind me" },
  { id: "quiet", group: "record", text: "Quiet room, door shut, phone on silent somewhere else" },
  { id: "takes", group: "record", text: "Three takes, then I pick the best" },
  { id: "where", group: "safe", text: "Nothing in shot that shows where I live or study: no uniform or badge, no street signs, no house number" },
  { id: "personal", group: "safe", text: "No address, date of birth or anything personal the job doesn't need" },
  { id: "unlisted", group: "safe", text: "Uploaded as Unlisted, not Public, so only people with the link can see it" },
  { id: "adult", group: "safe", text: "Under 18? A parent, carer, teacher or tutor has watched it with me before I send it" },
];

const BASE_INTERESTS = ["Coaching a kids' sports team", "Volunteering at a food bank", "Running, the gym or swimming", "Playing or making music", "Going to gigs and festivals", "Walking the dog", "Fixing or making things", "Reading crime novels", "Drawing, painting or photography", "Growing veg on the allotment", "Fundraising for a local charity", "Cooking for family and friends", "Learning a language", "Cycling at weekends"];

const JOURNEYS = {
  first: {
    id: "first",
    name: "Create your 1st CV",
    who: "At school, college or uni, or writing a CV for the very first time.",
    card: "No experience? No problem. We'll ask about your studies, Saturday jobs, clubs and the things you love, and show you what counts.",
    hero: { kicker: "Your 1st CV", title: "Let's build your first CV.", lede: "No experience? No problem. Talk or type your answers, tick what sounds like you, and watch your CV build itself as you go. It saves as you work, and only you can see it." },
    order: ["about", "story", "strengths", "education", "experience", "interests", "download", "video"],
    labels: { experience: "Experience", education: "Education" },
    upload: { lead: false, title: "Got a CV from school or college?", text: "Maybe from a careers lesson, or one a teacher helped with. Pop it in and we'll fill in what we can, then help you make it sound like you." },
    tips: {
      story: "This is the first thing they read about you. Answer the questions in your own words. School, college, Saturday jobs, caring for someone, sport, clubs and the things you love all count.",
      experience: "No paid work yet? That's fine. Saturday jobs, babysitting, work experience, volunteering, helping in a family business, running a club or a big project at school all count. \"Organised a bake sale that raised £240 for the hospice\" is real experience.",
      education: "On a first CV, this is where you make your case, so use it. Put what you're studying now first, with \"Expected\" and the date if you haven't finished.",
    },
    counts: true,
    video: "A short video puts you in front of the employer before they've even opened your CV. On a first job application, almost nobody does this, so it really stands out.",
    statementBrief: "This person is writing their FIRST CV: a school, college or university student, or someone with little or no paid work. School, college, Saturday jobs, caring, sport, clubs, volunteering and hobbies all count. Never apologise for a lack of experience. Lead with what they're studying or doing now and what they enjoy.",
    interests: ["Playing football for a local team", "Gaming with friends online", "Making videos or content", "Playing or making music", "Drawing, painting or photography", "Cooking for family and friends", "Running, the gym or swimming", "Volunteering at a food bank", "Looking after my dog", "Fixing or making things", "Going to gigs and festivals", "Cadets, Scouts or Guides", "Duke of Edinburgh Award", "Learning a language"],
    questions: [
      { id: "study", title: "What are you studying right now, and which bit do you actually enjoy?",
        think: "School, college, uni, an apprenticeship or a course. Say what you're doing and the part that gets you interested.",
        ideas: ["GCSEs, A levels, a BTEC or T Level", "A college course or apprenticeship", "A degree, and the module you liked most", "The practical bits, the people, the problem solving"],
        starters: ["Right now I'm studying", "The bit I enjoy most is", "I'm in my final year of"],
        example: "Right now I'm studying for my Level 3 in hospitality, and the bit I enjoy most is service, when it's busy and everyone's working together." },
      { id: "earned", title: "Have you ever earned money or helped out?",
        think: "A Saturday job, babysitting, a paper round, the family business, helping a neighbour. All of it counts.",
        ideas: ["A Saturday or holiday job", "Babysitting or dog walking", "Helping in a family business", "Work experience or a placement", "Looking after a relative"],
        starters: ["I've worked", "On Saturdays I", "I help out at"],
        example: "I've worked Saturdays at my uncle's café for a year, serving customers and cashing up at the end of the day." },
      { id: "free", title: "What do you do when you're not studying?",
        think: "Sport, music, gaming, clubs, cadets, volunteering, looking after someone at home. The real stuff.",
        ideas: ["A team or a sport", "Music, art, making videos", "Clubs, cadets, Scouts or Guides", "Volunteering", "Looking after brothers, sisters or grandparents"],
        starters: ["Outside college, I", "Most weekends you'll find me", "I'm part of"],
        example: "Most weekends you'll find me playing five-a-side or helping my mum look after my little brother." },
      { id: "proud", title: "Tell us about something you organised, made or stuck at.",
        think: "Something you did, made, fixed, organised or kept going with, even when it was hard.",
        ideas: ["A school event, show or fundraiser", "A project you're proud of", "Learning an instrument or a skill", "Exams you got through while juggling other things", "Raising money for a cause"],
        starters: ["I'm proud that I", "I organised", "I stuck with"],
        example: "I'm proud that I kept my grades up while working Saturdays and helping look after my nan." },
      { id: "others", title: "Who'd say you're good to have around, and why?",
        think: "A teacher, coach, manager or friend. What would they say about you, in your own words?",
        ideas: ["A teacher who'd say you work hard", "A coach who'd say you never give up", "A manager who'd say you're reliable", "Friends who'd say you're the organiser"],
        starters: ["My manager would say", "My teacher would tell you", "People say I'm"],
        example: "My manager would say I'm the one who turns up early and never needs telling twice." },
      { id: "care", title: "What matters to you?",
        think: "How you treat people, what you'd stand up for, what annoys you when it's done badly.",
        ideas: ["Doing a job properly, even when nobody's checking", "Being kind to customers, or to the new person", "Honesty, fairness, turning up when you say you will", "Making someone's day a bit better"],
        starters: ["I care about", "What matters most to me is", "I believe"],
        example: "I care about doing things properly, even when nobody's checking." },
      { id: "best", title: "Where do you do your best work?",
        think: "The kind of place and people that bring out your best, and how you like to be managed.",
        ideas: ["Busy and buzzing, or calm and steady", "In a team, or getting on with it on your own", "Clear instructions, or freedom to work it out", "Indoors, outdoors, on your feet, with people, with things"],
        starters: ["I do my best work", "I work best with a manager who", "I'm happiest when"],
        example: "I do my best work in a busy team where everyone mucks in, with a manager who tells it straight." },
      { id: "next", title: "What do you want next?",
        think: "Your first job, an apprenticeship, uni, or \"not sure yet, but I'd like to try...\". All good answers.",
        ideas: ["Your first job in a particular kind of place", "An apprenticeship so you can earn and learn", "A part-time job alongside your studies", "Trying something new and finding out what you're good at"],
        starters: ["Next, I want to", "I'm looking for my first job in", "I'd love an apprenticeship in"],
        example: "I'm looking for my first job in a kitchen where I can learn from good chefs." },
    ],
  },

  update: {
    id: "update",
    name: "Update your CV",
    who: "In work or recently out of it, and looking for your next role.",
    card: "Bring the CV you've got. We'll show you what's working, then help you turn a list of duties into a list of results.",
    hero: { kicker: "Update your CV", title: "Let's make your CV work harder.", lede: "Upload the CV you've got and see what's working and what isn't. Then talk or type, turn duties into results, and watch it improve as you go. It saves as you work, and only you can see it." },
    order: ["about", "story", "strengths", "experience", "education", "interests", "download", "video"],
    labels: { experience: "Career history", education: "Education" },
    upload: { lead: true, title: "Start with the CV you've got", text: "Upload it as Word or PDF. We'll fill in the builder for you, check it against the seven stops in The CV That Gets Read, and show you what to fix first." },
    tips: {
      story: "This is the first thing they read about you. If it reads like everyone else's, it gets skimmed. Answer the questions in your own words and let it sound like you.",
      experience: "Latest first. For each role, say what you did, then what came of it underneath: what got better, what you were trusted with, what you'd point to. Give a reason for leaving every role you've left. Roughly ten years of detail is enough: older roles can be one line.",
      education: "The further into your career you are, the smaller this gets. Three lines is fine. Add training and certificates that matter for the jobs you want.",
    },
    video: "A short video puts you in front of the hiring manager before the rest of your application has loaded. If you can do this well, you're ahead of most of the field.",
    statementBrief: "This person is an experienced job seeker updating their CV for their next role. Lead with what they do now and what they're known for, include a real result they told you about, and say what they want next. Never repeat a list of duties.",
    interests: BASE_INTERESTS,
    questions: [
      { id: "now", title: "What do you do now, and what are you known for?",
        think: "Your job in plain words, the way you'd explain it down the pub, and the thing people come to you for.",
        ideas: ["Your current or most recent role", "The thing colleagues ask you to sort out", "How long you've been doing this kind of work"],
        starters: ["I'm a", "I've spent the last", "People come to me when"],
        example: "I'm a team leader in a busy contact centre, and people come to me when a complaint needs sorting properly." },
      { id: "achieved", title: "What have you achieved, rather than what were you responsible for?",
        think: "Something that got better because of you. What was it like before you started, and what was it like after?",
        ideas: ["Something faster, cheaper, safer or better", "A team you built or a person you brought on", "A customer, client or project you turned round", "Something you were trusted with"],
        starters: ["Before I started,", "I turned round", "I'm proud that I"],
        example: "Before I started, new starters took two months to get up to speed. I wrote a simple training plan and now it takes three weeks." },
      { id: "fixed", title: "What problem have you fixed that you're proud of?",
        think: "A mess you sorted, a process you made better, a difficult situation you handled. Who noticed?",
        ideas: ["A process that kept going wrong", "A complaint or a difficult customer", "A deadline that looked impossible", "A team that wasn't working well"],
        starters: ["We had a problem with", "I noticed that", "When it all went wrong,"],
        example: "We kept losing bookings because of double entries, so I set up one shared diary and the problem stopped." },
      { id: "moving", title: "Why are you moving on?",
        think: "Always give a reason. If you don't, the reader makes one up, and it usually isn't kind. Keep it short and honest.",
        ideas: ["Looking for a step up", "The contract or project is ending", "Redundancy or a restructure", "Moving area", "Wanting different hours or a new direction"],
        starters: ["I'm looking for", "My contract ends", "I'm ready for"],
        example: "I'm ready for a step up to managing a team of my own." },
      { id: "next", title: "What kind of role do you want next, and what would you rather leave behind?",
        think: "This decides what you lead with. Be as specific as you can about the work, the place and the people.",
        ideas: ["The job title you're after", "More or less responsibility", "A different sector or setting", "The part of your job you'd happily never do again"],
        starters: ["Next, I want", "I'm looking for a role where", "I'd like to do more"],
        example: "I'm looking for an operations role where I can fix how things work, with less time on reports." },
      { id: "care", title: "What matters to you in how you work?",
        think: "How you treat people, what you won't compromise on, what annoys you when it's done badly.",
        ideas: ["Doing it properly first time", "Being straight with people", "Looking after the team", "Customers getting a fair deal"],
        starters: ["I care about", "I won't", "What matters most to me is"],
        example: "I care about being straight with people, even when the news isn't good." },
      { id: "best", title: "Where do you do your best work?",
        think: "The kind of place and people that bring out your best, and how you like to manage or be managed.",
        ideas: ["Busy and fast, or calm and planned", "Leading, or being a strong part of a team", "A manager who trusts you, or one who's hands-on", "Honest, informal, structured"],
        starters: ["I do my best work", "I work best with", "I manage people by"],
        example: "I do my best work in honest teams where people say what they think." },
      { id: "real", title: "The real you: what does your life revolve around?",
        think: "One real, specific thing. It makes you memorable, and it's often what an interviewer asks about first.",
        ideas: ["Your dog, your allotment, your football team", "A sport you play or coach", "Family, cooking, music", "A cause you volunteer for"],
        starters: ["Outside work,", "Most weekends you'll find me", "My life revolves around"],
        example: "Outside work, my border collie thinks I should walk her more." },
    ],
  },

  back: {
    id: "back",
    name: "Back to work",
    who: "Coming back after time away: family, caring, health, redundancy or a long search.",
    card: "Time away doesn't wipe out what you can do. We'll help you tell the story honestly, gap and all, in your own words and at your own pace.",
    hero: { kicker: "Back to work", title: "Let's get you back in.", lede: "Time away doesn't wipe out what you can do. Tell us about life before the break and what filled it, in your own words, and we'll help you put it on the page honestly. Take your time: it saves as you go." },
    order: ["about", "story", "strengths", "experience", "education", "interests", "download", "video"],
    labels: { experience: "Experience", education: "Education" },
    upload: { lead: false, title: "Dig out your old CV", text: "However old it is. We'll bring it into the builder so you're not starting from a blank page, then help you bring it up to date." },
    tips: {
      story: "Gaps feel bigger to you than they do to anyone reading. Answer in your own words, and only share what you're happy to. Running a home, caring for someone and volunteering all count.",
      experience: "Add your career break as an entry of its own, in the right place on the timeline, with a short honest line about what filled it. You choose how much to say. Then add the jobs before it, latest first.",
      education: "Add anything you've learned during your break: courses, certificates, online learning. Older qualifications can be one line each.",
    },
    breaks: true,
    video: "A short video lets them meet you, your energy and your experience, before they've looked at the dates on your CV.",
    statementBrief: "This person is RETURNING to work after time away (for example raising a family, caring, health, redundancy or a long job search). Lead with what they did before and what they're known for, mention the break briefly and positively only in the words they used, include what they did or learned during it if they told you, and say what they want now. Never explain the reason for the break beyond what they said. Never apologise for it.",
    interests: BASE_INTERESTS.concat(["School PTA or governors", "Running a book club"]),
    questions: [
      { id: "before", title: "What did you do before your break, and what were you known for?",
        think: "Your last few roles, and the thing people came to you for. What would your old manager say you were best at?",
        ideas: ["Your job title and the kind of place", "What colleagues relied on you for", "Something you were trusted with"],
        starters: ["Before my break, I", "I spent", "My old manager would say"],
        example: "Before my break, I spent eight years in office management, and I was the one who kept everything running." },
      { id: "away", title: "How would you like to describe your time away?",
        think: "You choose how much to say. A short, honest line is all a CV needs. Tap one to start, or say it your own way.",
        ideas: ["Raising a family", "Caring for someone", "Taking time out for my health", "After being made redundant", "Travel or study", "Keeping it brief: a career break"],
        starters: ["I took time out to raise my family", "I spent time caring for", "I took a career break to", "After being made redundant, I"],
        example: "I took four years out to raise my two children." },
      { id: "proud", title: "What have you done in that time that you're proud of?",
        think: "Running a busy home, the school PTA, a fundraiser, volunteering, a course, helping a friend's business, getting through something hard.",
        ideas: ["Organising events or fundraisers", "Volunteering or helping a charity", "Managing a household budget", "Caring for someone with complex needs", "Helping out in a friend's business"],
        starters: ["During my break, I", "I'm proud that I", "I ran"],
        example: "During my break, I ran the school's summer fair two years running and doubled the money it raised." },
      { id: "learned", title: "What have you learned or kept up with?",
        think: "Courses, new tools, reading about your old field, skills you've picked up along the way.",
        ideas: ["An online course or qualification", "New software or apps you use now", "Keeping in touch with your old industry", "Something completely new"],
        starters: ["I've kept up with", "I've recently learned", "I've taken a course in"],
        example: "I've kept up with bookkeeping by doing the accounts for my partner's business." },
      { id: "care", title: "What matters to you?",
        think: "How you treat people, what you'd stand up for, what you've learned about yourself.",
        ideas: ["Doing a job properly", "Being someone people can rely on", "Treating people fairly", "Getting things organised"],
        starters: ["I care about", "What matters most to me is", "I've learned that"],
        example: "I care about being someone people can rely on." },
      { id: "next", title: "What's bringing you back now, and what are you looking for?",
        think: "The kind of work you want, and the kind of place. \"Getting back to what I'm good at\" is a fine answer.",
        ideas: ["Getting back to the work you love", "Trying something new", "A role that uses what you learned during your break", "A friendly team to come back to"],
        starters: ["I'm ready to", "I'm looking for", "Now the children are at school, I"],
        example: "I'm ready to get back to office management in a friendly team where I can get stuck in." },
      { id: "real", title: "The real you: what does your life revolve around?",
        think: "One real, specific thing. It makes you memorable, and it's often what an interviewer asks about first.",
        ideas: ["Your family, your dog, your allotment", "A sport you play or coach", "A cause you volunteer for", "Cooking, music, walking"],
        starters: ["Outside work,", "Most weekends you'll find me", "My life revolves around"],
        example: "Most weekends you'll find me on the touchline at my son's football." },
      { id: "needs", private: true, title: "What would make the right job work for you?",
        think: "Hours, location, flexibility. This one is just for you: it's kept in your account and never goes on your CV. Keep it handy when you look at adverts and talk to employers.",
        ideas: ["School hours or part time", "Working from home some days", "Somewhere close to home", "Flexibility for appointments"],
        starters: ["I'm looking for", "I need", "Ideally"],
        example: "Ideally school hours, within 20 minutes of home." },
    ],
  },
};

const IDS = Object.keys(JOURNEYS);
const isJourney = (id) => IDS.includes(id);

// Every question id across all journeys (plus the older ones, so nothing anyone
// has already written is ever lost).
const ANSWER_KEYS = [...new Set(["story", "proud", "care", "best", "next", "real", ...IDS.flatMap((j) => JOURNEYS[j].questions.map((q) => q.id))])];

// The question titles, for the "write it up" step. Private ones are left out.
function labelsFor(journey) {
  const j = JOURNEYS[journey] || JOURNEYS.first;
  const out = {};
  for (const q of j.questions) if (!q.private) out[q.id] = q.title;
  // Older answers from before the journeys still count.
  const OLD = { story: "Your story so far", proud: "What you're proud of", care: "What matters to you", best: "Where you do your best work", next: "What you want next", real: "The real you" };
  for (const k of Object.keys(OLD)) if (!out[k] && !j.questions.some((q) => q.id === k)) out[k] = OLD[k];
  return out;
}
const privateKeys = (journey) => (JOURNEYS[journey] || JOURNEYS.first).questions.filter((q) => q.private).map((q) => q.id);

// What the page needs.
function forPage() {
  return { steps: STEP_KEYS, guide: GUIDE_CARDS, journeys: IDS.map((id) => JOURNEYS[id]), video: { parts: VIDEO_PARTS, checks: VIDEO_CHECKS } };
}

module.exports = { JOURNEYS, IDS, isJourney, ANSWER_KEYS, STEP_KEYS, GUIDE_CARDS, VIDEO_PARTS, VIDEO_CHECKS, labelsFor, privateKeys, forPage };
