/**
 * Insulin — extracted from PDB 4INS (chains A, B).
 *
 * Cα-only coordinates centered on the molecular centroid and uniformly scaled
 * so the maximum radial distance is ~4 world units. Secondary
 * structure derived from the HELIX records in the PDB file (no DSSP run).
 * Disulfides taken from SSBOND records.
 */

export default {
  name: 'Insulin',
  chains: [
    {
      id: 'A',
      residues: [
        { resNum: 1, resName: 'GLY', ca: [0.027, 1.569, 1.878], ss: 'helix' },
        { resNum: 2, resName: 'ILE', ca: [-0.107, 0.904, 1.241], ss: 'helix' },
        { resNum: 3, resName: 'VAL', ca: [0.741, 0.575, 1.235], ss: 'helix' },
        { resNum: 4, resName: 'GLU', ca: [0.759, 0.472, 2.131], ss: 'helix' },
        { resNum: 5, resName: 'GLN', ca: [-0.088, 0.189, 2.212], ss: 'helix' },
        { resNum: 6, resName: 'CYS', ca: [-0.002, -0.480, 1.594], ss: 'helix' },
        { resNum: 7, resName: 'CYS', ca: [0.741, -0.801, 2.014], ss: 'helix' },
        { resNum: 8, resName: 'THR', ca: [0.525, -0.670, 2.908], ss: 'helix' },
        { resNum: 9, resName: 'SER', ca: [-0.353, -0.893, 2.812], ss: 'helix' },
        { resNum: 10, resName: 'ILE', ca: [-0.797, -1.154, 2.044], ss: 'helix' },
        { resNum: 11, resName: 'CYS', ca: [-1.113, -0.682, 1.309], ss: 'loop' },
        { resNum: 12, resName: 'SER', ca: [-1.675, -0.851, 0.616], ss: 'helix' },
        { resNum: 13, resName: 'LEU', ca: [-1.562, -0.739, -0.286], ss: 'helix' },
        { resNum: 14, resName: 'TYR', ca: [-2.225, -0.115, -0.260], ss: 'helix' },
        { resNum: 15, resName: 'GLN', ca: [-1.718, 0.391, 0.320], ss: 'helix' },
        { resNum: 16, resName: 'LEU', ca: [-0.998, 0.316, -0.235], ss: 'helix' },
        { resNum: 17, resName: 'GLU', ca: [-1.488, 0.642, -0.929], ss: 'helix' },
        { resNum: 18, resName: 'ASN', ca: [-1.442, 1.450, -0.509], ss: 'loop' },
        { resNum: 19, resName: 'TYR', ca: [-0.558, 1.496, -0.739], ss: 'loop' },
        { resNum: 20, resName: 'CYS', ca: [-0.673, 1.396, -1.646], ss: 'loop' },
        { resNum: 21, resName: 'ASN', ca: [-0.569, 2.140, -2.181], ss: 'loop' },
      ],
    },
    {
      id: 'B',
      residues: [
        { resNum: 1, resName: 'PHE', ca: [-2.488, -2.202, -0.336], ss: 'loop' },
        { resNum: 2, resName: 'VAL', ca: [-2.098, -2.388, 0.472], ss: 'loop' },
        { resNum: 3, resName: 'ASN', ca: [-1.645, -1.884, 1.085], ss: 'loop' },
        { resNum: 4, resName: 'GLN', ca: [-0.745, -1.920, 0.993], ss: 'loop' },
        { resNum: 5, resName: 'HIS', ca: [-0.010, -1.809, 1.525], ss: 'loop' },
        { resNum: 6, resName: 'LEU', ca: [0.620, -1.398, 1.003], ss: 'loop' },
        { resNum: 7, resName: 'CYS', ca: [1.441, -1.127, 1.234], ss: 'loop' },
        { resNum: 8, resName: 'GLY', ca: [2.161, -0.783, 0.767], ss: 'loop' },
        { resNum: 9, resName: 'SER', ca: [2.211, -0.956, -0.112], ss: 'helix' },
        { resNum: 10, resName: 'HIS', ca: [1.470, -1.477, -0.062], ss: 'helix' },
        { resNum: 11, resName: 'LEU', ca: [0.956, -0.721, 0.041], ss: 'helix' },
        { resNum: 12, resName: 'VAL', ca: [1.316, -0.351, -0.711], ss: 'helix' },
        { resNum: 13, resName: 'GLU', ca: [1.110, -1.100, -1.181], ss: 'helix' },
        { resNum: 14, resName: 'ALA', ca: [0.236, -1.047, -0.898], ss: 'helix' },
        { resNum: 15, resName: 'LEU', ca: [0.197, -0.159, -1.139], ss: 'helix' },
        { resNum: 16, resName: 'TYR', ca: [0.531, -0.374, -1.959], ss: 'helix' },
        { resNum: 17, resName: 'LEU', ca: [-0.126, -1.017, -2.074], ss: 'helix' },
        { resNum: 18, resName: 'VAL', ca: [-0.797, -0.474, -1.777], ss: 'helix' },
        { resNum: 19, resName: 'CYS', ca: [-0.576, 0.300, -2.216], ss: 'helix' },
        { resNum: 20, resName: 'GLY', ca: [-0.155, -0.037, -2.962], ss: 'helix' },
        { resNum: 21, resName: 'GLU', ca: [-0.086, 0.609, -3.600], ss: 'loop' },
        { resNum: 22, resName: 'ARG', ca: [-0.493, 1.257, -3.107], ss: 'loop' },
        { resNum: 23, resName: 'GLY', ca: [0.289, 1.243, -2.634], ss: 'loop' },
        { resNum: 24, resName: 'PHE', ca: [0.351, 1.426, -1.737], ss: 'strand' },
        { resNum: 25, resName: 'PHE', ca: [0.778, 1.876, -1.058], ss: 'strand' },
        { resNum: 26, resName: 'TYR', ca: [1.215, 1.402, -0.417], ss: 'strand' },
        { resNum: 27, resName: 'THR', ca: [1.238, 1.937, 0.319], ss: 'loop' },
        { resNum: 28, resName: 'PRO', ca: [1.577, 1.576, 1.086], ss: 'loop' },
        { resNum: 29, resName: 'LYS', ca: [1.641, 2.030, 1.893], ss: 'loop' },
        { resNum: 30, resName: 'ALA', ca: [2.454, 2.415, 2.036], ss: 'loop' },
      ],
    },
  ],
  disulfides: [
    { chainA: 'A', resA: 6, chainB: 'A', resB: 11 },
    { chainA: 'A', resA: 7, chainB: 'B', resB: 7 },
    { chainA: 'A', resA: 20, chainB: 'B', resB: 19 },
  ],
  boundingRadius: 4,
}
