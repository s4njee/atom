import { createContext, createElement, useContext } from 'react'

const ATOM_INTERACTION_RESUME_DELAY_MS = 1800

const FALLBACK_INTERACTION_REF = {
  current: {
    controlsActive: false,
    pauseAnimationUntil: 0,
  },
}

const AtomInteractionContext = createContext(FALLBACK_INTERACTION_REF)

function AtomInteractionProvider({ children, value }) {
  return createElement(
    AtomInteractionContext.Provider,
    { value: value ?? FALLBACK_INTERACTION_REF },
    children,
  )
}

function useAtomInteraction() {
  return useContext(AtomInteractionContext)
}

export {
  ATOM_INTERACTION_RESUME_DELAY_MS,
  AtomInteractionProvider,
  useAtomInteraction,
}
