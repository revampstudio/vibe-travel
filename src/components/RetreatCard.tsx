import type { Retreat } from '../types/index.ts'

export default function RetreatCard({ retreat }: { retreat: Retreat }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 hover:border-muted/40 transition-colors
                    cursor-pointer">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-text text-balance">{retreat.name}</h4>
          <p className="text-sm text-muted mt-1">{retreat.city}, {retreat.country}</p>
        </div>
        {retreat.isSponsored && (
          <span className="text-xs font-semibold bg-accent/10 text-accent px-2.5 py-1
                           rounded-full flex-shrink-0">
            Sponsored
          </span>
        )}
      </div>

      <p className="text-sm text-muted leading-relaxed mb-4 text-pretty">{retreat.description}</p>

      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold bg-white px-3 py-1.5 rounded-lg text-muted border border-border/80">
            {retreat.type}
          </span>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm text-text font-medium">{retreat.rating}</span>
          </div>
        </div>
        <span className="text-base font-bold text-text">{retreat.price}</span>
      </div>
    </div>
  )
}
