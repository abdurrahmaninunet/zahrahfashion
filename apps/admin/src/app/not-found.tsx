import { redirect } from 'next/navigation';

/**
 * Global 404 handler — any unmatched route (or an explicit `notFound()`) sends
 * the user to the admin home instead of showing a not-found page.
 */
export default function NotFound() {
  redirect('/');
}
