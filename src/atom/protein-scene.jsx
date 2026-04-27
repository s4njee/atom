import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { OrbitControls } from '@react-three/drei'
import { PROTEINS } from './proteins'
import { ProteinStructure } from './proteins/ProteinStructure.jsx'
import { AtomRenderModeProvider, DEFAULT_ATOM_RENDER_MODE } from './render-mode'

const BLUEPRINT_PAPER = '#edf2e9'

function ProteinScene({
  dynamicProtein,
  proteinMode8 = false,
  renderMode = 'cartoon',
  visualization,
}) {
  const { component: ProteinComponent } = PROTEINS[visualization] ?? PROTEINS[1]
  const backgroundColor = proteinMode8 ? BLUEPRINT_PAPER : '#040913'
  const fogColor = proteinMode8 ? BLUEPRINT_PAPER : '#040913'
  const renderModeContext = proteinMode8
    ? { ...DEFAULT_ATOM_RENDER_MODE, blueprintEnabled: true }
    : DEFAULT_ATOM_RENDER_MODE

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <fog attach="fog" args={[fogColor, proteinMode8 ? 16 : 14, proteinMode8 ? 32 : 30]} />
      <ambientLight intensity={proteinMode8 ? 1.1 : 0.5} />
      {!proteinMode8 && (
        <hemisphereLight args={['#d2ecff', '#071018', 0.92]} />
      )}
      {!proteinMode8 && (
        <>
          <directionalLight position={[4, 4, 6]} intensity={1.35} color="#ffffff" />
          <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#4da3ff" />
          <pointLight position={[0, 0, -5]} intensity={10} distance={24} color="#13304f" />
        </>
      )}
      <AtomRenderModeProvider value={renderModeContext}>
        {dynamicProtein ? (
          <ProteinStructure
            key={dynamicProtein.pdbId}
            data={dynamicProtein}
            proteinMode8={proteinMode8}
            renderMode={renderMode}
          />
        ) : (
          <ProteinComponent proteinMode8={proteinMode8} renderMode={renderMode} />
        )}
      </AtomRenderModeProvider>
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={4}
        maxDistance={28}
        makeDefault
      />
      {!proteinMode8 && (
        <EffectComposer>
          <Bloom
            mipmapBlur
            intensity={0.55}
            luminanceThreshold={0.28}
            luminanceSmoothing={0.26}
            radius={0.46}
          />
        </EffectComposer>
      )}
    </>
  )
}

export { ProteinScene }
