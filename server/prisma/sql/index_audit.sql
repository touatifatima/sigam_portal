-- Index audit for prioritized tables
-- Run in pgAdmin Query Tool or psql after traffic has occurred.

-- 1) Current index usage and size
SELECT
  s.schemaname,
  s.relname AS table_name,
  s.indexrelname AS index_name,
  s.idx_scan,
  s.idx_tup_read,
  s.idx_tup_fetch,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
  pg_get_indexdef(s.indexrelid) AS index_def
FROM pg_stat_user_indexes s
WHERE s.relname IN (
  'demande',
  'inscription_provisoire',
  'notifications_portail',
  'messages_portail',
  'PermisPortail',
  'utilisateurs_portail'
)
ORDER BY s.relname, s.idx_scan DESC, s.indexrelname;

-- 2) Candidate unused indexes (non-unique, non-primary, never scanned)
SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
  COALESCE(st.idx_scan, 0) AS idx_scan,
  pg_get_indexdef(i.oid) AS index_def,
  format('DROP INDEX IF EXISTS %I.%I;', n.nspname, i.relname) AS suggested_drop
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index x ON x.indrelid = t.oid
JOIN pg_class i ON i.oid = x.indexrelid
LEFT JOIN pg_stat_user_indexes st ON st.indexrelid = i.oid
WHERE t.relkind = 'r'
  AND t.relname IN (
    'demande',
    'inscription_provisoire',
    'notifications_portail',
    'messages_portail',
    'PermisPortail',
    'utilisateurs_portail'
  )
  AND x.indisprimary = false
  AND x.indisunique = false
  AND COALESCE(st.idx_scan, 0) = 0
ORDER BY pg_relation_size(i.oid) DESC;

-- 3) Duplicate index definitions on the same table (exact same expression)
WITH idx AS (
  SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    regexp_replace(pg_get_indexdef(i.oid), '^CREATE( UNIQUE)? INDEX [^ ]+ ON [^ ]+ ', '') AS normalized_def
  FROM pg_class t
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE t.relkind = 'r'
    AND t.relname IN (
      'demande',
      'inscription_provisoire',
      'notifications_portail',
      'messages_portail',
      'PermisPortail',
      'utilisateurs_portail'
    )
)
SELECT a.table_name, a.index_name AS index_a, b.index_name AS index_b, a.normalized_def
FROM idx a
JOIN idx b
  ON a.table_name = b.table_name
 AND a.normalized_def = b.normalized_def
 AND a.index_name < b.index_name
ORDER BY a.table_name, a.index_name;

