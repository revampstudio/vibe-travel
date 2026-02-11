import { useStore } from '../store/useStore.ts'

export default function LifeStageCard() {
  const profile = useStore((s) => s.profile)
  if (!profile) return null

  return (
    <div className="rounded-2xl border border-jupiter/25 bg-jupiter/8 p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="size-12 rounded-full bg-jupiter/15 flex items-center justify-center flex-shrink-0">
          <span className="text-jupiter text-lg font-serif font-bold">{profile.personalYear}</span>
        </div>
        <div>
          <h4 className="text-base font-semibold text-text">{profile.lifeStage}</h4>
          <p className="text-sm text-muted mt-0.5">Personal Year {profile.personalYear}</p>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed text-pretty">{profile.lifeStageDescription}</p>

      {profile.saturnReturn && (
        <div className="mt-5 pt-5 border-t border-jupiter/20">
          <div className="flex items-start gap-4">
            <div className="size-10 rounded-full bg-saturn/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-saturn text-lg">&#x2644;</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-saturn">Saturn Return Active</p>
              <p className="text-sm text-muted leading-relaxed mt-1.5 text-pretty">
                A pivotal period of transformation, restructuring, and stepping into maturity.
                Travel with intention — the places you visit now shape your next chapter.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
