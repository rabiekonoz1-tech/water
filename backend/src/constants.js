// Shared domain vocabulary (mirrored in mobile/src/constants/domain.ts)
const VISIT_OUTCOMES = ['inspected', 'closed', 'refused', 'not_found', 'other'];
const VIOLATION_LEVELS = ['none', 'minor', 'major', 'critical'];
const COMPLIANCE_ANSWERS = ['yes', 'no', 'na'];
const COMPLIANCE_KEYS = [
  'has_discharge_permit',
  'pretreatment_present',
  'pretreatment_working',
  'grease_trap_present',
  'grease_trap_clean',
  'sampling_point_accessible',
  'illegal_connection',
];
const RESERVATION_TTL_HOURS = Number(process.env.RESERVATION_TTL_HOURS || 6);

const OUTCOME_LABELS = {
  inspected: 'تمت المعاينة',
  closed: 'المنشأة مغلقة',
  refused: 'رفض المعاينة',
  not_found: 'غير موجودة بالعنوان',
  other: 'أخرى',
};
const LEVEL_LABELS = { none: 'لا توجد مخالفة', minor: 'بسيطة', major: 'جسيمة', critical: 'خطيرة' };
const COMPLIANCE_LABELS = {
  has_discharge_permit: 'يوجد ترخيص صرف',
  pretreatment_present: 'توجد وحدة معالجة مبدئية',
  pretreatment_working: 'وحدة المعالجة تعمل',
  grease_trap_present: 'توجد مصيدة شحوم',
  grease_trap_clean: 'مصيدة الشحوم نظيفة',
  sampling_point_accessible: 'نقطة سحب العينة متاحة',
  illegal_connection: 'توجد توصيلة مخالفة',
};

module.exports = {
  VISIT_OUTCOMES, VIOLATION_LEVELS, COMPLIANCE_ANSWERS, COMPLIANCE_KEYS,
  RESERVATION_TTL_HOURS, OUTCOME_LABELS, LEVEL_LABELS, COMPLIANCE_LABELS,
};
