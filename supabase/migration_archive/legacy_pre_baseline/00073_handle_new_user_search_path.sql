CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, user_role, age_band, account_status)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_role',
    new.raw_user_meta_data->>'ageBand',
    new.raw_user_meta_data->>'accountStatus'
  );
  RETURN new;
END;
$$;
