import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('sync_admin_session', { path: '/' });
  throw redirect(303, '/login');
};
