import { describe, it, expect } from 'vitest';
import { classifyError } from './index.js';

describe('classifyError', () => {
  it('classifies getaddrinfo ENOTFOUND as dns', () => {
    const result = classifyError(new Error('getaddrinfo ENOTFOUND www.example.com'));
    expect(result.errorType).toBe('dns');
    expect(result.msg).toBe('getaddrinfo ENOTFOUND www.example.com');
  });

  it('classifies ECONNREFUSED as dns', () => {
    const result = classifyError(new Error('ECONNREFUSED 127.0.0.1:443'));
    expect(result.errorType).toBe('dns');
    expect(result.msg).toBe('ECONNREFUSED 127.0.0.1:443');
  });

  it('classifies ERR_NAME_NOT_RESOLVED as dns', () => {
    const result = classifyError(new Error('ERR_NAME_NOT_RESOLVED'));
    expect(result.errorType).toBe('dns');
    expect(result.msg).toBe('ERR_NAME_NOT_RESOLVED');
  });

  it('classifies Navigation timeout as timeout', () => {
    const result = classifyError(new Error('Navigation timeout of 30000 ms exceeded'));
    expect(result.errorType).toBe('timeout');
    expect(result.msg).toBe('Navigation timeout of 30000 ms exceeded');
  });

  it('classifies Timeout waiting for selector as timeout', () => {
    const result = classifyError(new Error('Timeout waiting for selector'));
    expect(result.errorType).toBe('timeout');
    expect(result.msg).toBe('Timeout waiting for selector');
  });

  it('classifies HTTP 503 error as unknown', () => {
    const result = classifyError(new Error('HTTP 503 from https://example.com'));
    expect(result.errorType).toBe('unknown');
    expect(result.msg).toBe('HTTP 503 from https://example.com');
  });

  it('classifies an unrecognized error message as unknown', () => {
    const result = classifyError(new Error('something completely different'));
    expect(result.errorType).toBe('unknown');
    expect(result.msg).toBe('something completely different');
  });

  it('classifies a raw string thrown as unknown with the string as msg', () => {
    const result = classifyError('raw string thrown');
    expect(result.errorType).toBe('unknown');
    expect(result.msg).toBe('raw string thrown');
  });

  it('classifies a non-Error non-string (number) as unknown with stringified msg', () => {
    const result = classifyError(42);
    expect(result.errorType).toBe('unknown');
    expect(result.msg).toBe('42');
  });
});
