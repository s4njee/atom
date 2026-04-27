import data from '../data/proteins/insulin.js'
import { ProteinStructure } from './ProteinStructure.jsx'

export default function Insulin({ proteinMode8 = false, renderMode = 'cartoon' }) {
  return <ProteinStructure data={data} proteinMode8={proteinMode8} renderMode={renderMode} />
}
