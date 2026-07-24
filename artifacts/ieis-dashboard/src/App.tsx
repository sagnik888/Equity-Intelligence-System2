import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { Shell } from '@/components/layout/Shell';
import Dashboard from '@/pages/Dashboard';
import Universe from '@/pages/Universe';
import StockDetail from '@/pages/StockDetail';
import Signals from '@/pages/Signals';
import Rankings from '@/pages/Rankings';
import HardGates from '@/pages/HardGates';
import Portfolio from '@/pages/Portfolio';
import Research from '@/pages/Research';
import Watchlists from '@/pages/Watchlists';
import Backtest from '@/pages/Backtest';
import Audit from '@/pages/Audit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/universe" component={Universe} />
        <Route path="/universe/:isin" component={StockDetail} />
        <Route path="/signals" component={Signals} />
        <Route path="/rankings" component={Rankings} />
        <Route path="/hardgates" component={HardGates} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/research" component={Research} />
        <Route path="/watchlists" component={Watchlists} />
        <Route path="/backtest" component={Backtest} />
        <Route path="/audit" component={Audit} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
