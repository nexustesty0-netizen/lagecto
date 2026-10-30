import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportShell, SignInHint } from "@/components/support/SupportShell";
import { SupportCards } from "@/components/support/SupportCards";
import { FaqAccordion } from "@/components/support/FaqAccordion";
import { SupportCaseForm } from "@/components/support/SupportCaseForm";
import { LegalViewer } from "@/components/support/LegalViewer";
import { TicketThread } from "@/components/support/TicketThread";
import { HelpActions } from "@/components/support/HelpActions";
import { EmptyState, StatusBadge } from "@/components/ui/primitives";
import { getProfile } from "@/lib/auth/session";
import { getPublicShop } from "@/lib/public-catalog";
import {
  loadAbout,
  loadFaqs,
  loadHelpArticle,
  loadHelpArticles,
  loadLegal,
  loadLegalVersion,
  loadMyCase,
  loadMyCases,
  loadSupportContact,
} from "@/lib/support/load";
import { TECHNICAL_ISSUES } from "@/lib/support/constants";
import { formatDate } from "@/lib/format";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export async function SupportRouter({
  section,
  searchParams,
  basePath,
  audience,
}: {
  section: string[];
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
  audience: "all" | "customer" | "shop_owner";
}) {
  const current = [basePath, ...section].join("/").replace(/\/$/, "") || basePath;
  const key = section[0] || "home";
  const profile = await getProfile();
  const signedIn = Boolean(profile);
  if (key === "home") {
    const contact = await loadSupportContact();
    return (
      <SupportShell basePath={basePath} current={current} showSearch>
        <SupportCards basePath={basePath} />
        <p className="mt-8 text-sm text-[var(--lagecto-muted)]">
          {contact.name} Support · {contact.phone} · {contact.email}
        </p>
      </SupportShell>
    );
  }

  if (key === "faqs") {
    const faqs = await loadFaqs(audience === "shop_owner" ? "shop_owner" : "all");
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="mb-4 text-2xl font-semibold">Frequently Asked Questions</h2>
        <FaqAccordion faqs={faqs} />
      </SupportShell>
    );
  }

  if (key === "contact") {
    const contact = await loadSupportContact();
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="text-2xl font-semibold">Contact LaGecto Support</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="lg-card p-6">
            <p className="font-semibold">{contact.name} Support</p>
            <p className="mt-3">Phone: {contact.phone}</p>
            <p>
              Email:{" "}
              <a className="text-[#0B6E4F] underline" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </p>
            <HelpActions />
          </article>
          {signedIn ? (
            <SupportCaseForm kind="support" basePath={basePath} forShopOwner={audience === "shop_owner"} />
          ) : (
            <SignInHint href={`${basePath}/contact`} />
          )}
        </div>
      </SupportShell>
    );
  }

  if (key === "tickets") {
    if (!profile) {
      return (
        <SupportShell basePath={basePath} current={current} variant="quiet">
          <SignInHint href={`${basePath}/tickets`} />
        </SupportShell>
      );
    }
    const caseId = section[1];
    if (caseId) {
      const packed = await loadMyCase(caseId, profile.id, profile.role === "admin");
      if (!packed) notFound();
      return (
        <SupportShell basePath={basePath} current={current} variant="quiet">
          <TicketThread ticket={packed.ticket} messages={packed.messages} notes={packed.notes} isAdmin={profile.role === "admin"} />
        </SupportShell>
      );
    }
    const cases = await loadMyCases(profile.id);
    return (
      <SupportShell basePath={basePath} current={current} variant="quiet">
        <h2 className="mb-4 text-2xl font-semibold">My requests</h2>
        {!cases.length ? (
          <div>
            <EmptyState title="No support requests yet." body="Everything looks quiet here. If you need help, we're ready." />
            <Link href={`${basePath}/contact`} className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">
              Contact Support
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {cases.map((row) => (
              <li key={row.id}>
                <Link href={`${basePath}/tickets/${row.id}`} className="lg-card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-mono text-xs text-[#0B6E4F]">{row.ticket_number}</p>
                    <p className="font-semibold">{row.subject}</p>
                    <p className="text-xs text-[var(--lagecto-muted)]">
                      {row.kind} · {row.category} · {formatDate(row.updated_at)}
                    </p>
                  </div>
                  <StatusBadge value={row.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SupportShell>
    );
  }

  if (key === "bug") {
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="text-2xl font-semibold">Report a Bug</h2>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">Tell us what broke. Do not include passwords or payment PINs.</p>
        {signedIn ? (
          <div className="mt-6">
            <SupportCaseForm kind="bug" basePath={basePath} />
          </div>
        ) : (
          <div className="mt-6">
            <SignInHint href={`${basePath}/bug`} />
          </div>
        )}
      </SupportShell>
    );
  }

  if (key === "technical") {
    const guides = await loadHelpArticles("troubleshooting");
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="text-2xl font-semibold">Technical issues</h2>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">Try these steps first. They are ordinary browser checks — nothing risky.</p>
        <ul className="mt-6 grid gap-3">
          {TECHNICAL_ISSUES.map((item) => {
            const guide = guides.find((row) => row.slug === item.guide);
            return (
              <li key={item.id} className="lg-card p-4">
                <p className="font-semibold">{item.label}</p>
                {guide ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{guide.summary}</p> : null}
                <Link href={`${basePath}/articles/${item.guide}`} className="text-sm font-semibold text-[#0B6E4F]">
                  Read the guide
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 font-semibold">Still having trouble? Contact Support.</p>
        {signedIn ? (
          <div className="mt-4">
            <SupportCaseForm kind="technical" basePath={basePath} forShopOwner={audience === "shop_owner"} />
          </div>
        ) : (
          <SignInHint href={`${basePath}/technical`} />
        )}
      </SupportShell>
    );
  }

  if (key === "feedback") {
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="text-2xl font-semibold">What do you think about LaGecto?</h2>
        {signedIn ? (
          <div className="mt-6">
            <SupportCaseForm kind="feedback" basePath={basePath} />
          </div>
        ) : (
          <div className="mt-6">
            <SignInHint href={`${basePath}/feedback`} />
          </div>
        )}
      </SupportShell>
    );
  }

  if (key === "report-shop") {
    const shopId = firstParam(searchParams.shop) || firstParam(searchParams.shopId);
    const shop = shopId ? await getPublicShop(shopId) : null;
    return (
      <SupportShell basePath={basePath} current={current}>
        <h2 className="text-2xl font-semibold">Report this shop</h2>
        {signedIn ? (
          <div className="mt-6">
            <SupportCaseForm
              kind="shop_report"
              basePath={basePath}
              shopId={shop?.id || shopId || undefined}
              shopName={shop?.name}
            />
          </div>
        ) : (
          <div className="mt-6">
            <SignInHint href={`${basePath}/report-shop${shopId ? `?shop=${shopId}` : ""}`} />
          </div>
        )}
      </SupportShell>
    );
  }

  if (key === "safety") {
    const page = await loadAbout("safety-security");
    return (
      <SupportShell basePath={basePath} current={current} variant="quiet">
        <article className="max-w-3xl">
          <h2 className="text-3xl font-semibold">{page?.title || "Safety & Security"}</h2>
          <div className="mt-6 whitespace-pre-wrap text-base leading-7">{page?.body}</div>
          <Link href={`${basePath}/report-shop`} className="mt-6 inline-block font-semibold text-[#0B6E4F]">
            Report a shop
          </Link>
        </article>
      </SupportShell>
    );
  }

  if (key === "about") {
    const page = await loadAbout("about-lagecto");
    const contact = await loadSupportContact();
    return (
      <SupportShell basePath={basePath} current={current} variant="quiet">
        <article className="max-w-3xl">
          <h2 className="text-3xl font-semibold">{page?.title || "About LaGecto"}</h2>
          <p className="mt-2 text-[var(--lagecto-muted)]">{contact.tagline}</p>
          <div className="mt-6 whitespace-pre-wrap text-base leading-7">{page?.body}</div>
        </article>
      </SupportShell>
    );
  }

  if (key === "terms" || key === "privacy") {
    const versionParam = Number(firstParam(searchParams.v) || 0);
    const packed = await loadLegal(key);
    const selected = versionParam ? await loadLegalVersion(key, versionParam) : packed.current;
    if (!selected) {
      return (
        <SupportShell basePath={basePath} current={current} variant="quiet">
          <EmptyState title="Document not published yet" body="An administrator will publish the reviewed version here." />
        </SupportShell>
      );
    }
    return (
      <SupportShell basePath={basePath} current={current} variant="quiet">
        <LegalViewer
          title={key === "terms" ? "Terms & Conditions" : "Privacy Policy"}
          version={selected.version}
          effectiveOn={selected.effective_on}
          publishedAt={selected.published_at}
          content={selected.content}
          history={packed.history}
          slug={key}
          basePath={basePath}
        />
      </SupportShell>
    );
  }

  if (key === "articles") {
    const slug = section[1];
    if (!slug) notFound();
    const article = await loadHelpArticle(slug);
    if (!article) notFound();
    return (
      <SupportShell basePath={basePath} current={current} variant="quiet">
        <article className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[#D4AF37]">{article.kind}</p>
          <h2 className="mt-2 text-3xl font-semibold">{article.title}</h2>
          {article.summary ? <p className="mt-2 text-[var(--lagecto-muted)]">{article.summary}</p> : null}
          <div className="mt-6 whitespace-pre-wrap text-base leading-7">{article.body}</div>
          <p className="mt-8 text-sm">
            Still need help?{" "}
            <Link href={`${basePath}/contact`} className="font-semibold text-[#0B6E4F]">
              Contact Support
            </Link>
          </p>
        </article>
      </SupportShell>
    );
  }

  notFound();
}
