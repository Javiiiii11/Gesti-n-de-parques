-- ============================================================================
-- ParkSales · Esquema de "Chat IA"
-- ============================================================================
-- IMPORTANTE: El Chat IA funciona 100% en el navegador (conocimiento embebido
-- en js/conocimiento/). NO necesita ninguna tabla en Supabase.
--
-- Este archivo solo elimina la tabla antigua "chat_fuentes" si existía de
-- versiones anteriores, para que en la BD SOLO queden:
--   · parques
--   · tipos_bono
--   · usuarios (auth)
-- ============================================================================

drop table if exists public.chat_fuentes;