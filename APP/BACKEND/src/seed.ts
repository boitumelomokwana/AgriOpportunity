import type { Opportunity } from './types.js';

const updated = new Date().toISOString();
const applySteps = [
  'Review the eligibility requirements and gather the documents listed above.',
  'Open the official source and complete the organisation’s application form.',
  'Keep a copy of your submission and record the closing date in your tracker.',
];

export const seedOpportunities: Opportunity[] = [
  {
    id: '1',
    title: 'Future Engineers Bursary',
    organisation: 'Ubuntu Skills Foundation',
    category: 'Bursary',
    province: 'Gauteng',
    location: 'Gauteng',
    education: 'Grade 12 / Undergraduate',
    closes: '31 Dec 2027',
    closingDate: '2027-12-31T23:59:59.000Z',
    closingTone: 'normal',
    match: 92,
    summary: 'Illustrative funding support for South African students pursuing engineering and related technology qualifications.',
    field: 'Engineering & Technology',
    mode: 'On-site',
    eligibility: [
      'South African citizen or permanent resident',
      'Currently studying or planning to study full time',
      'Strong academic record in mathematics and physical science',
      'Review the original source for complete criteria',
    ],
    qualifications: { education: 'Grade 12 / Undergraduate', field: 'Engineering, mathematics or technology' },
    documents: ['CV or résumé', 'Academic record', 'Proof of enrolment or ID'],
    howToApply: applySteps,
    sourceName: 'Ubuntu Skills Foundation (illustrative)',
    sourceUrl: 'https://example.org/opportunities/future-engineers-bursary',
    lastUpdated: updated,
  },
  {
    id: '2',
    title: 'Digital Marketing Internship',
    organisation: 'Cape Creative Collective',
    category: 'Internship',
    province: 'Western Cape',
    location: 'Western Cape · Hybrid',
    education: 'Diploma / Degree',
    closes: '31 Dec 2027',
    closingDate: '2027-12-31T23:59:59.000Z',
    closingTone: 'normal',
    match: 86,
    summary: 'Illustrative 12-month internship for graduates interested in digital campaigns, content and analytics.',
    field: 'Marketing & Communications',
    mode: 'Hybrid',
    eligibility: [
      'South African citizen or permanent resident',
      'Diploma or degree in marketing, communications or a related field',
      'Comfortable working with content and analytics tools',
      'Able to travel to the Cape Town office for hybrid days',
    ],
    qualifications: { education: 'Diploma / Degree', field: 'Marketing, communications or media' },
    documents: ['CV or résumé', 'Academic record', 'Portfolio or examples of work'],
    howToApply: applySteps,
    sourceName: 'Cape Creative Collective (illustrative)',
    sourceUrl: 'https://example.org/opportunities/digital-marketing-internship',
    lastUpdated: updated,
  },
  {
    id: '3',
    title: 'Solar Technician Learnership',
    organisation: 'Mzansi Green Energy',
    category: 'Learnership',
    province: 'Limpopo',
    location: 'Limpopo',
    education: 'Grade 12',
    closes: '31 Dec 2027',
    closingDate: '2027-12-31T23:59:59.000Z',
    closingTone: 'normal',
    match: 78,
    summary: 'Illustrative practical training programme introducing young job seekers to solar installation and maintenance.',
    field: 'Energy & Technical Trades',
    mode: 'On-site',
    eligibility: [
      'South African citizen or permanent resident',
      'Grade 12 certificate with mathematics or technical subjects',
      'Aged between 18 and 35',
      'Available for the full training period',
    ],
    qualifications: { education: 'Grade 12', field: 'Technical, electrical or energy-related subjects' },
    documents: ['CV or résumé', 'Certified ID copy', 'Grade 12 certificate'],
    howToApply: applySteps,
    sourceName: 'Mzansi Green Energy (illustrative)',
    sourceUrl: 'https://example.org/opportunities/solar-technician-learnership',
    lastUpdated: updated,
  },
  ...([
    {
      id: '4', title: 'Graduate Data Analyst Programme', organisation: 'Imbokodo Financial Services',
      category: 'Graduate programme', province: 'Gauteng', location: 'Gauteng · Hybrid',
      education: "Bachelor's degree", match: 74, field: 'Data & Finance', mode: 'Hybrid',
      summary: 'Illustrative graduate placement focused on data analysis, business insight and career mentorship.',
      eligibility: ['South African citizen or permanent resident', 'Recent graduate in a data, statistics, finance or mathematics field'],
      qualificationField: 'Data science, statistics, finance or mathematics',
      source: 'Imbokodo Financial Services',
      url: 'graduate-data-analyst-programme',
    },
    {
      id: '5', title: 'Youth Support Assistant', organisation: 'Northern Cape Community Network',
      category: 'Job', province: 'Northern Cape', location: 'Northern Cape',
      education: 'Grade 12', match: 71, field: 'Community Services', mode: 'On-site',
      summary: 'Illustrative entry-level role supporting community workshops and youth programme administration.',
      eligibility: ['South African citizen or permanent resident', 'Grade 12 certificate', 'Basic computer and administration skills'],
      qualificationField: 'Community development or administration',
      source: 'Northern Cape Community Network',
      url: 'youth-support-assistant',
    },
    {
      id: '6', title: 'Junior Web Developer', organisation: 'Cape Digital Studio',
      category: 'Job', province: 'Western Cape', location: 'Western Cape · Remote',
      education: 'Diploma / Degree', match: 68, field: 'Technology', mode: 'Remote',
      summary: 'Illustrative junior role building accessible, responsive web interfaces.',
      eligibility: ['South African citizen or permanent resident', 'Software development qualification or strong portfolio', 'Working knowledge of HTML, CSS and JavaScript'],
      qualificationField: 'Software development or computer science',
      source: 'Cape Digital Studio',
      url: 'junior-web-developer',
    },
    {
      id: '7', title: 'Agricultural Science Bursary', organisation: 'Free State Agri Academy',
      category: 'Bursary', province: 'Free State', location: 'Free State',
      education: 'Grade 12 / Undergraduate', match: 88, field: 'Agriculture & Environment', mode: 'On-site',
      summary: 'Illustrative bursary for learners and students interested in agriculture, food systems and rural development.',
      eligibility: ['South African citizen or permanent resident', 'Studying or accepted into an agriculture-related programme'],
      qualificationField: 'Agriculture, environmental science or food systems',
      source: 'Free State Agri Academy',
      url: 'agricultural-science-bursary',
    },
    {
      id: '8', title: 'Supply Chain Graduate Programme', organisation: 'Durban Port Logistics',
      category: 'Graduate programme', province: 'KwaZulu-Natal', location: 'KwaZulu-Natal · Hybrid',
      education: "Bachelor's degree", match: 81, field: 'Supply Chain & Logistics', mode: 'Hybrid',
      summary: 'Illustrative graduate programme covering procurement, logistics planning and operations.',
      eligibility: ['South African citizen or permanent resident', 'Degree in supply chain, logistics, commerce or engineering'],
      qualificationField: 'Supply chain, logistics, commerce or engineering',
      source: 'Durban Port Logistics',
      url: 'supply-chain-graduate-programme',
    },
    {
      id: '9', title: 'Early Childhood Development Learnership', organisation: 'Eastern Cape Care Foundation',
      category: 'Learnership', province: 'Eastern Cape', location: 'Eastern Cape',
      education: 'Grade 12', match: 76, field: 'Education & Care', mode: 'On-site',
      summary: 'Illustrative learnership for young people who want to build a career in early childhood development.',
      eligibility: ['South African citizen or permanent resident', 'Grade 12 certificate', 'Interest in working with young children'],
      qualificationField: 'Early childhood development or care work',
      source: 'Eastern Cape Care Foundation',
      url: 'ecd-learnership',
    },
    {
      id: '10', title: 'Remote Customer Support Associate', organisation: 'Sunrise Connect',
      category: 'Job', province: 'National', location: 'National · Remote',
      education: 'Grade 12', match: 64, field: 'Customer Experience', mode: 'Remote',
      summary: 'Illustrative remote support role helping customers with queries over chat, email and voice.',
      eligibility: ['South African citizen or permanent resident', 'Grade 12 certificate', 'Reliable internet connection and a quiet workspace'],
      qualificationField: 'Customer service or communication',
      source: 'Sunrise Connect',
      url: 'remote-customer-support',
    },
    {
      id: '11', title: 'Municipal Finance Internship', organisation: 'Mpumalanga Municipal Partnership',
      category: 'Internship', province: 'Mpumalanga', location: 'Mpumalanga',
      education: 'Diploma / Degree', match: 69, field: 'Finance & Public Service', mode: 'On-site',
      summary: 'Illustrative internship in municipal budgeting, reporting and financial administration.',
      eligibility: ['South African citizen or permanent resident', 'Diploma or degree in accounting, finance or public management'],
      qualificationField: 'Accounting, finance or public management',
      source: 'Mpumalanga Municipal Partnership',
      url: 'municipal-finance-internship',
    },
    {
      id: '12', title: 'Tourism Skills Programme', organisation: 'North West Hospitality Hub',
      category: 'Skills training', province: 'North West', location: 'North West',
      education: 'Grade 12', match: 58, field: 'Tourism & Hospitality', mode: 'On-site',
      summary: 'Illustrative short programme introducing hospitality, guest services and tourism operations.',
      eligibility: ['South African citizen or permanent resident', 'Grade 12 or equivalent experience', 'Interest in hospitality and tourism'],
      qualificationField: 'Hospitality, tourism or customer service',
      source: 'North West Hospitality Hub',
      url: 'tourism-skills-programme',
    },
    {
      id: '13', title: 'Data Science Bursary', organisation: 'Cape Analytics Trust',
      category: 'Bursary', province: 'Western Cape', location: 'Western Cape',
      education: 'Undergraduate / Postgraduate', match: 90, field: 'Data & Technology', mode: 'On-site',
      summary: 'Illustrative bursary for students building skills in data science, statistics and machine learning.',
      eligibility: ['South African citizen or permanent resident', 'Registered for a data-related qualification', 'Strong mathematics and statistics results'],
      qualificationField: 'Data science, statistics, computer science or mathematics',
      source: 'Cape Analytics Trust',
      url: 'data-science-bursary',
    },
    {
      id: '14', title: 'Youth Climate Action Programme', organisation: 'National Youth Climate Network',
      category: 'Youth programme', province: 'National', location: 'National · Hybrid',
      education: 'Age 18–30', match: 66, field: 'Environment & Community', mode: 'Hybrid',
      summary: 'Illustrative programme for young people interested in climate action, community organising and green skills.',
      eligibility: ['South African citizen or permanent resident', 'Aged between 18 and 30', 'Interest in climate, environment or community work'],
      qualificationField: 'Environment, community development or social innovation',
      source: 'National Youth Climate Network',
      url: 'youth-climate-action',
    },
    {
      id: '15', title: 'Legacy Youth Development Programme', organisation: 'Gauteng Youth Desk',
      category: 'Youth programme', province: 'Gauteng', location: 'Gauteng',
      education: 'Grade 12', match: 55, field: 'Youth Development', mode: 'On-site',
      summary: 'Illustrative programme that has closed, included to demonstrate expired listing handling.',
      eligibility: ['This sample listing has closed'],
      qualificationField: 'Youth development',
      source: 'Gauteng Youth Desk',
      url: 'legacy-youth-programme',
    },
  ] satisfies Array<{
    id: string;
    title: string;
    organisation: string;
    category: Opportunity['category'];
    province: Opportunity['province'];
    location: string;
    education: string;
    match: number;
    field: string;
    mode: Opportunity['mode'];
    summary: string;
    eligibility: string[];
    qualificationField: string;
    source: string;
    url: string;
  }>).map((item) => ({
    id: item.id,
    title: item.title,
    organisation: item.organisation,
    category: item.category,
    province: item.province,
    location: item.location,
    education: item.education,
    closes: '',
    closingDate: '',
    closingTone: 'normal' as const,
    match: item.match,
    summary: item.summary,
    field: item.field,
    mode: item.mode,
    eligibility: item.eligibility,
    qualifications: { education: item.education, field: item.qualificationField },
    documents: ['CV or résumé', 'Academic record', 'Proof of enrolment or ID'],
    howToApply: applySteps,
    sourceName: `${item.source} (illustrative)`,
    sourceUrl: `https://example.org/opportunities/${item.url}`,
    lastUpdated: updated,
  })),
];

const closingOffsets = [22, 34, 4, 40, 27, 55, 68, 32, 20, 54, 30, 85, 17, 90, -18];
const updatedOffsets = [6, 2, 1, 4, 8, 3, 11, 5, 7, 9, 14, 18, 3, 21, 45];

function dateFromNow(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

for (const [index, opportunity] of seedOpportunities.entries()) {
  const closingOffset = closingOffsets[index] ?? 30;
  const closingDate = dateFromNow(closingOffset);
  const updatedDate = dateFromNow(-(updatedOffsets[index] ?? 0));
  opportunity.closingDate = closingDate.toISOString();
  opportunity.closes = closingDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  opportunity.closingTone =
    closingOffset <= 7 ? 'urgent' : closingOffset <= 30 ? 'soon' : 'normal';
  opportunity.lastUpdated = updatedDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  opportunity.isExpired = closingOffset < 0;
}
