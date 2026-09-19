BEGIN;

-- Existing private-world resources predate Plants & Trees 2.0. Give every
-- biological node a stable mature lifecycle record without changing its
-- position, resource balance, owner, or generation. The private-world API
-- retains its lazy initializer for worlds created after this migration.
UPDATE private_world_resources
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'plant',
  jsonb_strip_nulls(jsonb_build_object(
    'lifecycleVersion', 2,
    'id', 'private-' || world_id::text || ':' || node_id || ':plant:' || generation::text,
    'speciesId', CASE WHEN resource_type = 'wood' THEN 'pine-tree' ELSE 'wild-herb' END,
    'slot', 0,
    'birthYear', -6,
    'age', 6,
    'stage', CASE WHEN resource_type = 'wood' AND remaining <= 0 THEN 'dead' ELSE 'mature' END,
    'health', CASE WHEN resource_type = 'wood' AND remaining <= 0 THEN 0 ELSE 100 END,
    'resources', GREATEST(0, LEAST(remaining, max_amount)),
    'maxResources', max_amount,
    'lastAdvancedYear', 0,
    'harvestHistory', '[]'::jsonb,
    'generation', GREATEST(1, generation),
    'state', CASE WHEN resource_type = 'wood' AND remaining <= 0 THEN 'stump' ELSE NULL END
  )),
  'lastGrowthAt', to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  'replacementAt', CASE
    WHEN resource_type = 'wood' AND remaining <= 0
      THEN to_jsonb(to_char((now() + interval '24 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    ELSE 'null'::jsonb
  END
)
WHERE resource_type IN ('wood', 'herbs')
  AND COALESCE(metadata, '{}'::jsonb)->'plant' IS NULL;

COMMIT;
