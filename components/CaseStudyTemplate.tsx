import { pickIcon } from "@/lib/icons";
import { SECTION_HEADINGS } from "@/lib/schema";
import type { StoredCaseStudy } from "@/lib/schema";
import "../app/case-study/[slug]/case-study.css";

function deriveTicks(rawValue: string): string[] {
  const m = rawValue.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  if (!m) return ["High", "Mid", "Low", "0"];
  const n = parseFloat(m[1]);
  const fmt = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(Math.round(v)));
  return [fmt(n * 1.1), fmt(n * 0.66), fmt(n * 0.33), "0"];
}

/** Renders the real, on-brand case-study page for a given row — used by
 *  both the published /case-study/[slug] route and the draft /preview/[id]
 *  route. One template, two data sources; never two implementations. */
export default function CaseStudyTemplate({ row }: { row: StoredCaseStudy }) {
  const icon = pickIcon(row.industry);
  const initial = (row.quote_author_name || "?").trim().charAt(0).toUpperCase();
  const t1 = deriveTicks(row.stat2_value);
  const t2 = deriveTicks(row.stat3_value);

  return (

    <div className="cs-page">
      <div className="cs-shell">
        <nav className="cs-nav">
          <a className="cs-logo" href="/" aria-label="Gushwork">
            <img src="/assets/logo/gushwork-logo-original.svg" alt="Gushwork" />
          </a>
          <div className="cs-nav-right">
            <a className="cs-nav-cta" href="https://www.gushwork.ai/demo">
              Book a Demo
            </a>
          </div>
          <div className="cs-nav-progress" id="cs-nav-progress" />
        </nav>

        <header className="cs-hero">
          <div className="cs-hero-bg" aria-hidden="true">
            <div className="cs-hero-grid" />
            <div className="cs-hero-swoosh" />
            <div className="cs-hero-fade" />
          </div>
          <div className="cs-hero-body cs-inner">
            <div className="cs-hero-top">
              <div className="cs-hero-text">
                <div className="cs-eyebrow">
                  <svg viewBox="0 0 256 256" aria-hidden="true">
                    <path d="M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Z" />
                  </svg>
                  <span>Case Study</span>
                </div>
                <div className="cs-hero-heads">
                  <h1 className="cs-hero-title">{row.headline}</h1>
                  <div className="cs-hero-meta">
                    <span>{row.industry}</span>
                    <i aria-hidden="true" />
                    <span>{row.country}</span>
                  </div>
                </div>
              </div>
              <div className="cs-hero-media">
                {row.photoUrl ? (
                  <div className="cs-slot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.photoUrl} alt="" />
                    {row.client_website && (
                      <div className="cs-hero-logo">
                        <img
                          src={`https://logo.clearbit.com/${new URL(row.client_website).hostname}`}
                          alt={`${row.client_name} logo`}
                          onError={(e) => {
                            (e.currentTarget.closest(".cs-hero-logo") as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    {row.photoCredit && (
                      <a
                        className="cs-photo-credit"
                        href={`${row.photoCredit.profileUrl}?utm_source=gushwork&utm_medium=referral`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Photo: {row.photoCredit.name} on Unsplash
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="cs-hero-media--icon" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 256 256" fill="currentColor">${icon}</svg>` }} />
                )}
              </div>
            </div>
            <div className="cs-stats">
              <div className="cs-stat">
                <b>{row.stat1_value}</b>
                <span>{row.stat1_label}</span>
              </div>
              <div className="cs-stat">
                <b>{row.stat2_value}</b>
                <span>{row.stat2_label}</span>
              </div>
              <div className="cs-stat">
                <b>{row.stat3_value}</b>
                <span>{row.stat3_label}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="cs-article">
          <div className="cs-article-inner">
            <article className="cs-prose">
              <div className="cs-block">
                <h2>{SECTION_HEADINGS.section_the_customer}</h2>
                <p>{row.section_the_customer}</p>
              </div>

              {row.tldr_problem && row.tldr_challenge && row.tldr_solution && (
                <div className="cs-tldr">
                  <div className="cs-tldr-card">
                    <h3>Problem</h3>
                    <p>{row.tldr_problem}</p>
                  </div>
                  <div className="cs-tldr-card">
                    <h3>Challenge</h3>
                    <p>{row.tldr_challenge}</p>
                  </div>
                  <div className="cs-tldr-card cs-tldr-card--wide">
                    <h3>Solution</h3>
                    <p>{row.tldr_solution}</p>
                  </div>
                </div>
              )}

              <div className="cs-block">
                <h2>{SECTION_HEADINGS.section_what_changed}</h2>
                <div className="cs-copy">
                  <p>{row.section_what_changed}</p>
                  <figure className="cs-figure cs-figure--generated">
                    <div className="cs-growth-card">
                      <div className="cs-growth-card-header">
                        <span className="cs-growth-card-label">{row.stat2_label || "Total Visitors"}</span>
                      </div>
                      <div className="cs-growth-card-body">
                        <div>
                          <span className="cs-growth-card-value">{row.stat2_value}</span>
                          <br />
                          <span className="cs-growth-card-caption">{row.stat2_label}</span>
                        </div>
                        <div className="cs-growth-card-chart">
                          <div className="cs-growth-card-yaxis" aria-hidden="true">
                            {t1.map((v) => (
                              <span key={v}>{v}</span>
                            ))}
                          </div>
                          <div className="cs-growth-card-plot">
                            <svg viewBox="0 0 240 90" preserveAspectRatio="none" aria-hidden="true">
                              <defs>
                                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <line x1="0" y1="4" x2="240" y2="4" stroke="#e7e8e9" />
                              <line x1="0" y1="32" x2="240" y2="32" stroke="#e7e8e9" />
                              <line x1="0" y1="60" x2="240" y2="60" stroke="#e7e8e9" />
                              <line x1="0" y1="88" x2="240" y2="88" stroke="#e7e8e9" />
                              <path d="M0,80 C40,79 80,72 120,58 C160,44 190,24 240,4 L240,90 L0,90 Z" fill="url(#g1)" />
                              <path d="M0,80 C40,79 80,72 120,58 C160,44 190,24 240,4" fill="none" stroke="#16a34a" strokeWidth="2" />
                            </svg>
                            <div className="cs-growth-card-xaxis" aria-hidden="true">
                              <span>Month 1</span>
                              <span>Month 2</span>
                              <span>Month 3</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="cs-growth-card">
                      <div className="cs-growth-card-header">
                        <span className="cs-growth-card-label">{row.stat3_label || "Total Leads"}</span>
                      </div>
                      <div className="cs-growth-card-body">
                        <div>
                          <span className="cs-growth-card-value">{row.stat3_value}</span>
                          <br />
                          <span className="cs-growth-card-caption">{row.stat3_label}</span>
                        </div>
                        <div className="cs-growth-card-chart">
                          <div className="cs-growth-card-yaxis" aria-hidden="true">
                            {t2.map((v) => (
                              <span key={v}>{v}</span>
                            ))}
                          </div>
                          <div className="cs-growth-card-plot">
                            <svg viewBox="0 0 240 90" preserveAspectRatio="none" aria-hidden="true">
                              <defs>
                                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#0070ff" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="#0070ff" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <line x1="0" y1="4" x2="240" y2="4" stroke="#e7e8e9" />
                              <line x1="0" y1="32" x2="240" y2="32" stroke="#e7e8e9" />
                              <line x1="0" y1="60" x2="240" y2="60" stroke="#e7e8e9" />
                              <line x1="0" y1="88" x2="240" y2="88" stroke="#e7e8e9" />
                              <path d="M0,84 C50,84 90,82 130,70 C170,58 200,32 240,6 L240,90 L0,90 Z" fill="url(#g2)" />
                              <path d="M0,84 C50,84 90,82 130,70 C170,58 200,32 240,6" fill="none" stroke="#0070ff" strokeWidth="2" />
                            </svg>
                            <div className="cs-growth-card-xaxis" aria-hidden="true">
                              <span>Month 1</span>
                              <span>Month 2</span>
                              <span>Month 3</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </figure>
                </div>
              </div>

              <figure className="cs-quote">
                <p>&ldquo;{row.quote_text}&rdquo;</p>
                <figcaption className="cs-byline">
                  <span className="cs-byline-photo">{initial}</span>
                  <span className="cs-byline-text">
                    <b>{row.quote_author_name}</b>
                    <span>{row.quote_author_role}</span>
                  </span>
                </figcaption>
              </figure>

              <div className="cs-block">
                <h2>{SECTION_HEADINGS.section_why_this_matters}</h2>
                <p>{row.section_why_this_matters}</p>
              </div>

              <div className="cs-block">
                <h2>{SECTION_HEADINGS.section_closing}</h2>
                <p>{row.section_closing}</p>
              </div>
            </article>

            <aside className="cs-aside">
              <div className="cs-card">
                <div className="cs-card-content">
                  <div className="cs-card-people" aria-hidden="true">
                    <img src="/assets/case-study/cta-peopl.webp" alt="" />
                  </div>
                  <h3>Discover AI agents that help businesses get more qualified leads.</h3>
                </div>
                <a className="cs-btn" href="https://www.gushwork.ai/demo">
                  Book a Demo
                </a>
              </div>
            </aside>
          </div>
        </section>

        <footer className="cs-footer">
          <div className="cs-footer-inner">
            <div className="cs-footer-main">
              <div className="cs-footer-cols">
                <div className="cs-footer-col">
                  <h4>Platform</h4>
                  <div className="cs-footer-list">
                    <a href="https://www.gushwork.ai/brand-memory">Brand Memory</a>
                    <a href="https://www.gushwork.ai/page-creation-engine">Page Creation Engine</a>
                    <a href="https://www.gushwork.ai/ai-first-cms">AI-First CMS</a>
                    <a href="https://www.gushwork.ai/leads-dashboard">Leads Dashboard</a>
                    <a href="https://www.gushwork.ai/analytics">Analytics</a>
                  </div>
                </div>
                <div className="cs-footer-col">
                  <h4>Solutions</h4>
                  <div className="cs-footer-list">
                    <a href="https://www.gushwork.ai/solutions/ai-search">AI Search Agent</a>
                    <a href="https://www.gushwork.ai/solutions/lead-conversion">Lead Conversion</a>
                    <a href="https://www.gushwork.ai/solutions/paid-boost">Paid Boost</a>
                  </div>
                </div>
                <div className="cs-footer-col">
                  <h4>Company</h4>
                  <div className="cs-footer-list">
                    <a href="https://www.gushwork.ai/pricing">Pricing</a>
                    <a href="https://www.gushwork.ai/careers">Careers</a>
                    <a href="https://www.gushwork.ai/case-study">Customers</a>
                    <a href="https://www.gushwork.ai/gushwork-alternatives">Alternatives</a>
                    <a href="https://www.gushwork.ai/affiliate">Affiliate</a>
                  </div>
                </div>
              </div>
              <div className="cs-footer-comp">
                <div className="cs-footer-addr-row">
                  <div className="cs-footer-addr-col">
                    <p>Gushwork, Regents Inc, 16192 Coastal Hwy, Lewes, DE 19958, United States</p>
                    <div className="cs-footer-contact">
                      <a href="tel:+18884515522">+1 (888) 451 5522</a>
                      <a href="mailto:growth@gushwork.ai">growth@gushwork.ai</a>
                    </div>
                  </div>
                  <div className="cs-footer-addr-col">
                    <p>Gushwork, 578, 9th A Main Rd, Indiranagar, Bengaluru, Karnataka 560038, India</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="cs-footer-social">
              <a href="https://www.linkedin.com/company/gushwork" aria-label="LinkedIn">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M14.8156 0H1.18125C0.528125 0 0 0.515625 0 1.15313V14.8438C0 15.4813 0.528125 16 1.18125 16H14.8156C15.4688 16 16 15.4813 16 14.8469V1.15313C16 0.515625 15.4688 0 14.8156 0ZM4.74687 13.6344H2.37188V5.99687H4.74687V13.6344ZM3.55938 4.95625C2.79688 4.95625 2.18125 4.34062 2.18125 3.58125C2.18125 2.82188 2.79688 2.20625 3.55938 2.20625C4.31875 2.20625 4.93437 2.82188 4.93437 3.58125C4.93437 4.3375 4.31875 4.95625 3.55938 4.95625ZM13.6344 13.6344H11.2625V9.92188C11.2625 9.0375 11.2469 7.89687 10.0281 7.89687C8.79375 7.89687 8.60625 8.8625 8.60625 9.85938V13.6344H6.2375V5.99687H8.5125V7.04063H8.54375C8.85937 6.44063 9.63438 5.80625 10.7875 5.80625C13.1906 5.80625 13.6344 7.3875 13.6344 9.44375V13.6344Z" />
                </svg>
              </a>
              <a href="https://x.com/gushwork" aria-label="X">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M12.2175 1.26929H14.4665L9.5531 6.88495L15.3333 14.5266H10.8075L7.26265 9.89198L3.20659 14.5266H0.956247L6.21158 8.52002L0.666626 1.26929H5.30737L8.51156 5.50551L12.2175 1.26929ZM11.4282 13.1805H12.6744L4.63022 2.54471H3.29293L11.4282 13.1805Z" />
                </svg>
              </a>
            </div>
            <div className="cs-footer-legal">
              <span>&copy; 2026 Gushwork | All Rights Reserved</span>
              <div>
                <a href="https://www.gushwork.ai/privacy-policy">Privacy Policy</a>
                <a href="https://www.gushwork.ai/terms-and-conditions">Terms &amp; Conditions</a>
              </div>
            </div>
          </div>
          <div className="cs-footer-band">
            <img src="/assets/case-study/updated-footer-bg.webp" alt="" aria-hidden="true" />
          </div>
        </footer>
      </div>
    </div>
  
  );
}
