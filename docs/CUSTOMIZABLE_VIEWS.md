# Customizable views (#24)

Criterios cubiertos:

| Criterio | Implementación |
|----------|----------------|
| Recordar última pestaña del detalle OKR | `lastDetailTab` en `viewPreferences`; se actualiza al cambiar pestaña (`OKRDetailView`). |
| Ocultar/mostrar secciones (p. ej. Historial) | `visibleTabs` por pestaña del modal; UI en **Perfil**; persistido en Mongo (`profiles.viewPreferences`). |
| Ordenar (score, owner, updated) y filtrar por actividad | `dashboardSort`, `dashboardSortDirection`, `dashboardFilterUpdateType` (`all` / `recent` = últimos 7 días). UI en barra del dashboard y en **Perfil**. |
| Filtro tipo de actualización en Historial | `historyEventTypeFilter`; UI en pestaña Historial y valores por defecto en **Perfil**. |
| Guardar en perfil + Reset | `GET/PUT/DELETE /api/profiles/preferences`; botón **Restablecer todo** en Perfil y **Reset** en la barra de filtros del dashboard. |

Archivos clave: `frontend/lib/useViewPreferences.tsx`, `frontend/lib/api.ts` (`ViewPreferences`), `backend/app/routes/profiles.py` (`DEFAULT_VIEW_PREFERENCES`), `frontend/components/modal/OKRDetailView.tsx`, `frontend/components/dashboard/OKRDashboard.tsx`, `frontend/components/dashboard/FilterBar.tsx`, `frontend/app/profile/page.tsx`.
