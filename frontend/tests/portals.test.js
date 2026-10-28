import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveActivePortal,
  getPortalToken,
  getPortalUser,
  setPortalAuth,
  clearPortalAuth,
  isAuthFailure,
  formatAccountName
} from '../src/api/client.js';

// Mock sessionStorage in node environment for testing scoped storage
const storage = new Map();
globalThis.sessionStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};

test('resolveActivePortal identifies portal from pathname', () => {
  assert.equal(resolveActivePortal('/student'), 'student');
  assert.equal(resolveActivePortal('/student/dashboard'), 'student');
  assert.equal(resolveActivePortal('/student/checkin'), 'student');

  assert.equal(resolveActivePortal('/teacher'), 'teacher');
  assert.equal(resolveActivePortal('/teacher/dashboard'), 'teacher');
  assert.equal(resolveActivePortal('/teacher/sessions/42'), 'teacher');

  assert.equal(resolveActivePortal('/admin'), 'admin');
  assert.equal(resolveActivePortal('/admin/dashboard'), 'admin');
  assert.equal(resolveActivePortal('/admin/settings'), 'admin');

  assert.equal(resolveActivePortal('/'), null);
  assert.equal(resolveActivePortal('/login'), null);
});

test('scoped storage maintains strict isolation between portals', () => {
  storage.clear();

  const studentUser = { id: 1, name: 'Alice Student', role: 'student', student_code: 'S101' };
  const teacherUser = { id: 2, name: 'Bob Teacher', role: 'teacher' };
  const adminUser = { id: 3, name: 'Charlie Admin', role: 'admin' };

  // Set student credentials
  setPortalAuth('student', 'token-student-123', studentUser);
  assert.equal(getPortalToken('student'), 'token-student-123');
  assert.deepEqual(getPortalUser('student'), studentUser);
  assert.equal(getPortalToken('teacher'), null);
  assert.equal(getPortalToken('admin'), null);

  // Set teacher credentials
  setPortalAuth('teacher', 'token-teacher-456', teacherUser);
  assert.equal(getPortalToken('teacher'), 'token-teacher-456');
  assert.deepEqual(getPortalUser('teacher'), teacherUser);
  // Student must still be intact
  assert.equal(getPortalToken('student'), 'token-student-123');
  assert.deepEqual(getPortalUser('student'), studentUser);

  // Set admin credentials
  setPortalAuth('admin', 'token-admin-789', adminUser);
  assert.equal(getPortalToken('admin'), 'token-admin-789');

  // Clearing teacher portal must not affect student or admin
  clearPortalAuth('teacher');
  assert.equal(getPortalToken('teacher'), null);
  assert.equal(getPortalUser('teacher'), null);
  assert.equal(getPortalToken('student'), 'token-student-123');
  assert.equal(getPortalToken('admin'), 'token-admin-789');

  // Clearing all portals
  clearPortalAuth();
  assert.equal(getPortalToken('student'), null);
  assert.equal(getPortalToken('admin'), null);
});

test('WRONG_PORTAL status 403 does not trigger unauthorized logout handler', () => {
  const wrongPortalError = {
    config: { url: '/api/auth/login' },
    response: {
      status: 403,
      data: {
        detail: {
          code: 'WRONG_PORTAL',
          message: 'This account is not authorized for the Teacher Portal.'
        }
      }
    }
  };
  assert.equal(isAuthFailure(wrongPortalError), false);
});

test('formatAccountName displays Administrator for seeded default and preserves custom names', () => {
  assert.equal(formatAccountName('DEMO Administrator'), 'Administrator');
  assert.equal(formatAccountName('Dr. Sarah Rahman'), 'Dr. Sarah Rahman');
  assert.equal(formatAccountName('DEMO Student 1'), 'DEMO Student 1');
  assert.equal(formatAccountName('DEMO Teacher 1'), 'DEMO Teacher 1');
  assert.equal(formatAccountName(''), '');
  assert.equal(formatAccountName(null), '');
  assert.equal(formatAccountName(undefined), '');
});
