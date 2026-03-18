-- Post-index maintenance
-- IMPORTANT: VACUUM cannot run inside a transaction block.

VACUUM (VERBOSE, ANALYZE) "demande";
VACUUM (VERBOSE, ANALYZE) "inscription_provisoire";
VACUUM (VERBOSE, ANALYZE) "notifications_portail";
VACUUM (VERBOSE, ANALYZE) "messages_portail";
VACUUM (VERBOSE, ANALYZE) "PermisPortail";
VACUUM (VERBOSE, ANALYZE) "utilisateurs_portail";

