export const APP_HOTKEYS = {
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
  bloomEnabled: true,
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
}
