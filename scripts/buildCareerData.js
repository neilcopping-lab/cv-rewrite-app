// Builds data/careers.json for Identify Your Options from Skills England (and O*NET).
// Run: SKILLS_ENGLAND_API_KEY=... node scripts/buildCareerData.js
require("dotenv").config();
require("../lib/options/careerData")
  .build()
  .then((d) => console.log(`Done: ${d.occupations.length} occupations saved.`))
  .catch((e) => { console.error(e.message); process.exit(1); });
