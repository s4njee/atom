import elementCatalog from './elements.json'

const DEFAULT_ATOM_RENDER_STYLE = Object.freeze({
  ...elementCatalog.defaultRenderStyle,
})

const ELEMENTS_BY_SYMBOL = Object.freeze(
  Object.fromEntries(
    Object.entries(elementCatalog.elements).map(([symbol, info]) => [
      symbol,
      Object.freeze({
        ...info,
        symbol,
        renderStyle: Object.freeze({
          ...(info.renderStyle ?? DEFAULT_ATOM_RENDER_STYLE),
        }),
      }),
    ]),
  ),
)

const ATOM_RENDER_STYLES = Object.freeze(
  Object.fromEntries(
    Object.entries(ELEMENTS_BY_SYMBOL).map(([symbol, info]) => [symbol, info.renderStyle]),
  ),
)

const DEFAULT_RENDER_SCALE_BY_ELEMENT = Object.freeze(
  Object.fromEntries(
    Object.entries(ELEMENTS_BY_SYMBOL).map(([symbol, info]) => [symbol, info.renderScale]),
  ),
)

const ELEMENT_SYMBOLS_BY_ATOMIC_NUMBER = Object.freeze(
  Object.fromEntries(
    Object.values(ELEMENTS_BY_SYMBOL).map((info) => [info.atomicNumber, info.symbol]),
  ),
)

const ATOM_SCALES = DEFAULT_RENDER_SCALE_BY_ELEMENT
const DEFAULT_ATOM_SCALE = DEFAULT_RENDER_SCALE_BY_ELEMENT.C ?? 0.22

function getElementInfo(symbol) {
  return ELEMENTS_BY_SYMBOL[symbol] ?? null
}

function getAtomRenderStyle(symbol) {
  return ELEMENTS_BY_SYMBOL[symbol]?.renderStyle ?? DEFAULT_ATOM_RENDER_STYLE
}

function atomicNumberToElementSymbol(atomicNumber) {
  return ELEMENT_SYMBOLS_BY_ATOMIC_NUMBER[atomicNumber] ?? `Z${atomicNumber}`
}

export {
  ATOM_RENDER_STYLES,
  ATOM_SCALES,
  DEFAULT_ATOM_RENDER_STYLE,
  DEFAULT_ATOM_SCALE,
  DEFAULT_RENDER_SCALE_BY_ELEMENT,
  ELEMENTS_BY_SYMBOL,
  ELEMENT_SYMBOLS_BY_ATOMIC_NUMBER,
  atomicNumberToElementSymbol,
  getAtomRenderStyle,
  getElementInfo,
}
