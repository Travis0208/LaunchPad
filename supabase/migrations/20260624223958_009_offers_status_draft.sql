-- Replace the status check constraint on offers to use 'draft' instead of 'pending'
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers ADD CONSTRAINT offers_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'));

-- Rename any existing 'pending' rows to 'draft' for consistency
UPDATE offers SET status = 'draft' WHERE status = 'pending';
