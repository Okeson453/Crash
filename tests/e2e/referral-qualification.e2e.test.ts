/**
 * Live referral E2E — requires DATABASE_URL and applied migrations.
 * Skipped automatically when DATABASE_URL is unset (CI without services).
 *
 * Path under test:
 *   attribute → Observer (not qualified) → PAYG payment → QUALIFIED → milestone ledger
 */

const hasDb = Boolean(process.env.DATABASE_URL);

(hasDb ? describe : describe.skip)('referral qualification E2E (live DB)', () => {
  it('documents required environment', () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });

  it.todo('User A obtains referral code');
  it.todo('User B attributes via code');
  it.todo('B remains Observer → referral not QUALIFIED');
  it.todo('B subscribes PAYG + payment confirmed → QUALIFIED');
  it.todo('A reaches milestone → reward ledger row with tenant_id');
  it.todo('Refund → qualification invalidated + reward reversed');
  it.todo('Self-referral rejected');
  it.todo('Duplicate referred account rejected');
});
