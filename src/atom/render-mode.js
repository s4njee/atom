import { createContext, createElement, useContext } from 'react'

const DEFAULT_ATOM_RENDER_MODE = Object.freeze({
  bondLightIntensityScale: 1,
  cinematicEnabled: false,
  pharmacophoreMap: null,
})

const AtomRenderModeContext = createContext(DEFAULT_ATOM_RENDER_MODE)

function AtomRenderModeProvider({ children, value }) {
  return createElement(
    AtomRenderModeContext.Provider,
    { value: value ?? DEFAULT_ATOM_RENDER_MODE },
    children,
  )
}

function useAtomRenderMode() {
  return useContext(AtomRenderModeContext)
}

export {
  AtomRenderModeProvider,
  DEFAULT_ATOM_RENDER_MODE,
  useAtomRenderMode,
}
