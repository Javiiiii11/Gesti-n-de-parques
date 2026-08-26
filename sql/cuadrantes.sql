-- ============================================================================
-- ParkSales · Cuadrantes mensuales de turnos (compartidos entre el equipo)
-- Ejecuta en Supabase → SQL Editor si el proyecto ya existía.
-- ============================================================================
-- Un registro por mes (YYYY-MM). El Excel se parsea en el navegador y aquí
-- se guarda el JSON ya limpio para que todo el mundo vea el mismo calendario.
-- La contraseña de subida vive en la app (no en la BD): evita que cualquiera
-- suba un archivo, pero cualquier usuario autenticado puede LEER el cuadrante.
-- ============================================================================

create table if not exists public.cuadrantes (
    id               uuid primary key default gen_random_uuid(),
    mes              text not null unique check (mes ~ '^\d{4}-\d{2}$'),
    nombre_archivo   text,
    datos            jsonb not null default '{}'::jsonb,
    total_usuarios   integer not null default 0 check (total_usuarios >= 0),
    uploaded_by      uuid references auth.users (id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

comment on table public.cuadrantes is 'Cuadrante de turnos del equipo, un mes por fila (datos JSON parseados del Excel)';

create index if not exists idx_cuadrantes_mes on public.cuadrantes (mes desc);

drop trigger if exists trg_cuadrantes_updated_at on public.cuadrantes;
create trigger trg_cuadrantes_updated_at
    before update on public.cuadrantes
    for each row execute function public.set_updated_at();

alter table public.cuadrantes enable row level security;

drop policy if exists "cuadrantes_select" on public.cuadrantes;
create policy "cuadrantes_select" on public.cuadrantes
    for select using (auth.role() = 'authenticated');

drop policy if exists "cuadrantes_insert" on public.cuadrantes;
create policy "cuadrantes_insert" on public.cuadrantes
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "cuadrantes_update" on public.cuadrantes;
create policy "cuadrantes_update" on public.cuadrantes
    for update using (auth.role() = 'authenticated');

drop policy if exists "cuadrantes_delete" on public.cuadrantes;
create policy "cuadrantes_delete" on public.cuadrantes
    for delete using (auth.role() = 'authenticated');
