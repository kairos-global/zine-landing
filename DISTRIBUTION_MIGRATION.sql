-- Add distribution fields to issues table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE issues
ADD COLUMN IF NOT EXISTS self_distribute BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS print_for_me BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN issues.self_distribute IS 'User prints and fulfills their own zines';
COMMENT ON COLUMN issues.print_for_me IS 'Zineground prints and delivers to distributors worldwide';

-- Optional: Create an index to efficiently find issues available for distribution
CREATE INDEX IF NOT EXISTS idx_issues_print_for_me 
ON issues(print_for_me) 
WHERE print_for_me = true AND status = 'published';

