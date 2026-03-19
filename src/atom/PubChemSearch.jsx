/**
 * PubChemSearch — floating search bar with live autocomplete.
 *
 * Behaviour:
 *  - Debounces the query (300 ms) before hitting the PubChem autocomplete endpoint
 *  - Arrow-key navigation through suggestions
 *  - Enter or suggestion click triggers the parent's onSearch callback
 *  - Escape closes the suggestion list
 *  - Typing a plain number is treated as a direct CID lookup
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAutocomplete } from './pubchem'

// ---------------------------------------------------------------------------
// useDebounce
// ---------------------------------------------------------------------------

function useDebounce(value, delayMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PubChemSearch({ onSearch, loading, error, activeMolecule, onClear }) {
  const [query, setQuery]               = useState('')
  const [suggestions, setSuggestions]   = useState([])
  const [showList, setShowList]         = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)

  const inputRef     = useRef(null)
  const containerRef = useRef(null)

  const debouncedQuery = useDebounce(query, 300)

  // Fetch autocomplete whenever the debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      setShowList(false)
      return
    }

    let stale = false
    fetchAutocomplete(debouncedQuery).then((results) => {
      if (stale) return
      setSuggestions(results)
      setShowList(results.length > 0)
      setActiveIndex(-1)
    })

    return () => { stale = true }
  }, [debouncedQuery])

  // Close the suggestion list when clicking outside the widget
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowList(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const triggerSearch = useCallback((term) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setQuery(trimmed)
    setShowList(false)
    setSuggestions([])
    onSearch(trimmed)
  }, [onSearch])

  const handleKeyDown = useCallback((e) => {
    // Let the parent app's hotkeys handle arrow keys only when the list is closed
    if (!showList) {
      if (e.key === 'Enter' && query.trim()) triggerSearch(query)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) {
        triggerSearch(suggestions[activeIndex])
      } else if (query.trim()) {
        triggerSearch(query)
      }
    } else if (e.key === 'Escape') {
      setShowList(false)
      setActiveIndex(-1)
    }
  }, [showList, suggestions, activeIndex, query, triggerSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setShowList(false)
    onClear()
    inputRef.current?.focus()
  }, [onClear])

  const isActive = Boolean(activeMolecule)

  return (
    <div className="pubchem-search" ref={containerRef}>
      <div className="pubchem-search__field">
        {/* Magnifier icon */}
        <svg
          className="pubchem-search__icon"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          className="pubchem-search__input"
          type="text"
          placeholder="Search PubChem…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowList(true)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-label="Search for a molecule on PubChem"
          aria-expanded={showList}
          aria-autocomplete="list"
        />

        {/* Loading spinner */}
        {loading && <span className="pubchem-search__spinner" aria-label="Loading" />}

        {/* Clear button — shown when a dynamic molecule is active */}
        {isActive && !loading && (
          <button
            type="button"
            className="pubchem-search__clear"
            onClick={handleClear}
            title="Clear search — return to preset molecules"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Active molecule pill */}
      {isActive && (
        <div className="pubchem-search__pill">
          <span className="pubchem-search__pill-name">{activeMolecule.name}</span>
          {activeMolecule.formula && (
            <span className="pubchem-search__pill-formula">{activeMolecule.formula}</span>
          )}
          {activeMolecule.cid && (
            <a
              className="pubchem-search__pill-cid"
              href={`https://pubchem.ncbi.nlm.nih.gov/compound/${activeMolecule.cid}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in PubChem"
            >
              CID {activeMolecule.cid} ↗
            </a>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="pubchem-search__error" role="alert">
          {error}
        </div>
      )}

      {/* Autocomplete suggestion list */}
      {showList && suggestions.length > 0 && (
        <ul
          className="pubchem-search__suggestions"
          role="listbox"
          aria-label="Compound suggestions"
        >
          {suggestions.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === activeIndex}
              className={`pubchem-search__suggestion ${i === activeIndex ? 'is-active' : ''}`}
              onMouseDown={() => triggerSearch(name)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
