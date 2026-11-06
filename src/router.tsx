import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import AppShell from "./components/layout/app-shell";
import { RouteFallback } from "./components/common/route-fallback";

const Login = lazy(() => import("./pages/Login"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Backup = lazy(() => import("./pages/Backup"));
const InventarioFotos = lazy(() => import("./pages/InventarioFotos"));
const AuditorHome = lazy(() => import("./pages/auditor/AuditorHome"));
const AuditorCelula = lazy(() => import("./pages/auditor/AuditorCelula"));
const AuditorRefazer = lazy(() => import("./pages/auditor/AuditorRefazer"));
const AuditorRelatorios = lazy(() => import("./pages/auditor/AuditorRelatorios"));
const AuditorBi = lazy(() => import("./pages/auditor/AuditorBi"));
const AuditorAnalises = lazy(() => import("./pages/auditor/AuditorAnalises"));
const AuditorCaso = lazy(() => import("./pages/auditor/AuditorCaso"));
const AuditorRelatorioEditor = lazy(() => import("./pages/auditor/AuditorRelatorioEditor"));
const RelatorioBi = lazy(() => import("./pages/RelatorioBi"));
const Emissor = lazy(() => import("./pages/Emissor"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const routers = [
  {
    path: "/login",
    name: "login",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, name: "home", element: <Navigate to="/emissor" replace /> },
      {
        path: "emissor",
        name: "emissor",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Emissor />
          </Suspense>
        ),
      },
      {
        path: "relatorio-bi",
        name: "relatorio-bi",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <RelatorioBi />
          </Suspense>
        ),
      },
      {
        path: "backup",
        name: "backup",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Backup />
          </Suspense>
        ),
      },
      {
        path: "inventario",
        name: "inventario",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <InventarioFotos />
          </Suspense>
        ),
      },
      {
        path: "auditor",
        name: "auditor",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorHome />
          </Suspense>
        ),
      },
      {
        path: "auditor/celula/:cell",
        name: "auditor-celula",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorCelula />
          </Suspense>
        ),
      },
      {
        path: "auditor/refazer",
        name: "auditor-refazer",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorRefazer />
          </Suspense>
        ),
      },
      {
        path: "auditor/caso/:caseId",
        name: "auditor-caso",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorCaso />
          </Suspense>
        ),
      },
      {
        path: "auditor/relatorio/:caseId",
        name: "auditor-relatorio",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorRelatorioEditor />
          </Suspense>
        ),
      },
      {
        path: "auditor/relatorios",
        name: "auditor-relatorios",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorRelatorios />
          </Suspense>
        ),
      },
      {
        path: "auditor/bi",
        name: "auditor-bi",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorBi />
          </Suspense>
        ),
      },
      {
        path: "usuarios",
        name: "usuarios",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Usuarios />
          </Suspense>
        ),
      },
      {
        path: "auditor/analises",
        name: "auditor-analises",
        element: (
          <Suspense fallback={<RouteFallback />}>
            <AuditorAnalises />
          </Suspense>
        ),
      },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: (
      <Suspense fallback={<RouteFallback />}>
        <NotFound />
      </Suspense>
    ),
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
