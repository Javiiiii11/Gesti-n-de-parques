-- ============================================================================
-- ParkSales · Esquema de "Chat IA" (fuentes locales para el buscador interno)
-- ============================================================================
-- Instrucciones:
-- 1. Entra en tu proyecto de Supabase → SQL Editor → New query
-- 2. Pega este archivo completo y pulsa "Run"
-- 3. Comprueba en Table Editor que se ha creado "chat_fuentes"
--
-- IMPORTANTE (seguridad):
-- Esta app no usa un login real de Supabase (auth.enterGuestMode() crea un
-- usuario falso solo en localStorage), así que aquí NO se puede exigir
-- auth.role() = 'authenticated' como en parques/ventas: nunca se cumpliría
-- y la tabla se quedaría bloqueada. Las políticas de abajo permiten acceso
-- con la clave "anon" (la misma que ya va incrustada en supabase-client.js),
-- protegido únicamente por la contraseña de la app (auth.js) — igual de
-- "seguro" que el resto de la aplicación tal y como está montada hoy. Si
-- algún día añades autenticación real, cambia 'anon' por 'authenticated'
-- aquí abajo.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tabla: chat_fuentes
-- Cada fila es un documento completo (archivo subido o texto de una web
-- pegado/añadido por el usuario). El texto se trocea en el cliente en
-- tiempo de búsqueda, no hace falta una tabla de "chunks" aparte para el
-- volumen de datos de una app personal.
-- ----------------------------------------------------------------------------
create table if not exists public.chat_fuentes (
    id                  uuid primary key default gen_random_uuid(),
    tipo                text not null check (tipo in ('archivo', 'web')),
    nombre              text not null,
    origen              text,                    -- nombre del archivo o URL de la web
    contenido           text not null,           -- texto ya extraído, lo que se indexa
    tamano_bytes         integer,
    created_at          timestamptz not null default now()
);

comment on table public.chat_fuentes is 'Documentos y páginas web añadidos por el usuario para el buscador local del Chat IA';

create index if not exists chat_fuentes_created_at_idx on public.chat_fuentes (created_at desc);

alter table public.chat_fuentes enable row level security;

drop policy if exists "chat_fuentes_select" on public.chat_fuentes;
create policy "chat_fuentes_select" on public.chat_fuentes
    for select using (true);

drop policy if exists "chat_fuentes_insert" on public.chat_fuentes;
create policy "chat_fuentes_insert" on public.chat_fuentes
    for insert with check (true);

drop policy if exists "chat_fuentes_update" on public.chat_fuentes;
create policy "chat_fuentes_update" on public.chat_fuentes
    for update using (true);

drop policy if exists "chat_fuentes_delete" on public.chat_fuentes;
create policy "chat_fuentes_delete" on public.chat_fuentes
    for delete using (true);
