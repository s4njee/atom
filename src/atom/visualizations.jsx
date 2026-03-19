import {
  Atom,
  BuckminsterfullereneMolecule,
  EthyleneMolecule,
  OxygenMolecule,
} from './molecules'
import { PresetMolecule } from './molecules/PresetMolecule'

// JSON molecule data
import caffeineData       from './molecules/data/caffeine.json'
import glucoseData        from './molecules/data/glucose.json'
import epinephrineData    from './molecules/data/epinephrine.json'
import atropineData       from './molecules/data/atropine.json'
import capsaicinData      from './molecules/data/capsaicin.json'
import lsdData            from './molecules/data/lsd.json'
import mirtazapineData    from './molecules/data/mirtazapine.json'
import quetiapineData     from './molecules/data/quetiapine.json'
import empagliflozinData  from './molecules/data/empagliflozin.json'

// Wrap each JSON dataset in a tiny stable component so the visualizations
// registry can store component references (not data objects).
const CaffeineMolecule      = () => <PresetMolecule data={caffeineData} />
const GlucoseMolecule       = () => <PresetMolecule data={glucoseData} />
const EpinephrineMolecule   = () => <PresetMolecule data={epinephrineData} />
const AtropineMolecule      = () => <PresetMolecule data={atropineData} />
const CapsaicinMolecule     = () => <PresetMolecule data={capsaicinData} />
const LSDMolecule           = () => <PresetMolecule data={lsdData} />
const MirtazapineMolecule   = () => <PresetMolecule data={mirtazapineData} />
const QuetiapineMolecule    = () => <PresetMolecule data={quetiapineData} />
const EmpagliflozinMolecule = () => <PresetMolecule data={empagliflozinData} />

const ATOM_VISUALIZATIONS = [
  { value: 1,  label: 'atom',                  component: Atom },
  { value: 2,  label: 'oxygen',                component: OxygenMolecule },
  { value: 3,  label: 'ethylene',              component: EthyleneMolecule },
  { value: 4,  label: 'caffeine',              component: CaffeineMolecule },
  { value: 5,  label: 'epinephrine',           component: EpinephrineMolecule },
  { value: 6,  label: 'buckminsterfullerene',  component: BuckminsterfullereneMolecule },
  { value: 7,  label: 'capsaicin',             component: CapsaicinMolecule },
  { value: 8,  label: 'mirtazapine',           component: MirtazapineMolecule },
  { value: 9,  label: 'quetiapine',            component: QuetiapineMolecule },
  { value: 10, label: 'lsd',                   component: LSDMolecule },
  { value: 11, label: 'atropine',              component: AtropineMolecule },
  { value: 12, label: 'empagliflozin',         component: EmpagliflozinMolecule },
  { value: 13, label: 'glucose',               component: GlucoseMolecule },
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
