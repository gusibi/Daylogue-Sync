import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { verifyAdminKey, createSessionCookie, checkRateLimit, recordLoginFail, resetLoginFail } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request, platform, cookies, getClientAddress }) => {
    const data = await request.formData();
    const adminKey = data.get('adminKey')?.toString() || '';
    const targetKey = platform?.env?.ADMIN_KEY || 'admin123';
    const secret = platform?.env?.SESSION_SECRET || 'default-secret-key-32-chars-at-least';
    const db = platform?.env?.DB;

    const clientIp = getClientAddress() || '127.0.0.1';

    if (db) {
      const allowed = await checkRateLimit(db, clientIp);
      if (!allowed) {
        return fail(429, { error: '登录失败尝试次数过多，请 10 分钟后再试' });
      }
    }

    const isValid = await verifyAdminKey(adminKey, targetKey);
    if (!isValid) {
      if (db) {
        await recordLoginFail(db, clientIp);
      }
      return fail(400, { error: '密钥错误，请重新输入' });
    }

    if (db) {
      await resetLoginFail(db, clientIp);
    }

    const sessionCookie = await createSessionCookie(secret);
    cookies.set('sync_admin_session', sessionCookie, {
      path: '/',
      httpOnly: true,
      secure: false, // 适配本地开发与线上部署
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60
    });

    throw redirect(303, '/overview');
  }
};
