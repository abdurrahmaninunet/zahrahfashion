import { redirect } from 'next/navigation';

/**
 * Global 404 handler — any unmatched route (or an explicit `notFound()`) sends
 * the visitor to the homepage instead of showing a not-found page.
 */
export default function NotFound() {
  redirect('/');
}
