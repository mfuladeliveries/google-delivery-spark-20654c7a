# Project rules
- Defer database requests outside auth-state callbacks so the auth lock cannot stall signed-in pages; retain role loading before access decisions.
- Define explicit, least-privilege grants immediately after public table creation and preserve RLS; verify live changes with role-isolation tests because grants alone do not protect rows.
- Apply live permission changes through an additive migration; historical grant edits support clean replay but do not update already-applied databases.
- Keep KFC-only image presentation in KfcProductImage, with a neutral local fallback and contain fitting, so picture failures never substitute another product or change other restaurant displays.
- Steers uses a separate price_verified flag and Steers-only order validation while is_available controls visibility; other menus default to verified to preserve their behavior. Admin confirmation applies to all configured branches because the existing menu is brand-level.
- Keep Steers imagery isolated in SteersProductImage, label generated category pictures as illustrations, and never replace failed photos with another product.
- Burger King reuses the existing brand menu and branches; menuPriceVerification and a dedicated order guard block unconfirmed new prices while preserving existing positive prices. Admin confirmation is brand-wide because menus are shared by configured branches.
- Keep Burger King image failures neutral in BurgerKingProductImage so missing photos never display an unrelated product.
- Keep daily running-credit snapshots in an admin-read-only RLS table, never the browser bundle; retain UTC recording boundaries, precision and partial-day labels, and update only from authorized recorded-usage lookups because no documented automatic billing API is available.