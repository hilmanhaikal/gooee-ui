import { useEffect, useState, type RefObject } from 'react'
import { EMPTY_MEDIA, watchMedia, type MediaState } from '../../internal/motion/media'

// Shared by VideoPlayer and AudioPlayer. The logic lives in motion/media.ts, for React and Vue.

export { handleMediaKey, handleSeekKey, readMs, seekBy, togglePlay, type MediaKeyResult, type MediaState } from '../../internal/motion/media'

export function useMediaState(ref: RefObject<HTMLMediaElement | null>, src: unknown): MediaState {
  const [state, setState] = useState(EMPTY_MEDIA)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    return watchMedia(el, setState)
  }, [ref, src])
  return state
}
