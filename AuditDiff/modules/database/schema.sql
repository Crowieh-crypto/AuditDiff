-- packages/database/schema.sql
-- Complete AuditDiff schema: 5 tables

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contracts we have scanned
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'mainnet',
  name TEXT,
  abi_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, network)
);

-- A scan job: one block range on one contract
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID REFERENCES contracts(id),
  from_block INTEGER NOT NULL,
  to_block INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | running | complete | error
  progress_pct INTEGER DEFAULT 0,
  progress_message TEXT,
  error TEXT,
  slots_scanned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual state variable changes found in a scan
CREATE TABLE IF NOT EXISTS state_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  slot_index TEXT,
  variable_name TEXT NOT NULL,
  variable_type TEXT,
  category TEXT,
  value_before TEXT,
  value_after TEXT,
  raw_before TEXT,
  raw_after TEXT,
  tx_hash TEXT,
  block_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Findings: classified and severity-rated issues
CREATE TABLE IF NOT EXISTS findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  state_change_id UUID REFERENCES state_changes(id),
  rule_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  -- severity: critical | high | medium | low
  is_combo BOOLEAN DEFAULT false,
  escalated BOOLEAN DEFAULT false,
  intel_notes JSONB,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Address intelligence cache
CREATE TABLE IF NOT EXISTS address_intel (
  address TEXT PRIMARY KEY,
  tx_count INTEGER,
  first_seen TIMESTAMPTZ,
  is_known_exploiter BOOLEAN DEFAULT false,
  is_known_labeled BOOLEAN DEFAULT false,
  label TEXT,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scans_contract ON scans(contract_id);
CREATE INDEX IF NOT EXISTS idx_state_changes_scan ON state_changes(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_address_intel_fetched ON address_intel(fetched_at);
