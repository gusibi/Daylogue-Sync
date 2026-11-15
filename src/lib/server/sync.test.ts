import { describe, it, expect } from 'vitest';
import { compareHlc, isHlcNewer } from './hlc';
import { sha256, timingSafeEqual, verifyAdminKey, createSessionCookie, verifySessionCookie } from './auth';
import { WIPE_PHRASE } from '$lib/confirm';
import wipeCases from '../../../protocol/fixtures/wipe_cases.json';
import conflictCases from '../../../protocol/fixtures/conflict_records.json';

describe('T0 & T1 核心逻辑与测试向量校验', () => {
  it('HLC 字典序比较应满足 LWW 偏序关系', () => {
    const t1 = '1763184000100-0001-dev_01';
    const t2 = '1763184000100-0002-dev_01';
    const t3 = '1763184000200-0001-dev_01';

    expect(compareHlc(t1, t2)).toBe(-1);
    expect(compareHlc(t2, t1)).toBe(1);
    expect(compareHlc(t1, t1)).toBe(0);

    expect(isHlcNewer(t2, t1)).toBe(true);
    expect(isHlcNewer(t3, t2)).toBe(true);
    expect(isHlcNewer(t1, t3)).toBe(false);
  });

  it('来自测试向量的冲突判定用例', () => {
    const serverHlc = conflictCases.existingOnServer.hlc;
    const olderHlc = conflictCases.incomingOlder.hlc;
    const newerHlc = conflictCases.incomingNewer.hlc;

    expect(isHlcNewer(olderHlc, serverHlc)).toBe(false);
    expect(isHlcNewer(newerHlc, serverHlc)).toBe(true);
  });

  it('安全鉴权工具恒定时间比较与 SHA-256', async () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('abcdef', 'abc')).toBe(false);

    expect(await verifyAdminKey('secret123', 'secret123')).toBe(true);
    expect(await verifyAdminKey('wrong', 'secret123')).toBe(false);

    const hash = await sha256('hello-token');
    expect(hash.length).toBe(64);
  });

  it('HMAC 签名 Session Cookie 生成与校验', async () => {
    const secret = 'super-secret-key-32-chars-long!!';
    const cookie = await createSessionCookie(secret);
    expect(cookie).toContain('.');

    const isValid = await verifySessionCookie(cookie, secret);
    expect(isValid).toBe(true);

    const isTamperedValid = await verifySessionCookie(cookie + 'x', secret);
    expect(isTamperedValid).toBe(false);

    const wrongSecretValid = await verifySessionCookie(cookie, 'another-secret');
    expect(wrongSecretValid).toBe(false);
  });

  it('全系统唯一 Wipe 确认短语严格一致性校验', () => {
    expect(WIPE_PHRASE).toBe('我知道要删除远端数据');
    expect(wipeCases.expectedPhrase).toBe(WIPE_PHRASE);
    expect(wipeCases.validRequest.confirm).toBe(WIPE_PHRASE);

    for (const inv of wipeCases.invalidRequests) {
      expect(inv.confirm === WIPE_PHRASE).toBe(false);
    }
  });
});
