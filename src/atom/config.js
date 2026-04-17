export const APP_HOTKEYS = {
  bloom: '4',
  chromaticAberration: 'c',
  xrayMode: 'x',
  gui: 'g',
}

export const CAMERA_DEFAULTS = {
  position: [0, 0.2, 8.5],
  fov: 45,
}

export const SCENE_DEFAULTS = {
  backgroundColor: '#040913',
  fogColor: '#040913',
  fogNear: 10,
  fogFar: 20,
  ambientIntensity: 0.36,
  hemisphereSkyColor: '#d2ecff',
  hemisphereGroundColor: '#071018',
  hemisphereIntensity: 0.92,
  keyLightColor: '#ffffff',
  keyLightIntensity: 1.35,
  fillLightColor: '#4da3ff',
  fillLightIntensity: 0.5,
  backLightColor: '#13304f',
  backLightIntensity: 10,
  backLightDistance: 18,
}

export const LIGHT_POSITIONS = {
  key: [4, 4, 6],
  fill: [-4, -2, 3],
  back: [0, 0, -5],
}

export const EFFECT_DEFAULTS = {
  bloomEnabled: false,
  bloomIntensity: 0.72,
  bloomThreshold: 0.2,
  bloomSmoothing: 0.26,
  bloomRadius: 0.46,
  chromaticOffset: 0.004,
  chromaticOscillationSpeed: 3.2,
  chromaticRadialModulation: true,
  chromaticModulationOffset: 0.15,
}

export const XRAY_DEFAULTS = {
  rimColor: '#e8fbff',
  rimStrength: 1.35,
  rimPower: 2.4,
}

export const STANDING_WAVE_DEFAULTS = {
  standingWaveN: 0,
  standingWaveOmega: 0.5,
  standingWaveAmplitude: 0.7,
}

// ---------------------------------------------------------------------------
// Named effect presets — each preset overrides a subset of EFFECT_DEFAULTS
// and SCENE_DEFAULTS. Stored as plain objects so they can be serialised and
// compared cheaply.
// ---------------------------------------------------------------------------

export const EFFECT_PRESETS = [
  {
    id: 'default',
    label: 'Default',
    effect: {
      bloomEnabled: false,
      bloomIntensity: 0.72,
      bloomThreshold: 0.2,
      bloomSmoothing: 0.26,
      bloomRadius: 0.46,
    },
    scene: {},
  },
  {
    id: 'neon-lab',
    label: 'Neon Lab',
    effect: {
      bloomEnabled: true,
      bloomIntensity: 1.6,
      bloomThreshold: 0.08,
      bloomSmoothing: 0.18,
      bloomRadius: 0.65,
    },
    scene: {
      ambientIntensity: 0.22,
      keyLightIntensity: 1.8,
    },
  },
  {
    id: 'deep-space',
    label: 'Deep Space',
    effect: {
      bloomEnabled: true,
      bloomIntensity: 0.95,
      bloomThreshold: 0.14,
      bloomSmoothing: 0.32,
      bloomRadius: 0.55,
    },
    scene: {
      fogNear: 8,
      fogFar: 16,
      ambientIntensity: 0.18,
      hemisphereIntensity: 0.6,
      keyLightIntensity: 1.1,
    },
  },
  {
    id: 'clinical',
    label: 'Clinical',
    effect: {
      bloomEnabled: false,
      bloomIntensity: 0.4,
      bloomThreshold: 0.35,
      bloomSmoothing: 0.4,
      bloomRadius: 0.3,
    },
    scene: {
      ambientIntensity: 0.72,
      hemisphereIntensity: 1.4,
      keyLightIntensity: 0.9,
      fillLightIntensity: 0.8,
    },
  },
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    effect: {
      bloomEnabled: true,
      bloomIntensity: 0.48,
      bloomThreshold: 0.28,
      bloomSmoothing: 0.22,
      bloomRadius: 0.38,
    },
    scene: {
      ambientIntensity: 0.44,
      hemisphereIntensity: 1.1,
      keyLightIntensity: 1.6,
      fillLightIntensity: 0.6,
    },
  },
]

export const GUI_DEFAULTS = {
  title: 'Atom Controls',
  width: 320,
}

export const GUI_RANGES = {
  fogNear: [1, 20, 0.1],
  fogFar: [5, 40, 0.1],
  ambientIntensity: [0, 3, 0.01],
  hemisphereIntensity: [0, 3, 0.01],
  keyLightIntensity: [0, 4, 0.01],
  fillLightIntensity: [0, 3, 0.01],
  backLightIntensity: [0, 20, 0.1],
  backLightDistance: [1, 30, 0.1],
  bloomIntensity: [0, 3, 0.01],
  bloomThreshold: [0, 1, 0.01],
  bloomSmoothing: [0, 1, 0.01],
  bloomRadius: [0, 1, 0.01],
  chromaticOffset: [0, 0.02, 0.0001],
  chromaticOscillationSpeed: [0, 10, 0.01],
  chromaticModulationOffset: [0, 1, 0.01],
  rimStrength: [0, 4, 0.01],
  rimPower: [0.25, 6, 0.01],
  standingWaveN: [0, 8, 1],
  standingWaveOmega: [0.1, 3, 0.01],
  standingWaveAmplitude: [0, 1, 0.01],
}
