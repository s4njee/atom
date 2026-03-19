import { createMoleculeSchema } from './molecule-schema.js'

const PUBCHEM_HOSTNAME = 'pubchem.ncbi.nlm.nih.gov'
const PUBCHEM_ORIGIN = `https://${PUBCHEM_HOSTNAME}`
const PUBCHEM_RECORD_TYPE_3D = '3d'
const PUBCHEM_RECORD_TYPE_2D = '2d'

function isPositiveIntegerString(value) {
  return /^\d+$/.test(value)
}

function decodePubChemPathSegment(value = '') {
  return decodeURIComponent(value).replace(/\+/g, ' ').trim()
}

function parsePubChemUrl(input) {
  let parsed

  try {
    parsed = new URL(input)
  } catch {
    return null
  }

  if (!parsed.hostname.endsWith(PUBCHEM_HOSTNAME)) {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)

  if (segments[0] === 'compound') {
    const compoundSegments = segments.slice(1)
    const cidSegment = compoundSegments.find(isPositiveIntegerString)

    if (cidSegment) {
      return {
        sourceUrl: parsed.toString(),
        query: cidSegment,
        cid: Number(cidSegment),
        slug: compoundSegments.find((segment) => segment !== cidSegment) ?? null,
      }
    }

    return {
      sourceUrl: parsed.toString(),
      query: decodePubChemPathSegment(compoundSegments[0] ?? ''),
      cid: null,
      slug: decodePubChemPathSegment(compoundSegments[0] ?? ''),
    }
  }

  if (segments[0] === 'rest' && segments[1] === 'pug' && segments[2] === 'compound') {
    const mode = segments[3]
    const value = segments[4]

    if (mode === 'cid' && isPositiveIntegerString(value)) {
      return {
        sourceUrl: parsed.toString(),
        query: value,
        cid: Number(value),
        slug: null,
      }
    }

    if (mode === 'name' && value) {
      return {
        sourceUrl: parsed.toString(),
        query: decodePubChemPathSegment(value),
        cid: null,
        slug: decodePubChemPathSegment(value),
      }
    }
  }

  const cidFromQuery = parsed.searchParams.get('cid')

  if (cidFromQuery && isPositiveIntegerString(cidFromQuery)) {
    return {
      sourceUrl: parsed.toString(),
      query: cidFromQuery,
      cid: Number(cidFromQuery),
      slug: null,
    }
  }

  return null
}

function extractPubChemCompoundReference(input) {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) {
    return {
      sourceUrl: null,
      query: String(input),
      cid: input,
      slug: null,
    }
  }

  if (typeof input !== 'string') {
    throw new Error('PubChem schema generation expects a PubChem URL, CID, or query string')
  }

  const trimmed = input.trim()

  if (isPositiveIntegerString(trimmed)) {
    return {
      sourceUrl: null,
      query: trimmed,
      cid: Number(trimmed),
      slug: null,
    }
  }

  const parsedUrl = parsePubChemUrl(trimmed)

  if (parsedUrl) return parsedUrl

  return {
    sourceUrl: null,
    query: decodePubChemPathSegment(trimmed),
    cid: null,
    slug: decodePubChemPathSegment(trimmed),
  }
}

function buildPubChemCanonicalUrl(cid, slug = null) {
  if (slug) {
    return `${PUBCHEM_ORIGIN}/compound/${encodeURIComponent(slug)}/${cid}`
  }

  return `${PUBCHEM_ORIGIN}/compound/${cid}`
}

function buildPubChemRecordUrl(cid, recordType) {
  return `${PUBCHEM_ORIGIN}/rest/pug/compound/cid/${cid}/record/JSON/?record_type=${recordType}`
}

function buildPubChemPropertyUrl(cid) {
  return `${PUBCHEM_ORIGIN}/rest/pug/compound/cid/${cid}/property/Title,MolecularFormula/JSON`
}

function buildPubChemCidLookupUrl(query) {
  return `${PUBCHEM_ORIGIN}/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`
}

async function fetchPubChemJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url)

  if (!response.ok) {
    throw new Error(`PubChem request failed for ${url} (${response.status})`)
  }

  return response.json()
}

async function resolvePubChemCompoundCid(reference, fetchImpl = fetch) {
  if (reference.cid) return reference.cid

  if (!reference.query) {
    throw new Error('PubChem link did not contain a CID or compound query')
  }

  const lookupJson = await fetchPubChemJson(buildPubChemCidLookupUrl(reference.query), fetchImpl)
  const cid = lookupJson?.IdentifierList?.CID?.[0]

  if (!cid) {
    throw new Error(`Unable to resolve a PubChem CID for "${reference.query}"`)
  }

  return cid
}

function getFirstPubChemCompound(recordJson) {
  const compound = recordJson?.PC_Compounds?.[0]

  if (!compound) {
    throw new Error('PubChem record response did not include a compound payload')
  }

  return compound
}

function getPreferredConformer(compound) {
  const coords = compound?.coords ?? []

  for (const entry of coords) {
    const conformer = entry?.conformers?.[0]

    if (conformer?.x?.length) {
      return {
        aid: entry.aid,
        conformer,
      }
    }
  }

  return null
}

function getPubChemPropertyEntry(propertyJson) {
  return propertyJson?.PropertyTable?.Properties?.[0] ?? null
}

function createSchemaFromPubChemPayload({
  reference,
  cid,
  recordType,
  compound,
  propertyEntry,
}) {
  const atomIds = compound?.atoms?.aid ?? []
  const atomicNumbers = compound?.atoms?.element ?? []
  const conformerPayload = getPreferredConformer(compound)
  const coordinateAid = conformerPayload?.aid ?? atomIds
  const conformer = conformerPayload?.conformer ?? {}
  const positionByAtomId = new Map()

  coordinateAid.forEach((atomId, index) => {
    positionByAtomId.set(atomId, [
      conformer.x?.[index] ?? 0,
      conformer.y?.[index] ?? 0,
      conformer.z?.[index] ?? 0,
    ])
  })

  const positions = atomIds.map((atomId) => positionByAtomId.get(atomId) ?? [0, 0, 0])
  const atomIndexByAtomId = new Map(atomIds.map((atomId, atomIndex) => [atomId, atomIndex]))
  const atomIndexA = []
  const atomIndexB = []
  const bondOrder = []
  const bondAid1 = compound?.bonds?.aid1 ?? []
  const bondAid2 = compound?.bonds?.aid2 ?? []
  const bondOrders = compound?.bonds?.order ?? []

  bondAid1.forEach((startAtomId, bondIndex) => {
    const endAtomId = bondAid2[bondIndex]
    const startAtomIndex = atomIndexByAtomId.get(startAtomId)
    const endAtomIndex = atomIndexByAtomId.get(endAtomId)

    if (startAtomIndex === undefined || endAtomIndex === undefined) return

    atomIndexA.push(startAtomIndex)
    atomIndexB.push(endAtomIndex)
    bondOrder.push(bondOrders[bondIndex] ?? 1)
  })

  const title = propertyEntry?.Title ?? reference.slug ?? `PubChem CID ${cid}`
  const canonicalUrl = buildPubChemCanonicalUrl(cid, title)

  return createMoleculeSchema({
    source: {
      provider: 'pubchem',
      sourceUrl: reference.sourceUrl,
      canonicalUrl,
      cid,
      query: reference.query,
      recordType,
    },
    molecule: {
      id: `pubchem:${cid}`,
      name: title,
      formula: propertyEntry?.MolecularFormula ?? null,
    },
    atoms: {
      ids: atomIds,
      atomicNumbers,
      positions,
    },
    bonds: {
      atomIndexA,
      atomIndexB,
      order: bondOrder,
    },
    annotations: {
      has3dCoordinates: recordType === PUBCHEM_RECORD_TYPE_3D,
    },
  })
}

async function fetchPubChemMoleculeSchema(
  input,
  {
    fetchImpl = fetch,
    prefer3d = true,
  } = {},
) {
  const reference = extractPubChemCompoundReference(input)
  const cid = await resolvePubChemCompoundCid(reference, fetchImpl)
  const propertyPromise = fetchPubChemJson(buildPubChemPropertyUrl(cid), fetchImpl)
  let recordJson
  let recordType = PUBCHEM_RECORD_TYPE_3D

  if (prefer3d) {
    try {
      recordJson = await fetchPubChemJson(buildPubChemRecordUrl(cid, PUBCHEM_RECORD_TYPE_3D), fetchImpl)
    } catch {
      recordType = PUBCHEM_RECORD_TYPE_2D
      recordJson = await fetchPubChemJson(buildPubChemRecordUrl(cid, PUBCHEM_RECORD_TYPE_2D), fetchImpl)
    }
  } else {
    recordType = PUBCHEM_RECORD_TYPE_2D
    recordJson = await fetchPubChemJson(buildPubChemRecordUrl(cid, PUBCHEM_RECORD_TYPE_2D), fetchImpl)
  }

  const [propertyJson, compound] = await Promise.all([
    propertyPromise,
    Promise.resolve(getFirstPubChemCompound(recordJson)),
  ])
  const propertyEntry = getPubChemPropertyEntry(propertyJson)

  return createSchemaFromPubChemPayload({
    reference,
    cid,
    recordType,
    compound,
    propertyEntry,
  })
}

export {
  PUBCHEM_ORIGIN,
  PUBCHEM_RECORD_TYPE_2D,
  PUBCHEM_RECORD_TYPE_3D,
  buildPubChemCanonicalUrl,
  buildPubChemCidLookupUrl,
  buildPubChemPropertyUrl,
  buildPubChemRecordUrl,
  extractPubChemCompoundReference,
  fetchPubChemMoleculeSchema,
  resolvePubChemCompoundCid,
}
