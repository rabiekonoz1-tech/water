import type { ComplianceAnswer, ViolationLevel, VisitOutcome } from './constants';

export type UserRole = 'admin' | 'worker';

export interface User {
  id: string;
  name: string;
  code: string;
  role: UserRole;
  active?: number;
}

export interface MonthlyPlan {
  id: string;
  month_label: string;
  filename: string;
  uploaded_by: string;
  total_facilities: number;
  created_at: string;
}

export interface SampleItem {
  id: string;
  code?: string;
  name: string;
  type: string;
  count: number;
  ph?: number | null;
  temperature?: number | null;
}

export interface Inspection {
  id: string;
  facility_id: string;
  plan_id: string;
  worker_id: string;
  worker_name: string;
  samples: SampleItem[];
  notes: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy?: number | null;
  signature_base64: string;
  created_at: string;
  client_id?: string;
  visit_outcome?: VisitOutcome;
  compliance?: Record<string, ComplianceAnswer>;
  violation_level?: ViolationLevel;
  representative_name?: string;
  representative_phone?: string;
  followup_required?: boolean;
  followup_date?: string;
}

export interface FacilityHistory {
  visits: number;
  worst: ViolationLevel;
  last_at: string;
}

export type FacilityStatus = 'available' | 'reserved' | 'completed';

export interface Facility {
  id: string;
  plan_id: string;
  serial_no: number;
  name: string;
  address: string;
  center: string;
  facility_code: string;
  target_date: string;
  plan_notes: string;
  status: FacilityStatus;
  reserved_by_id?: string | null;
  reserved_by_name?: string | null;
  reserved_at?: string | null;
  completed_by_id?: string | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  activity_type?: string;
  visit_outcome?: VisitOutcome | '';
  history?: FacilityHistory | null;
  has_followup?: boolean;
  inspection?: Inspection | null;
}

export interface ActivityItem {
  id: string;
  plan_id: string;
  facility_id?: string | null;
  facility_name: string;
  center: string;
  worker_id: string;
  worker_name: string;
  action: 'reserved' | 'released' | 'expired' | 'completed' | 'unlocked' | 'plan_uploaded';
  summary: string;
  created_at: string;
}

export interface PlanStats {
  plan: MonthlyPlan;
  totals: { total: number; completed: number; reserved: number; available: number; completion_rate: number };
  by_center: { center: string; total: number; completed: number; reserved: number }[];
  by_activity: { activity_type: string; total: number; completed: number }[];
  by_worker: { worker_name: string; visits: number; samples: number }[];
  outcomes: Record<string, number>;
  violation_levels: Record<ViolationLevel, number>;
  total_samples: number;
  sample_types: { type: string; count: number }[];
  open_followups: number;
  compliance_failures: { key: string; label: string; count: number }[];
}

export interface FollowupItem {
  id: string;
  facility_id: string;
  facility_name: string;
  center: string;
  facility_code: string;
  address: string;
  worker_name: string;
  violation_level: ViolationLevel;
  followup_date: string;
  notes: string;
}

export interface ConflictItem {
  id: string;
  facility_name: string;
  center: string;
  worker_name: string;
  completed_by_name: string;
  created_at: string;
  samples: SampleItem[];
  notes: string;
}
