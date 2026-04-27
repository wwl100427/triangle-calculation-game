-- 创建成绩表
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(255) NOT NULL,
  time FLOAT NOT NULL,
  score INTEGER NOT NULL,
  is_cheating BOOLEAN DEFAULT false,
  cheat_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX idx_scores_nickname ON scores(nickname);
CREATE INDEX idx_scores_score ON scores(score);
CREATE INDEX idx_scores_time ON scores(time);
CREATE INDEX idx_scores_created_at ON scores(created_at);
CREATE INDEX idx_scores_is_cheating ON scores(is_cheating);