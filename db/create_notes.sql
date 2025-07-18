PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS notes;
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id TEXT NOT NULL,
  article_id INTEGER,
  note_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  content_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(article_id)
);
