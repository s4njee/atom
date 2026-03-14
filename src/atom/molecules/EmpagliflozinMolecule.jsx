import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  BondElectronPair,
  Nucleus,
  StructuralBond,
} from '../core'

export function EmpagliflozinMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.48
  const atomDefs = [
    // PubChem CID 11949646, 3D conformer heavy-atom coordinates.
    { key: 'a1', element: 'Cl', scale: ATOM_SCALES.Cl, position: [-0.7423 * scale, 4.3515 * scale, 0.8154 * scale] },
    { key: 'a2', element: 'O', scale: ATOM_SCALES.O, position: [4.2659 * scale, 0.1767 * scale, -0.2707 * scale] },
    { key: 'a3', element: 'O', scale: ATOM_SCALES.O, position: [3.2059 * scale, -3.7588 * scale, 0.3049 * scale] },
    { key: 'a4', element: 'O', scale: ATOM_SCALES.O, position: [2.0299 * scale, -1.6573 * scale, 1.9892 * scale] },
    { key: 'a5', element: 'O', scale: ATOM_SCALES.O, position: [5.9106 * scale, -3.0912 * scale, -0.4326 * scale] },
    { key: 'a6', element: 'O', scale: ATOM_SCALES.O, position: [6.7026 * scale, 0.9816 * scale, -1.25 * scale] },
    { key: 'a7', element: 'O', scale: ATOM_SCALES.O, position: [-7.0788 * scale, -2.7764 * scale, 0.4135 * scale] },
    { key: 'a8', element: 'O', scale: ATOM_SCALES.O, position: [-5.1636 * scale, -0.7353 * scale, -0.757 * scale] },
    { key: 'a9', element: 'C', scale: ATOM_SCALES.C, position: [3.8292 * scale, -2.5168 * scale, 0.6371 * scale] },
    { key: 'a10', element: 'C', scale: ATOM_SCALES.C, position: [2.7579 * scale, -1.4326 * scale, 0.782 * scale] },
    { key: 'a11', element: 'C', scale: ATOM_SCALES.C, position: [4.8203 * scale, -2.1743 * scale, -0.475 * scale] },
    { key: 'a12', element: 'C', scale: ATOM_SCALES.C, position: [3.3944 * scale, -0.0357 * scale, 0.8445 * scale] },
    { key: 'a13', element: 'C', scale: ATOM_SCALES.C, position: [5.3523 * scale, -0.7497 * scale, -0.3083 * scale] },
    { key: 'a14', element: 'C', scale: ATOM_SCALES.C, position: [2.3507 * scale, 1.0641 * scale, 0.8286 * scale] },
    { key: 'a15', element: 'C', scale: ATOM_SCALES.C, position: [6.2591 * scale, -0.3457 * scale, -1.4662 * scale] },
    { key: 'a16', element: 'C', scale: ATOM_SCALES.C, position: [1.4646 * scale, 1.1671 * scale, -0.2426 * scale] },
    { key: 'a17', element: 'C', scale: ATOM_SCALES.C, position: [2.2793 * scale, 1.9703 * scale, 1.8853 * scale] },
    { key: 'a18', element: 'C', scale: ATOM_SCALES.C, position: [0.5047 * scale, 2.179 * scale, -0.257 * scale] },
    { key: 'a19', element: 'C', scale: ATOM_SCALES.C, position: [-5.6491 * scale, -0.8929 * scale, 0.5717 * scale] },
    { key: 'a20', element: 'C', scale: ATOM_SCALES.C, position: [-0.4273 * scale, 2.2572 * scale, -1.4231 * scale] },
    { key: 'a21', element: 'C', scale: ATOM_SCALES.C, position: [1.3193 * scale, 2.9821 * scale, 1.8709 * scale] },
    { key: 'a22', element: 'C', scale: ATOM_SCALES.C, position: [0.4319 * scale, 3.0865 * scale, 0.7997 * scale] },
    { key: 'a23', element: 'C', scale: ATOM_SCALES.C, position: [-7.0794 * scale, -0.4197 * scale, 0.6585 * scale] },
    { key: 'a24', element: 'C', scale: ATOM_SCALES.C, position: [-5.7795 * scale, -2.3707 * scale, 0.8773 * scale] },
    { key: 'a25', element: 'C', scale: ATOM_SCALES.C, position: [-7.8404 * scale, -1.6036 * scale, 0.0959 * scale] },
    { key: 'a26', element: 'C', scale: ATOM_SCALES.C, position: [-1.6985 * scale, 1.4541 * scale, -1.2446 * scale] },
    { key: 'a27', element: 'C', scale: ATOM_SCALES.C, position: [-4.0206 * scale, -0.0141 * scale, -0.9175 * scale] },
    { key: 'a28', element: 'C', scale: ATOM_SCALES.C, position: [-2.803 * scale, 2.0581 * scale, -0.6707 * scale] },
    { key: 'a29', element: 'C', scale: ATOM_SCALES.C, position: [-1.726 * scale, 0.1344 * scale, -1.6592 * scale] },
    { key: 'a30', element: 'C', scale: ATOM_SCALES.C, position: [-3.9737 * scale, 1.3178 * scale, -0.5057 * scale] },
    { key: 'a31', element: 'C', scale: ATOM_SCALES.C, position: [-2.8968 * scale, -0.6057 * scale, -1.4942 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const leftRingKeys = ['a14', 'a16', 'a18', 'a22', 'a21', 'a17']
  const rightRingKeys = ['a26', 'a28', 'a30', 'a27', 'a31', 'a29']
  const leftRingPoints = leftRingKeys.map((key) => atoms[key])
  const rightRingPoints = rightRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    Cl: { color: '#74c46e', emissive: '#356f2f', emissiveIntensity: 1.35 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['a1', 'a22'],
    ['a2', 'a12'],
    ['a2', 'a13'],
    ['a3', 'a9'],
    ['a4', 'a10'],
    ['a5', 'a11'],
    ['a6', 'a15'],
    ['a7', 'a24'],
    ['a7', 'a25'],
    ['a8', 'a19'],
    ['a8', 'a27'],
    ['a9', 'a10'],
    ['a9', 'a11'],
    ['a10', 'a12'],
    ['a11', 'a13'],
    ['a12', 'a14'],
    ['a13', 'a15'],
    ['a14', 'a16'],
    ['a14', 'a17'],
    ['a16', 'a18'],
    ['a17', 'a21'],
    ['a18', 'a20'],
    ['a18', 'a22'],
    ['a19', 'a23'],
    ['a19', 'a24'],
    ['a20', 'a26'],
    ['a21', 'a22'],
    ['a23', 'a25'],
    ['a26', 'a28'],
    ['a26', 'a29'],
    ['a27', 'a30'],
    ['a27', 'a31'],
    ['a28', 'a30'],
    ['a29', 'a31'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.16 + t * 0.074
    moleculeRef.current.rotation.x = 0.28 + Math.sin(t * 0.15) * 0.04
    moleculeRef.current.rotation.z = 0.08 + Math.sin(t * 0.1) * 0.022
    moleculeRef.current.position.y = Math.sin(t * 0.35) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={atomStyle[element].color}
          emissive={atomStyle[element].emissive}
          emissiveIntensity={atomStyle[element].emissiveIntensity}
        />
      ))}

      {bondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bondDefs
        .filter(([startKey, endKey]) => (
          !leftRingKeys.includes(startKey) || !leftRingKeys.includes(endKey)
        ) && (
          !rightRingKeys.includes(startKey) || !rightRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 10 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 10 ? '#c9edff' : '#e6f7ff'}
            speed={8 + (index % 5) * 0.38}
            phase={index * 0.35}
            spread={index < 8 ? 0.08 : 0.068}
            lineScale={index < 8 ? 0.25 : 0.22}
            lightIntensity={0}
          />
        ))}

      <AromaticRingPair ringPoints={leftRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.4} />
      <AromaticRingPair ringPoints={leftRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.7} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.1} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.5} />
    </group>
  )
}
