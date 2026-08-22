CREATE TABLE posts (
  id           INTEGER PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  body_md      TEXT    NOT NULL DEFAULT '',
  body_html    TEXT    NOT NULL DEFAULT '',
  excerpt      TEXT,
  cover_image  TEXT,
  status       TEXT    NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'published')),
  published_at INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Serves the only hot query: published posts, newest first. A future
-- published_at schedules a post without a cron job.
CREATE INDEX posts_feed ON posts (status, published_at DESC);

CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expiry ON sessions (expires_at);
