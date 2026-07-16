import { useEffect, useMemo, useRef, useState } from "react";

function defaultLabel(item) {
  return item?.name || item?.label || "";
}

function defaultSearchText(item) {
  return [item?.name, item?.label, item?.category].filter(Boolean).join(" ");
}

function SearchableCombobox({
  emptyMessage = "No se encontraron resultados",
  getLabel = defaultLabel,
  getSearchText = defaultSearchText,
  items = [],
  onChange,
  placeholder = "Buscar...",
  renderItem,
  value = null,
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
      ? items.filter((item) => getSearchText(item).toLowerCase().includes(normalizedQuery))
      : items;
    return matches.slice(0, 30);
  }, [getSearchText, items, query]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!value && !isOpen) setQuery("");
  }, [isOpen, value]);

  const selectItem = (item) => {
    onChange?.(item);
    setQuery(getLabel(item));
    setIsOpen(false);
  };

  const openList = () => {
    if (value) setQuery("");
    setIsOpen(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && filteredItems[highlightedIndex]) {
      event.preventDefault();
      selectItem(filteredItems[highlightedIndex]);
    }
  };

  const inputValue = isOpen ? query : value ? getLabel(value) : query;

  return (
    <div className="searchable-combobox" ref={rootRef}>
      <input
        aria-autocomplete="list"
        aria-expanded={isOpen}
        className="searchable-combobox-input"
        onChange={(event) => {
          setQuery(event.target.value);
          if (value) onChange?.(null);
          setIsOpen(true);
        }}
        onClick={openList}
        onFocus={openList}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        role="combobox"
        value={inputValue}
      />

      {isOpen && (
        <div className="searchable-combobox-list" role="listbox">
          {filteredItems.map((item, index) => (
            <button
              className={index === highlightedIndex ? "searchable-combobox-option highlighted" : "searchable-combobox-option"}
              key={item.id || getLabel(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
              role="option"
              type="button"
            >
              {renderItem ? renderItem(item) : <span>{getLabel(item)}</span>}
            </button>
          ))}
          {filteredItems.length === 0 && <p className="searchable-combobox-empty">{emptyMessage}</p>}
        </div>
      )}
    </div>
  );
}

export default SearchableCombobox;
