import React, { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface CompanyResearchProps {
  isin: string;
  ticker: string;
  companyName: string;
}

export const CompanyResearch: React.FC<CompanyResearchProps> = ({
  isin,
  ticker,
  companyName,
}) => {
  const [activeTab, setActiveTab] = useState("summary");

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "signals", label: "Signals" },
    { id: "financials", label: "Financials" },
    { id: "sector-metrics", label: "Sector Metrics" },
    { id: "cash-flow", label: "Cash Flow" },
    { id: "balance-sheet", label: "Balance Sheet" },
    { id: "valuation", label: "Valuation" },
    { id: "governance", label: "Governance" },
    { id: "shareholding", label: "Shareholding" },
    { id: "technicals", label: "Technicals" },
    { id: "forecast", label: "Forecast" },
    { id: "scenarios", label: "Scenarios" },
    { id: "catalysts", label: "Catalysts" },
    { id: "risks", label: "Risks" },
    { id: "evidence", label: "Evidence" },
    { id: "signal-history", label: "Signal History" },
    { id: "position-history", label: "Position History" },
    { id: "documents", label: "Documents" },
    { id: "audit-trail", label: "Audit Trail" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "summary":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Candidate Score</div>
                <div className="text-3xl font-bold text-green-400">72.5</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Research Score</div>
                <div className="text-3xl font-bold text-blue-400">68.3</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Data Confidence</div>
                <div className="text-3xl font-bold text-yellow-400">85.0</div>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="text-gray-400 text-sm">Hard Gate</div>
                <div className="text-3xl font-bold text-green-400">PASS</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Key Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">P/E Ratio</span>
                    <span className="text-white">18.5x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">P/B Ratio</span>
                    <span className="text-white">2.3x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ROE</span>
                    <span className="text-green-400">18.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Debt/Equity</span>
                    <span className="text-white">0.45x</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Growth Metrics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Revenue CAGR (5Y)</span>
                    <span className="text-green-400">12.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">EPS CAGR (5Y)</span>
                    <span className="text-green-400">15.3%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">FCF CAGR (3Y)</span>
                    <span className="text-green-400">18.7%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">TTM Growth</span>
                    <span className="text-yellow-400">8.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "signals":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-4">
              {["Daily", "Weekly", "Monthly", "Medium", "Long"].map((horizon) => (
                <div key={horizon} className="bg-gray-800 p-4 rounded-lg">
                  <div className="text-gray-400 text-sm mb-2">{horizon}</div>
                  <div className="text-2xl font-bold text-green-400 mb-2">72</div>
                  <div className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded inline-block">
                    STRONG BUY
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Signal Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Alignment Score</span>
                  <span className="text-green-400">0.85</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Signal Confidence</span>
                  <span className="text-yellow-400">78%</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "financials":
        return (
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-4">Financial Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400">Metric</th>
                    <th className="text-right py-2 text-gray-400">FY2023</th>
                    <th className="text-right py-2 text-gray-400">FY2024</th>
                    <th className="text-right py-2 text-gray-400">YoY Growth</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-300">Revenue</td>
                    <td className="text-right text-white">₹1,250 Cr</td>
                    <td className="text-right text-white">₹1,406 Cr</td>
                    <td className="text-right text-green-400">+12.5%</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-300">EBITDA</td>
                    <td className="text-right text-white">₹312 Cr</td>
                    <td className="text-right text-white">₹365 Cr</td>
                    <td className="text-right text-green-400">+17.0%</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-2 text-gray-300">PAT</td>
                    <td className="text-right text-white">₹156 Cr</td>
                    <td className="text-right text-white">₹187 Cr</td>
                    <td className="text-right text-green-400">+19.9%</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-300">EPS</td>
                    <td className="text-right text-white">₹15.6</td>
                    <td className="text-right text-white">₹18.7</td>
                    <td className="text-right text-green-400">+19.9%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "valuation":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Valuation Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Price</span>
                  <span className="text-white">₹2,450</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fair Value (Base)</span>
                  <span className="text-green-400">₹2,850</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Upside</span>
                  <span className="text-green-400">+16.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expected Return (1Y)</span>
                  <span className="text-green-400">+18.5%</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Scenarios</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bear Case (20%)</span>
                  <span className="text-red-400">₹2,100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Base Case (60%)</span>
                  <span className="text-yellow-400">₹2,850</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bull Case (20%)</span>
                  <span className="text-green-400">₹3,600</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "governance":
        return (
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-4">Governance Assessment</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="text-gray-300">Audit Opinion</span>
                <span className="text-green-400 text-sm">Unqualified</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="text-gray-300">Board Independence</span>
                <span className="text-green-400 text-sm">75% Independent</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="text-gray-300">Promoter Pledge</span>
                <span className="text-yellow-400 text-sm">12% Pledged</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700 rounded">
                <span className="text-gray-300">Related Party Transactions</span>
                <span className="text-green-400 text-sm">Low Risk</span>
              </div>
            </div>
          </div>
        );

      case "risks":
        return (
          <div className="space-y-3">
            <div className="bg-red-900 border border-red-700 p-4 rounded-lg flex gap-3">
              <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
              <div>
                <div className="font-semibold text-red-300">Regulatory Risk</div>
                <div className="text-sm text-red-200">
                  Pending regulatory approval for new product line
                </div>
              </div>
            </div>
            <div className="bg-yellow-900 border border-yellow-700 p-4 rounded-lg flex gap-3">
              <AlertCircle className="text-yellow-400 flex-shrink-0" size={20} />
              <div>
                <div className="font-semibold text-yellow-300">Execution Risk</div>
                <div className="text-sm text-yellow-200">
                  Capex project timelines may slip
                </div>
              </div>
            </div>
            <div className="bg-yellow-900 border border-yellow-700 p-4 rounded-lg flex gap-3">
              <AlertCircle className="text-yellow-400 flex-shrink-0" size={20} />
              <div>
                <div className="font-semibold text-yellow-300">Market Risk</div>
                <div className="text-sm text-yellow-200">
                  Commodity price volatility impacts margins
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-800 p-8 rounded-lg text-center text-gray-400">
            Content for {activeTab} tab coming soon
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{companyName}</h2>
            <p className="text-gray-400">{ticker} | ISIN: {isin}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-400">₹2,450</div>
            <div className="text-green-400 text-sm flex items-center gap-1 justify-end">
              <TrendingUp size={16} />
              +2.5% (1D)
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg">
        <div className="flex overflow-x-auto border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">{renderTabContent()}</div>
      </div>
    </div>
  );
};
