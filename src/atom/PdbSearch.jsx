import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPdbAutocomplete } from './pdb'

function useDebounce(value, delayMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}

function PdbSearch({ onSearch, loading, error, activeProtein, onClear }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showList, setShowList] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      setShowList(false)
      return
    }

    let stale = false
    fetchPdbAutocomplete(debouncedQuery).then((results) => {
      if (stale) return
      setSuggestions(results)
      setShowList(results.length > 0)
      setActiveIndex(-1)
    })

    return () => { stale = true }
  }, [debouncedQuery])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const handleKeyDown = useCallback((event) => {
    if (!showList) {
      if (event.key === 'Enter' && query.trim()) triggerSearch(query)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const suggestion = suggestions[activeIndex]
      triggerSearch(suggestion?.id ?? query)
    } else if (event.key === 'Escape') {
      setShowList(false)
      setActiveIndex(-1)
    }
  }, [activeIndex, query, showList, suggestions, triggerSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setShowList(false)
    onClear()
    inputRef.current?.focus()
  }, [onClear])

  const isActive = Boolean(activeProtein)

  return (
    <div className="pubchem-search" ref={containerRef}>
      <div className="pubchem-search__field">
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
          placeholder="Search PDB..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowList(true)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          aria-label="Search for a protein in the Protein Data Bank"
          aria-expanded={showList}
          aria-autocomplete="list"
        />

        {loading && <span className="pubchem-search__spinner" aria-label="Loading" />}

        {isActive && !loading && (
          <button
            type="button"
            className="pubchem-search__clear"
            onClick={handleClear}
            title="Clear search"
            aria-label="Clear search"
          >
            x
          </button>
        )}
      </div>

      {isActive && (
        <div className="pubchem-search__pill">
          <span className="pubchem-search__pill-name">{activeProtein.pdbId}</span>
          <span className="pubchem-search__pill-formula">{activeProtein.title}</span>
          <a
            className="pubchem-search__pill-cid"
            href={`https://www.rcsb.org/structure/${activeProtein.pdbId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in RCSB PDB"
          >
            PDB {activeProtein.pdbId} ↗
          </a>
        </div>
      )}

      {error && (
        <div className="pubchem-search__error" role="alert">
          {error}
        </div>
      )}

      {showList && suggestions.length > 0 && (
        <ul
          className="pubchem-search__suggestions"
          role="listbox"
          aria-label="PDB suggestions"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`pubchem-search__suggestion ${index === activeIndex ? 'is-active' : ''}`}
              onMouseDown={() => triggerSearch(suggestion.id)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { PdbSearch }
