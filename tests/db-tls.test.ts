import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { databaseTlsOptions } from '../src/lib/db';
import { SUPABASE_ROOT_2021_CA } from '../src/lib/supabase-ca';

test('managed Supabase pooler uses the trusted official root and hostname verification', () => {
  const cert = new X509Certificate(SUPABASE_ROOT_2021_CA);
  assert.match(cert.subject, /Supabase/i);
  assert.ok(Date.parse(cert.validTo) > Date.now(), 'Supabase trust root must not be expired');
  const tls = databaseTlsOptions('aws-1-eu-central-1.pooler.supabase.com');
  assert.equal(tls?.rejectUnauthorized, true);
  assert.equal(tls?.ca, SUPABASE_ROOT_2021_CA);
  assert.equal(databaseTlsOptions('db.gaenqqzplxhdismjzmqs.supabase.co')?.ca, SUPABASE_ROOT_2021_CA);
});

test('TLS remains fail-closed on external hosts and off only for loopback development', () => {
  assert.deepEqual(databaseTlsOptions('postgres.example.com'), {rejectUnauthorized:true});
  assert.equal(databaseTlsOptions('localhost'),undefined);
  assert.equal(databaseTlsOptions('127.0.0.1'),undefined);
  assert.equal(databaseTlsOptions('evilpooler.supabase.com.attacker.test')?.ca, undefined);
});
