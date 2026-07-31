import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ComplianceDiffView from "./pages/ComplianceDiffView";
import HistoryPage from "./pages/HistoryPage";
import ImpactSimulationView from "./pages/ImpactSimulationView";
import LiveDashboardPage from "./pages/LiveDashboardPage";
import RunDetailLayout from "./pages/RunDetailLayout";
import SubmitRequestPage from "./pages/SubmitRequestPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ background: "var(--surface-0)" }}>
        <Navbar />
        <Routes>
          <Route path="/" element={<SubmitRequestPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/runs/:runId" element={<RunDetailLayout />}>
            <Route index element={<LiveDashboardPage />} />
            <Route path="impact" element={<ImpactSimulationView />} />
            <Route path="compliance" element={<ComplianceDiffView />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
