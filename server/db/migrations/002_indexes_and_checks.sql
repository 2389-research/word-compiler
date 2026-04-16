-- 002_indexes_and_checks.sql
--
-- Adds missing indexes surfaced by the #44 audit, and installs CHECK-like
-- triggers on enum-valued columns. SQLite does not support ALTER TABLE ADD
-- CHECK, so we emulate CHECK constraints using BEFORE INSERT / BEFORE UPDATE
-- triggers that call RAISE(ABORT, ...).
--
-- Trigger names encode the table and column so that the runtime error
-- messages ("projects.status ...") are greppable in logs and tests.

-- ---------------------------------------------------------------------------
-- Missing indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_scene_plans_project
  ON scene_plans(project_id);

-- ASC index: SQLite scans it in reverse to satisfy ORDER BY created_at DESC,
-- so the ASC form is sufficient and avoids any version-floor concerns around
-- descending-index support.
CREATE INDEX IF NOT EXISTS idx_voice_guide_versions_created_at
  ON voice_guide_versions(created_at);

-- ---------------------------------------------------------------------------
-- projects.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_projects_status_insert
BEFORE INSERT ON projects
FOR EACH ROW
WHEN NEW.status NOT IN ('bootstrap', 'bible', 'planning', 'drafting', 'revising')
BEGIN
  SELECT RAISE(ABORT, 'projects.status must be one of bootstrap|bible|planning|drafting|revising');
END;

CREATE TRIGGER IF NOT EXISTS chk_projects_status_update
BEFORE UPDATE OF status ON projects
FOR EACH ROW
WHEN NEW.status NOT IN ('bootstrap', 'bible', 'planning', 'drafting', 'revising')
BEGIN
  SELECT RAISE(ABORT, 'projects.status must be one of bootstrap|bible|planning|drafting|revising');
END;

-- ---------------------------------------------------------------------------
-- scene_plans.status
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_scene_plans_status_insert
BEFORE INSERT ON scene_plans
FOR EACH ROW
WHEN NEW.status NOT IN ('planned', 'drafting', 'complete')
BEGIN
  SELECT RAISE(ABORT, 'scene_plans.status must be one of planned|drafting|complete');
END;

CREATE TRIGGER IF NOT EXISTS chk_scene_plans_status_update
BEFORE UPDATE OF status ON scene_plans
FOR EACH ROW
WHEN NEW.status NOT IN ('planned', 'drafting', 'complete')
BEGIN
  SELECT RAISE(ABORT, 'scene_plans.status must be one of planned|drafting|complete');
END;

-- ---------------------------------------------------------------------------
-- audit_flags.severity
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS chk_audit_flags_severity_insert
BEFORE INSERT ON audit_flags
FOR EACH ROW
WHEN NEW.severity NOT IN ('critical', 'warning', 'info')
BEGIN
  SELECT RAISE(ABORT, 'audit_flags.severity must be one of critical|warning|info');
END;

CREATE TRIGGER IF NOT EXISTS chk_audit_flags_severity_update
BEFORE UPDATE OF severity ON audit_flags
FOR EACH ROW
WHEN NEW.severity NOT IN ('critical', 'warning', 'info')
BEGIN
  SELECT RAISE(ABORT, 'audit_flags.severity must be one of critical|warning|info');
END;

-- ---------------------------------------------------------------------------
-- profile_adjustments.status
-- ---------------------------------------------------------------------------

-- Source of truth: TuningProposal.status in src/learner/tuning.ts
CREATE TRIGGER IF NOT EXISTS chk_profile_adjustments_status_insert
BEFORE INSERT ON profile_adjustments
FOR EACH ROW
WHEN NEW.status NOT IN ('pending', 'accepted', 'rejected')
BEGIN
  SELECT RAISE(ABORT, 'profile_adjustments.status must be one of pending|accepted|rejected');
END;

CREATE TRIGGER IF NOT EXISTS chk_profile_adjustments_status_update
BEFORE UPDATE OF status ON profile_adjustments
FOR EACH ROW
WHEN NEW.status NOT IN ('pending', 'accepted', 'rejected')
BEGIN
  SELECT RAISE(ABORT, 'profile_adjustments.status must be one of pending|accepted|rejected');
END;

-- ---------------------------------------------------------------------------
-- learned_patterns.status
-- ---------------------------------------------------------------------------

-- Source of truth: LearnedPattern.status in src/learner/patterns.ts
CREATE TRIGGER IF NOT EXISTS chk_learned_patterns_status_insert
BEFORE INSERT ON learned_patterns
FOR EACH ROW
WHEN NEW.status NOT IN ('proposed', 'accepted', 'rejected', 'expired')
BEGIN
  SELECT RAISE(ABORT, 'learned_patterns.status must be one of proposed|accepted|rejected|expired');
END;

CREATE TRIGGER IF NOT EXISTS chk_learned_patterns_status_update
BEFORE UPDATE OF status ON learned_patterns
FOR EACH ROW
WHEN NEW.status NOT IN ('proposed', 'accepted', 'rejected', 'expired')
BEGIN
  SELECT RAISE(ABORT, 'learned_patterns.status must be one of proposed|accepted|rejected|expired');
END;
