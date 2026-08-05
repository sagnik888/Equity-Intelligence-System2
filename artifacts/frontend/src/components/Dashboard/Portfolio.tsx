import React, { useState } from "react";
import { TrendingUp, TrendingDown, AlertCircle, Trash2 } from "lucide-react";

interface Position {
  symbol: string;
  company: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  value: number;
  return: number;
  returnPct: number;
  horizon: string;
  suitability: number;
  riskScore: number;
}

interface PortfolioProps {
  positions: Position[];
}

export const Portfolio: React.FC<PortfolioProps> = ({ positions }) => {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalReturn = positions.reduce((sum, p) => sum + p.return, 0);
  const totalReturnPct = totalValue > 0 ? (totalReturn / (totalValue - totalReturn)) * 100 : 0;

  const getReturnColor = (returnPct: number) => {
    if (returnPct > 0) return "text-green-400";
    if (returnPct < 0) return "text-red-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Total Value</div>
          <div className="text-3xl font-bold text-white">₹{(totalValue / 100000).toFixed(2)}L</div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Total Return</div>
          <div className={`text-3xl font-bold ${getReturnColor(totalReturnPct)}`}>
            ₹{(totalReturn / 100000).toFixed(2)}L
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Return %</div>
          <div className={`text-3xl font-bold ${getReturnColor(totalReturnPct)}`}>
            {totalReturnPct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Positions</div>
          <div className="text-3xl font-bold text-white">{positions.length}</div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-3">Portfolio Risk</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Gross Exposure</span>
              <span className="text-white">125%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Net Exposure</span>
              <span className="text-white">95%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Max Drawdown</span>
              <span className="text-red-400">-12.3%</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-3">Concentration</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Top Position</span>
              <span className="text-white">18.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Top 5</span>
              <span className="text-white">62.3%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Sector Concentration</span>
              <span className="text-yellow-400">High</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-gray-400 text-sm mb-3">Horizon Distribution</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Daily</span>
              <span className="text-white">2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Weekly</span>
              <span className="text-white">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Long-term</span>
              <span className="text-white">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="bg-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-900">
              <th className="px-4 py-3 text-left font-semibold text-gray-300">Symbol</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">Company</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Qty</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Entry Price</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Current Price</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Value</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Return</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">Return %</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Horizon</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Suitability</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Risk</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, idx) => (
              <tr
                key={idx}
                className="border-b border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => setSelectedPosition(position)}
              >
                <td className="px-4 py-3 font-semibold text-white">{position.symbol}</td>
                <td className="px-4 py-3 text-gray-300">{position.company}</td>
                <td className="px-4 py-3 text-right text-gray-300">{position.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-300">₹{position.entryPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-300">₹{position.currentPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-white">₹{(position.value / 100000).toFixed(2)}L</td>
                <td className={`px-4 py-3 text-right font-semibold ${getReturnColor(position.returnPct)}`}>
                  ₹{(position.return / 1000).toFixed(1)}K
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${getReturnColor(position.returnPct)}`}>
                  {position.returnPct > 0 && "+"}
                  {position.returnPct.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded text-xs">
                    {position.horizon}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    position.suitability >= 70
                      ? "bg-green-900 text-green-300"
                      : position.suitability >= 50
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-red-900 text-red-300"
                  }`}>
                    {position.suitability}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    position.riskScore <= 30
                      ? "bg-green-900 text-green-300"
                      : position.riskScore <= 60
                        ? "bg-yellow-900 text-yellow-300"
                        : "bg-red-900 text-red-300"
                  }`}>
                    {position.riskScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button className="p-1 hover:bg-red-900 rounded transition-colors">
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Position Details Modal */}
      {selectedPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                {selectedPosition.symbol} - {selectedPosition.company}
              </h3>
              <button
                onClick={() => setSelectedPosition(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-gray-400 text-sm">Entry Price</div>
                <div className="text-2xl font-bold text-white">₹{selectedPosition.entryPrice}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Current Price</div>
                <div className="text-2xl font-bold text-white">₹{selectedPosition.currentPrice}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Position Value</div>
                <div className="text-2xl font-bold text-white">₹{(selectedPosition.value / 100000).toFixed(2)}L</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Return</div>
                <div className={`text-2xl font-bold ${getReturnColor(selectedPosition.returnPct)}`}>
                  {selectedPosition.returnPct > 0 && "+"}
                  {selectedPosition.returnPct.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold">
                Add to Position
              </button>
              <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold">
                Exit Position
              </button>
              <button
                onClick={() => setSelectedPosition(null)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
