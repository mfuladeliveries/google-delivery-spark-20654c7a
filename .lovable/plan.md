# Multi-area restaurants: one listing per brand

Nothing changes until you approve. Everything below was checked without changing anything.

## What I found

The branch system already exists: one restaurant can have several branches, each with its own area, coordinates, fee, delivery time and open/closed status. The problem is the data.

**Duplicate brand listings, each with its own separate menu:**
- KFC (31 items, 4 branches), a second KFC (0 items, inactive) and "Melkbos KFC" (1 item, inactive)
- Steers (65 items: Delft and Melkbosstrand) and a second Steers (15 items, Mfuleni branch with no coordinates)
- Pedros (23 items), Pedros (0 items, Atlantis, inactive) and Pedros Chicken (25 items: Atlantis Mall and Mfuleni with no coordinates)
- Debonnairs Pizza (12 items, Mfuleni) and Debonairs Pizza (0 items, Atlantis)
- McDonalds x2 (13 items each, one branch has no coordinates)
- Hungry Lion x2 (Delft with 1 item; Atlantis with 0 items, inactive)

**Branches missing coordinates:** KFC Mfuleni, Pedros Chicken Mfuleni, Steers Mfuleni, one McDonalds Mfuleni, Nandos Mfuleni.
**Turned off:** Mfula Kitchen's only branch (Mfuleni). Burger King and Mdala Tshisanyama each have only one branch, in Mfuleni.
**Areas with no restaurants:** Khayelitsha and Malmesbury.

## What I need from you before I make changes

1. **Real coordinates** for each branch that has none, plus any new branches you want (for example a Burger King or Mdala branch in another area). I won't make up coordinates.
2. **Which menu to keep for each brand** when the copies are different (for example the 25-item Pedros Chicken menu or the 23-item Pedros menu). By default I'd keep the bigger menu and add any items that exist only in the other copy, without changing any prices.
3. Whether Mfula Kitchen's Mfuleni branch should be turned back on.

## Changes after you approve

1. **Merge duplicate brands:** move each duplicate's branches under the main listing and give it one menu with one set of prices. The duplicate listings get hidden, not deleted, so past orders, ratings and favourites still work.
2. **Fill in branch coordinates** with the values you send. Any branch without coordinates stays hidden from customers.
3. **Automatic branch choice:** when the customer's location is detected, the app picks their delivery area and then the nearest open branch in that area for each brand. That branch sets the delivery fee, delivery time and checkout. Brands without a branch in the area are not shown, and the customer sees "not available in your area yet".
4. **Driver navigation:** the pickup pin and directions use the chosen branch's coordinates, not the brand's main address.
5. **Admin:** add a warning on restaurants with branches that are missing coordinates, and stop new duplicate brand listings from being created.
6. **Tests:** branch choice per area, fee per branch, hiding branches with no coordinates, and making sure merged menus keep their prices.

## Kept as is
Payments (live and test), delivery fee rules, customer accounts, KFC/Steers/Burger King pictures, and the rule that unconfirmed prices can't be ordered. Nothing gets published, and nothing is pushed to GitHub.

## Technical details
- Migration: reassign `restaurant_locations.restaurant_id` and `menu_items.restaurant_id` to the main brand row. Set the duplicate restaurants to `is_active=false`. Add a unique index on lower(trim(name)) for active restaurants. Add a function that marks restaurants deprecated.
- `get_restaurants_for_location` / `create_verified_order`: choose the nearest active, open branch that has coordinates and belongs to the detected area. `validate_order_branch_area` already enforces the area match.
- Driver views: use the branch lat/lng from `orders.restaurant_location_id`.
