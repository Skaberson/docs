-- Simple schema for docs
CREATE TABLE IF NOT EXISTS docs (
  id SERIAL PRIMARY KEY,
  title TEXT DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT now()
);
