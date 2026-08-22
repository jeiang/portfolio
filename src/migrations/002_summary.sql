-- The list pages and the feed need a one-line summary, but deriving it from
-- body_md on every request meant fetching every post's full markdown and
-- running six regexes over it. Store it at save time instead.
--
-- `excerpt` stays the author's explicit override; `summary` is what gets
-- rendered, and is `excerpt` when set and derived from the body otherwise.
--
-- No backfill: this ships before the first deployment, so there are no rows
-- to migrate. Existing drafts pick up a summary on their next save.
ALTER TABLE posts ADD COLUMN summary TEXT NOT NULL DEFAULT '';
