import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthFailure,
  setPortalAuth,
  getPortalUser,
  clearPortalAuth
} from '../src/api/client.js';

// Mock sessionStorage in node environment
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};

test('ACCOUNT_SUSPENDED (403) during login does not trigger unauthorized logout handler', () => {
  const accountSuspendedError = {
    config: { url: '/api/auth/login' },
    response: {
      status: 403,
      headers: { 'x-error-code': 'ACCOUNT_SUSPENDED' },
      data: {
        detail: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended: Academic integrity inquiry'
        }
      }
    }
  };
  assert.equal(isAuthFailure(accountSuspendedError), false);
});

test('ACCOUNT_UNAVAILABLE (401) on suspended token triggers session cleanup', () => {
  const suspendedTokenError = {
    config: { url: '/api/attendance/me' },
    response: {
      status: 401,
      headers: { 'x-error-code': 'ACCOUNT_UNAVAILABLE' },
      data: {
        detail: {
          code: 'ACCOUNT_UNAVAILABLE',
          message: 'Account has been suspended'
        }
      }
    }
  };
  assert.equal(isAuthFailure(suspendedTokenError), true);
});

test('Pending account status is properly stored and read in portal session', () => {
  storage.clear();
  const pendingStudent = {
    id: 99,
    name: 'New Applicant',
    email: 'applicant@university.edu',
    role: 'student',
    student_code: '2026-CSE-999',
    department: 'CSE',
    status: 'pending'
  };

  setPortalAuth('student', 'token-pending-123', pendingStudent);
  const user = getPortalUser('student');
  assert.equal(user.status, 'pending');
  assert.equal(user.student_code, '2026-CSE-999');

  clearPortalAuth('student');
  assert.equal(getPortalUser('student'), null);
});

test('Approved account status retains institutional verification metadata', () => {
  storage.clear();
  const approvedTeacher = {
    id: 88,
    name: 'Dr. Faculty Member',
    email: 'faculty@university.edu',
    role: 'teacher',
    staff_id: 'FAC-CSE-001',
    department: 'CSE',
    status: 'approved',
    verified_method: 'institutional_roster'
  };

  setPortalAuth('teacher', 'token-approved-456', approvedTeacher);
  const user = getPortalUser('teacher');
  assert.equal(user.status, 'approved');
  assert.equal(user.verified_method, 'institutional_roster');

  clearPortalAuth('teacher');
});
