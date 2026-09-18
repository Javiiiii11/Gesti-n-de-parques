-- ============================================================================
-- ParkSales · Copias de Seguridad Automáticas en la Nube (Supabase)
-- ============================================================================
-- Esta tabla almacena copias de seguridad completas de cada usuario de forma
-- periódica (por defecto cada 2 horas) para que el administrador pueda
-- descargar el JSON de cualquier usuario en caso de borrado accidental de cookies.
--
-- INSTRUCCIONES:
-- 1. Entra en tu panel de Supabase → SQL Editor → New Query.
-- 2. Pega este código completo y pulsa "Run".
-- ============================================================================

-- Extensión para generar UUIDs si no existe
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabla: backups_usuarios
-- ----------------------------------------------------------------------------
create table if not exists public.backups_usuarios (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid references auth.users (id) on delete cascade,
    user_email       text not null,
    user_name        text,
    fecha            timestamptz not null default now(),
    tipo             text not null default 'auto', -- 'auto' (cada 2h), 'manual', 'cierre'
    data             jsonb not null,               -- Estado completo (ventas, contactos, llamadas, notas, cuadrantes...)
    stats            jsonb not null default '{}'::jsonb, -- { ventas: X, importe: Y, contactos: Z, llamadas: W }
    created_at       timestamptz not null default now()
);

comment on table public.backups_usuarios is 'Copias de seguridad periódicas y automáticas de los datos locales de cada usuario';

-- ----------------------------------------------------------------------------
-- Tabla: configuracion_global (para frecuencia de copias y ajustes globales)
-- ----------------------------------------------------------------------------
create table if not exists public.configuracion_global (
    clave            text primary key,
    valor            jsonb not null,
    updated_at       timestamptz not null default now()
);

-- Frecuencia por defecto de copias en nube: 120 minutos (2 horas)
insert into public.configuracion_global (clave, valor)
values ('backup_frecuencia_minutos', '120'::jsonb)
on conflict (clave) do nothing;

-- ----------------------------------------------------------------------------
-- Índices para búsquedas rápidas por usuario y fecha
-- ----------------------------------------------------------------------------
create index if not exists idx_backups_usuarios_user_fecha 
    on public.backups_usuarios (user_id, fecha desc);

create index if not exists idx_backups_usuarios_email_fecha 
    on public.backups_usuarios (user_email, fecha desc);

create index if not exists idx_backups_usuarios_fecha 
    on public.backups_usuarios (fecha desc);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.backups_usuarios enable row level security;
alter table public.configuracion_global enable row level security;

-- Políticas para backups_usuarios
-- Permitir lectura a todos los usuarios autenticados (para que el panel con contraseña cookies2026 pueda listar las copias de todos)
drop policy if exists "backups_usuarios_select" on public.backups_usuarios;
create policy "backups_usuarios_select" on public.backups_usuarios
    for select using (auth.role() = 'authenticated');

-- Permitir inserción a cualquier usuario autenticado de sus propios datos
drop policy if exists "backups_usuarios_insert" on public.backups_usuarios;
create policy "backups_usuarios_insert" on public.backups_usuarios
    for insert with check (auth.role() = 'authenticated');

-- Permitir eliminación a usuarios autenticados
drop policy if exists "backups_usuarios_delete" on public.backups_usuarios;
create policy "backups_usuarios_delete" on public.backups_usuarios
    for delete using (auth.role() = 'authenticated');

-- Políticas para configuracion_global
drop policy if exists "configuracion_global_select" on public.configuracion_global;
create policy "configuracion_global_select" on public.configuracion_global
    for select using (auth.role() = 'authenticated');

drop policy if exists "configuracion_global_upsert" on public.configuracion_global;
create policy "configuracion_global_upsert" on public.configuracion_global
    for all using (auth.role() = 'authenticated');
