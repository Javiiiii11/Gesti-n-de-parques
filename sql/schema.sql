-- ============================================================================
-- ParkSales · Esquema de base de datos para Supabase (PostgreSQL)
-- ============================================================================
-- IMPORTANTE: En la BD SOLO se guardan:
--   · parques      (definiciones predefinidas de parques)
--   · tipos_bono   (bonos predefinidos)
--   · usuarios     (auth de Supabase)
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
-- Índices para que las consultas sigan siendo rápidas
-- ----------------------------------------------------------------------------
create index if not exists idx_parques_activo       on public.parques (activo);
create index if not exists idx_tipos_bono_activo    on public.tipos_bono (activo);

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

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.parques enable row level security;
alter table public.tipos_bono enable row level security;

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

-- ----------------------------------------------------------------------------
-- LIMPIEZA: eliminar tablas que ya NO se usan en la BD
-- (ventas y contactos ahora viven SOLO en el navegador)
-- ----------------------------------------------------------------------------
-- Primero la vista (depende de ventas), luego las tablas.
drop view if exists public.vw_ventas_resumen;
drop table if exists public.ventas;
drop table if exists public.contactos;
