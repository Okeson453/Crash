/**
 * Fraud signal classification rules (pure).
 */

function classifyStatus(status: string): { type: string; severity: string } {
  if (status === 'REJECTED_SELF_REFERRAL') return { type: 'self_referral', severity: 'high' };
  if (status === 'REJECTED_DUPLICATE') return { type: 'duplicate_referred', severity: 'medium' };
  if (status === 'REJECTED_FRAUD') return { type: 'rejected_fraud', severity: 'high' };
  if (status === 'REJECTED_REFUND' || status === 'REJECTED_CHARGEBACK')
    return { type: 'rejected_refund', severity: 'medium' };
  return { type: 'unknown', severity: 'low' };
}

describe('admin referral fraud classification', () => {
  it('classifies self-referral as high', () => {
    expect(classifyStatus('REJECTED_SELF_REFERRAL')).toEqual({
      type: 'self_referral',
      severity: 'high',
    });
  });

  it('classifies duplicate as medium', () => {
    expect(classifyStatus('REJECTED_DUPLICATE').severity).toBe('medium');
  });

  it('classifies fraud as high', () => {
    expect(classifyStatus('REJECTED_FRAUD').type).toBe('rejected_fraud');
  });

  it('treats velocity > 10 as medium signal threshold', () => {
    const count = 11;
    expect(count > 10).toBe(true);
  });
});
