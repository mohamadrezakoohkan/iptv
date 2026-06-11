// ADR: ADR-0002
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const rtr = req('../../server/rtr.js');
const isValidUrl = rtr._isValidUrl;

describe('isValidUrl — proxy URL validation', function () {
  it('accepts a valid http URL', function () {
    expect(isValidUrl('http://example.com/path')).toBe(true);
  });

  it('accepts a valid https URL', function () {
    expect(isValidUrl('https://stream.example.org/live/index.m3u8')).toBe(true);
  });

  it('rejects when url param is missing (undefined)', function () {
    expect(isValidUrl(undefined)).toBe(false);
  });

  it('rejects when url param is empty string', function () {
    expect(isValidUrl('')).toBe(false);
  });

  it('rejects a non-http scheme (ftp)', function () {
    expect(isValidUrl('ftp://example.com/file')).toBe(false);
  });

  it('rejects a non-http scheme (file)', function () {
    expect(isValidUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects localhost by name', function () {
    expect(isValidUrl('http://localhost:3000/api')).toBe(false);
  });

  it('rejects 127.0.0.1', function () {
    expect(isValidUrl('http://127.0.0.1:8080/api')).toBe(false);
  });

  it('rejects ::1 (IPv6 loopback)', function () {
    expect(isValidUrl('http://[::1]/api')).toBe(false);
  });

  it('rejects a non-URL string', function () {
    expect(isValidUrl('not-a-url')).toBe(false);
  });
});
