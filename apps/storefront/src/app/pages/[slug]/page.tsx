import { redirect, notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { STATIC_PAGES } from '@/lib/static-pages';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (STATIC_PAGES[slug]) return { title: STATIC_PAGES[slug].title };
  try {
    const page = await serverApi<{ title: string }>(`/store/pages/${slug}`);
    return { title: page.title };
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
    <article className="mx-auto max-w-[1905px] px-2.5 py-10 lg:px-[8rem]">
      <div className="max-w-3xl text-left">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{page!.title}</h1>
        {page!.body ? (
          <div
            className="prose prose-stone mt-5 text-left text-base leading-relaxed [&_a]:font-medium [&_a]:text-[#8a6d1f] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: page!.body }}
          />
        ) : (
          <p className="mt-5 text-base text-stone-500">This page is being written — chat with us on WhatsApp if you need anything.</p>
        )}
      </div>
    </article>
  );
}
