// Realistic fake CV used for render-testing every design (Section 12). Every
// figure here is internally consistent so the fabrication checker can be
// validated against it too.
module.exports = {
  header: {
    name: "Jordan Ellis", targetRole: "Senior Account Manager",
    contacts: { email: "jordan.ellis@example.com", phone: "+44 7700 900123", location: "Manchester, UK" },
    linkedin: "linkedin.com/in/jordanellis", portfolio: null, github: null, introVideo: null
  },
  personalStatement:
    "I got into account management running events for a family catering firm, and I still think the job starts with knowing one client properly. Twelve years on I lead enterprise relationships and I do my best work in honest teams that say what they mean.",
  skills: [
    { skill: "Enterprise account management", proof: "Held the top three regional accounts for four years with full retention and a 22% average year on year spend uplift." },
    { skill: "Onboarding design", proof: "Rebuilt the client onboarding journey that cut churn from 18% to 9% in a single year." },
    { skill: "Salesforce", proof: "Daily user since 2019; trained two cohorts of new starters on it." },
    { skill: "Inclusive hiring", proof: "Ran the blind shortlisting rollout that doubled diversity at interview stage in 12 months." }
  ],
  experience: [
    { company: "Bright Northern Ltd", title: "Senior Account Manager", dates: "2022 to now", location: "Manchester",
      responsibilities: ["Lead a portfolio of 14 enterprise accounts across the UK and Ireland.", "Own quarterly business reviews, renewal forecasting and growth planning."],
      achievements: ["Grew portfolio revenue by £1.4m in two years.", "Built the QBR template now used company wide."], reasonForLeaving: null },
    { company: "Halton Group", title: "Account Manager", dates: "2020 to 2022", location: "Leeds",
      responsibilities: ["Managed 30 SME accounts and a junior coordinator."],
      achievements: ["Cut churn from 18% to 9% by redesigning onboarding."], reasonForLeaving: "Promotion at Bright Northern." }
  ],
  interests: ["Restoring a 1978 Vespa", "Coaching under-11s football on Saturdays", "Long distance trail running", "Baking sourdough, badly but persistently"],
  education: [
    { qualification: "BA History", institution: "University of Leeds", dates: "2008 to 2011", grade: "2:1" },
    { qualification: "Salesforce Administrator certification", institution: "Salesforce", dates: "2020", grade: "" }
  ],
  skillsMatch: [
    { requirement: "5+ years managing enterprise client relationships", proof: "7 years across two firms; current portfolio worth £4.2m." },
    { requirement: "Experience designing onboarding journeys", proof: "Built the onboarding flow that cut churn from 18% to 9% at Halton Group." },
    { requirement: "Working knowledge of Salesforce", proof: "Daily user since 2019; trained two cohorts on it." },
    { requirement: "Commitment to EDI in commercial settings", proof: "Led blind shortlisting; doubled interview-stage diversity in 12 months." }
  ],
  missing: []
};
