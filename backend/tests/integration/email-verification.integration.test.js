import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../../server.js';
import User from '../../src/models/User.js';

const email = `integration_${Date.now()}@example.com`;
const password = 'StrongPass123';

test('registration issues verification token and blocks login before verification', async () => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Tester',
      email,
      password,
      role: 'patient',
    });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.email, email);
  assert.equal(registerRes.body.user.isVerified, false);
  assert.ok(registerRes.body.verificationToken);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  assert.equal(loginRes.status, 403);
  assert.equal(loginRes.body.code, 'EMAIL_NOT_VERIFIED');
});

test('verify-email activates account and login succeeds', async () => {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      firstName: 'Rana',
      lastName: 'Tester',
      email: `verify_${Date.now()}@example.com`,
      password,
      role: 'patient',
    });

  const verificationToken = registerRes.body.verificationToken;
  assert.ok(verificationToken);

  const verifyRes = await request(app)
    .post('/api/auth/verify-email')
    .send({ token: verificationToken });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.user.isVerified, true);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: verifyRes.body.user.email,
      password,
    });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
});

test('requireVerified middleware blocks unverified token on protected route', async () => {
  const unverifiedUser = await User.create({
    email: `unverified_${Date.now()}@example.com`,
    passwordHash: '$2b$12$IX2f3qUS5xkN9aDymN5lXOUwbl6adPC6EycNIR2A7xv5q9Br8IphK', // StrongPass123
    role: 'patient',
    isVerified: false,
  });

  const token = jwt.sign(
    {
      sub: unverifiedUser.id,
      role: unverifiedUser.role,
      isVerified: false,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const res = await request(app)
    .get('/api/medications')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
});
