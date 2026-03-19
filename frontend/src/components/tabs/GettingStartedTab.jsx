import React, { useState } from 'react';
import { HoverImageTooltip } from '../common/HoverImageTooltip';

// ─── Inline SVG icon components ──────────────────────────────────────────────

function IconChevronDown({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconAlertTriangle({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClipboard({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconRocket({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function IconStar({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconHelpCircle({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconMonitor({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconTerminal({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconKey({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconFlag({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function IconGpu({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function IconFolder({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IconPaintbrush({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 00-2.82 0L8 7l9 9 1.59-1.59a2 2 0 000-2.82L17 10l4.37-4.37a2.12 2.12 0 10-3-3z" /><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" /><path d="M14.5 17.5L4.5 15" />
    </svg>
  );
}

function IconDollarSign({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconShield({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconExternalLink({ className = '' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline ml-0.5 ${className}`}>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Reusable layout helpers ─────────────────────────────────────────────────

function FaqItem({ question, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border-default rounded overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-bg-card hover:bg-bg-hover transition-colors duration-150 text-left cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-[13px] font-medium text-text-primary">{question}</span>
        <IconChevronDown className={`text-text-muted flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-3 bg-bg-input border-t border-border-default text-[13px] text-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[13px] font-bold text-accent mt-0.5">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold text-text-primary mb-1.5">{title}</h3>
        <div className="text-[13px] text-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function FieldRow({ label, badge, children }) {
  return (
    <div className="flex gap-3 py-2.5 px-3 border-b border-border-default last:border-0">
      <div className="flex-shrink-0 w-44 flex flex-col gap-1 pt-0.5">
        <span className="text-[12px] font-semibold text-text-primary">{label}</span>
        {badge && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-dark text-text-muted leading-none self-start">{badge}</span>
        )}
      </div>
      <p className="flex-1 text-[12px] text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function SectionHeading({ icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="text-accent-teal">{icon}</span>
      <h2 className="text-[15px] font-bold text-text-primary">{title}</h2>
    </div>
  );
}

function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children}<IconExternalLink />
    </a>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function GettingStartedTab() {
  return (
    <div className="h-full overflow-y-auto bg-bg-dark">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-2 pb-2">
          <img src="/icon.png" alt="Livery AI Studio" width="72" height="72" className="mx-auto mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold text-text-primary">Getting Started with Livery AI Studio</h1>
          <p className="text-[13px] text-text-secondary max-w-xl mx-auto">
            Describe your design in plain English, let Google Gemini paint it, and watch it appear on your car in iRacing — automatically.
          </p>
        </div>

        {/* ── Examples ─────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {[
            {
              tag: 'Generate',
              tagColor: 'text-accent bg-accent/10 border-accent/20',
              prompt: 'Gulf Racing heritage livery — pale powder blue base with broad burnt orange stripe across the hood and flanks, white roundels, period-correct Gulf logo placement, thin pinstripe border between colours',
              imgA: '/example-1a.jpg',
              imgB: '/example-1b.jpg',
            },
            {
              tag: 'Modify',
              tagColor: 'text-success bg-success/10 border-success/20',
              prompt: 'Add realistic race-worn weathering throughout — stone chips across the nose and leading edges, brake dust staining around the rear wheel arches, tyre rubber deposits along the lower sills, faded paint on the roof from prolonged sun exposure',
              imgA: '/example-2a.jpg',
              imgB: '/example-2b.jpg',
            },
          ].map(({ tag, tagColor, prompt, imgA, imgB }) => (
            <div key={tag} className="rounded-xl overflow-hidden border border-border-default bg-bg-card">
              {/* Prompt card */}
              <div className="px-4 py-3 flex items-start gap-3">
                <span className={`mt-0.5 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${tagColor}`}>
                  {tag}
                </span>
                <p className="text-[12px] text-text-secondary leading-relaxed italic">"{prompt}"</p>
              </div>
              {/* Texture + iRacing columns */}
              <div className="grid grid-cols-2">
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Texture</span>
                </div>
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">iRacing</span>
                </div>
              </div>
              <div className="flex">
                <HoverImageTooltip src={imgA} alt={`${tag} example texture`} className="w-1/2">
                  <img src={imgA} alt={`${tag} example texture`} className="w-full block" />
                </HoverImageTooltip>
                <HoverImageTooltip src={imgB} alt={`${tag} example iRacing preview`} className="w-1/2">
                  <img src={imgB} alt={`${tag} example iRacing preview`} className="w-full block" />
                </HoverImageTooltip>
              </div>
            </div>
          ))}

          {/* Example 3 — Reference (3-column: reference, texture, iRacing) */}
          <div className="rounded-xl overflow-hidden border border-border-default bg-bg-card">
            {/* Prompt card */}
            <div className="px-4 py-3 flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border text-accent-wine bg-accent-wine/10 border-accent-wine/20">
                Reference
              </span>
              <p className="text-[12px] text-text-secondary leading-relaxed italic">"Match the patterns from this helmet to the livery — same colors and shapes applied across the car body in a logical way"</p>
            </div>
            {/* Reference + Texture + iRacing columns */}
            <div className="grid grid-cols-3">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Reference</span>
              </div>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Texture</span>
              </div>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">iRacing</span>
              </div>
            </div>
            <div className="flex">
              <HoverImageTooltip src="/example-3r.jpg" alt="Reference image used for example 3" className="w-1/3">
                <img src="/example-3r.jpg" alt="Reference image used for example 3" className="w-full block" />
              </HoverImageTooltip>
              <HoverImageTooltip src="/example-3a.jpg" alt="Reference example texture" className="w-1/3">
                <img src="/example-3a.jpg" alt="Reference example texture" className="w-full block" />
              </HoverImageTooltip>
              <HoverImageTooltip src="/example-3b.jpg" alt="Reference example iRacing preview" className="w-1/3">
                <img src="/example-3b.jpg" alt="Reference example iRacing preview" className="w-full block" />
              </HoverImageTooltip>
            </div>
          </div>
        </div>

        {/* ── Lead-in ──────────────────────────────────────────────────────── */}
        <div className="text-center space-y-1 pt-2">
          <h2 className="text-lg font-bold text-text-primary">Ready to create your own?</h2>
          <p className="text-[13px] text-text-secondary max-w-xl mx-auto">
            Here's everything you need to know to get up and running — from API key to iRacing in minutes.
          </p>
        </div>

        {/* Recommended Workflow & Disclaimer */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <IconStar className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[13px] font-bold text-text-primary mb-2">AI output is a starting point — expect to refine it</h2>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                This tool generates an AI livery texture. Results will often need some clean-up —
                alignment, colour tweaks, fixing nonsense or adding finer detail.{' '}
                <strong className="text-text-primary">Most outputs benefit from a pass in an image editor</strong>{' '}
                before they are race-ready. You are unlikely to get a race-ready livery straight from the generator.
              </p>
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-text-primary mb-2">Recommended workflow:</p>
            <ol className="text-[12px] text-text-secondary space-y-1.5 ml-4 list-decimal leading-relaxed">
              <li>
                Download the correct car template (UV layout) from{' '}
                <ExtLink href="https://www.tradingpaints.com/cartemplates">tradingpaints.com/cartemplates</ExtLink>
              </li>
              <li>Use this tool to generate an AI draft as an initial starting point</li>
              <li>
                Open the draft alongside the template in an image editor — such as{' '}
                <ExtLink href="https://www.adobe.com/products/photoshop.html">Adobe Photoshop</ExtLink>,{' '}
                <ExtLink href="https://www.photopea.com">Photopea</ExtLink> (free, browser-based),{' '}
                <ExtLink href="https://www.gimp.org">GIMP</ExtLink> (free), or{' '}
                <ExtLink href="https://affinity.serif.com">Affinity Photo</ExtLink>
              </li>
              <li>Refine the livery: fix seams, add sponsor logos, adjust colours, and polish detail by hand</li>
              <li>Export as PNG and upload to Trading Paints</li>
            </ol>
          </div>
          <div className="border-t border-warning/20 pt-3 space-y-1.5">
            <p className="text-[12px] font-semibold text-text-primary flex items-center gap-1.5">
              <IconDollarSign className="text-warning" />
              Gemini API costs — your responsibility
            </p>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              The Google Gemini API is a paid service. Every generation is billed directly to your Google account —
              including generations that return poor results, fail partway through, or are cancelled. Typical costs
              range from ~$0.07 to ~$0.13 per image depending on the model and resolution. The maintainers of this
              tool accept no responsibility for any API fees you incur. Monitor your spend at{' '}
              <ExtLink href="https://console.cloud.google.com/billing">Google Cloud Console — Billing</ExtLink>{' '}
              and set a budget alert if needed. See{' '}
              <ExtLink href="https://ai.google.dev/gemini-api/docs/pricing">current Gemini pricing</ExtLink>{' '}
              for up-to-date rates.
            </p>
            <p className="text-[12px] font-semibold text-text-primary flex items-center gap-1.5 mt-2">
              <IconShield className="text-warning" />
              Content &amp; intellectual property
            </p>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              Gemini's own safety filters apply to every request. Make sure your prompts and outputs
              follow{' '}
              <ExtLink href="https://ai.google.dev/gemini-api/terms">Google's Gemini API terms of service</ExtLink>.
              The maintainers of this tool are not responsible for content produced by the API.
            </p>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5">
          <SectionHeading icon={<IconClipboard />} title="Requirements" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <IconMonitor />, label: 'Windows 10 / 11', note: 'Required for iRacing deployment' },
              { icon: <IconTerminal />, label: 'Python 3.10+', note: 'Only if running from source (not needed for bundled .exe)' },
              { icon: <IconKey />, label: 'Google Gemini API key', note: 'Paid — get one at aistudio.google.com' },
              { icon: <IconFlag />, label: 'iRacing', note: 'Installed with at least one car' },
              { icon: <IconPaintbrush />, label: 'Trading Paints app', note: 'Required to see custom liveries in-sim' },
              { icon: <IconGpu />, label: 'NVIDIA GPU', note: 'Optional — enables Real-ESRGAN upscaling' },
            ].map(({ icon, label, note }) => (
              <div key={label} className="flex items-start gap-3 bg-bg-input rounded p-3">
                <span className="text-accent flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="text-[12px] font-semibold text-text-primary">{label}</p>
                  <p className="text-[11px] text-text-muted">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5">
          <SectionHeading icon={<IconRocket />} title="Quick Start" />

          {/* Cost callout */}
          <div className="bg-warning/5 border border-warning/20 rounded p-3 mb-6 flex items-start gap-2.5">
            <IconDollarSign className="text-warning flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-text-secondary leading-relaxed">
              <strong className="text-text-primary">API costs:</strong>{' '}
              Each generation costs between <strong className="text-text-primary">~$0.067</strong> (Flash 1K) and{' '}
              <strong className="text-text-primary">~$0.134</strong> (Pro 2K) per image, billed directly by Google.
              See{' '}
              <ExtLink href="https://ai.google.dev/gemini-api/docs/pricing">current Gemini pricing</ExtLink>{' '}
              for exact rates. Set a budget alert in the{' '}
              <ExtLink href="https://console.cloud.google.com/billing">Google Cloud Console</ExtLink>{' '}
              to avoid surprises.
            </div>
          </div>

          <div className="space-y-5">
            <Step number={1} title="Launch the app">
              <strong className="text-text-primary">Option A — Bundled executable (easiest):</strong>{' '}
              If you downloaded the pre-built <code className="bg-bg-input px-1.5 py-0.5 rounded text-[12px] text-accent font-mono">.exe</code> release,
              simply double-click it to launch. No Python installation is required.
              <br /><br />
              <strong className="text-text-primary">Option B — Running from source (advanced):</strong>{' '}
              Double-click <code className="bg-bg-input px-1.5 py-0.5 rounded text-[12px] text-accent font-mono">start.bat</code> in the project folder.
              This automatically sets up a Python virtual environment, installs dependencies,
              and opens the app window. Running from source gives you finer control over features
              such as GPU upscaling, custom dependencies, and development options.
              <div className="mt-2 bg-bg-input rounded p-3 text-[12px] text-text-muted space-y-1">
                <p><code className="text-accent font-mono">start.bat</code> — first-time setup + launch</p>
                <p><code className="text-accent font-mono">start-quick.bat</code> — skip install checks, launch immediately</p>
                <p><code className="text-accent font-mono">start-with-upscale.bat</code> — install GPU dependencies (NVIDIA required)</p>
                <p><code className="text-accent font-mono">user-start.bat</code> — customizable template for your preferred flags</p>
              </div>
            </Step>

            <Step number={2} title="Add your Gemini API key">
              Click the <strong className="text-text-primary">Settings</strong> tab,
              paste your Gemini API key into the <em>Gemini API Key</em> field,
              then click <strong className="text-text-primary">Save Settings</strong>.
              <br /><br />
              Don't have a key yet? Visit{' '}
              <ExtLink href="https://aistudio.google.com/app/apikey">aistudio.google.com</ExtLink>, sign in with a Google account,
              and create an API key. You will need to enable billing on your Google Cloud project
              for image generation to work.
              Your key is stored only in{' '}
              <code className="bg-bg-input px-1.5 py-0.5 rounded text-[12px] text-accent font-mono">config.json</code>{' '}
              on your machine — it is never committed to Git or sent anywhere else.
              <br /><br />
              <strong className="text-warning text-[12px] flex items-center gap-1">
                <IconAlertTriangle className="w-3.5 h-3.5" /> You are responsible for all API charges.
              </strong>{' '}
              <span className="text-[12px]">
                Every generation call is billed directly to your Google account, including requests
                that fail or produce unsatisfactory results. Set a monthly budget cap in the{' '}
                <ExtLink href="https://console.cloud.google.com/billing">Google Cloud Console</ExtLink>{' '}
                if you are concerned about runaway spend.
              </span>
            </Step>

            <Step number={3} title="Enter your iRacing Customer ID">
              Still in <strong className="text-text-primary">Settings</strong>, enter your iRacing Customer ID.
              Find it by logging in to{' '}
              <ExtLink href="https://members.iracing.com">members.iracing.com</ExtLink>{' '}
              and navigating to <strong className="text-text-primary">My Info</strong> — your Customer ID is displayed there.
              This ID is used to name the livery file so iRacing recognises it as yours.
            </Step>

            <Step number={4} title="Configure your data folder (optional)">
              The app stores everything it generates in a <strong className="text-text-primary">data folder</strong>.
              By default this is the <code className="bg-bg-input px-1.5 py-0.5 rounded text-[12px] text-accent font-mono">data/</code> directory
              inside the app's installation folder. If you want your files somewhere else — for example a different
              drive, a shared network location, or just to keep things tidy — you can change it in{' '}
              <strong className="text-text-primary">Settings — Data Directory</strong>.
              <br /><br />
              <strong className="text-text-primary text-[12px]">What's stored in the data folder:</strong>
              <div className="mt-2 bg-bg-input rounded p-3 text-[12px] text-text-muted space-y-1.5">
                <p><code className="text-accent font-mono">data/liveries/</code> — PNG previews of every generated livery</p>
                <p><code className="text-accent font-mono">data/history.json</code> — generation history (prompt, model, cost, file path) shown in the History tab</p>
                <p><code className="text-accent font-mono">data/uploads/</code> — wireframe, base texture, and reference images you upload</p>
              </div>
              <br />
              <strong className="text-text-primary text-[12px]">To set a custom path:</strong>
              <ol className="mt-1 ml-4 list-decimal space-y-1 text-[12px] text-text-muted">
                <li>Click <strong className="text-text-primary">Settings</strong></li>
                <li>Enter an absolute path in the <em>Data Directory</em> field — e.g.{' '}
                  <code className="bg-bg-card px-1 rounded text-accent font-mono">C:\Users\you\Documents\LiveryGen</code>
                </li>
                <li>Click <strong className="text-text-primary">Save Settings</strong></li>
                <li>The app will use that folder immediately; existing files in the old folder are not moved automatically</li>
              </ol>
              Leave the field empty to use the default <code className="bg-bg-input px-1.5 py-0.5 rounded text-[12px] text-accent font-mono">data/</code> folder.
            </Step>

            <Step number={5} title="Install Trading Paints">
              Trading Paints is a free companion app that tells iRacing to load custom liveries from your paint folder.
              Without it your generated livery will not be visible inside the sim.
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-[12px] text-text-muted">
                <li>Go to <ExtLink href="https://www.tradingpaints.com/install">tradingpaints.com/install</ExtLink> and download the app</li>
                <li>Install it and sign in with your iRacing account</li>
                <li>Leave Trading Paints running in the background while you generate liveries</li>
              </ol>
            </Step>

            <Step number={6} title="Pick a car and generate your first livery">
              Use the <strong className="text-text-primary">Car</strong> selector in the top sub-bar to choose a car,
              then switch to the <strong className="text-text-primary">Generate</strong> tab.
              Type a description of the livery you want, then click{' '}
              <strong className="text-text-primary">Generate Livery</strong>. Generation takes 15–30 seconds.
              <br /><br />
              Once done, the livery TGA is automatically copied to your iRacing paint folder.
              You can also click <strong className="text-text-primary">Download</strong> to save the TGA file yourself.
              Open iRacing, search for your car under <em>My Content — Car Model</em> to preview it.
            </Step>

            <Step number={7} title="Review your history">
              Switch to the <strong className="text-text-primary">History</strong> tab to browse all your past generations.
              From here you can preview, re-deploy, iterate on, or delete any previous livery.
            </Step>

            <Step number={8} title="Share your livery online (optional)">
              To make your livery visible to other drivers during online races:
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-[12px] text-text-muted">
                <li>Click the <strong className="text-text-primary">Download</strong> button on the livery preview to save the TGA</li>
                <li>Go to <ExtLink href="https://www.tradingpaints.com/upload">tradingpaints.com/upload</ExtLink></li>
                <li>Upload the TGA and follow the instructions to pick the correct car and assign it as your active racing livery</li>
              </ol>
            </Step>
          </div>
        </div>

        {/* Generate Tab Guide */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5">
          <SectionHeading icon={<IconStar />} title="Generate Tab — All Options Explained" />
          <p className="text-[12px] text-text-secondary mb-4">
            The Generate tab is where you create new liveries. Here is a breakdown of every option:
          </p>

          <div className="space-y-6">
            {/* Mode */}
            <div>
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">Mode</h3>
              <div className="bg-bg-input rounded divide-y divide-border-default">
                <FieldRow label="New" badge="default">
                  Start a fresh livery from scratch. The AI paints the car using only your prompt,
                  the car's UV wireframe, and any reference images you supply.
                </FieldRow>
                <FieldRow label="Modify">
                  Iterate on an existing livery. Upload a base texture and describe the changes you want.
                  Ideal for tweaking colours, adding sponsors, or refining a previous generation.
                </FieldRow>
                <FieldRow label="Auto-iterate" badge="modify only">
                  When Modify mode is active, toggling Auto-iterate automatically uses the most recently
                  generated livery as the base texture so you can keep refining without manually re-uploading.
                </FieldRow>
              </div>
            </div>

            {/* Prompt fields */}
            <div>
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">Prompt Fields</h3>
              <div className="bg-bg-input rounded divide-y divide-border-default">
                <FieldRow label="Context" badge="optional">
                  Additional background information that guides the AI without being part of the main prompt.
                  Use it for consistent style rules such as "always use matte finish" or sponsor guidelines.
                </FieldRow>
                <FieldRow label="Prompt" badge="required">
                  Your main design description. Be as specific as possible — mention colours, patterns, themes,
                  sponsors, number placement, and any other visual details. See the{' '}
                  <strong className="text-text-primary">Examples</strong> link for inspiration.
                </FieldRow>
                <FieldRow label="Enhance" badge="optional">
                  Click the <strong className="text-text-primary">✦ Enhance</strong> link next to the prompt field
                  to expand a brief description into a detailed, AI-optimised prompt. You can customise how
                  enhancement works by clicking the <strong className="text-text-primary">⚙ cog</strong> icon to
                  open <em>Enhance Prompt Settings</em>, where you can edit or reset the system guidance.
                </FieldRow>
                <FieldRow label="History" badge="optional">
                  Click the <strong className="text-text-primary">History</strong> link to browse prompts from
                  your previous generations. Select any past prompt to load it directly into the prompt field —
                  great for re-using or refining earlier designs.
                </FieldRow>
              </div>
            </div>

            {/* Model & resolution */}
            <div>
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">Model &amp; Resolution</h3>
              <div className="bg-bg-input rounded divide-y divide-border-default">
                <FieldRow label="Flash" badge="faster / cheaper">
                  Gemini Flash model. Generates at 1024 px (~$0.067 per image) by default.
                  Fastest option — great for iterating on ideas before committing to a final render.
                </FieldRow>
                <FieldRow label="Pro" badge="highest quality">
                  Gemini Pro model. Always generates at 2048 px (~$0.134 per image).
                  Best fidelity for final liveries destined for online racing.
                </FieldRow>
                <FieldRow label="2K Resolution" badge="Flash only">
                  Forces Flash to generate at 2048 px (~$0.101 per image) instead of 1024 px.
                  Only available when Flash is selected; Pro always uses 2K.
                </FieldRow>
                <FieldRow label="GPU Upscale" badge="Flash 1K + NVIDIA">
                  After a 1K Flash generation, runs Real-ESRGAN 4x upscaling on your NVIDIA GPU to
                  produce a crisp 2048x2048 texture. The cheapest way to get 2K-quality results
                  (~$0.067 with GPU vs ~$0.101 for Flash 2K). Only shown when Flash 1K is active and a
                  compatible NVIDIA GPU is detected.
                </FieldRow>
              </div>
            </div>

            {/* Uploads */}
            <div>
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">Uploads</h3>
              <div className="bg-bg-input rounded divide-y divide-border-default">
                <FieldRow label="Wireframe" badge="optional">
                  A UV wireframe image of the car body. The app auto-loads the wireframe for the selected car
                  from the built-in library. Upload a custom one if you have a higher-quality template or a
                  car not in the library.
                </FieldRow>
                <FieldRow label="Base Texture" badge="optional">
                  In <em>New</em> mode this acts as a colour reference — the AI uses it for stylistic
                  guidance only. In <em>Modify</em> mode it is the livery you want to change; the AI
                  paints on top of it. Accepts PNG or JPG.
                </FieldRow>
                <FieldRow label="Reference Images" badge="optional">
                  Up to several extra images the AI can draw inspiration from — real-world liveries,
                  sponsor logos, colour palettes, mood boards, etc. These do not constrain the output but
                  nudge the AI toward a particular aesthetic.
                </FieldRow>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">Actions</h3>
              <div className="bg-bg-input rounded divide-y divide-border-default">
                <FieldRow label="Generate Livery">
                  Sends your prompt and images to the Gemini API and waits for the generated texture.
                  The result is automatically converted to a TGA file and copied to your iRacing paint
                  folder. A PNG preview appears on the right side of the tab.
                </FieldRow>
                <FieldRow label="Deploy to iRacing">
                  Appears after a successful generation. Re-deploys the last result to iRacing if you
                  accidentally cleared your paint folder or switched cars.
                </FieldRow>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-accent/5 border border-accent/20 rounded p-4 space-y-2">
              <p className="text-[12px] font-semibold text-accent flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
                </svg>
                Tips for better results
              </p>
              <ul className="text-[12px] text-text-secondary space-y-1 ml-4 list-disc">
                <li>Describe colours using real paint names or hex codes: "deep midnight blue (#0A0F3C)"</li>
                <li>For text on the livery, describe placement, font style, and colour clearly — e.g. "bold white sans-serif 'APEX' across the hood"</li>
                <li>Add sponsor names and their general placement: "ACME logo on hood, left rear quarter" — note that iRacing applies your car number automatically</li>
                <li>Specify finish type: matte, gloss, satin, carbon-fibre weave, brushed metal — <strong className="text-text-primary">note:</strong> matte/gloss finish requires a <em>specular map</em> to be applied separately (see the Specular tab)</li>
                <li>Use Examples (link near the prompt field) to see what works well</li>
                <li>Try the <strong className="text-text-primary">✦ Enhance</strong> link to let AI expand a short idea into a detailed prompt — great when you have a concept but aren't sure how to describe it</li>
                <li>Iterate with Modify mode and small, targeted changes rather than rewriting the full prompt — e.g. <em>"move the logo from the roof to the hood"</em> or <em>"change the red stripe to gold"</em></li>
                <li>For the cheapest high-quality workflow: use Flash model + GPU Upscale</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Monitor Folder Guide */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5">
          <SectionHeading icon={<IconFolder />} title="Monitor Folder — Live Auto-Deploy" />
          <p className="text-[12px] text-text-secondary mb-4">
            The <strong className="text-text-primary">Monitor Folder</strong> feature lets you edit your livery
            in an external image editor and have it automatically deployed to iRacing every time you save —
            no manual redeploy needed.
          </p>

          <div className="space-y-4">
            {/* What it does */}
            <div className="bg-bg-input rounded p-4 space-y-2">
              <p className="text-[12px] font-semibold text-text-primary">How it works</p>
              <ol className="text-[12px] text-text-secondary space-y-1.5 ml-4 list-decimal leading-relaxed">
                <li>
                  Select your car in the sub-bar, then click{' '}
                  <strong className="text-text-primary">Monitor Folder</strong> (next to the car picker).
                </li>
                <li>
                  Pick or type the folder path where your livery TGA files live — typically the same
                  folder you use in your image editor when exporting.
                </li>
                <li>
                  The app immediately deploys any matching files that already exist in the folder,
                  then watches for changes in the background.
                </li>
                <li>
                  Every time you save{' '}
                  <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">car_&#123;id&#125;.tga</code>{' '}
                  or{' '}
                  <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">car_spec_&#123;id&#125;.tga</code>{' '}
                  to that folder, the file is immediately copied to your iRacing paint folder.
                </li>
                <li>
                  A notification toast confirms each auto-deploy. Click{' '}
                  <strong className="text-text-primary">Stop</strong> (in the sub-bar) to end monitoring.
                </li>
              </ol>
            </div>

            {/* File naming */}
            <div className="bg-bg-input rounded p-4 space-y-2">
              <p className="text-[12px] font-semibold text-text-primary">File naming</p>
              <p className="text-[12px] text-text-secondary">
                The monitor looks for these exact filenames using your iRacing Customer ID from Settings:
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <code className="bg-bg-card px-2 py-0.5 rounded text-[12px] text-accent font-mono">car_&#123;customerID&#125;.tga</code>
                  <span className="text-[11px] text-text-muted">— main diffuse livery</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-bg-card px-2 py-0.5 rounded text-[12px] text-accent font-mono">car_spec_&#123;customerID&#125;.tga</code>
                  <span className="text-[11px] text-text-muted">— specular / reflectivity map (optional)</span>
                </div>
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                For example, if your Customer ID is <code className="bg-bg-card px-1 rounded text-accent font-mono">123456</code>,
                save your file as <code className="bg-bg-card px-1 rounded text-accent font-mono">car_123456.tga</code> in the monitored folder.
              </p>
            </div>

            {/* Typical workflow */}
            <div className="bg-accent/5 border border-accent/20 rounded p-4 space-y-2">
              <p className="text-[12px] font-semibold text-accent flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
                </svg>
                Recommended workflow with an external editor
              </p>
              <ol className="text-[12px] text-text-secondary space-y-1 ml-4 list-decimal leading-relaxed">
                <li>Generate a livery in the Generate tab as a starting point.</li>
                <li>Download the TGA and open it in Photoshop, GIMP, or Affinity Photo alongside the car's UV template.</li>
                <li>In the app, start Monitor Folder and point it at the folder where you're saving your edits.</li>
                <li>Make a change in your editor, export/save as <code className="bg-bg-card px-1 rounded text-accent font-mono">car_&#123;id&#125;.tga</code> — it deploys instantly.</li>
                <li>Switch to iRacing and hit <em>Ctrl+R</em> to reload textures. Your edit is live.</li>
              </ol>
            </div>

            <div className="bg-warning/5 border border-warning/20 rounded p-3 flex items-start gap-2.5">
              <IconAlertTriangle className="text-warning flex-shrink-0 mt-0.5 w-3.5 h-3.5" />
              <p className="text-[12px] text-text-secondary leading-relaxed">
                <strong className="text-text-primary">Customer ID required:</strong>{' '}
                Make sure your iRacing Customer ID is saved in{' '}
                <strong className="text-text-primary">Settings</strong> before starting the monitor.
                The monitor uses this ID to build the expected filenames and will show an error if it is missing.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="bg-bg-card border border-border-default rounded-lg p-5">
          <SectionHeading icon={<IconHelpCircle />} title="Troubleshooting &amp; FAQ" />
          <div className="space-y-2">

            <FaqItem question="How does the AI livery generation actually work?">
              <p>
                Under the hood, the app sends Google's <strong>Gemini</strong> vision model a carefully
                constructed prompt along with one or more reference images. Here's the basic flow:
              </p>
              <ol className="mt-2 ml-4 list-decimal space-y-2">
                <li>
                  <strong className="text-text-primary">Wireframe (UV guide)</strong> — Every iRacing car
                  has a flat "UV template" that maps the 3D car body onto a 2D image. The app feeds this
                  wireframe to the model so it understands where each panel, door, hood, and roof sits on
                  the flat texture.
                </li>
                <li>
                  <strong className="text-text-primary">Prompt engineering</strong> — Your description is
                  wrapped in a detailed system prompt that tells Gemini to "paint within the wireframe lines",
                  respect panel boundaries, keep text readable, and output a full 2D texture (not a 3D render).
                  The prompt also tells the model the exact pixel resolution to target and reminds it that this
                  texture will be wrapped around a car in a racing sim.
                </li>
                <li>
                  <strong className="text-text-primary">Optional inputs</strong> — If you supply a base texture
                  (Modify mode) or reference images, those are included alongside the wireframe so the model can
                  see what it's modifying or draw stylistic inspiration from. The base diffuse texture also helps
                  the AI understand the car's default colour scheme.
                </li>
                <li>
                  <strong className="text-text-primary">Generation</strong> — Gemini processes all the inputs
                  and produces a new 2D texture image. The app converts this to a TGA file and copies it to
                  your iRacing paint folder.
                </li>
              </ol>
              <div className="mt-3 p-3 bg-bg-card border border-warning/20 rounded">
                <p className="text-[12px] font-semibold text-text-primary flex items-center gap-1.5 mb-1">
                  <IconAlertTriangle className="text-warning w-3.5 h-3.5" />
                  It's not perfect — and that's expected
                </p>
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  Despite the clever prompting, Gemini is still <em>largely guessing</em> at how to paint
                  a flat 2D texture that will look correct when wrapped around a complex 3D shape. Seams,
                  misaligned panels, nonsense text, and colour bleed are common. Think of the AI output as
                  an extremely fast concept sketch rather than a finished product. That said, the results
                  can be surprisingly good — modern AI is remarkable at understanding spatial relationships
                  — and with a couple of iterations or a quick pass in an image editor, you can get
                  genuinely race-ready liveries.
                </p>
              </div>
            </FaqItem>

            <FaqItem question="I get an 'Invalid API key' or 401 error when generating">
              <p>Your Gemini API key is missing or incorrect. Open <strong>Settings</strong> and confirm:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>The key is pasted in full with no leading/trailing spaces.</li>
                <li>Billing is enabled for the Google Cloud project the key belongs to — visit <ExtLink href="https://console.cloud.google.com/billing">Google Cloud Console — Billing</ExtLink>.</li>
                <li>The Gemini API is enabled for your project — visit <ExtLink href="https://aistudio.google.com">aistudio.google.com</ExtLink> to confirm.</li>
              </ul>
            </FaqItem>

            <FaqItem question="Generation fails or returns no image">
              <p>Several things can cause this:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li><strong>Gemini is at capacity</strong> — wait 30 seconds and try again.</li>
                <li><strong>Prompt triggered a safety filter</strong> — rephrase your prompt to avoid flags.</li>
                <li><strong>Image too large to upload</strong> — resize reference images to under 4 MB each.</li>
                <li><strong>Network error</strong> — check your internet connection and retry.</li>
              </ul>
            </FaqItem>

            <FaqItem question="The livery doesn't appear on my car in iRacing">
              <p>Follow this checklist:</p>
              <ol className="mt-2 ml-4 list-decimal space-y-1">
                <li>Make sure your <strong>iRacing Customer ID</strong> is entered correctly in Settings — the paint file is named using this ID.</li>
                <li>Trading Paints must be installed and running — without it iRacing ignores custom paint files.</li>
                <li>In iRacing, go to <em>My Content — Car Model</em> and look for your car; the livery may need a few seconds to sync.</li>
                <li>Try clicking <strong>Deploy to iRacing</strong> again from the Generate tab to re-copy the file.</li>
              </ol>
            </FaqItem>

            <FaqItem question="The Upscale tab shows a warning or 'not installed'">
              <p>Both upscale engines require an NVIDIA GPU with CUDA. Install either or both:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>
                  <strong>Real-ESRGAN</strong> (fast, ~30s) — re-launch with{' '}
                  <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">start.bat --realesrgan</code>{' '}
                  (or <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">start-with-upscale.bat</code>)
                </li>
                <li>
                  <strong>SeedVR2</strong> (higher quality, 30s–2 min, requires 8+ GB VRAM + Git) — re-launch with{' '}
                  <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">start.bat --seedvr</code>
                </li>
                <li>Install both at once: <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">start.bat --realesrgan --seedvr</code></li>
                <li>For RTX 30-series GPUs add <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">--cuda 11</code>; RTX 40/50-series use the default (CUDA 12).</li>
                <li>If you don't have an NVIDIA GPU, both engines are unavailable but generated textures are still resized to 2048×2048 using Lanczos resampling.</li>
              </ul>
            </FaqItem>

            <FaqItem question="The generated livery looks low quality or 'sloppy'">
              <p>AI image generation is probabilistic — results vary. To improve quality:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Use <strong>Pro</strong> model for the highest fidelity output.</li>
                <li>Write a more detailed and specific prompt — vague prompts produce generic results.</li>
                <li>Supply a clean wireframe image — a high-quality UV map gives the AI better structure to paint on.</li>
                <li>Add reference images that closely match the aesthetic you want.</li>
                <li>Use <strong>Modify</strong> mode to iterate on a promising result rather than starting over.</li>
              </ul>
            </FaqItem>

            <FaqItem question="The result doesn't match the wireframe — panels look wrong or the design is misaligned">
              <p>
                This is expected behaviour. Gemini generates a 2D texture image without any true 3D
                understanding of the car's geometry, so panel boundaries, seams, and element placement
                are inherently approximate. <strong className="text-text-primary">The AI has a mind of its own
                — results are not guaranteed.</strong>
              </p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>
                  <strong>Simplify your prompt</strong> — fewer design elements, plainer colour schemes,
                  and avoiding complex logos tend to align better with the UV layout.
                </li>
                <li>
                  <strong>Regenerate a few times</strong> — generation is probabilistic; the next attempt
                  may align much better even with the same prompt.
                </li>
                <li>
                  <strong>Iterate with Modify mode</strong> — use <em>"Iterate on This"</em> from a
                  promising result and give targeted correction instructions (e.g. <em>"shift the stripe
                  down so it runs along the door sill"</em>).
                </li>
                <li>
                  <strong>Adjust in an image editor</strong> — treat the AI output as a starting point
                  and do a quick manual touch-up in Photoshop, GIMP, or Paint.NET using the car's UV
                  template as a layer guide.
                </li>
              </ul>
              <div className="mt-3 p-3 bg-bg-card border border-warning/20 rounded text-[12px] text-text-secondary leading-relaxed">
                <IconAlertTriangle className="inline text-warning w-3.5 h-3.5 mr-1.5 align-text-bottom" />
                Perfect alignment between AI output and UV wireframe is not a guaranteed feature of this
                tool. Prompting style, model choice, and a degree of luck all play a role.
              </div>
            </FaqItem>

            <FaqItem question="How much does each generation cost?">
              <p>You are charged directly by Google per generated image:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li><strong>Flash 1K</strong> — ~$0.067 per image (cheapest)</li>
                <li><strong>Flash 2K</strong> — ~$0.101 per image</li>
                <li><strong>Pro 2K</strong> — ~$0.134 per image (highest quality)</li>
              </ul>
              <p className="mt-2">
                Pricing can change — always verify at{' '}
                <ExtLink href="https://ai.google.dev/gemini-api/docs/pricing">ai.google.dev/gemini-api/docs/pricing</ExtLink>.
                You can override the displayed prices in <strong>Settings — API Pricing</strong>.
                The <em>Spent</em> tracker in the top bar shows your cumulative session spend.
              </p>
              <p className="mt-2 font-semibold">
                All charges are billed directly to your Google account. The maintainers of this
                tool are not responsible for any fees you incur, including those from failed
                requests, unsatisfactory results, or accidental over-generation. Set a budget
                alert in the{' '}
                <ExtLink href="https://console.cloud.google.com/billing">Google Cloud Console — Billing</ExtLink>{' '}
                to avoid unexpected charges.
              </p>
            </FaqItem>

            <FaqItem question="Who is responsible for the content Gemini generates?">
              <p>
                Google's Gemini API applies its own content safety filters and usage policies to
                every request. The maintainers of this tool have no control over what the API will
                or will not generate, and accept no responsibility for any content it produces.
              </p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>
                  <strong>Intellectual property:</strong> Do not submit prompts that ask the AI to
                  reproduce copyrighted logos, team liveries, or other protected material without
                  the appropriate rights. You are solely responsible for ensuring your prompts and
                  outputs do not infringe third-party IP.
                </li>
                <li>
                  <strong>Explicit or harmful content:</strong> Gemini's own guardrails govern
                  what it will produce. The tool maintainers are not liable for content that
                  bypasses those guardrails or for any consequences of its use.
                </li>
                <li>
                  <strong>Responsible use:</strong> Use your best judgement. Think carefully before
                  uploading AI-generated liveries publicly — review the output, ensure it meets
                  community standards, and refine it manually where needed.
                </li>
              </ul>
            </FaqItem>

            <FaqItem question="Can I use the app on Linux or macOS?">
              <p>
                The app runs on Linux and macOS, but the automatic iRacing deployment feature requires Windows
                because iRacing only runs on Windows. On other platforms you can still generate liveries and
                manually copy the output PNG/TGA to your iRacing paint folder on a Windows machine.
                Use <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">start.sh</code> to
                launch on Linux/macOS.
              </p>
            </FaqItem>

            <FaqItem question="Where are my generated liveries saved?">
              <p>
                Everything is stored in the <strong>data folder</strong>, which defaults to{' '}
                <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">data/</code> inside
                the app's installation directory. You can change this in{' '}
                <strong>Settings — Data Directory</strong>.
              </p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li><code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">data/liveries/</code> — PNG preview of each generated livery, named by timestamp</li>
                <li><code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">data/history.json</code> — generation history (prompt, model, cost, file path) shown in the History tab</li>
                <li><code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">data/uploads/</code> — wireframe, base texture, and reference images you upload to the Generate tab</li>
                <li>TGA deployed to iRacing: <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">Documents\iRacing\paint\&lt;car&gt;\car_&lt;customerID&gt;.tga</code></li>
              </ul>
            </FaqItem>

            <FaqItem question="How do I reset or wipe all my data?">
              <p>
                Open <strong>Settings</strong> and click <strong>Wipe All Data</strong>. You will be
                asked to type <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">wipe my data</code> to confirm.
                This removes all generated liveries, history, uploads, and session state.
                Your <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">config.json</code> (API key, customer ID, pricing) is preserved.
              </p>
              <p className="mt-2">
                To also reset settings, delete{' '}
                <code className="bg-bg-card px-1 rounded text-[12px] text-accent font-mono">config.json</code>{' '}
                from the app's installation directory. These files are git-ignored so they will not be restored by a git pull.
              </p>
            </FaqItem>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2 pb-4">
          <p className="text-[12px] text-text-muted">
            Made for the{' '}
            <span className="text-accent">Blue Flags &amp; Dads</span>{' '}
            iRacing community
          </p>
          <p className="text-[12px] text-text-muted">
            For help, join the{' '}
            <span className="text-accent">Discord</span>{' '}
            and share your creations in <em>#paintshop</em>
          </p>
        </div>

      </div>
    </div>
  );
}

export default GettingStartedTab;
