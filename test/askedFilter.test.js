// Step 3 mustn't re-ask what step 2 already asked, or chase optional extras.
const test = require("node:test");
const assert = require("node:assert");
const { dropAlreadyAsked, askedAtStep2 } = require("../lib/askedFilter");

const st = { questions: {
  gapQuestions: [
    { id: "g1", requirement: "Forecasting in HubSpot", question: "The advert asks for forecasting in HubSpot - have you used HubSpot, even briefly, or is your forecasting experience all in Salesforce?" },
    { id: "g2", requirement: "SaaS experience", question: "Is Bright Northern or Halton Group a SaaS company, or a different industry? The advert is looking for SaaS background specifically." },
  ],
  sectionQuestions: [],
} };

test("questions already asked at step 2 aren't asked again at step 3", () => {
  const missing = [
    { item: "HubSpot", question: "The advert specifically asks for forecasting in HubSpot. Have you used HubSpot at all, even alongside Salesforce, or should we leave this as a gap?" },
    { item: "SaaS", question: "Have you worked in a software or SaaS company, or sold a software product, at any point?" },
  ];
  assert.deepEqual(dropAlreadyAsked(missing, askedAtStep2(st)), []);
});

test("optional extras (phone, interests, links) aren't chased", () => {
  const missing = [
    { item: "phone", question: "What's the best phone number to list on the CV?" },
    { item: "interests", question: "Could you give 3 to 6 real interests or activities outside work to include?" },
    { item: "LinkedIn", question: "Is your LinkedIn profile live?" },
  ];
  assert.deepEqual(dropAlreadyAsked(missing, []), []);
});

test("a genuinely new question still gets through", () => {
  const missing = [{ item: "title: Halton Group", question: "What was your job title at Halton Group?" }];
  assert.equal(dropAlreadyAsked(missing, askedAtStep2(st)).length, 1);
});
