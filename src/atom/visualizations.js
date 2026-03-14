import {
  Atom,
  AtropineMolecule,
  BuckminsterfullereneMolecule,
  CaffeineMolecule,
  CapsaicinMolecule,
  EmpagliflozinMolecule,
  EpinephrineMolecule,
  EthyleneMolecule,
  LSDMolecule,
  MirtazapineMolecule,
  OxygenMolecule,
  QuetiapineMolecule,
} from './molecules'

const ATOM_VISUALIZATIONS = [
  { value: 1, label: 'atom', component: Atom },
  { value: 2, label: 'oxygen', component: OxygenMolecule },
  { value: 3, label: 'ethylene', component: EthyleneMolecule },
  { value: 4, label: 'caffeine', component: CaffeineMolecule },
  { value: 5, label: 'epinephrine', component: EpinephrineMolecule },
  { value: 6, label: 'buckminsterfullerene', component: BuckminsterfullereneMolecule },
  { value: 7, label: 'capsaicin', component: CapsaicinMolecule },
  { value: 8, label: 'mirtazapine', component: MirtazapineMolecule },
  { value: 9, label: 'quetiapine', component: QuetiapineMolecule },
  { value: 10, label: 'lsd', component: LSDMolecule },
  { value: 11, label: 'atropine', component: AtropineMolecule },
  { value: 12, label: 'empagliflozin', component: EmpagliflozinMolecule },
]

const DEFAULT_VISUALIZATION = ATOM_VISUALIZATIONS[0].value
const VISUALIZATION_OPTIONS = ATOM_VISUALIZATIONS.map(({ value, label }) => ({ value, label }))
const VISUALIZATION_INDEX_BY_VALUE = Object.fromEntries(
  ATOM_VISUALIZATIONS.map(({ value }, index) => [value, index]),
)
const VISUALIZATION_LABELS = Object.fromEntries(
  ATOM_VISUALIZATIONS.map(({ value, label }) => [value, label]),
)
const VISUALIZATION_VALUE_BY_LABEL = Object.fromEntries(
  ATOM_VISUALIZATIONS.map(({ value, label }) => [label, value]),
)
const VISUALIZATION_COMPONENTS = Object.fromEntries(
  ATOM_VISUALIZATIONS.map(({ value, component }) => [value, component]),
)

function getNextVisualization(currentValue, direction) {
  const currentIndex = VISUALIZATION_INDEX_BY_VALUE[currentValue]
  if (currentIndex === undefined) return DEFAULT_VISUALIZATION

  const nextIndex = (currentIndex + direction + ATOM_VISUALIZATIONS.length) % ATOM_VISUALIZATIONS.length
  return ATOM_VISUALIZATIONS[nextIndex].value
}

export {
  ATOM_VISUALIZATIONS,
  DEFAULT_VISUALIZATION,
  getNextVisualization,
  VISUALIZATION_COMPONENTS,
  VISUALIZATION_VALUE_BY_LABEL,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
}
