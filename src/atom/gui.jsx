import { useEffect, useRef } from 'react'
import GUI from 'lil-gui'
import {
  APP_HOTKEYS,
  GUI_DEFAULTS,
  GUI_RANGES,
} from './config'
import { isEditableTarget } from './core'
import {
  ATOM_VISUALIZATIONS,
  DEFAULT_VISUALIZATION,
  VISUALIZATION_LABELS,
  VISUALIZATION_VALUE_BY_LABEL,
} from './visualizations'

const VISUALIZATION_NAMES = ATOM_VISUALIZATIONS.map(({ label }) => label)

function AtomGuiControls({
  chromaticAberrationEnabled,
  effectSettings,
  sceneSettings,
  setEffectSettings,
  setSceneSettings,
  setVisualization,
  setXraySettings,
  updateChromaticAberration,
  updateXrayMode,
  visualization,
  xrayMode,
  xraySettings,
}) {
  const paramsRef = useRef({
    visualization: VISUALIZATION_LABELS[visualization] ?? VISUALIZATION_LABELS[DEFAULT_VISUALIZATION],
    chromaticAberrationEnabled,
    xrayMode,
    ...sceneSettings,
    ...effectSettings,
    ...xraySettings,
  })
  const syncGuiDisplayRef = useRef(() => {})

  useEffect(() => {
    const params = paramsRef.current
    const gui = new GUI(GUI_DEFAULTS)
    let guiVisible = false

    gui.domElement.style.zIndex = '40'
    gui.hide()

    const updateSceneSetting = (key, value) => {
      setSceneSettings((current) => (
        current[key] === value ? current : { ...current, [key]: value }
      ))
    }

    const updateEffectSetting = (key, value) => {
      setEffectSettings((current) => (
        current[key] === value ? current : { ...current, [key]: value }
      ))
    }

    const updateXraySetting = (key, value) => {
      setXraySettings((current) => (
        current[key] === value ? current : { ...current, [key]: value }
      ))
    }

    const addNumberControl = (folder, key, label, [min, max, step], onChange) => (
      folder.add(params, key, min, max, step).name(label).onChange(onChange)
    )

    const sceneFolder = gui.addFolder('Scene')
    sceneFolder
      .add(params, 'visualization', VISUALIZATION_NAMES)
      .name('Visualization')
      .onChange((name) => {
        setVisualization(VISUALIZATION_VALUE_BY_LABEL[name] ?? DEFAULT_VISUALIZATION)
      })
    sceneFolder
      .addColor(params, 'backgroundColor')
      .name('Background')
      .onChange((value) => updateSceneSetting('backgroundColor', value))
    sceneFolder
      .addColor(params, 'fogColor')
      .name('Fog')
      .onChange((value) => updateSceneSetting('fogColor', value))
    addNumberControl(
      sceneFolder,
      'fogNear',
      'Fog Near',
      GUI_RANGES.fogNear,
      (value) => updateSceneSetting('fogNear', value),
    )
    addNumberControl(
      sceneFolder,
      'fogFar',
      'Fog Far',
      GUI_RANGES.fogFar,
      (value) => updateSceneSetting('fogFar', value),
    )
    sceneFolder.open()

    const lightingFolder = gui.addFolder('Lighting')
    addNumberControl(
      lightingFolder,
      'ambientIntensity',
      'Ambient',
      GUI_RANGES.ambientIntensity,
      (value) => updateSceneSetting('ambientIntensity', value),
    )
    lightingFolder
      .addColor(params, 'hemisphereSkyColor')
      .name('Hemisphere Sky')
      .onChange((value) => updateSceneSetting('hemisphereSkyColor', value))
    lightingFolder
      .addColor(params, 'hemisphereGroundColor')
      .name('Hemisphere Ground')
      .onChange((value) => updateSceneSetting('hemisphereGroundColor', value))
    addNumberControl(
      lightingFolder,
      'hemisphereIntensity',
      'Hemisphere',
      GUI_RANGES.hemisphereIntensity,
      (value) => updateSceneSetting('hemisphereIntensity', value),
    )
    lightingFolder
      .addColor(params, 'keyLightColor')
      .name('Key Color')
      .onChange((value) => updateSceneSetting('keyLightColor', value))
    addNumberControl(
      lightingFolder,
      'keyLightIntensity',
      'Key Intensity',
      GUI_RANGES.keyLightIntensity,
      (value) => updateSceneSetting('keyLightIntensity', value),
    )
    lightingFolder
      .addColor(params, 'fillLightColor')
      .name('Fill Color')
      .onChange((value) => updateSceneSetting('fillLightColor', value))
    addNumberControl(
      lightingFolder,
      'fillLightIntensity',
      'Fill Intensity',
      GUI_RANGES.fillLightIntensity,
      (value) => updateSceneSetting('fillLightIntensity', value),
    )
    lightingFolder
      .addColor(params, 'backLightColor')
      .name('Back Color')
      .onChange((value) => updateSceneSetting('backLightColor', value))
    addNumberControl(
      lightingFolder,
      'backLightIntensity',
      'Back Intensity',
      GUI_RANGES.backLightIntensity,
      (value) => updateSceneSetting('backLightIntensity', value),
    )
    addNumberControl(
      lightingFolder,
      'backLightDistance',
      'Back Distance',
      GUI_RANGES.backLightDistance,
      (value) => updateSceneSetting('backLightDistance', value),
    )

    const effectsFolder = gui.addFolder('Effects')
    effectsFolder
      .add(params, 'chromaticAberrationEnabled')
      .name('Chromatic')
      .onChange((value) => updateChromaticAberration(value))
    effectsFolder
      .add(params, 'bloomEnabled')
      .name('Bloom')
      .onChange((value) => updateEffectSetting('bloomEnabled', value))
    addNumberControl(
      effectsFolder,
      'bloomIntensity',
      'Bloom Intensity',
      GUI_RANGES.bloomIntensity,
      (value) => updateEffectSetting('bloomIntensity', value),
    )
    addNumberControl(
      effectsFolder,
      'bloomThreshold',
      'Bloom Threshold',
      GUI_RANGES.bloomThreshold,
      (value) => updateEffectSetting('bloomThreshold', value),
    )
    addNumberControl(
      effectsFolder,
      'bloomSmoothing',
      'Bloom Smoothing',
      GUI_RANGES.bloomSmoothing,
      (value) => updateEffectSetting('bloomSmoothing', value),
    )
    addNumberControl(
      effectsFolder,
      'bloomRadius',
      'Bloom Radius',
      GUI_RANGES.bloomRadius,
      (value) => updateEffectSetting('bloomRadius', value),
    )
    addNumberControl(
      effectsFolder,
      'chromaticOffset',
      'Chromatic Offset',
      GUI_RANGES.chromaticOffset,
      (value) => updateEffectSetting('chromaticOffset', value),
    )
    addNumberControl(
      effectsFolder,
      'chromaticOscillationSpeed',
      'Chromatic Speed',
      GUI_RANGES.chromaticOscillationSpeed,
      (value) => updateEffectSetting('chromaticOscillationSpeed', value),
    )
    effectsFolder
      .add(params, 'chromaticRadialModulation')
      .name('Radial Modulation')
      .onChange((value) => updateEffectSetting('chromaticRadialModulation', value))
    addNumberControl(
      effectsFolder,
      'chromaticModulationOffset',
      'Modulation Offset',
      GUI_RANGES.chromaticModulationOffset,
      (value) => updateEffectSetting('chromaticModulationOffset', value),
    )
    effectsFolder.open()

    const xrayFolder = gui.addFolder('X-Ray')
    xrayFolder
      .add(params, 'xrayMode')
      .name('Enabled')
      .onChange((value) => updateXrayMode(value))
    xrayFolder
      .addColor(params, 'rimColor')
      .name('Rim Color')
      .onChange((value) => updateXraySetting('rimColor', value))
    addNumberControl(
      xrayFolder,
      'rimStrength',
      'Rim Strength',
      GUI_RANGES.rimStrength,
      (value) => updateXraySetting('rimStrength', value),
    )
    addNumberControl(
      xrayFolder,
      'rimPower',
      'Rim Power',
      GUI_RANGES.rimPower,
      (value) => updateXraySetting('rimPower', value),
    )

    syncGuiDisplayRef.current = () => {
      gui.controllersRecursive().forEach((controller) => controller.updateDisplay())
    }

    const toggleGui = () => {
      guiVisible = !guiVisible

      if (guiVisible) {
        syncGuiDisplayRef.current()
        gui.show()
        return
      }

      gui.hide()
    }

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (event.key === APP_HOTKEYS.gui || event.key === APP_HOTKEYS.gui.toUpperCase()) {
        toggleGui()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      gui.destroy()
    }
  }, [
    setEffectSettings,
    setSceneSettings,
    setVisualization,
    setXraySettings,
    updateChromaticAberration,
    updateXrayMode,
  ])

  useEffect(() => {
    Object.assign(
      paramsRef.current,
      {
        visualization: VISUALIZATION_LABELS[visualization] ?? VISUALIZATION_LABELS[DEFAULT_VISUALIZATION],
        chromaticAberrationEnabled,
        xrayMode,
      },
      sceneSettings,
      effectSettings,
      xraySettings,
    )
    syncGuiDisplayRef.current()
  }, [
    chromaticAberrationEnabled,
    effectSettings,
    sceneSettings,
    visualization,
    xrayMode,
    xraySettings,
  ])

  return null
}

export { AtomGuiControls }
