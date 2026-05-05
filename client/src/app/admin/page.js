"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  fetchReportsSummary,
  fetchReportsAttendees,
  fetchReportsSales,
} from "@/lib/admin/eventApi";
import Pagination from "@/components/pagination"; // your component

// ---- FilterDropdown Component (mimics Actions dropdown style)
function FilterDropdown({ value, onChange, options, width = "auto" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left,
        y: rect.bottom + window.scrollY + 5,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => {
      updatePosition();
    };

    const closeOnOutsideClick = (e) => {
      if (!buttonRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("click", closeOnOutsideClick);
    
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("click", closeOnOutsideClick);
    };
  }, [isOpen, updatePosition]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const displayValue = options.find(opt => opt.value === value)?.label || value;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="px-3 py-1.5 rounded-xl bg-primary text-root-primary text-sm font-medium hover:opacity-90 transition"
      >
        {displayValue} ▾
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: coords.y,
            left: coords.x,
            zIndex: 9999,
            minWidth: width !== "auto" ? width : "auto",
          }}
          className="w-48 rounded-xl bg-surface border border-root text-root-primary text-sm shadow-elevated"
        >
          {options.map((opt, i) => {
            // Skip the "All" option at the beginning
            if (opt.value === "All") {
              return null;
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(opt.value)}
                className={`flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-highlight transition text-root-primary ${opt.value === value ? "bg-highlight/50" : ""}`}
              >
                <span>{opt.label}</span>
              </button>
            );
          })}
          {/* Add "All Event Types" seamlessly at the bottom */}
          <button
            onClick={() => handleSelect(options[0].value)}
            className={`flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-highlight transition text-root-primary ${options[0].value === value ? "bg-highlight/50" : ""}`}
          >
            <span>All Event Types</span>
          </button>
        </div>
      )}
    </div>
  );
}

// tiny debounce
const useDebounced = (value, ms = 400) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const TYPE_OPTIONS = ["All", "bazaar", "booth", "conference", "trip", "workshop"];

// header cell with clickable sort
function SortTh({ label, col, sort, onSort, right }) {
  const dir = sort.col === col ? (sort.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th
      onClick={() => onSort(col)}
      className={`p-2 cursor-pointer select-none text-root-primary ${right ? "text-right" : "text-left"}`}
    >
      <span className="opacity-90 text-sm">{label}</span>
      <span className="ml-2 opacity-60 text-xs">{dir}</span>
    </th>
  );
}

// Banner component reused from workshops page to keep colors consistent
function Banner({ text, tone }) {
  if (!text) return null;
  const toneClass =
    tone === "error"
      ? "bg-red-600/25 text-red-200 border-red-400/40"
      : tone === "success"
      ? "bg-green-600/25 text-green-200 border-green-400/40"
      : "bg-black/30 text-secondary border-white/10";
  return <div className={`mb-3 rounded-xl px-3 py-2 text-sm border ${toneClass}`}>{text}</div>;
}

// Small sparkline used for KPI cards (renders small polyline or placeholder)
function Sparkline({ values = [], color = "#7c3aed", width = 120, height = 36 }) {
  if (!values || values.length === 0) {
    return <div className="mt-2 h-8 w-32 rounded bg-black/20" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = width;
  const h = height;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * (w - 2) + 1; // padding
    const y = max === min ? h / 2 : h - 2 - ((v - min) / (max - min)) * (h - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <svg width={w} height={h} className="mt-2">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

export default function AdminHome() {
  // shared summary filters (affect cards only)
  const [summaryName, setSummaryName] = useState("");
  const [summaryType, setSummaryType] = useState("All");
  const [sumFrom, setSumFrom] = useState("");
  const [sumTo, setSumTo] = useState("");

  // debounced for auto-fetch (memoize query object to avoid referential churn)
  const summaryQuery = useMemo(() => ({ name: summaryName, type: summaryType, from: sumFrom, to: sumTo }), [summaryName, summaryType, sumFrom, sumTo]);
  const qSummary = useDebounced(summaryQuery);

  const [totalAttendees, setTotalAttendees] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [banner, setBanner] = useState(null);

  // Attendees table filters/paging/sort
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState("All");
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [attPage, setAttPage] = useState(1);
  const [attPerPage, setAttPerPage] = useState(5);
  const [attSort, setAttSort] = useState({ col: "start", dir: "asc" });

  // Sales table filters/paging/sort
  const [saleType, setSaleType] = useState("All");
  const [saleFrom, setSaleFrom] = useState("");
  const [saleTo, setSaleTo] = useState("");
  const [salePage, setSalePage] = useState(1);
  const [salePerPage, setSalePerPage] = useState(5);
  const [saleSort, setSaleSort] = useState({ col: "rev", dir: "desc" });

  const [attRows, setAttRows] = useState([]);
  const [attTotalPages, setAttTotalPages] = useState(1);
  const [attTotal, setAttTotal] = useState(0);

  const [saleRows, setSaleRows] = useState([]);
  const [saleTotalPages, setSaleTotalPages] = useState(1);
  const [saleTotal, setSaleTotal] = useState(0);

  // ---- Helpers to make API sort param
  const attSortKey = useMemo(() => {
    const map = {
      name: "name",
      type: "type",
      start: "start",
      end: "end",
      reg: "reg",
    };
    return `${map[attSort.col] || "start"}_${attSort.dir}`;
  }, [attSort]);

  const saleSortKey = useMemo(() => {
    const map = {
      name: "name",
      type: "type",
      start: "start",
      end: "end",
      rev: "rev",
    };
    return `${map[saleSort.col] || "rev"}_${saleSort.dir}`;
  }, [saleSort]);

  // ---- fetch summary cards
  useEffect(() => {
    (async () => {
      try {
        setBanner(null);
        const data = await fetchReportsSummary({
          name: qSummary.name || "",
          type: qSummary.type || "All",
          from: qSummary.from || "",
          to: qSummary.to || "",
        });
        setTotalAttendees(data?.data?.totalAttendees || 0);
        setTotalRevenue(data?.data?.totalRevenue || 0);
      } catch (e) {
        setBanner({ tone: "error", text: e.message || "Failed to fetch" });
      }
    })();
  }, [qSummary]);

  // ---- fetch attendees table
  const attQuery = useMemo(() => ({ attName, attType, attFrom, attTo, attPage, attPerPage, attSortKey }), [attName, attType, attFrom, attTo, attPage, attPerPage, attSortKey]);
  const dqAtt = useDebounced(attQuery);
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReportsAttendees({
          name: dqAtt.attName || "",
          type: dqAtt.attType || "All",
          from: dqAtt.attFrom || "",
          to: dqAtt.attTo || "",
          page: dqAtt.attPage || 1,
          limit: dqAtt.attPerPage || 5,
          sort: dqAtt.attSortKey,
        });
        setAttRows(data?.data?.items || []);
        setAttTotalPages(data?.data?.totalPages || 1);
        setAttTotal(data?.data?.total || 0);
      } catch (e) {
        setAttRows([]);
        setAttTotalPages(1);
        setAttTotal(0);
        setBanner({ tone: "error", text: e.message || "Failed to fetch attendees" });
      }
    })();
  }, [dqAtt]);

  // ---- fetch sales table
  const saleQuery = useMemo(() => ({ saleType, saleFrom, saleTo, salePage, salePerPage, saleSortKey }), [saleType, saleFrom, saleTo, salePage, salePerPage, saleSortKey]);
  const dqSale = useDebounced(saleQuery);
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReportsSales({
          type: dqSale.saleType || "All",
          from: dqSale.saleFrom || "",
          to: dqSale.saleTo || "",
          page: dqSale.salePage || 1,
          limit: dqSale.salePerPage || 5,
          sort: dqSale.saleSortKey,
        });
        setSaleRows(data?.data?.items || []);
        setSaleTotalPages(data?.data?.totalPages || 1);
        setSaleTotal(data?.data?.total || 0);
      } catch (e) {
        setSaleRows([]);
        setSaleTotalPages(1);
        setSaleTotal(0);
        setBanner({ tone: "error", text: e.message || "Failed to fetch sales" });
      }
    })();
  }, [dqSale]);

  // ---- Sorting togglers
  const toggleSort = (state, setState) => (col) => {
    setState((prev) =>
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }
    );
  };

  const sortAtt = toggleSort(attSort, setAttSort);
  const sortSale = toggleSort(saleSort, setSaleSort);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold text-root-primary">Home</h1>

      <Banner text={banner?.text} tone={banner?.tone} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface border border-root p-4">
          <div className="text-root-secondary text-sm">Total Attendees</div>
          <div className="mt-1 text-3xl font-semibold text-root-primary">{totalAttendees}</div>
          {/* sparkline based on current page attendee counts */}
          <Sparkline values={attRows.map((r) => Number(r.registered) || 0)} color="#7c3aed" />
        </div>
        <div className="rounded-2xl bg-surface border border-root p-4">
          <div className="text-root-secondary text-sm">Total Revenue</div>
          <div className="mt-1 text-3xl font-semibold text-root-primary">
            {Number(totalRevenue).toLocaleString()}
          </div>
          <Sparkline values={saleRows.map((r) => Number(r.revenue) || 0)} color="#06b6d4" />
        </div>
      </div>

      {/* Attendees section */}
      <section className="rounded-2xl bg-surface border border-root">
        <div className="flex items-center justify-between p-4 border-b border-root">
          <h2 className="text-lg font-medium text-root-primary">Attendees</h2>
          <div className="flex gap-3 items-center">
            {/* type select using new FilterDropdown */}
            <FilterDropdown
              value={attType}
              onChange={(val) => { setAttType(val); setAttPage(1); }}
              options={TYPE_OPTIONS.map((t) => ({
                value: t,
                label: t === "All" ? "All Event Types" : t.charAt(0).toUpperCase() + t.slice(1),
              }))}
            />
            {/* name search */}
            <input
              value={attName}
              onChange={(e) => { setAttName(e.target.value); setAttPage(1); }}
              placeholder="Search by event name"
              className="px-3 py-2.5 rounded-lg input-surface border border-root text-root-primary text-sm placeholder:text-root-secondary/60 hover:border-root/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            />
            <input
              type="date"
              value={attFrom}
              onChange={(e) => { setAttFrom(e.target.value); setAttPage(1); }}
              className="px-3 py-2.5 rounded-lg input-surface border border-root text-root-primary text-sm hover:border-root/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
            />
            <input
              type="date"
              value={attTo}
              onChange={(e) => { setAttTo(e.target.value); setAttPage(1); }}
              className="px-3 py-2.5 rounded-lg input-surface border border-root text-root-primary text-sm hover:border-root/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface text-root-primary">
          <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-root-secondary opacity-80">
              <tr>
                <SortTh label="Event" col="name" sort={attSort} onSort={sortAtt} />
                <SortTh label="Type" col="type" sort={attSort} onSort={sortAtt} />
                <SortTh label="Start" col="start" sort={attSort} onSort={sortAtt} />
                <SortTh label="End" col="end" sort={attSort} onSort={sortAtt} />
                <SortTh label="# Registered" col="reg" sort={attSort} onSort={sortAtt} right />
              </tr>
            </thead>
            <tbody>
              {attRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-root-secondary" colSpan={5}>
                    No attendees found for the current filters.
                  </td>
                </tr>
              ) : (
                attRows.map((r) => (
                  <tr key={r.eventId} className="border-t border-root hover:bg-black/10">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 capitalize">{r.type}</td>
                    <td className="px-4 py-3">{new Date(r.start).toLocaleString()}</td>
                    <td className="px-4 py-3">{new Date(r.end).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{r.registered}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>


          <Pagination
            page={attPage}
            limit={attPerPage}
            totalCount={attTotal}
            onPageChange={(p) => setAttPage(p)}
            onLimitChange={(l) => { setAttPerPage(l); setAttPage(1); }}
          />
          </div>
        
      </section>

      {/* Sales section */}
      <section className="rounded-2xl bg-surface border border-root">
        <div className="flex items-center justify-between p-4 border-b border-root">
          <h2 className="text-lg font-medium text-root-primary">Sales</h2>
          <div className="flex gap-3 items-center">
            <FilterDropdown
              value={saleType}
              onChange={(val) => { setSaleType(val); setSalePage(1); }}
              options={TYPE_OPTIONS.map((t) => ({
                value: t,
                label: t === "All" ? "All Event Types" : t.charAt(0).toUpperCase() + t.slice(1),
              }))}
            />
            <input
              type="date"
              value={saleFrom}
              onChange={(e) => { setSaleFrom(e.target.value); setSalePage(1); }}
              className="px-3 py-2.5 rounded-lg input-surface border border-root text-root-primary text-sm hover:border-root/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
            />
            <input
              type="date"
              value={saleTo}
              onChange={(e) => { setSaleTo(e.target.value); setSalePage(1); }}
              className="px-3 py-2.5 rounded-lg input-surface border border-root text-root-primary text-sm hover:border-root/80 focus:outline-none focus:ring-2 focus:ring-primary/30 transition [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface text-root-primary">
          <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-root-secondary opacity-80">
              <tr>
                <SortTh label="Event" col="name" sort={saleSort} onSort={sortSale} />
                <SortTh label="Type" col="type" sort={saleSort} onSort={sortSale} />
                <SortTh label="Start" col="start" sort={saleSort} onSort={sortSale} />
                <SortTh label="End" col="end" sort={saleSort} onSort={sortSale} />
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => sortSale("rev")}
                    className="cursor-pointer select-none opacity-90 hover:opacity-100"
                  >
                    Revenue
                    <span className="ml-1 opacity-60">
                      {saleSort.col === "rev" ? (saleSort.dir === "asc" ? "↑" : "↓") : ""}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {saleRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-root-secondary" colSpan={5}>
                    No sales found for the current filters.
                  </td>
                </tr>
              ) : (
                saleRows.map((r) => (
                  <tr key={r.eventId} className="border-t border-root hover:bg-black/10">
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 capitalize">{r.type}</td>
                    <td className="px-4 py-3">{new Date(r.start).toLocaleString()}</td>
                    <td className="px-4 py-3">{new Date(r.end).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(r.revenue).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

        
         

          <Pagination
            page={salePage}
            limit={salePerPage}
            totalCount={saleTotal}
            onPageChange={(p) => setSalePage(p)}
            onLimitChange={(l) => { setSalePerPage(l); setSalePage(1); }}
          />
          </div>
       
      </section>
    </main>
  );
}
