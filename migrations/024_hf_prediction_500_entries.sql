-- High-frequency prediction capacity: raise plan daily entry ceilings to support ≥500/day on Whale/Pro.

UPDATE plans SET max_daily_entries = 500
WHERE name = 'Whale' AND max_daily_entries < 500;

UPDATE plans SET max_daily_entries = 500
WHERE name = 'Pro' AND max_daily_entries < 500;

UPDATE plans SET max_daily_entries = GREATEST(max_daily_entries, 150)
WHERE name = 'Starter';

UPDATE plans SET max_daily_entries = GREATEST(max_daily_entries, 100)
WHERE name = 'Pay-as-You-Go';

COMMENT ON TABLE plans IS 'Subscription plans; Whale/Pro support up to 500 daily entries with HF ACIE prediction';
