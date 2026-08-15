-- ============================================================================
-- ParkSales · Arreglar tabla public.parques
-- Deja SOLO los 15 parques correctos, sin duplicados y con nombres bien escritos.
-- ============================================================================
-- CÓMO USARLO:
-- 1. Abre Supabase → SQL Editor → New query
-- 2. Pega todo este archivo y pulsa RUN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Reasignar ventas y contactos de los parques duplicados al parque canónico
-- ----------------------------------------------------------------------------

-- 'Warner' (duplicado) → 'Parque Warner'
update public.ventas v
set parque_id = (select id from public.parques where nombre = 'Parque Warner')
where v.parque_id in (select id from public.parques where nombre = 'Warner');

update public.contactos c
set parque_id = (select id from public.parques where nombre = 'Parque Warner')
where c.parque_id in (select id from public.parques where nombre = 'Warner');

-- 'Alantis' (mal escrito, duplicado de Atlantis) → 'Atlantis'
update public.ventas v
set parque_id = (select id from public.parques where nombre = 'Atlantis')
where v.parque_id in (select id from public.parques where nombre = 'Alantis');

update public.contactos c
set parque_id = (select id from public.parques where nombre = 'Atlantis')
where c.parque_id in (select id from public.parques where nombre = 'Alantis');

-- 'Aquopolis VILL' (duplicado) → 'Aquopolis VIL'
update public.ventas v
set parque_id = (select id from public.parques where nombre = 'Aquopolis VIL')
where v.parque_id in (select id from public.parques where nombre = 'Aquopolis VILL');

update public.contactos c
set parque_id = (select id from public.parques where nombre = 'Aquopolis VIL')
where c.parque_id in (select id from public.parques where nombre = 'Aquopolis VILL');

-- ----------------------------------------------------------------------------
-- 2) Eliminar los parques duplicados
-- ----------------------------------------------------------------------------
delete from public.parques where nombre = 'Warner';
delete from public.parques where nombre = 'Alantis';
delete from public.parques where nombre = 'Aquopolis VILL';

-- ----------------------------------------------------------------------------
-- 3) Corregir nombres mal escritos
-- ----------------------------------------------------------------------------
update public.parques set nombre = 'ZOO'                     where nombre = 'ZOo';
update public.parques set nombre = 'Aquopolis CUL'            where nombre = 'Aquopolis CULL';
update public.parques set nombre = 'Teleférico Benalmádena'   where nombre = 'Teleferico Benalmadena';

-- ----------------------------------------------------------------------------
-- 4) Garantizar que existan (idempotente) los 15 parques finales
-- ----------------------------------------------------------------------------
insert into public.parques (nombre, activo)
select nombre, true
from (values
      ('Atlantis'),
      ('Aquopolis CAR'),
      ('Aquopolis CDA'),
      ('Aquopolis CUL'),
      ('Aquopolis TOR'),
      ('Aquopolis VIL'),
      ('Faunia'),
      ('Hotel Selwo'),
      ('PAM'),
      ('Selwo Aventura'),
      ('Selwo Marina'),
      ('Teleférico Benalmádena'),
      ('Parque Warner'),
      ('Warner Beach'),
      ('ZOO')
     ) as lista(nombre)
where not exists (select 1 from public.parques p where p.nombre = lista.nombre);

-- ----------------------------------------------------------------------------
-- 5) Verificación: debe devolver exactamente 15 filas
-- ----------------------------------------------------------------------------
select nombre, activo, created_at
from public.parques
order by nombre;