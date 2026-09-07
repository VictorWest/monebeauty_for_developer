export const ADMIN_SIDEBAR_COOKIE = "mone_admin_sidebar";
export const ADMIN_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAdminSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}
