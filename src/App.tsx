import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { Loading } from "./components/ui";
import { ensureSettings } from "./db/repo";
import Games from "./pages/Games";
import { History, HistoryDetail } from "./pages/History";
import Login from "./pages/Login";
import Measures from "./pages/Measures";
import More from "./pages/More";
import SessionPage from "./pages/Session";
import Settings from "./pages/Settings";
import Today from "./pages/Today";
import Week from "./pages/Week";
import { checkAuth, useAuth } from "./sync/auth";
import { startSync } from "./sync/syncEngine";

// Os gráficos são a parte mais pesada do app: só carregam ao abrir Evolução.
const Progress = lazy(() => import("./pages/Progress"));

export default function App() {
  const auth = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (auth !== "in") return;
    void ensureSettings().then(startSync);
  }, [auth]);

  if (auth === "loading") return <Loading />;
  if (auth === "out") return <Login />;

  // Durante a sessão a barra inferior dá lugar ao descanso/desfazer.
  const hideNav = pathname.startsWith("/sessao/") || pathname === "/login";

  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/sessao/:id" element={<SessionPage />} />
        <Route path="/semana" element={<Week />} />
        <Route path="/historico" element={<History />} />
        <Route path="/historico/:id" element={<HistoryDetail />} />
        <Route
          path="/evolucao"
          element={
            <Suspense fallback={<Loading />}>
              <Progress />
            </Suspense>
          }
        />
        <Route path="/mais" element={<More />} />
        <Route path="/medidas" element={<Measures />} />
        <Route path="/jogos" element={<Games />} />
        <Route path="/config" element={<Settings />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </>
  );
}
