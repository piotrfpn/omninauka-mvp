-- Sprint 18C: Manual Premium Activation MVP
-- Adds plan expiration fields and secures them against unauthorized updates

-- 1. Add plan_expires_at and plan_updated_at to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz;

-- 2. Add constraint for plan values if not already present
-- First, ensure no nulls if we want to be strict, but current structure allows nullable plan (with default 'free')
-- We check if constraint exists first to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_check'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium', 'family'));
    END IF;
END $$;

-- 3. Create a function to protect plan fields from 'authenticated' users
CREATE OR REPLACE FUNCTION public.protect_plan_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is 'authenticated', revert any changes to sensitive plan fields
  -- This prevents users from self-upgrading to premium via client-side code
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
    NEW.plan := OLD.plan;
    NEW.plan_expires_at := OLD.plan_expires_at;
    NEW.plan_updated_at := OLD.plan_updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS protect_plan_fields_trigger ON public.profiles;
CREATE TRIGGER protect_plan_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_plan_fields();

-- 5. Comments for documentation
COMMENT ON COLUMN public.profiles.plan_expires_at IS 'Timestamp when the current paid plan expires.';
COMMENT ON COLUMN public.profiles.plan_updated_at IS 'Timestamp when the plan was last updated by an admin.';
