import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ElectronPair, Nucleus } from '../core'

export function Atom() {
  const atomRef = useRef(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    atomRef.current.rotation.y = t * 0.18
    atomRef.current.rotation.x = Math.sin(t * 0.35) * 0.08
    atomRef.current.position.y = Math.sin(t * 0.75) * 0.14
  })

  return (
    <group ref={atomRef}>
      <Nucleus />
      <ElectronPair axis="y" lobeTightness={1} />
    </group>
  )
}
