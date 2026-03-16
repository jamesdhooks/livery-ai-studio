import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getStarredCars, saveStarredCars } from '../utils/helpers';

export function CarPicker({ cars = [], selectedFolder = '', onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [starred, setStarred] = useState(() => getStarredCars());
  const [recents, setRecents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recentCars') || '[]');
    } catch {
      return [];
    }
  });
  
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selectedCar = useMemo(
    () => cars.find((c) => c.folder === selectedFolder),
    [cars, selectedFolder]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [open]);

  const filteredCars = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter(
      (c) =>
        c.display.toLowerCase().includes(q) ||
        c.folder.toLowerCase().includes(q)
    );
  }, [cars, query]);

  const starredCars = useMemo(
    () => filteredCars.filter((c) => starred.has(c.folder)),
    [filteredCars, starred]
  );
  const recentCars = useMemo(
    () =>
      !query.trim()
        ? recents
            .map((f) => cars.find((c) => c.folder === f))
            .filter(Boolean)
            .filter((c) => !starred.has(c.folder))
        : [],
    [recents, cars, starred, query]
  );
  const restCars = useMemo(
    () =>
      filteredCars.filter(
        (c) => !starred.has(c.folder) && !recentCars.find((r) => r.folder === c.folder)
      ),
    [filteredCars, starred, recentCars]
  );

  const handleSelect = (folder) => {
    onChange(folder);
    setOpen(false);
    // Update recents
    const newRecents = [folder, ...recents.filter((f) => f !== folder)].slice(0, 5);
    setRecents(newRecents);
    localStorage.setItem('recentCars', JSON.stringify(newRecents));
  };

  const toggleStar = (e, folder) => {
    e.stopPropagation();
    const newStarred = new Set(starred);
    const isAdding = !newStarred.has(folder);
    if (newStarred.has(folder)) {
      newStarred.delete(folder);
    } else {
      newStarred.add(folder);
    }
    setStarred(newStarred);
    saveStarredCars(newStarred);
    // Auto-select the car when starring it
    if (isAdding) handleSelect(folder);
  };

  const CarItem = ({ car }) => {
    const isStarred = starred.has(car.folder);
    const isActive = car.folder === selectedFolder;
    return (
      <div
        onClick={() => handleSelect(car.folder)}
        className={`
          flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors duration-100
          ${isActive ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-primary'}
        `}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">{car.display}</div>
          <div className="text-[10px] text-text-muted truncate">{car.folder}</div>
        </div>
        <button
          onClick={(e) => toggleStar(e, car.folder)}
          className={`flex-shrink-0 text-sm transition-colors ${
            isStarred ? 'text-warning' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {isStarred ? '★' : '☆'}
        </button>
      </div>
    );
  };

  const SectionHeader = ({ label }) => (
    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-bg-dark/50">
      {label}
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 h-[26px] min-w-[160px] max-w-[280px] bg-bg-input border border-border-default rounded text-xs text-text-primary hover:border-accent/50 transition-all duration-150 cursor-pointer"
      >
        <span className="text-text-muted text-xs">▼</span>
        <span className="flex-1 text-left truncate">
          {selectedCar ? selectedCar.display : 'Select a car…'}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-bg-panel border border-border-default rounded-lg shadow-2xl z-[200] flex flex-col max-h-80">
          {/* Search */}
          <div className="p-2 border-b border-border-default flex-shrink-0">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cars…"
              className="w-full px-2.5 py-1.5 text-xs bg-bg-input border border-border-default rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filteredCars.length === 0 && (
              <div className="px-3 py-4 text-xs text-text-muted text-center">
                No cars match
              </div>
            )}

            {starredCars.length > 0 && (
              <>
                <SectionHeader label="★ Starred" />
                {starredCars.map((c) => <CarItem key={c.folder} car={c} />)}
              </>
            )}

            {recentCars.length > 0 && (
              <>
                <SectionHeader label="Recent" />
                {recentCars.map((c) => <CarItem key={c.folder} car={c} />)}
              </>
            )}

            {restCars.length > 0 && (
              <>
                {(starredCars.length > 0 || recentCars.length > 0) && (
                  <SectionHeader label="All Cars" />
                )}
                {restCars.map((c) => <CarItem key={c.folder} car={c} />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CarPicker;
