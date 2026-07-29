// The Section 8 "explicit AI self-review pass" for the checks that need
// judgement rather than regex: voice, honesty, overstatement, tailoring.
const { askJSON, hasKey } = require("./anthropic");

async function selfReview(cv, { advertText }) {
  if (!hasKey()) return { notes: [], soundsHuman: null };
  return askJSON({
    system:
      "You are the final self-review before a CV is delivered. Judge only what needs judgement. Be honest, not flattering.",
    prompt: `Check the CV against these and report:
- Does it read like the candidate explaining their own work to a person, not a press release?
- Does anything overstate the candidate's actual skill level?
- Does the specific company/role/job language actually appear where relevant (tailored, not generic)?

Return JSON:
{"soundsHuman":true|false,"tailored":true|false,"overstatements":[""],"pressReleaseLines":[""],"notes":[""]}

JOB ADVERT (for tailoring check):
"""${(advertText || "").slice(0, 4000)}"""

CV JSON:
"""${JSON.stringify(cv).slice(0, 9000)}"""`,
    maxTokens: 1500
  });
}

module.exports = { selfReview };
