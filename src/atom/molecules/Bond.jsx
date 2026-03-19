/**
 * Bond — declarative bond renderer.
 *
 * Reads `order` and `structural` from props and delegates to the correct
 * low-level component so molecule files / data schemas never need to import
 * SingleBond, DoubleBond, or StructuralBond directly.
 *
 *   structural=true  → StructuralBond  (ring backbone, no electron animation)
 *   order >= 2       → DoubleBond      (sigma + pi electron pair)
 *   default          → SingleBond      (single electron pair)
 */
import { DoubleBond, SingleBond, StructuralBond } from '../core'

export function Bond({
  start,
  end,
  order = 1,
  structural = false,
  color = '#77b4df',
  opacity = 0.42,
  index = 0,
  showStructure,
}) {
  if (structural) {
    return <StructuralBond start={start} end={end} color={color} opacity={opacity} />
  }

  if (order >= 2) {
    const phase = index * 0.41
    return (
      <DoubleBond
        start={start}
        end={end}
        color={color}
        opacity={opacity}
        showStructure={showStructure}
        sigmaProps={{
          colorA: '#9edbff',
          colorB: '#d1f0ff',
          speed: 8.8 + (index % 4) * 0.3,
          spread: 0.09,
          lineScale: 0.28,
          phase,
        }}
        piPairs={[
          {
            sign: 1,
            colorA: '#9dd8ff',
            colorB: '#dff5ff',
            speed: 11.1 + (index % 3) * 0.3,
            phase,
          },
          {
            sign: -1,
            colorA: '#7fc3ff',
            colorB: '#c7ebff',
            speed: 10.6 + (index % 3) * 0.26,
            phase: phase + Math.PI * 0.58,
          },
        ]}
      />
    )
  }

  return (
    <SingleBond
      start={start}
      end={end}
      color={color}
      opacity={opacity}
      showStructure={showStructure}
      electronProps={{
        colorA: index % 2 === 0 ? '#8fd4ff' : '#9edbff',
        colorB: index % 2 === 0 ? '#bce8ff' : '#d1f0ff',
        speed: 8.6 + (index % 5) * 0.45,
        phase: index * 0.41,
        spread: 0.085,
        lineScale: 0.27,
      }}
    />
  )
}
