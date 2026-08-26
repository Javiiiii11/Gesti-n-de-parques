-- ============================================================================
-- ParkSales · Esquema de base de datos para Supabase (PostgreSQL)
-- ============================================================================
-- IMPORTANTE: En la BD SOLO se guardan:
--   · parques              (definiciones predefinidas de parques)
--   · tipos_bono           (bonos predefinidos)
--   · objetivos_mensuales  (meta de ventas por mes y usuario)
--   · cuadrantes           (turnos del equipo, un mes por fila)
--   · usuarios             (auth de Supabase)
--
-- Las ventas, apuntes (contactos), llamadas, notas, etc. se guardan
-- SIEMPRE en el navegador (localStorage / IndexedDB) y NUNCA en la BD.
--
-- Instrucciones:
-- 1. Entra en tu proyecto de Supabase → SQL Editor → New query
-- 2. Pega este archivo completo y pulsa "Run"
-- 3. Comprueba en Table Editor que se han creado "parques" y "tipos_bono"
-- ============================================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabla: parques
-- ----------------------------------------------------------------------------
create table if not exists public.parques (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null unique,
    horario_url         text,
    horario_texto       text,
    activo              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Add horario_url column if it doesn't exist yet
alter table public.parques add column if not exists horario_url text;
-- Add horario_texto column if it doesn't exist yet
alter table public.parques add column if not exists horario_texto text;

comment on table public.parques is 'Parques de ocio sobre los que se venden entradas';

-- ----------------------------------------------------------------------------
-- Tabla: tipos_bono
-- ----------------------------------------------------------------------------
create table if not exists public.tipos_bono (
    id                  uuid primary key default gen_random_uuid(),
    nombre              text not null unique,
    activo              boolean not null default true,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.tipos_bono is 'Tipos de bonos que se venden';

-- ----------------------------------------------------------------------------
-- Tabla: objetivos_mensuales
-- ----------------------------------------------------------------------------
create table if not exists public.objetivos_mensuales (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    mes         text not null check (mes ~ '^\d{4}-\d{2}$'),
    importe     numeric not null default 0 check (importe >= 0),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, mes)
);

comment on table public.objetivos_mensuales is 'Meta de ventas mensual por usuario (formato mes YYYY-MM)';

-- ----------------------------------------------------------------------------
-- Índices para que las consultas sigan siendo rápidas
-- ----------------------------------------------------------------------------
create index if not exists idx_parques_activo       on public.parques (activo);
create index if not exists idx_tipos_bono_activo    on public.tipos_bono (activo);
create index if not exists idx_objetivos_mensuales_user_mes
    on public.objetivos_mensuales (user_id, mes desc);

-- ----------------------------------------------------------------------------
-- Trigger: mantener updated_at en parques y tipos_bono
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_parques_updated_at on public.parques;
create trigger trg_parques_updated_at
    before update on public.parques
    for each row execute function public.set_updated_at();

drop trigger if exists trg_tipos_bono_updated_at on public.tipos_bono;
create trigger trg_tipos_bono_updated_at
    before update on public.tipos_bono
    for each row execute function public.set_updated_at();

drop trigger if exists trg_objetivos_mensuales_updated_at on public.objetivos_mensuales;
create trigger trg_objetivos_mensuales_updated_at
    before update on public.objetivos_mensuales
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.parques enable row level security;
alter table public.tipos_bono enable row level security;
alter table public.objetivos_mensuales enable row level security;

-- Lectura y escritura para cualquier usuario autenticado.
drop policy if exists "parques_select" on public.parques;
create policy "parques_select" on public.parques
    for select using (auth.role() = 'authenticated');

drop policy if exists "parques_insert" on public.parques;
create policy "parques_insert" on public.parques
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "parques_update" on public.parques;
create policy "parques_update" on public.parques
    for update using (auth.role() = 'authenticated');

drop policy if exists "parques_delete" on public.parques;
create policy "parques_delete" on public.parques
    for delete using (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_select" on public.tipos_bono;
create policy "tipos_bono_select" on public.tipos_bono
    for select using (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_insert" on public.tipos_bono;
create policy "tipos_bono_insert" on public.tipos_bono
    for insert with check (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_update" on public.tipos_bono;
create policy "tipos_bono_update" on public.tipos_bono
    for update using (auth.role() = 'authenticated');

drop policy if exists "tipos_bono_delete" on public.tipos_bono;
create policy "tipos_bono_delete" on public.tipos_bono
    for delete using (auth.role() = 'authenticated');

drop policy if exists "objetivos_mensuales_select" on public.objetivos_mensuales;
create policy "objetivos_mensuales_select" on public.objetivos_mensuales
    for select using (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_insert" on public.objetivos_mensuales;
create policy "objetivos_mensuales_insert" on public.objetivos_mensuales
    for insert with check (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_update" on public.objetivos_mensuales;
create policy "objetivos_mensuales_update" on public.objetivos_mensuales
    for update using (auth.uid() = user_id);

drop policy if exists "objetivos_mensuales_delete" on public.objetivos_mensuales;
create policy "objetivos_mensuales_delete" on public.objetivos_mensuales
    for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Tabla: cuadrantes (turnos mensuales compartidos)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- LIMPIEZA: eliminar tablas que ya NO se usan en la BD
-- (ventas y contactos ahora viven SOLO en el navegador)
-- ----------------------------------------------------------------------------
-- Primero la vista (depende de ventas), luego las tablas.
drop view if exists public.vw_ventas_resumen;
drop table if exists public.ventas;
drop table if exists public.contactos;
