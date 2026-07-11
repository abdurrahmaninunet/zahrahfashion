import { redirect } from 'next/navigation';

/** The MIM catalogue lives at /mim now — keep the old path working. */
export default function MimShopRedirect() {
  redirect('/mim');
}
