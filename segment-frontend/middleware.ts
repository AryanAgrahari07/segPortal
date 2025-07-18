import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/verify-otp'];

// Define role-specific routes
const adminRoutes = ['/admin'];
const userRoutes = ['/dashboard', '/table', '/segment'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to public routes without authentication
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get the token and role from cookies
  const token = request.cookies.get('token')?.value;
  const userRole = request.cookies.get('userRole')?.value;
  
  // If no token is found, redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // Check if admin is trying to access admin routes
  if (adminRoutes.some(route => pathname.startsWith(route)) && userRole !== 'admin') {
    // Redirect non-admin users to dashboard
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  // Check if user is trying to access user routes
  if (userRoutes.some(route => pathname.startsWith(route)) && !['admin', 'user'].includes(userRole || '')) {
    // Redirect unauthorized users to login
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // Allow access to the requested page
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$).*)',
  ],
}; 