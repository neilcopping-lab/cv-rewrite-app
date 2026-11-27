// Beyond the Obvious: roles you might not have thought of.
//
// Inspired by Rachel, who asked how we could show people the career options
// that never come up in a general careers or recruiter chat, like arts-based
// knowledge translation or participatory creative health.
//
// The official Skills England data only covers occupations with an
// apprenticeship or technical standard, so lots of newer, smaller or
// cross-over roles are missing from it. This is a hand-checked library of them.
//
// Rules for this file (so it stays honest):
//   - Every role is a real role, with at least one source you can open.
//   - Descriptions are written in our own words from those sources.
//   - No pay figures: they change, and they vary a lot in these fields.
//   - "Worth knowing" points come from the sources listed with them.
//   - The AI never adds roles, and never writes anything in here.
//   - Change it only with Neil's OK. Each role says when it was last checked.
//
// worlds: the areas of life a role mixes, used for the "Mix your worlds" question.
// words:  everyday words in someone's answers that point towards the role.
// traits / values: ids from cards.js that line up with the role.

const CHECKED = "2026-11-27";

// The worlds people can mix. "words" are matched against their own answers.
const WORLDS = [
  { id: "arts", label: "Arts and making", words: ["art", "arts", "artist", "paint", "drawing", "draw", "craft", "pottery", "sculpt", "photograph", "film", "design", "illustrat", "creative", "making things"] },
  { id: "music", label: "Music and performance", words: ["music", "sing", "choir", "band", "guitar", "piano", "drum", "drama", "theatre", "acting", "dance", "perform", "comedy"] },
  { id: "words", label: "Words and stories", words: ["writing", "write", "poetry", "poem", "story", "stories", "blog", "reading", "books", "library", "journal"] },
  { id: "health", label: "Health and wellbeing", words: ["health", "wellbeing", "nhs", "nurse", "gp ", "doctor", "care home", "wellness", "fitness", "yoga"] },
  { id: "care", label: "Caring and support", words: ["caring", "carer", "looked after", "looking after", "support worker", "volunteer", "befriend", "listening", "foster"] },
  { id: "nature", label: "Nature and growing", words: ["garden", "gardening", "allotment", "grow", "plants", "nature", "outdoor", "walking", "wildlife", "farm", "animals", "forest", "woods", "camping"] },
  { id: "research", label: "Research and ideas", words: ["research", "study", "studied", "university", "degree", "evidence", "data", "science", "history", "curious", "find out"] },
  { id: "community", label: "Community and fairness", words: ["community", "local", "neighbour", "charity", "campaign", "fair", "rights", "church", "mosque", "temple", "food bank", "youth club", "fundrais"] },
  { id: "heritage", label: "History and heritage", words: ["museum", "history", "heritage", "archive", "castle", "gallery", "old things", "family tree", "antique"] },
  { id: "teaching", label: "Teaching and young people", words: ["teach", "school", "children", "kids", "young people", "coach", "scouts", "brownies", "mentor", "tutor"] },
  { id: "digital", label: "Tech and digital", words: ["computer", "tech", "phone", "website", "app", "gaming", "games", "coding", "online", "social media", "digital"] },
  { id: "lived", label: "Your own life experience", words: ["been through", "lived experience", "my own experience", "i know what it's like", "used services", "been there"] },
];

const r = (o) => ({ checked: CHECKED, aka: [], worthKnowing: [], networks: [], ...o });

const ROLES = [
  r({
    id: "creative-health-practitioner",
    title: "Creative health practitioner",
    aka: ["Participatory arts practitioner", "Arts and health practitioner", "Creative health associate", "Community artist"],
    what: "You use arts, music, crafts and other creative activity to support people's health and wellbeing, in places like community groups, hospitals, care homes and schools. Lots of practitioners are artists first, who work alongside health, care and community teams.",
    whyMissed: "It sits between the arts and health, so a general careers chat about either one tends to miss it.",
    worlds: ["arts", "music", "health", "community"],
    words: ["art", "music", "sing", "craft", "creative", "wellbeing", "workshop", "community", "group"],
    traits: ["ideas", "open-up", "one-to-one", "explain", "hands", "energy"],
    values: ["creative", "helping", "local", "variety"],
    waysIn: [
      "Start with your own creative practice, then build up experience running sessions with groups, often as a volunteer or freelancer at first.",
      "The Culture, Health & Wellbeing Alliance is free to join, and shares training, events and opportunities for people working in creative health.",
    ],
    worthKnowing: [
      "A report for the Mayor of London found London's creative health workforce over-stretched, precarious and poorly paid, so expect freelance, part-time and project-funded work.",
    ],
    networks: [
      { name: "Culture, Health & Wellbeing Alliance", url: "https://culturehealthandwellbeing.org.uk/who-we-are/about-alliance" },
    ],
    sources: [
      { name: "Culture, Health & Wellbeing Alliance", url: "https://culturehealthandwellbeing.org.uk/who-we-are/about-alliance" },
      { name: "Mayor of London, creative health sector report", url: "https://www.london.gov.uk/media/106731/download" },
      { name: "Prospects, Introducing creative health", url: "https://prospects.ac.uk/jobs-and-work-experience/job-sectors/healthcare/introducing-creative-health" },
    ],
  }),
  r({
    id: "knowledge-mobilisation",
    title: "Knowledge mobilisation officer",
    aka: ["Knowledge exchange officer", "Knowledge broker", "Knowledge translation officer", "Research impact officer"],
    what: "You help research get out of the university and into real life, by turning findings into things people can use and connecting researchers with the services, communities and policy makers who need them. Some teams use creative methods, such as exhibitions, performance or film, which is known as arts-based knowledge translation.",
    whyMissed: "Most people have never heard the job title, and it's usually advertised on university and research job boards, not general ones.",
    worlds: ["research", "words", "arts", "community"],
    words: ["research", "evidence", "explain", "present", "events", "communicat", "policy", "university", "report", "writing"],
    traits: ["explain", "connections", "write", "organising", "ideas", "why"],
    values: ["learning", "challenged", "creative", "helping"],
    waysIn: [
      "Look on jobs.ac.uk for knowledge mobilisation, knowledge exchange and research impact roles.",
      "Experience in communications, events, public engagement or project coordination is often a way in, alongside an interest in research.",
    ],
    worthKnowing: [
      "Many posts are tied to research funding, so they're often fixed-term. For example, a Knowledge Mobilisation Officer post at UCL's Institute for Global Health was advertised in 2026 as a fixed-term contract.",
      "Some roles, especially health research ones, ask for a degree or a master's.",
    ],
    networks: [
      { name: "jobs.ac.uk", url: "https://www.jobs.ac.uk/" },
    ],
    sources: [
      { name: "UCL, Being a knowledge mobiliser: art, craft or science?", url: "https://www.ucl.ac.uk/engage/case-studies/2024/nov/being-knowledge-mobiliser-art-craft-or-science" },
      { name: "Kukkonen and Cooper, Arts-based knowledge translation (Integration and Implementation Insights)", url: "https://i2insights.org/2018/01/16/arts-based-knowledge-translation/amp/" },
      { name: "jobs.ac.uk, Knowledge Mobilisation Officer, UCL Institute for Global Health (2026)", url: "https://www.jobs.ac.uk/job/DQY059" },
      { name: "jobs.ac.uk, NIHR ARC Knowledge Mobilisation Fellow, University of West London (2025)", url: "https://jobs.ac.uk/job/DMD065" },
    ],
  }),
  r({
    id: "social-prescribing-link-worker",
    title: "Social prescribing link worker",
    aka: ["Community connector", "Wellbeing advisor", "Community navigator", "Health advisor"],
    what: "You give people time to talk about what matters to them, then connect them with local groups, activities and services that help with the practical, social and emotional things affecting their health. People are referred by GPs, charities, social care and other services.",
    whyMissed: "It's a fairly new NHS role, and it goes by different names in different areas.",
    worlds: ["health", "community", "care"],
    words: ["listen", "community", "local", "groups", "support", "volunteer", "charity", "people", "connect"],
    traits: ["open-up", "one-to-one", "stand-up", "looked-after", "connections", "organising"],
    values: ["helping", "local", "variety", "team"],
    waysIn: [
      "Roles are advertised on NHS Jobs, and by local charities and community organisations that run social prescribing services.",
      "NHS England publishes a workforce development framework for the role, which shows what employers look for.",
    ],
    worthKnowing: [
      "NHS England says the role can be called community connector, wellbeing advisor, community navigator or health advisor, so search for all of these.",
    ],
    networks: [
      { name: "National Academy for Social Prescribing", url: "https://socialprescribingacademy.org.uk/about-us/" },
    ],
    sources: [
      { name: "NHS England, Social prescribing link workers", url: "https://www.england.nhs.uk/personalisedcare/workforce-and-training/social-prescribing-link-workers/" },
      { name: "NHS England, Social prescribing FAQs", url: "https://www.england.nhs.uk/personalisedcare/social-prescribing/faqs/" },
    ],
  }),
  r({
    id: "peer-support-worker",
    title: "Peer support worker",
    aka: ["Peer worker", "Lived experience practitioner", "Peer mentor", "Peer coach", "Carer peer support worker"],
    what: "You use your own lived experience to support other people going through something similar, working alongside other professionals in health, justice and community services. Your experience is the qualification that matters most.",
    whyMissed: "Few people realise their own experience can be the main thing an employer is looking for.",
    worlds: ["lived", "care", "health", "community"],
    words: ["been through", "lived experience", "support", "listen", "mentor", "volunteer", "peer"],
    traits: ["open-up", "one-to-one", "stand-up", "keep-going", "looked-after"],
    values: ["helping", "honesty", "fairness", "team"],
    waysIn: [
      "There's a Level 3 Peer worker apprenticeship, around 15 months long, with no formal entry requirements apart from relevant lived experience.",
      "NHS trusts advertise peer support roles on NHS Jobs, and many run their own training once you start.",
    ],
    worthKnowing: [
      "You need relevant lived experience to apply. You never need to tell us about it here, and nothing in this app asks you to.",
    ],
    networks: [
      { name: "NHS Health Careers, Peer support worker", url: "https://www.healthcareers.nhs.uk/explore-roles/psychological-therapies/roles-psychological-therapies/peer-support-worker" },
    ],
    sources: [
      { name: "NHS Health Careers, Peer support worker", url: "https://www.healthcareers.nhs.uk/explore-roles/psychological-therapies/roles-psychological-therapies/peer-support-worker" },
      { name: "Skills England, Peer worker apprenticeship (ST0896)", url: "https://skillsengland.education.gov.uk/apprenticeships/st0896-v1-0" },
    ],
  }),
  r({
    id: "expert-by-experience",
    title: "Expert by Experience (care inspections)",
    aka: ["CQC Expert by Experience", "Lived experience inspector"],
    what: "You join Care Quality Commission inspection teams to talk with the people using health and care services, and their families, about what their care is really like. What you hear helps inspectors judge the quality of care.",
    whyMissed: "Most people don't know the care regulator pays people for their experience of using services or caring for someone.",
    worlds: ["lived", "care", "health", "community"],
    words: ["carer", "caring", "looked after", "family", "listen", "fair", "speak up"],
    traits: ["open-up", "not-right", "stand-up", "straight", "looked-after", "fair"],
    values: ["fairness", "honesty", "helping", "trusted"],
    waysIn: [
      "Choice Support recruits, trains and manages Experts by Experience for the CQC. The roles are paid and training is given.",
    ],
    worthKnowing: [
      "You need recent lived experience of using health or social care services, or of being a family carer for someone who does. The CQC contract notice sets this at within the past 8 years, or 4 years for maternity services.",
    ],
    networks: [
      { name: "Choice Support, Experts by Experience", url: "https://choicesupport.org.uk/about-us/what-we-do/experts-by-experience" },
    ],
    sources: [
      { name: "Care Quality Commission, Experts by Experience", url: "https://www.cqc.org.uk/node/2060" },
      { name: "Choice Support, Experts by Experience", url: "https://choicesupport.org.uk/about-us/what-we-do/experts-by-experience" },
      { name: "Find a Tender, CQC Experts by Experience contract notice", url: "https://www.find-tender.service.gov.uk/Notice/006977-2025" },
    ],
  }),
  r({
    id: "therapeutic-horticulture",
    title: "Social and therapeutic horticulture practitioner",
    aka: ["STH practitioner", "Horticultural therapist", "Therapeutic gardener"],
    what: "You use plants and gardening to help people improve their physical and mental health, build confidence and social skills, and learn practical skills. You work with small groups or one-to-one, in gardens, projects and outreach settings.",
    whyMissed: "People think of gardening jobs or care jobs, but rarely a job that's both.",
    worlds: ["nature", "health", "care"],
    words: ["garden", "gardening", "allotment", "plants", "grow", "outdoor", "nature"],
    traits: ["outdoors", "hands", "one-to-one", "steady", "open-up", "doing"],
    values: ["outdoors", "helping", "hands", "calm"],
    waysIn: [
      "The charity Thrive runs courses from a free online introduction up to a Level 5 Diploma in Social and Therapeutic Horticulture.",
      "Volunteering at a therapeutic gardening project is a good way to get experience.",
    ],
    worthKnowing: [
      "Prospects says it's usually a second career, and people often come from social care, mental health, teaching, occupational therapy or nursing.",
    ],
    networks: [
      { name: "Thrive, careers in social and therapeutic horticulture", url: "https://www.thrive.org.uk/how-we-help/what-we-do/social-therapeutic-horticulture/careers-in-social-therapeutic-horticulture" },
    ],
    sources: [
      { name: "Prospects, Horticultural therapist", url: "https://prospects.ac.uk/job-profiles/horticultural-therapist" },
      { name: "National Careers Service, Horticultural therapist", url: "https://nationalcareers.service.gov.uk/job-profiles/horticultural-therapist" },
      { name: "Thrive, Get into therapeutic horticulture", url: "https://www.thrive.org.uk/how-we-help/what-we-do/news-and-updates/get-into-therapeutic-horticulture-with-thrive" },
    ],
  }),
  r({
    id: "care-farming",
    title: "Care farm worker",
    aka: ["Social farming practitioner", "Green care worker", "Care farmer"],
    what: "You run farming and growing activities as a structured programme for people who need support with their health, social care or education. Care farms don't always have animals: some are community allotments and gardens in towns.",
    whyMissed: "Most people have never heard of care farming, so it never comes up as an option.",
    worlds: ["nature", "care", "teaching"],
    words: ["farm", "animals", "garden", "grow", "outdoor", "allotment", "countryside"],
    traits: ["outdoors", "hands", "energy", "doing", "one-to-one", "calm"],
    values: ["outdoors", "hands", "helping", "planet"],
    waysIn: [
      "Social Farms & Gardens and Thrive run self-led online courses for new care farmers, after a free Principles of Care Farming resource.",
      "Social Farms & Gardens has a map of care farms, which is a good place to look for volunteering.",
    ],
    worthKnowing: [
      "Care farms are often paid for by referring services, such as social services, health teams and schools, so local funding affects how many jobs there are.",
    ],
    networks: [
      { name: "Social Farms & Gardens, care farming knowledge base", url: "https://www.farmgarden.org.uk/node/1546" },
    ],
    sources: [
      { name: "Social Farms & Gardens, What is care farming?", url: "https://farmgarden.org.uk/node/1557" },
      { name: "Social Farms & Gardens, Growing Care Farming", url: "https://www.farmgarden.org.uk/GCF" },
      { name: "Camphill Village Trust, Farming and gardening", url: "https://www.camphillvillagetrust.org.uk/support/our-activities/farming-and-gardening/" },
    ],
  }),
  r({
    id: "forest-school-leader",
    title: "Forest School leader",
    aka: ["Forest School practitioner", "Outdoor learning leader"],
    what: "You run regular outdoor sessions in woodland and natural spaces, helping children, young people or adults build confidence, independence and practical skills like fire and tool use.",
    whyMissed: "People who love the outdoors and working with young people often don't know it's a qualification you can train for.",
    worlds: ["nature", "teaching"],
    words: ["outdoor", "woods", "forest", "camping", "scouts", "children", "kids", "nature", "teach"],
    traits: ["outdoors", "energy", "explain", "doing", "calm", "hands"],
    values: ["outdoors", "learning", "planet", "variety"],
    waysIn: [
      "Forest School qualifications go from Level 1 (an introduction) to Level 2 (assistant) and Level 3 (leader). The Level 3 Certificate is around 180 hours of learning.",
      "Training providers usually expect experience of working with your group, for example children, and you'll need an outdoor first aid course.",
    ],
    worthKnowing: [
      "The Forest School Association says Level 3 qualifications from purely online courses aren't accepted for its Recognised Provider scheme, so choose a course with practical training.",
    ],
    networks: [
      { name: "Forest School Association, qualifications", url: "https://forestschoolassociation.org/forest-school-qualification/" },
    ],
    sources: [
      { name: "Forest School Association, Forest School qualifications", url: "https://forestschoolassociation.org/forest-school-qualification/" },
      { name: "Field Studies Council, Level 3 Certificate for Forest School Leaders", url: "https://www.field-studies-council.org/courses-and-experiences/static-courses/level-3-certificate-for-forest-school-leaders/" },
    ],
  }),
  r({
    id: "arts-therapist",
    title: "Art, music or drama therapist",
    aka: ["Art therapist", "Art psychotherapist", "Music therapist", "Dramatherapist"],
    what: "You're a psychological therapist who uses art, music or drama as the main way of communicating, helping people with their mental and physical health, development and communication.",
    whyMissed: "People who are creative and good with people rarely realise there's a regulated health profession that needs both.",
    worlds: ["arts", "music", "health"],
    words: ["art", "music", "drama", "theatre", "paint", "sing", "creative", "listen"],
    traits: ["open-up", "one-to-one", "pictures", "ideas", "calm"],
    values: ["creative", "helping", "learning", "challenged"],
    waysIn: [
      "You need an approved postgraduate qualification in art, music or drama therapy, which leads to registration with the Health and Care Professions Council (HCPC).",
      "There's also an Arts therapist degree apprenticeship, for people who are already skilled in art, drama or music.",
    ],
    worthKnowing: [
      "These are protected titles. By law you must be registered with the HCPC to call yourself an art therapist, art psychotherapist, drama therapist or music therapist.",
    ],
    networks: [
      { name: "British Association of Art Therapists, career framework", url: "https://baat.org/download/12245/clinical-career-framework-arts-therapists-baat.pdf" },
    ],
    sources: [
      { name: "GOV.UK, Art therapist registration", url: "https://www.gov.uk/art-therapist-registration" },
      { name: "Skills England, Arts therapist (degree) apprenticeship (ST0633)", url: "https://skillsengland.education.gov.uk/apprenticeships/st0633-v1-1" },
      { name: "Prospects, Dramatherapist", url: "https://prospects.ac.uk/job-profiles/dramatherapist" },
    ],
  }),
  r({
    id: "hospital-arts",
    title: "Hospital arts coordinator",
    aka: ["Arts programme manager", "Arts producer", "Arts in health manager"],
    what: "You run the arts programme in a hospital: exhibitions, live music, art for wards and waiting areas, and creative projects for patients and staff wellbeing. You work with artists, clinical teams and the hospital charity.",
    whyMissed: "Hardly anyone knows hospitals have arts teams at all.",
    worlds: ["arts", "music", "health"],
    words: ["exhibition", "gallery", "art", "music", "events", "curate", "organise", "hospital"],
    traits: ["organising", "ideas", "juggled", "explain", "problem"],
    values: ["creative", "helping", "variety", "team"],
    waysIn: [
      "Experience of arts project management, curating, events or arts administration is the usual route in.",
      "Many hospital arts teams also take on freelance artists and facilitators for projects.",
    ],
    worthKnowing: [
      "The National Arts in Hospitals Network, now part of NHS Charities Together, links over 100 NHS trusts, which gives a sense of how many hospitals run arts programmes.",
    ],
    networks: [
      { name: "National Arts in Hospitals Network", url: "https://www.culturehealthandwellbeing.org.uk/news/general-news/art-hospitals" },
    ],
    sources: [
      { name: "Culture, Health & Wellbeing Alliance, Art in hospitals (2024)", url: "https://www.culturehealthandwellbeing.org.uk/news/general-news/art-hospitals" },
      { name: "Norfolk and Norwich University Hospitals, Staffing the hospital arts", url: "https://www.nnuh.nhs.uk/departments/hospital-arts-project/staffing-the-hospital-arts/" },
    ],
  }),
  r({
    id: "activity-coordinator",
    title: "Activity coordinator (care homes)",
    aka: ["Activities coordinator", "Activity provider", "Wellbeing coordinator"],
    what: "You plan and run activities that give people living in care homes purpose, enjoyment and connection, based on each person's life story and interests. Music, crafts, gardening, outings and games can all be part of it.",
    whyMissed: "People think of care homes as care jobs only. This one is about creativity and connection.",
    worlds: ["care", "arts", "music", "community"],
    words: ["crafts", "music", "games", "quiz", "organise", "events", "older people", "grandparent", "volunteer"],
    traits: ["ideas", "energy", "open-up", "organising", "looked-after", "explain"],
    values: ["helping", "creative", "fun", "variety"],
    waysIn: [
      "Care home groups and councils advertise these roles directly. Experience of running groups, events or clubs counts.",
    ],
    worthKnowing: [
      "The Department of Health and Social Care's Care Workforce Pathway now has an activity co-ordinator role category, which sets out what the role involves.",
    ],
    networks: [
      { name: "GOV.UK, Care Workforce Pathway: activity co-ordinator", url: "https://www.gov.uk/government/publications/care-workforce-pathway-for-adult-social-care/activity-co-ordinator-role-category" },
    ],
    sources: [
      { name: "GOV.UK, Care Workforce Pathway: activity co-ordinator role category", url: "https://www.gov.uk/government/publications/care-workforce-pathway-for-adult-social-care/activity-co-ordinator-role-category" },
      { name: "University of East Anglia, Activity providers in UK care homes: a scoping review (2025)", url: "https://research-portal.uea.ac.uk/en/publications/professional-development-and-workforce-issues-of-activity-provide/" },
    ],
  }),
  r({
    id: "museum-learning",
    title: "Museum learning officer",
    aka: ["Learning and engagement officer", "Community learning officer", "Access officer", "Participation officer"],
    what: "You bring museum, gallery and heritage collections to life for schools, families and local communities, by planning and running sessions, events and outreach.",
    whyMissed: "The job titles vary a lot, so it's easy to miss when you search for teaching or heritage jobs.",
    worlds: ["heritage", "teaching", "community", "arts"],
    words: ["museum", "history", "heritage", "gallery", "teach", "school", "children", "families", "events"],
    traits: ["explain", "ideas", "energy", "memory", "organising"],
    values: ["learning", "creative", "local", "variety"],
    waysIn: [
      "Experience of teaching, youth work, events or volunteering at a museum or heritage site helps.",
      "Prospects lists other titles to search for: access, community learning, engagement, inclusion, learning and participation officer.",
    ],
    worthKnowing: [
      "Depending on the size of the museum, you might be the only learning officer or part of a bigger team.",
    ],
    networks: [
      { name: "Prospects, Museum education officer", url: "https://www.prospects.ac.uk/job-profiles/museum-education-officer" },
    ],
    sources: [
      { name: "Prospects, Museum education officer", url: "https://www.prospects.ac.uk/job-profiles/museum-education-officer" },
      { name: "TARGETjobs, Museum education officer", url: "https://targetjobs.co.uk/careers-advice/job-descriptions/276169-museum-education-officer-job-description" },
    ],
  }),
  r({
    id: "public-involvement",
    title: "Patient and public involvement officer",
    aka: ["PPIE officer", "Public involvement lead", "Research involvement and engagement officer"],
    what: "You make sure patients and the public help shape health research, by recruiting people to review studies and sit on panels, building links with community groups, and supporting people to take part.",
    whyMissed: "It's a behind-the-scenes research role that's mostly advertised on NHS and university job boards.",
    worlds: ["research", "community", "health"],
    words: ["community", "groups", "events", "research", "volunteer", "organise", "fair", "inclusion"],
    traits: ["organising", "stand-up", "explain", "open-up", "fair"],
    values: ["fairness", "helping", "learning", "team"],
    waysIn: [
      "Roles are advertised on NHS Jobs and jobs.ac.uk, often in National Institute for Health and Care Research (NIHR) funded teams.",
      "Experience of community engagement, events or coordinating volunteers is a good starting point.",
    ],
    worthKnowing: [
      "Many posts sit in research teams with fixed funding periods. For example, a University of York PPIE Manager post was advertised as fixed-term.",
    ],
    networks: [
      { name: "jobs.ac.uk", url: "https://www.jobs.ac.uk/" },
    ],
    sources: [
      { name: "NHS Jobs, Patient and Public Involvement Lead, King's College Hospital (2025)", url: "https://www.jobs.nhs.uk/candidate/jobadvert/C9213-25-0977" },
      { name: "jobs.ac.uk, Patient-Public Involvement and Engagement Manager, University of York", url: "https://www.jobs.ac.uk/job/DSG259/" },
    ],
  }),
  r({
    id: "digital-inclusion",
    title: "Digital inclusion officer",
    aka: ["Digital champion coordinator", "Digital skills officer"],
    what: "You help people who are left out of the online world to get connected, and to build the confidence and skills to use digital services.",
    whyMissed: "People who are patient with technology often don't know helping others with it is a job.",
    worlds: ["digital", "community", "teaching"],
    words: ["computer", "phone", "online", "tech", "explain", "patient", "older people", "help"],
    traits: ["explain", "one-to-one", "self-taught", "open-up", "calm"],
    values: ["helping", "local", "fairness", "learning"],
    waysIn: [
      "Charities, councils and housing associations run digital inclusion projects. Good Things Foundation, the UK's digital inclusion charity, supports a national network of local partners.",
    ],
    worthKnowing: [
      "Projects are often grant-funded, so check whether a post is permanent or fixed-term.",
    ],
    networks: [
      { name: "Good Things Foundation", url: "https://goodthingsfoundation.org/jobs/digital-inclusion-delivery-officer-x2" },
    ],
    sources: [
      { name: "Good Things Foundation, Digital Inclusion Delivery Officer", url: "https://goodthingsfoundation.org/jobs/digital-inclusion-delivery-officer-x2" },
      { name: "CharityJob, Digital Inclusion Officer, WellChild", url: "https://www.charityjob.co.uk/jobs/wellchild/digital-inclusion-officer/1021205" },
    ],
  }),
  r({
    id: "accessibility-specialist",
    title: "Accessibility specialist",
    aka: ["Digital accessibility specialist", "Accessibility tester", "Accessibility consultant"],
    what: "You're the voice of disabled users in digital teams, testing websites and apps with screen readers and other tools, checking legal requirements, and helping teams build services everyone can use.",
    whyMissed: "Most people don't know it's a job, let alone one you can move into from outside tech.",
    worlds: ["digital", "community", "care"],
    words: ["website", "app", "computer", "tech", "fair", "test", "detail", "disabled"],
    traits: ["detail", "not-right", "stand-up", "self-taught", "properly", "fair"],
    values: ["fairness", "helping", "learning", "challenged"],
    waysIn: [
      "The Civil Service says you can start as a junior accessibility specialist, through an apprenticeship or graduate scheme, or move across from testing or research.",
      "It also says this is a good career change if you've worked with disabled people.",
    ],
    worthKnowing: [
      "From there people move up to senior or lead roles, or into service design, user research or consultancy.",
    ],
    networks: [
      { name: "Civil Service careers, user-centred design", url: "https://www.civil-service-careers.gov.uk/user-centred-design/" },
    ],
    sources: [
      { name: "Civil Service careers, User-centred design", url: "https://www.civil-service-careers.gov.uk/user-centred-design/" },
      { name: "GOV.UK Accessibility blog, Establishing accessibility in the DDaT profession", url: "https://accessibility.blog.gov.uk/2022/10/25/establishing-accessibility-in-the-ddat-profession/" },
    ],
  }),
  r({
    id: "user-researcher",
    title: "User researcher",
    aka: ["UX researcher", "Service researcher"],
    what: "You find out what people need from a service and how they experience it, by planning and running interviews, testing and surveys, then sharing what you learn so the team builds the right thing.",
    whyMissed: "If you're curious about people and good at listening, it's rarely suggested unless you already work in tech.",
    worlds: ["research", "digital", "community"],
    words: ["research", "interview", "listen", "curious", "people", "survey", "find out", "psychology"],
    traits: ["why", "connections", "open-up", "write", "detail"],
    values: ["learning", "challenged", "helping", "team"],
    waysIn: [
      "The Civil Service says people often come from social research, psychology or the social sciences, and career changers who've gathered and made sense of evidence about how people behave are a good fit.",
      "You'd usually start as an associate or junior user researcher.",
    ],
    worthKnowing: [
      "The Civil Service careers page doesn't mention an apprenticeship route for this role.",
    ],
    networks: [
      { name: "Civil Service careers, user-centred design", url: "https://www.civil-service-careers.gov.uk/user-centred-design/" },
    ],
    sources: [
      { name: "Civil Service careers, User-centred design", url: "https://www.civil-service-careers.gov.uk/user-centred-design/" },
      { name: "Home Office, User researcher role standard", url: "https://design.homeoffice.gov.uk/user-research/professional-standards/user-researcher-role-standard" },
    ],
  }),
  r({
    id: "trusts-fundraiser",
    title: "Trusts and foundations fundraiser",
    aka: ["Bid writer", "Grants officer", "Trusts officer"],
    what: "You raise money for a charity by finding grant-giving trusts and foundations, writing applications that tell the charity's story well, and keeping funders up to date on what their money achieved.",
    whyMissed: "People who are good writers and believe in a cause rarely know charities employ people just to win grants.",
    worlds: ["words", "community", "research"],
    words: ["writing", "write", "charity", "fundrais", "story", "research", "cause", "campaign"],
    traits: ["write", "connections", "organising", "properly", "ideas"],
    values: ["helping", "creative", "challenged", "local"],
    waysIn: [
      "Small charities often welcome help with bids from volunteers, which gives you real applications to talk about.",
      "Roles are advertised on charity job boards under titles like bid writer, grants officer and trusts fundraiser.",
    ],
    worthKnowing: [
      "Prospects notes that short-term contracts are common in fundraising, especially event fundraising.",
    ],
    networks: [
      { name: "Prospects, Charity fundraiser", url: "https://www.prospects.ac.uk/job-profiles/charity-fundraiser" },
    ],
    sources: [
      { name: "Prospects, Charity fundraiser", url: "https://www.prospects.ac.uk/job-profiles/charity-fundraiser" },
      { name: "CharityJob, Trusts jobs", url: "https://www.charityjob.co.uk/jobs/fundraising/trusts" },
    ],
  }),
];

// ── Matching ───────────────────────────────────────────────────────────────
const lc = (s) => String(s || "").toLowerCase();
const has = (text, w) => text.includes(lc(w));

// Which worlds someone has talked about, from their own words.
function worldsIn(text) {
  const t = " " + lc(text) + " ";
  return WORLDS.filter((w) => w.words.some((x) => has(t, x))).map((w) => w.id);
}

// profile: { personText, mixText, traits:[{id, example}], values:{id: pile}, topValues, workStyle }
function rank(profile, { roles = ROLES } = {}) {
  const text = " " + lc(profile.personText) + " ";
  const mixWorlds = worldsIn(profile.mixText || "");
  const lifeWorlds = worldsIn(profile.personText || "");
  const traits = new Set((profile.traits || []).filter((t) => String(t.example || "").trim().length >= 10).map((t) => t.id));
  const must = new Set(Object.entries(profile.values || {}).filter(([, p]) => p === "must").map(([id]) => id));
  const no = new Set(Object.entries(profile.values || {}).filter(([, p]) => p === "no").map(([id]) => id));
  const top = new Set(profile.topValues || []);
  const ws = profile.workStyle || {};
  const out = roles.map((role) => {
    const reasons = [];
    const mixHit = role.worlds.filter((w) => mixWorlds.includes(w));
    const lifeHit = role.worlds.filter((w) => lifeWorlds.includes(w));
    const wordHit = role.words.filter((w) => has(text, w));
    const traitHit = role.traits.filter((t) => traits.has(t));
    const valueHit = role.values.filter((v) => must.has(v));
    const valueNo = role.values.filter((v) => no.has(v));
    let s = 0;
    s += mixHit.length >= 2 ? 3 : mixHit.length * 1.2;
    s += Math.min(2, lifeHit.length * 0.6);
    s += Math.min(1.5, wordHit.length * 0.3);
    s += traitHit.length * 0.7;
    s += valueHit.reduce((n, v) => n + (top.has(v) ? 0.9 : 0.5), 0);
    s -= valueNo.length * 0.3;
    if (ws.where === "Outdoors" && role.worlds.includes("nature")) s += 0.6;
    if (ws.people === "Mostly people" && role.worlds.some((w) => ["care", "community", "teaching"].includes(w))) s += 0.3;
    const name = (id) => (WORLDS.find((w) => w.id === id) || {}).label;
    if (mixHit.length >= 2) reasons.push(`It mixes two worlds you said you'd like to bring together: ${mixHit.slice(0, 2).map((w) => name(w).toLowerCase()).join(" and ")}.`);
    else if (mixHit.length === 1) reasons.push(`It brings in ${name(mixHit[0]).toLowerCase()}, one of the worlds you'd like to mix.`);
    else if (lifeHit.length) reasons.push(`It connects with things you've told us about: ${lifeHit.slice(0, 2).map((w) => name(w).toLowerCase()).join(" and ")}.`);
    if (traitHit.length) reasons.push(`${traitHit.length === 1 ? "One of your strengths fits" : `${traitHit.length} of your strengths fit`} this work.`);
    if (valueHit.length) reasons.push(`It could give you things that matter to you: ${valueHit.length} of your Must haves.`);
    return { role, score: Math.round(s * 100) / 100, reasons, worlds: role.worlds };
  });
  out.sort((a, b) => b.score - a.score || a.role.title.localeCompare(b.role.title));
  return out;
}

// Spread the list out, so each batch shows a different mix of worlds rather
// than five versions of the same idea. Used for "Show me something different".
function spread(ranked, size = 4) {
  const left = ranked.slice(), batches = [];
  while (left.length) {
    const batch = [], seen = new Set();
    for (let i = 0; i < left.length && batch.length < size; ) {
      const lead = left[i].worlds[0];
      if (!seen.has(lead) || left.length - i <= size - batch.length) { seen.add(lead); batch.push(left.splice(i, 1)[0]); }
      else i++;
    }
    batches.push(batch);
  }
  return batches;
}

function publicRole(x, reasons) {
  const o = x.role || x;
  return {
    code: "BTO:" + o.id, id: o.id, title: o.title, aka: o.aka, what: o.what, whyMissed: o.whyMissed,
    reasons: reasons || x.reasons || [], waysIn: o.waysIn, worthKnowing: o.worthKnowing, networks: o.networks,
    sources: o.sources, checked: o.checked, worlds: o.worlds.map((w) => (WORLDS.find((x2) => x2.id === w) || {}).label).filter(Boolean),
  };
}

const find = (code) => ROLES.find((o) => "BTO:" + o.id === String(code || "")) || null;

// A plain job spec for CV Rewrite, written only from this library.
function roleSpec(o) {
  const lines = [`Role: ${o.title}`];
  if (o.aka.length) lines.push(`Also called: ${o.aka.join(", ")}`);
  lines.push("", o.what, "", "Ways in:", ...o.waysIn.map((w) => `- ${w}`));
  lines.push("", "Sources: " + o.sources.map((s) => `${s.name} (${s.url})`).join("; "));
  return lines.join("\n").slice(0, 30000);
}

module.exports = { ROLES, WORLDS, CHECKED, rank, spread, worldsIn, publicRole, find, roleSpec };
