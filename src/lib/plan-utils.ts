import type { User } from '../types';

/**
 * Checks if a user's plan is currently active based on its expiration date.
 */
export function isPlanActive(user: User | null): boolean {
  if (!user) return false;
  
  // Free plan is always "active" (as a base)
  if (user.plan === 'free') return true;
  
  // If inherited from parent, it's active (the RPC already checked expiration)
  if (user.inheritedFromParent) return true;

  // Paid plans (premium, family)
  const expiresAt = user.planExpiresAt;
  if (!expiresAt) {
    // If no expiration date is set for a paid plan, we assume it's active for now
    // (MVP manual activation case)
    return true;
  }

  const expiresDate = new Date(expiresAt);
  const now = new Date();
  
  return expiresDate > now;
}

/**
 * Returns the effective plan for display and access control.
 * If a paid plan has expired, it returns 'free'.
 */
export function getEffectivePlan(user: User | null): 'free' | 'premium' | 'family' {
  if (!user) return 'free';
  
  // If effective plan was already calculated by RPC (Sprint 23A)
  if (user.effectivePlan) {
    return user.effectivePlan;
  }

  // Fallback to old logic
  if (user.plan === 'free') return 'free';
  
  if (isPlanActive(user)) {
    return user.plan;
  }
  
  return 'free';
}
