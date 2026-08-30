import { errorEnvelope, sendApiError } from '@/api/errors/envelope';

describe('Issues 26–30', () => {
  it('29: error envelope shape', () => {
    const e = errorEnvelope('FOO', 'bar', { x: 1 }, 'req-1');
    expect(e).toEqual({
      error: { code: 'FOO', message: 'bar', details: { x: 1 }, requestId: 'req-1' },
    });
  });

  it('29: sendApiError uses status + envelope', () => {
    let status = 0;
    let body: unknown;
    sendApiError(
      {
        status: (n) => {
          status = n;
          return {
            send: (b) => {
              body = b;
            },
          };
        },
      },
      422,
      'VALIDATION_ERROR',
      'bad',
      { field: 'status' }
    );
    expect(status).toBe(422);
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'bad', details: { field: 'status' } },
    });
  });
});
