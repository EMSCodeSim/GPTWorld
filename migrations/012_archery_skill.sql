BEGIN;
ALTER TABLE player_crafting_skills DROP CONSTRAINT IF EXISTS player_crafting_skills_skill_key_check;
ALTER TABLE player_crafting_skills ADD CONSTRAINT player_crafting_skills_skill_key_check CHECK (skill_key IN ('carpentry','masonry','herbalism','blacksmithing','tailoring','cooking','farming','construction','hunting','archery'));
COMMIT;
