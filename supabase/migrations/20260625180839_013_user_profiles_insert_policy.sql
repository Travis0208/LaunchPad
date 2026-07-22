-- Allow authenticated users to insert their own profile row.
-- This is needed when a user exists in auth.users but has no user_profiles row yet.
CREATE POLICY "insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
