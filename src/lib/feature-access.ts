export type PlanType = 'free' | 'premium' | 'family';
export type TutorMode = 'basic' | 'advanced';
export type MistakeReviewAccess = 'preview' | 'full';

export interface FeatureAccess {
  aiLessonsPerDay: number;
  tutorMode: TutorMode;
  maxFlashcardsPerLesson: number;
  quizQuestionCount: number;
  mistakeReview: MistakeReviewAccess;
  premiumTest: boolean;
}

const freeFeatures: FeatureAccess = {
  aiLessonsPerDay: 2,
  tutorMode: 'basic',
  maxFlashcardsPerLesson: 5,
  quizQuestionCount: 5,
  mistakeReview: 'preview',
  premiumTest: false,
};

const premiumFeatures: FeatureAccess = {
  aiLessonsPerDay: 10,
  tutorMode: 'advanced',
  maxFlashcardsPerLesson: 20,
  quizQuestionCount: 10,
  mistakeReview: 'full',
  premiumTest: true,
};

const familyFeatures: FeatureAccess = {
  ...premiumFeatures,
};

/**
 * Returns feature limits based on the user's current effective plan.
 * Ensure you pass the effective plan (e.g. from getEffectivePlan) and not the raw database value.
 */
export function getFeatureAccess(plan: string | undefined | null): FeatureAccess {
  if (!plan) return freeFeatures;
  
  if (plan === 'family') return familyFeatures;
  if (plan === 'premium') return premiumFeatures;
  
  return freeFeatures;
}
