// Mirrors backend/src/constants.js — keep in sync.
export type VisitOutcome = 'inspected' | 'closed' | 'refused' | 'not_found' | 'other';
export type ViolationLevel = 'none' | 'minor' | 'major' | 'critical';
export type ComplianceAnswer = 'yes' | 'no' | 'na';

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  inspected: 'تمت المعاينة',
  closed: 'المنشأة مغلقة',
  refused: 'رفض المعاينة',
  not_found: 'غير موجودة بالعنوان',
  other: 'أخرى',
};

export const LEVEL_LABELS: Record<ViolationLevel, string> = {
  none: 'لا توجد مخالفة',
  minor: 'بسيطة',
  major: 'جسيمة',
  critical: 'خطيرة',
};

export const COMPLIANCE_ITEMS: { key: string; label: string; badAnswer: ComplianceAnswer }[] = [
  { key: 'has_discharge_permit', label: 'يوجد ترخيص صرف', badAnswer: 'no' },
  { key: 'pretreatment_present', label: 'توجد وحدة معالجة مبدئية', badAnswer: 'no' },
  { key: 'pretreatment_working', label: 'وحدة المعالجة تعمل', badAnswer: 'no' },
  { key: 'grease_trap_present', label: 'توجد مصيدة شحوم', badAnswer: 'no' },
  { key: 'grease_trap_clean', label: 'مصيدة الشحوم نظيفة', badAnswer: 'no' },
  { key: 'sampling_point_accessible', label: 'نقطة سحب العينة متاحة', badAnswer: 'no' },
  { key: 'illegal_connection', label: 'توجد توصيلة مخالفة', badAnswer: 'yes' },
];

export const SAMPLE_TYPE_PRESETS = ['صرف صناعي', 'صرف مطعم / مطبخ', 'عينة لحظية', 'عينة مجمعة', 'مياه معالجة', 'مياه شرب'];

export function suggestViolationLevel(compliance: Record<string, ComplianceAnswer>): ViolationLevel {
  const bad = COMPLIANCE_ITEMS.filter((i) => compliance[i.key] === i.badAnswer).map((i) => i.key);
  if (bad.includes('illegal_connection')) return 'critical';
  if (bad.includes('has_discharge_permit') || bad.includes('pretreatment_present')) return 'major';
  if (bad.length > 0) return 'minor';
  return 'none';
}

export const LEVEL_COLORS: Record<ViolationLevel, { bg: string; fg: string }> = {
  none: { bg: '#E9F6E5', fg: '#4FA336' },
  minor: { bg: '#FEF3C7', fg: '#D97706' },
  major: { bg: '#FFEDD5', fg: '#C2410C' },
  critical: { bg: '#FEE2E2', fg: '#DC2626' },
};
