import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthFailure, getErrorCode, errorText, AUTH_FAILURE_CODES } from '../src/api/client.js';

test('AUTH_FAILURE_CODES contains all access-token failure codes', () => {
  assert.equal(AUTH_FAILURE_CODES.has('AUTH_REQUIRED'), true);
  assert.equal(AUTH_FAILURE_CODES.has('LOGIN_REQUIRED'), true);
  assert.equal(AUTH_FAILURE_CODES.has('INVALID_ACCESS_TOKEN'), true);
  assert.equal(AUTH_FAILURE_CODES.has('ACCESS_TOKEN_EXPIRED'), true);
  assert.equal(AUTH_FAILURE_CODES.has('ACCOUNT_UNAVAILABLE'), true);
  // Must NOT contain check-in / QR / login credential codes
  assert.equal(AUTH_FAILURE_CODES.has('QR_EXPIRED'), false);
  assert.equal(AUTH_FAILURE_CODES.has('TICKET_EXPIRED'), false);
  assert.equal(AUTH_FAILURE_CODES.has('CHALLENGE_EXPIRED'), false);
  assert.equal(AUTH_FAILURE_CODES.has('INVALID_CREDENTIALS'), false);
});

test('getErrorCode extracts code from detail object, data.code, or headers', () => {
  // From detail.code
  assert.equal(getErrorCode({ response: { data: { detail: { code: 'QR_EXPIRED', message: 'Expired' } } } }), 'QR_EXPIRED');
  // From data.code
  assert.equal(getErrorCode({ response: { data: { code: 'TICKET_EXPIRED' } } }), 'TICKET_EXPIRED');
  // From header
  assert.equal(getErrorCode({ response: { headers: { 'x-error-code': 'ACCESS_TOKEN_EXPIRED' } } }), 'ACCESS_TOKEN_EXPIRED');
  // Absent
  assert.equal(getErrorCode({ response: { data: {} } }), null);
  assert.equal(getErrorCode({}), null);
});

test('isAuthFailure returns true only for actual authentication failures', () => {
  // Access token expired / invalid
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'ACCESS_TOKEN_EXPIRED' } } } }), true);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'INVALID_ACCESS_TOKEN' } } } }), true);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'AUTH_REQUIRED' } } } }), true);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'ACCOUNT_UNAVAILABLE' } } } }), true);
  assert.equal(isAuthFailure({ response: { status: 401, headers: { 'x-error-code': 'ACCESS_TOKEN_EXPIRED' } } }), true);
});

test('isAuthFailure returns false for QR, challenge, and ticket expiry', () => {
  // QR expired / invalid must preserve login
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'QR_EXPIRED' } } } }), false);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'INVALID_QR' } } } }), false);

  // Check-in ticket expired / invalid must preserve login
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'TICKET_EXPIRED' } } } }), false);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'INVALID_TICKET' } } } }), false);

  // Challenge expired / invalid must preserve login
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'CHALLENGE_EXPIRED' } } } }), false);
  assert.equal(isAuthFailure({ response: { status: 401, data: { detail: { code: 'INVALID_CHALLENGE' } } } }), false);
});

test('isAuthFailure returns false for incorrect login credentials', () => {
  const loginError = {
    config: { url: '/api/auth/login' },
    response: { status: 401, data: { detail: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } } }
  };
  assert.equal(isAuthFailure(loginError), false);
});

test('isAuthFailure returns false for non-401, network, and permission errors', () => {
  // 403 Forbidden
  assert.equal(isAuthFailure({ response: { status: 403, data: { detail: 'Role not permitted' } } }), false);
  // 404 Not Found
  assert.equal(isAuthFailure({ response: { status: 404, data: { detail: 'Not found' } } }), false);
  // 409 Conflict
  assert.equal(isAuthFailure({ response: { status: 409, data: { detail: 'Conflict' } } }), false);
  // 422 Validation
  assert.equal(isAuthFailure({ response: { status: 422, data: { detail: 'Invalid payload' } } }), false);
  // 500 Server Error
  assert.equal(isAuthFailure({ response: { status: 500, data: { detail: 'Internal Server Error' } } }), false);
  // Network error (no response)
  assert.equal(isAuthFailure({ message: 'Network Error' }), false);
});

test('errorText formats detail objects, strings, arrays, and fallbacks properly', () => {
  // Object detail with message
  assert.equal(errorText({ response: { data: { detail: { code: 'QR_EXPIRED', message: 'QR code expired' } } } }), 'QR_EXPIRED: QR code expired' ? 'QR code expired' : '');
  // Object detail with only code
  assert.equal(errorText({ response: { data: { detail: { code: 'QR_EXPIRED' } } } }), 'QR_EXPIRED');
  // String detail
  assert.equal(errorText({ response: { data: { detail: 'Simple error message' } } }), 'Simple error message');
  // Pydantic array detail
  const pydanticError = {
    response: {
      data: {
        detail: [
          { loc: ['body', 'email'], msg: 'field required' },
          { loc: ['body', 'password'], msg: 'too short' }
        ]
      }
    }
  };
  assert.equal(errorText(pydanticError), 'body.email: field required; body.password: too short');
  // Fallback to error.message
  assert.equal(errorText({ message: 'Connection refused' }), 'Connection refused');
});
