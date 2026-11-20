// Test-only mock model. Activated with MOCK_MODEL=1 so the FULL pipeline and
// server can be exercised end-to-end without a live API key or network. It
// returns realistic structured responses keyed off the calling system prompt.
// It deliberately plants a fabrication (an unclaimed skill + an invented "30%"
// metric) on the first generation so the Section 9 gate can be shown catching
// it, then returns a clean CV once the candidate has resolved the flag.

function respond({ system = "", prompt = "" }) {
  const s = system.toLowerCase();

  if (s.includes("gap-detection pass")) {
    return {
      requirements: [
        { requirement: "5+ years managing enterprise client relationships", advertLanguage: "enterprise client relationships", status: "covered", evidenceInCV: "Senior Account Manager, 14 enterprise accounts", why: "Clearly evidenced." },
        { requirement: "Working knowledge of Salesforce", advertLanguage: "Salesforce", status: "covered", evidenceInCV: "Daily Salesforce user since 2019", why: "Stated in CV." },
        { requirement: "Experience designing onboarding journeys", advertLanguage: "onboarding journeys", status: "thin", evidenceInCV: "Cut churn by redesigning onboarding", why: "Mentioned but not framed as onboarding design." },
        { requirement: "Fluent French for the Paris office", advertLanguage: "fluent French", status: "missing", evidenceInCV: null, why: "No evidence of French." }
      ]
    };
  }

  if (s.includes("question pass")) {
    return {
      gapQuestions: [
        { id: "g1", requirement: "Experience designing onboarding journeys", question: "The advert asks for onboarding design. Was the churn work you did actually designing the onboarding journey, and what was the result?" },
        { id: "g2", requirement: "Fluent French", question: "The advert asks for fluent French. Do you speak French to a working level?" }
      ],
      sectionQuestions: [
        { id: "s_statement", section: "personal statement", question: "In your own words, how did you get into account management and what do you care about in it?" },
        { id: "s_interests", section: "interests", question: "Three to six specific things you do outside work?" }
      ]
    };
  }

  if (s.includes("index a candidate")) {
    return {
      employers: ["Bright Northern Ltd", "Halton Group"],
      titles: ["Senior Account Manager", "Account Manager"],
      dates: ["2022 to now", "2020 to 2022"],
      qualifications: ["BA History", "Salesforce Administrator certification"],
      skills: ["enterprise account management", "onboarding", "Salesforce", "inclusive hiring"]
    };
  }

  if (s.includes("assembling the final cv")) {
    // Has the candidate resolved the planted fabrication? We detect the
    // resolving answer ("no french" / "18%") in the prompt's Q&A block.
    // Markers a candidate would type when resolving the French flag. Chosen so
    // they do NOT appear in the source CV (which contains "18%").
    const resolved = /don't speak french|do not speak french|leave it out|no, i don't|drop the french/i.test(prompt);
    const cv = {
      header: { name: "Jordan Ellis", targetRole: "Senior Account Manager", contacts: { email: "jordan.ellis@example.com", phone: "+44 7700 900123", location: "Manchester, UK" }, linkedin: null, portfolio: null, github: null, introVideo: null },
      personalStatement: "I got into account management running events for a family catering firm, and I still think the job starts with knowing one client properly. Twelve years on I lead enterprise relationships and I do my best work in honest teams.",
      skills: [
        { skill: "Enterprise account management", proof: "Held the top three regional accounts for four years with full retention." },
        { skill: "Onboarding design", proof: "Rebuilt the client onboarding journey that cut churn from 18% to 9% in a year." },
        { skill: "Salesforce", proof: "Daily user since 2019; trained two cohorts of new starters." }
      ],
      experience: [
        { company: "Bright Northern Ltd", title: "Senior Account Manager", dates: "2022 to now", location: "Manchester", responsibilities: ["Lead a portfolio of 14 enterprise accounts across the UK and Ireland.", "Own quarterly business reviews and renewal forecasting."], achievements: ["Grew portfolio revenue by £1.4m in two years.", "Built the QBR template now used company wide."], reasonForLeaving: null },
        { company: "Halton Group", title: "Account Manager", dates: "2020 to 2022", location: "Leeds", responsibilities: ["Managed 30 SME accounts and a junior coordinator."], achievements: ["Cut churn from 18% to 9% by redesigning onboarding."], reasonForLeaving: "Promotion at Bright Northern." }
      ],
      interests: ["Restoring a 1978 Vespa", "Coaching under-11s football on Saturdays", "Long distance trail running"],
      education: [
        { qualification: "BA History", institution: "University of Leeds", dates: "2008 to 2011", grade: "2:1" },
        { qualification: "Salesforce Administrator certification", institution: "Salesforce", dates: "2020", grade: "" }
      ],
      skillsMatch: [
        { requirement: "5+ years managing enterprise client relationships", proof: "Twelve years across two firms; portfolio of 14 enterprise accounts worth £1.4m." },
        { requirement: "Working knowledge of Salesforce", proof: "Daily user since 2019; trained two cohorts." },
        { requirement: "Experience designing onboarding journeys", proof: "Rebuilt onboarding at Halton Group, cut churn from 18% to 9%." }
      ],
      missing: []
    };
    if (!resolved) {
      // PLANTED FABRICATIONS (not in source): an invented metric + unclaimed skill.
      cv.skills.push({ skill: "Fluent French", proof: "Negotiated contracts with the Paris office." });
      cv.personalStatement = cv.personalStatement.replace("honest teams.", "honest teams, and I increased sales by 30% last year.");
    }
    return cv;
  }

  if (s.includes("fabrication auditor")) {
    // Only inspect the GENERATED CV portion, never the source-of-truth block
    // (which may legitimately mention French in the candidate's own answer).
    const genPart = prompt.split(/GENERATED CV/i).pop() || "";
    const flags = [];
    if (/fluent french/i.test(genPart)) flags.push({ kind: "skill", location: "skills", text: "Fluent French", why: "No French anywhere in the source material." });
    return { flags };
  }

  if (s.includes("master cv writer's statement pass")) {
    const said = (prompt.split("WHAT THEY TOLD US:")[1] || "").split("\n").map((l) => l.replace(/^[^:]+:\s*/, "").trim()).filter(Boolean);
    return { statement: said.slice(0, 4).map((l) => l.replace(/[.!?]?$/, ".")).join(" ") };
  }
  if (s.includes("master cv writer's job pass")) {
    const own = ((prompt.match(/In their own words: (.*)/) || [])[1] || "").split(/,|\band\b|\./).map((x) => x.trim()).filter(Boolean);
    return { responsibilities: own.slice(0, 4).map((x) => x.charAt(0).toUpperCase() + x.slice(1)), achievements: [] };
  }

  if (s.includes("master cv import pass")) {
    // Matches the sample CV the tests upload (scripts/makeBuilderCv.js).
    return {
      personalStatement: "Office administrator with a passion for excellence and a proven track record of supporting busy teams.",
      experience: [
        { title: "Office Administrator", company: "Lea Valley Lettings", location: "Hertford", dates: "2016 to 2021", responsibilities: ["Managed the diary for six letting agents", "Answered phones and dealt with tenant queries", "Ordered stationery and supplies"], achievements: [], reasonForLeaving: "", kind: "" },
        { title: "Career break", company: "", location: "", dates: "2021 to 2025", responsibilities: ["Raising my two children"], achievements: [], reasonForLeaving: "", kind: "break" },
        { title: "Receptionist", company: "Hitchin Dental Practice", location: "Hitchin", dates: "2012 to 2016", responsibilities: ["Booked appointments", "Took payments"], achievements: ["Cut missed appointments by sending reminder texts"], reasonForLeaving: "", kind: "" },
      ],
      skills: [{ skill: "Microsoft Office", proof: "" }, { skill: "Customer service", proof: "" }],
      education: [{ qualification: "NVQ Level 2 in Business Administration", institution: "North Herts College", dates: "", grade: "" }],
      interests: ["Reading", "Walking"],
    };
  }
  if (s.includes("master cv follow-up pass")) {
    const ans = ((prompt.match(/THEIR ANSWER[^:]*: ([\s\S]*)$/) || [])[1] || "").trim();
    const first = ans.split(/[.!?]/)[0].trim().replace(/^I\b/, "You").replace(/\bmy\b/g, "your");
    return { heard: [first], followUp: "How many people did that help, and what changed because of you?" };
  }
  if (s.includes("master cv video plan pass")) {
    return {
      intro: ["Hi, I'm [NAME], applying for the role", "Got into it through my Saturday job", "At my best when it's busy", "Outside work: five-a-side on Sundays"],
      story1: ["Where: my uncle's cafe", "What was going on: busy Saturdays", "What I did: served customers and cashed up", "What changed: (what got better? a number if you have one)"],
      story2: ["Where: college", "What was going on: Level 3 in hospitality", "What I did: worked service on busy nights", "What changed: (what did you learn?)"],
      close: ["You'd get someone who turns up early", "Who does it properly when nobody's checking", "CV attached, happy to chat any time"],
    };
  }
  if (s.includes("master cv proof pass")) {
    const own = ((prompt.match(/What they told us: (.*)/) || [])[1] || "").trim();
    const line = own.replace(/^I\s+/i, "").replace(/[.!?]+$/, "");
    return { proof: line.charAt(0).toUpperCase() + line.slice(1) };
  }

  if (s.includes("final self-review")) {
    return { soundsHuman: true, tailored: true, overstatements: [], pressReleaseLines: [], notes: [] };
  }

  return {};
}

module.exports = { respond };
