import { redirect, type Handle } from '@sveltejs/kit';
import { verifySessionCookie } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  const secret = event.platform?.env?.SESSION_SECRET || 'default-secret-key-32-chars-at-least';
  const sessionCookie = event.cookies.get('sync_admin_session');

  const isAdmin = await verifySessionCookie(sessionCookie, secret);
  event.locals.isAdmin = isAdmin;

  const url = event.url.pathname;

  // 后台页面保护逻辑（/api 和 /login 不拦截）
  if (!url.startsWith('/api/') && !url.startsWith('/login')) {
    if (!isAdmin) {
      throw redirect(303, '/login');
    }
  }

  // 若已登录访问 /login，直接跳转至 /overview
  if (url === '/login' && isAdmin) {
    throw redirect(303, '/overview');
  }

  // 根路径重定向
  if (url === '/') {
    throw redirect(303, isAdmin ? '/overview' : '/login');
  }

  return resolve(event);
};
