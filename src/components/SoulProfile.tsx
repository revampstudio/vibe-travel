import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.ts'

export default function SoulProfile() {
  const profile = useStore((s) => s.profile)
  const birthData = useStore((s) => s.birthData)
  if (!profile) return null

  return (
    <motion.div
      className="absolute top-5 left-5 right-5 z-20 pointer-events-none"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex items-center justify-between max-w-screen-xl mx-auto pointer-events-auto">
        {/* Right: Stats */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-5 bg-white/95 backdrop-blur-md rounded-2xl
                          px-6 py-4 shadow-sm border border-border/60">
            {/* Life Path */}
            <div className="text-center">
              <p className="text-lg font-serif font-bold text-text">{profile.lifePathNumber}</p>
              <p className="text-[11px] text-muted tracking-wide uppercase">Life Path</p>
            </div>

            <div className="w-px h-8 bg-border" />

            {/* Personal Year */}
            <div className="text-center">
              <p className="text-lg font-serif font-bold text-text">{profile.personalYear}</p>
              <p className="text-[11px] text-muted tracking-wide uppercase">Personal Year</p>
            </div>

            {/* Life Stage - desktop only */}
            <div className="hidden md:flex items-center gap-5">
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-sm font-semibold text-text">{profile.lifeStage}</p>
                <p className="text-[11px] text-muted tracking-wide uppercase">Current Stage</p>
              </div>
            </div>
          </div>

          {/* Saturn Return badge */}
          {profile.saturnReturn && (
            <div className="flex items-center gap-2 bg-saturn/10 backdrop-blur-md rounded-2xl
                            px-4 py-3.5 shadow-sm border border-saturn/20">
              <span className="text-saturn text-lg">&#x2644;</span>
              <span className="text-sm text-saturn font-medium hidden sm:block">Saturn Return</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
