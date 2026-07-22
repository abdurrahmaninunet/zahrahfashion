import { Fragment } from 'react';
import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { STATIC_PAGES } from '@/lib/static-pages';
import { ShopCards } from '@/components/shop-cards';

export const revalidate = 60;

const PROSE =
  'prose prose-stone text-left text-base leading-relaxed [&_a]:font-medium [&_a]:text-[#8a6d1f] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const canonical = `/pages/${slug}`;
  if (STATIC_PAGES[slug]) return { title: STATIC_PAGES[slug].title, alternates: { canonical } };
  try {
    const page = await serverApi<{ title: string }>(`/store/pages/${slug}`);
    return { title: page.title, alternates: { canonical } };
  } catch {
    return {};
  }
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Hard-coded Help & Company pages take precedence over the CMS.
  let page: { title: string; body: string; redirect?: string } | undefined = STATIC_PAGES[slug];
  if (!page) {
    try {
      page = await serverApi<{ title: string; body: string; redirect?: string }>(`/store/pages/${slug}`);
    } catch {
      notFound();
    }
  }
  if (page!.redirect) redirect(`/pages/${page!.redirect}`); // D-30

  return (
    <article className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
      <div className="mx-auto max-w-3xl text-left">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{page!.title}</h1>
        {page!.body ? (
          <div className="mt-5 space-y-6">
            {page!.body.split('[[SHOPS]]').map((chunk, i) => (
              <Fragment key={i}>
                {i > 0 && <ShopCards />}
                {chunk.trim() && <div className={PROSE} dangerouslySetInnerHTML={{ __html: chunk }} />}
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-base text-stone-500">This page is being written — chat with us on WhatsApp if you need anything.</p>
        )}
      </div>
    </article>
  );
}
