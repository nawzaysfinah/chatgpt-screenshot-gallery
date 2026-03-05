CREATE TABLE IF NOT EXISTS votes (
  slug TEXT NOT NULL,
  userId TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (slug, userId)
);

CREATE INDEX IF NOT EXISTS votes_slug_idx ON votes(slug);
CREATE INDEX IF NOT EXISTS votes_user_idx ON votes(userId);

CREATE TABLE IF NOT EXISTS scores (
  slug TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL
);
