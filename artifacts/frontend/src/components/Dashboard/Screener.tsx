import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Download, Settings2 } from "lucide-react";

interface Security {
  symbol: string;
  company: string;
  sector: string;
  marketCap: number;
  candidateScore: number;
  researchScore: number;
  dataConfidence: number;
  dailySignal: string;
  weeklySignal: string;
  monthlySignal: string;
  mediumSignal: string;
  longSignal: string;
  alignment: number;
  quality: number;
  growth: number;
  value: number;
  balanceSheet: number;
  capitalAllocation: number;
  integrity: number;
  momentum: number;
  liquidity: number;
  expectedReturn: number;
  fairValue: number;
  sectorRank: number;
  sizeRank: number;
  hardGate: string;
  researchStatus: string;
  lastFiling: string;
  lastScoreChange: string;
}

interface ScreenerProps {
  data: Security[];
}

export const Screener: React.FC<ScreenerProps> = ({ data }) => {
  const [sortBy, setSortBy] = useState<string>("candidateScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set([
      "symbol",
      "company",
      "sector",
      "candidateScore",
      "researchScore",
      "dataConfidence",
      "dailySignal",
      "weeklySignal",
      "monthlySignal",
      "alignment",
      "expectedReturn",
      "hardGate",
    ])
  );
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const columns = [
    { key: "symbol", label: "Symbol", width: "100px" },
    { key: "company", label: "Company", width: "150px" },
    { key: "sector", label: "Sector", width: "120px" },
    { key: "marketCap", label: "Market Cap", width: "120px" },
    { key: "candidateScore", label: "Candidate Score", width: "120px" },
    { key: "researchScore", label: "Research Score", width: "120px" },
    { key: "dataConfidence", label: "Data Confidence", width: "120px" },
    { key: "dailySignal", label: "Daily Signal", width: "100px" },
    { key: "weeklySignal", label: "Weekly Signal", width: "100px" },
    { key: "monthlySignal", label: "Monthly Signal", width: "100px" },
    { key: "mediumSignal", label: "Medium Signal", width: "100px" },
    { key: "longSignal", label: "Long Signal", width: "100px" },
    { key: "alignment", label: "Alignment", width: "100px" },
    { key: "quality", label: "Quality", width: "80px" },
    { key: "growth", label: "Growth", width: "80px" },
    { key: "value", label: "Value", width: "80px" },
    { key: "balanceSheet", label: "Balance Sheet", width: "100px" },
    { key: "capitalAllocation", label: "Capital Allocation", width: "120px" },
    { key: "integrity", label: "Integrity", width: "100px" },
    { key: "momentum", label: "Momentum", width: "100px" },
    { key: "liquidity", label: "Liquidity", width: "100px" },
    { key: "expectedReturn", label: "Expected Return", width: "120px" },
    { key: "fairValue", label: "Fair Value", width: "100px" },
    { key: "sectorRank", label: "Sector Rank", width: "100px" },
    { key: "sizeRank", label: "Size Rank", width: "100px" },
    { key: "hardGate", label: "Hard Gate", width: "100px" },
    { key: "researchStatus", label: "Research Status", width: "120px" },
    { key: "lastFiling", label: "Last Filing", width: "120px" },
    { key: "lastScoreChange", label: "Last Score Change", width: "150px" },
  ];

  const filteredAndSorted = useMemo(() => {
    let result = [...data];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter((item: any) => {
          const itemValue = item[key];
          if (typeof itemValue === "string") {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      }
    });

    // Apply sorting
    result.sort((a: any, b: any) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = aVal > bVal ? 1 : -1;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, filters, sortBy, sortOrder]);

  const paginatedData = filteredAndSorted.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "STRONG_BUY":
        return "bg-green-900 text-green-300";
      case "BUY":
        return "bg-green-800 text-green-200";
      case "HOLD":
        return "bg-yellow-900 text-yellow-300";
      case "SELL":
        return "bg-red-800 text-red-200";
      case "AVOID":
        return "bg-red-900 text-red-300";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            <Settings2 size={16} />
            Filters
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            <Settings2 size={16} />
            Columns
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            <Download size={16} />
            Export
          </button>
        </div>
        <div className="text-sm text-gray-400">
          Showing {paginatedData.length} of {filteredAndSorted.length} securities
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-900">
              {columns.map((col) => (
                visibleColumns.has(col.key) && (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-semibold text-gray-300 cursor-pointer hover:bg-gray-800"
                    onClick={() => {
                      if (sortBy === col.key) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy(col.key);
                        setSortOrder("desc");
                      }
                    }}
                    style={{ width: col.width }}
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortBy === col.key && (
                        sortOrder === "asc" ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      )}
                    </div>
                  </th>
                )
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row: Security, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-700 hover:bg-gray-700 transition-colors"
              >
                {columns.map((col) => (
                  visibleColumns.has(col.key) && (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-gray-300"
                      style={{ width: col.width }}
                    >
                      {col.key === "symbol" && (
                        <span className="font-semibold text-white">
                          {(row as any)[col.key]}
                        </span>
                      )}
                      {typeof (row as any)[col.key] === "number" &&
                      [
                        "candidateScore",
                        "researchScore",
                        "dataConfidence",
                        "alignment",
                        "quality",
                        "growth",
                        "value",
                        "integrity",
                        "momentum",
                        "liquidity",
                        "expectedReturn",
                      ].includes(col.key) ? (
                        <span className={getScoreColor((row as any)[col.key])}>
                          {((row as any)[col.key] as number).toFixed(1)}
                        </span>
                      ) : [
                          "dailySignal",
                          "weeklySignal",
                          "monthlySignal",
                          "mediumSignal",
                          "longSignal",
                        ].includes(col.key) ? (
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${getSignalColor(
                            (row as any)[col.key]
                          )}`}
                        >
                          {(row as any)[col.key]}
                        </span>
                      ) : (
                        (row as any)[col.key]
                      )}
                    </td>
                  )
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
        >
          Previous
        </button>
        <span className="text-sm text-gray-400">
          Page {page + 1} of {Math.ceil(filteredAndSorted.length / pageSize)}
        </span>
        <button
          onClick={() =>
            setPage(
              Math.min(
                Math.ceil(filteredAndSorted.length / pageSize) - 1,
                page + 1
              )
            )
          }
          disabled={page >= Math.ceil(filteredAndSorted.length / pageSize) - 1}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
};
