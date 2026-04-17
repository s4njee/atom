import { createContext, createElement, useContext } from 'react'
import { STANDING_WAVE_DEFAULTS } from './config'

const StandingWaveContext = createContext(STANDING_WAVE_DEFAULTS)

function StandingWaveProvider({ children, value }) {
  return createElement(
    StandingWaveContext.Provider,
    { value: value ?? STANDING_WAVE_DEFAULTS },
    children,
  )
}

function useStandingWave() {
  return useContext(StandingWaveContext)
}

export {
  StandingWaveProvider,
  STANDING_WAVE_DEFAULTS,
  useStandingWave,
}
