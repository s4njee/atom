import { useMemo } from 'react'

function PharmacophoreLegend({ pharmacophoreMap }) {
  const groups = useMemo(() => {
    if (!pharmacophoreMap) return []

    const groupByName = new Map()
    pharmacophoreMap.forEach(({ group, color }) => {
      if (!groupByName.has(group)) groupByName.set(group, { group, color })
    })
    return Array.from(groupByName.values())
  }, [pharmacophoreMap])

  if (groups.length === 0) return null

  return (
    <div className="pharmacophore-legend">
      {groups.map(({ group, color }) => (
        <div key={group} className="pharmacophore-legend__item">
          <span style={{ background: color, color }} className="pharmacophore-legend__dot" />
          <span>{group}</span>
        </div>
      ))}
    </div>
  )
}

export { PharmacophoreLegend }
