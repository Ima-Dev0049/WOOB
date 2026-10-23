import type { ProjectBrief } from '@/lib/creative/types';
import { getDictionary, type UiLocale } from '@/lib/i18n';

export function ProjectBriefSummary({ brief, locale, compact = false }: { brief: ProjectBrief; locale: UiLocale; compact?: boolean }) {
  const copy = getDictionary(locale).creativeBrief;
  const Heading = compact ? 'h3' : 'h2';
  return <section className={`project-brief ${compact ? 'compact' : ''}`} data-testid="project-brief" aria-labelledby="project-brief-title">
    <header className="project-brief-heading"><div><span className="eyebrow">Brief Engine</span><Heading id="project-brief-title">{copy.title}</Heading><p>{copy.subtitle}</p></div><span className="project-brief-engine">{copy.engine}</span></header>
    <div className="project-brief-facts">
      <div><span>{copy.objective}</span><strong>{brief.objective}</strong></div>
      {brief.valueProposition && brief.valueProposition !== brief.objective && <div><span>{copy.valueProposition}</span><strong>{brief.valueProposition}</strong></div>}
      <div><span>{copy.audience}</span><strong>{brief.audience.join(' · ')}</strong></div>
    </div>
    <div className="project-brief-counts"><span>{copy.pages(brief.requiredPages.length)}</span><span>{copy.features(brief.requiredFeatures.length)}</span><span>{brief.tone.join(' · ')}</span></div>
    {brief.contradictions.map((contradiction) => <aside className="project-brief-conflict" key={contradiction.id} role="alert"><strong>{copy.contradictions}</strong><p>{contradiction.description}</p><small>{contradiction.resolution}</small></aside>)}
    <div className="project-brief-notes">
      <section><h4>{copy.assumptions}</h4>{brief.assumptions.length ? <ul>{brief.assumptions.map((assumption) => <li key={assumption.id}>{assumption.description}<small>{assumption.basis}</small></li>)}</ul> : <p>{copy.noAssumptions}</p>}</section>
      {brief.missingInformation.length > 0 && <section><h4>{copy.missing}</h4><ul>{brief.missingInformation.map((missing) => <li key={missing.id}>{missing.description}</li>)}</ul></section>}
    </div>
    <details className="project-brief-success"><summary>{copy.success} · {brief.successCriteria.length}</summary><ul>{brief.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></details>
  </section>;
}
