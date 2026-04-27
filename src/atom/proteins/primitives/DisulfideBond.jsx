import { StructuralBond } from '../../core'
import { getAtomRenderStyle } from '../../elements'

const SULFUR_STYLE = getAtomRenderStyle('S')

export default function DisulfideBond({ start, end }) {
  if (!start || !end) return null

  return (
    <StructuralBond
      start={start}
      end={end}
      color={SULFUR_STYLE.color}
      opacity={0.7}
    />
  )
}
