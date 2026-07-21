import { cookies as getCookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { AdminService } from '@/lib/services/AdminService';

export const ADMIN_TOKEN_COOKIE = 'admin_token';

export async function requireAdminSession(
  request: NextRequest,
  adminService: AdminService,
): Promise<void> {
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  await adminService.verifySession(token);
}

export async function hasValidAdminSession(adminService: AdminService): Promise<boolean> {
  const cookieStore = await getCookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  try {
    await adminService.verifySession(token);
    return true;
  } catch {
    return false;
  }
}
