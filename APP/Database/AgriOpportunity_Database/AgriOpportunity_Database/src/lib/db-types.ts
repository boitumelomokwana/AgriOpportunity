// TypeScript row types matching supabase/schema.sql

export type SourceType = 'official_api' | 'third_party_api' | 'admin_curated';
export type VerificationStatus = 'pending' | 'approved' | 'verified' | 'rejected';

export interface ProfileRow {
  id: string; // = auth.users.id
  full_name: string | null;
  email: string | null;
  province: string | null;
  qualification: string | null;
  field_of_study: string | null;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export interface OpportunityRow {
  id: string;
  title: string;
  provider: string;
  category: string;
  province: string;
  qualification: string;
  closing_date: string | null; // YYYY-MM-DD
  description: string;
  tags: string[];
  requirements: {
    studyLevel: boolean;
    careerField: boolean;
    experience: boolean | 'warning';
  };
  sector: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  application_url: string | null;
  verification_status: VerificationStatus;
  published: boolean;
  created_at: string;
  updated_at: string;
}
