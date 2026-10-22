import Link from 'next/link';

interface LegalShellProps {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for /privacy and /terms. Plain prose, no client JS.
 * Content uses semantic headings so it stays readable when printed or
 * fetched by crawlers.
 */
export function LegalShell({ title, effectiveDate, children }: LegalShellProps) {
  return (
    <>
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg text-primary">
            TideeUp
          </Link>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Effective {effectiveDate}</p>
        </header>

        <article
          className="space-y-8 text-[15px] leading-relaxed text-foreground
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-2
            [&_p]:text-muted-foreground
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4"
        >
          {children}
        </article>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 py-8 text-sm text-muted-foreground">
          Questions? Email{' '}
          <a href="mailto:hello@tideeup.com" className="underline underline-offset-4">
            hello@tideeup.com
          </a>
          .
        </div>
      </footer>
    </>
  );
}
