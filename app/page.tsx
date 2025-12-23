import Link from "next/link";

const features = [
  {
    title: "Single Image Analysis",
    copy: "Upload one RGB image, choose ICC profiles, and inspect ΔE heatmaps, masks, and TAC.",
    href: "/single"
  },
  {
    title: "Multi-Profile Comparison",
    copy: "Run one image across multiple printer profiles and sort by perceptual difference.",
    href: "/compare"
  },
  {
    title: "Batch Ranking",
    copy: "Upload many images against one profile to find the worst offenders quickly.",
    href: "/batch"
  }
];

export default function HomePage() {
  return (
    <main className="grid gap-8">
      <section className="card flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-white">ColorGamut</h1>
        <p className="max-w-3xl text-slate-300">
          Analyze how far your RGB images drift when proofed through printer ICC profiles. Upload assets,
          pick rendering intents, and get ΔE2000 stats, TAC metrics, and previews to judge print risk.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/single" className="btn">
            Start with one image
          </Link>
          <Link href="/compare" className="btn bg-ink-warm text-slate-950 hover:bg-orange-300">
            Compare profiles
          </Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feat) => (
          <Link key={feat.title} href={feat.href} className="card hover:-translate-y-1 transition">
            <h3 className="text-xl font-semibold text-white">{feat.title}</h3>
            <p className="text-slate-300">{feat.copy}</p>
            <span className="mt-3 inline-flex text-sm font-semibold text-ink-accent">Open →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
