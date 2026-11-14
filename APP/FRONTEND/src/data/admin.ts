import type {
  AdminListing,
  AdminListingStatus,
  AdminSummary,
  OpportunityStatus,
} from '@/types';
import { daysFromNow, formatShortDate } from '@/utils/date';

const RAW_STATUS: Record<AdminListingStatus, OpportunityStatus> = {
  Published: 'published',
  'Closing soon': 'published',
  Expired: 'published',
  Approved: 'approved',
  Pending: 'pending',
  Rejected: 'rejected',
};

function listing(
  input: Omit<
    AdminListing,
    'closes' | 'closingDate' | 'sourceChecked' | 'rawStatus' | 'applicationUrl'
  > & {
    closesInDays: number;
    sourceCheckedDaysAgo: number;
  },
): AdminListing {
  const { closesInDays, sourceCheckedDaysAgo, ...rest } = input;
  const closingDate = daysFromNow(closesInDays);
  return {
    ...rest,
    rawStatus: RAW_STATUS[input.status],
    applicationUrl: input.sourceUrl,
    closingDate,
    closes: formatShortDate(closingDate),
    sourceChecked: daysFromNow(-sourceCheckedDaysAgo),
  };
}

export const mockAdminListings: AdminListing[] = [
  listing({
    id: 'adm1',
    title: 'Future Engineers Bursary',
    organisation: 'Ubuntu Skills Foundation',
    category: 'Bursary',
    province: 'Gauteng',
    closesInDays: 22,
    status: 'Published',
    sourceCheckedDaysAgo: 45,
    description:
      'Illustrative funding support for South African students pursuing engineering and related technology qualifications.',
    education: 'Grade 12 / Undergraduate',
    eligibility: 'South African citizen or permanent resident; studying full time.',
    sourceUrl: 'https://example.org/opportunities/future-engineers-bursary',
  }),
  listing({
    id: 'adm2',
    title: 'Digital Marketing Internship',
    organisation: 'Cape Creative Collective',
    category: 'Internship',
    province: 'Western Cape',
    closesInDays: 34,
    status: 'Published',
    sourceCheckedDaysAgo: 38,
    description:
      'Illustrative 12-month internship for graduates interested in digital campaigns, content and analytics.',
    education: 'Diploma / Degree',
    eligibility: 'Marketing, communications or media qualification; based in the Western Cape.',
    sourceUrl: 'https://example.org/opportunities/digital-marketing-internship',
  }),
  listing({
    id: 'adm3',
    title: 'Solar Technician Learnership',
    organisation: 'Mzansi Green Energy',
    category: 'Learnership',
    province: 'Limpopo',
    closesInDays: 4,
    status: 'Pending',
    sourceCheckedDaysAgo: 52,
    description:
      'Illustrative practical training programme introducing young job seekers to solar installation and maintenance.',
    education: 'Grade 12',
    eligibility: 'Grade 12 with mathematics or technical subjects; aged 18–35.',
    sourceUrl: 'https://example.org/opportunities/solar-technician-learnership',
  }),
  listing({
    id: 'adm4',
    title: 'Graduate Data Analyst Programme',
    organisation: 'Imbokodo Financial Services',
    category: 'Graduate programme',
    province: 'Gauteng',
    closesInDays: 40,
    status: 'Published',
    sourceCheckedDaysAgo: 60,
    description:
      'Illustrative graduate placement focused on data analysis, business insight and career mentorship.',
    education: "Bachelor's degree",
    eligibility: 'Recent data, statistics, finance or mathematics graduate.',
    sourceUrl: 'https://example.org/opportunities/graduate-data-analyst-programme',
  }),
  listing({
    id: 'adm5',
    title: 'Youth Support Assistant',
    organisation: 'Northern Cape Community Network',
    category: 'Job',
    province: 'Northern Cape',
    closesInDays: 27,
    status: 'Published',
    sourceCheckedDaysAgo: 12,
    description:
      'Illustrative entry-level role supporting community workshops and youth programme administration.',
    education: 'Grade 12',
    eligibility: 'Grade 12; community or administration experience is helpful.',
    sourceUrl: 'https://example.org/opportunities/youth-support-assistant',
  }),
  listing({
    id: 'adm6',
    title: 'Agricultural Science Bursary',
    organisation: 'Free State Agri Academy',
    category: 'Bursary',
    province: 'Free State',
    closesInDays: 68,
    status: 'Closing soon',
    sourceCheckedDaysAgo: 70,
    description:
      'Illustrative bursary for learners and students interested in agriculture, food systems and rural development.',
    education: 'Grade 12 / Undergraduate',
    eligibility: 'Studying or accepted into an agriculture-related programme.',
    sourceUrl: 'https://example.org/opportunities/agricultural-science-bursary',
  }),
  listing({
    id: 'adm7',
    title: 'Data Science Bursary',
    organisation: 'Cape Analytics Trust',
    category: 'Bursary',
    province: 'Western Cape',
    closesInDays: -18,
    status: 'Expired',
    sourceCheckedDaysAgo: 90,
    description:
      'Illustrative bursary for students building skills in data science, statistics and machine learning.',
    education: 'Undergraduate / Postgraduate',
    eligibility: 'Registered for a data-related qualification.',
    sourceUrl: 'https://example.org/opportunities/data-science-bursary',
  }),
  listing({
    id: 'adm8',
    title: 'Tourism Skills Programme',
    organisation: 'North West Hospitality Hub',
    category: 'Skills training',
    province: 'North West',
    closesInDays: 85,
    status: 'Pending',
    sourceCheckedDaysAgo: 5,
    description:
      'Illustrative short programme introducing hospitality, guest services and tourism operations.',
    education: 'Grade 12',
    eligibility: 'Grade 12 or equivalent experience; interest in hospitality.',
    sourceUrl: 'https://example.org/opportunities/tourism-skills-programme',
  }),
];

export const mockAdminSummary: AdminSummary = {
  active: 128,
  drafts: 12,
  closingSoon: 18,
  expired: 46,
};

export const adminAttentionThresholdDays = 30;
