export type InspectionAnswer = 'yes' | 'no' | null | undefined;

export interface InspectionItemLike {
  question?: string | null;
  category?: string | null;
  requires_photo?: boolean | null;
  correct_answer?: string | null;
}

const ALWAYS_PHOTO_KEYWORDS = [
  'vehical inspection front',
  'vehical inspection - front',
  'vehicle inspection front',
  'vehicle inspection - front',
  'vehical inspection left',
  'vehical inspection - left',
  'vehicle inspection left',
  'vehicle inspection - left',
  'vehical inspection right',
  'vehical inspection - right',
  'vehicle inspection right',
  'vehicle inspection - right',
  'vehical inspection back',
  'vehical inspection - back',
  'vehicle inspection back',
  'vehicle inspection - back',
  'vehical inspection interior',
  'vehicle inspection interior',
  'drivers licence',
  "driver's licence",
  'drivers license',
  "driver's license",
  'vehicle license disc',
  'vehicle licence disc',
  'vehical license disc',
  'vehical licence disc',
  'windscreen',
  'left front wheel',
  'right front wheel',
  'left rear wheel',
  'right rear wheel',
];

const FAILS_ON_YES_KEYWORDS = [
  'coolant leak',
  'coolant leaks',
  'oil leak',
  'oil leaks',
  'fluid leak',
  'fluid leaks',
  'any leaks',
  'any leak',
];

const normaliseText = (value: string | null | undefined): string =>
  (value ?? '').toLowerCase();

const matchesKeyword = (item: InspectionItemLike, keywords: string[]): boolean => {
  const normalized = `${normaliseText(item.category)} ${normaliseText(item.question)}`.trim();
  if (!normalized.length) return false;
  return keywords.some(keyword => normalized.includes(keyword));
};

const expectedAnswerForItem = (item: InspectionItemLike): 'yes' | 'no' | null => {
  const normalized = normaliseText(item.correct_answer as string);
  if (normalized === 'yes' || normalized === 'no') {
    return normalized;
  }
  return null;
};

export const requiresPhotoForItem = (item: InspectionItemLike): boolean => {
  return Boolean(item.requires_photo) || matchesKeyword(item, ALWAYS_PHOTO_KEYWORDS);
};

export const failsOnYesForItem = (item: InspectionItemLike): boolean => {
  return matchesKeyword(item, FAILS_ON_YES_KEYWORDS);
};

export const failureLabelForItem = (item: InspectionItemLike): 'Yes' | 'No' => {
  const expected = expectedAnswerForItem(item);
  if (expected === 'yes') {
    return 'No';
  }
  if (expected === 'no') {
    return 'Yes';
  }
  return failsOnYesForItem(item) ? 'Yes' : 'No';
};

export const isFailureAnswer = (item: InspectionItemLike, answer: InspectionAnswer): boolean => {
  const normalizedAnswer = normaliseAnswer(answer);
  if (normalizedAnswer !== 'yes' && normalizedAnswer !== 'no') return false;

  const expected = expectedAnswerForItem(item);
  if (expected) {
    return normalizedAnswer !== expected;
  }

  if (failsOnYesForItem(item)) {
    return normalizedAnswer === 'yes';
  }

  return normalizedAnswer === 'no';
};

export const normaliseAnswer = (answer: InspectionAnswer): 'yes' | 'no' | null => {
  const normalizedAnswer = normaliseText(answer as string);
  if (normalizedAnswer === 'yes' || normalizedAnswer === 'no') {
    return normalizedAnswer;
  }
  return null;
};
