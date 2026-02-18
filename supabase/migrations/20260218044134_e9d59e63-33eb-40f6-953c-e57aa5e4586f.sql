
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'customer', 'restaurant', 'driver');

-- 2. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can view their own roles; admins can view all
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create restaurants table
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  logo text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  cuisine text NOT NULL DEFAULT '',
  rating numeric NOT NULL DEFAULT 4.5,
  delivery_time text NOT NULL DEFAULT '25-35 min',
  min_order numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  owner_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active restaurants"
  ON public.restaurants FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Restaurant owners can update their restaurant"
  ON public.restaurants FOR UPDATE
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage restaurants"
  ON public.restaurants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create menu_items table
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  image text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available menu items"
  ON public.menu_items FOR SELECT
  USING (is_available = true OR public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()
  ));

CREATE POLICY "Restaurant owners can manage their menu items"
  ON public.menu_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin'));

-- 5. Add restaurant_id and driver_id to existing orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS customer_id uuid;

-- Update customer_id from user_id for new architecture
UPDATE public.orders SET customer_id = user_id WHERE customer_id IS NULL;

-- 6. Add driver RLS policies to orders
CREATE POLICY "Drivers can view assigned orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update their assigned orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Restaurant owners can view their orders"
  ON public.orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()
  ));

CREATE POLICY "Restaurant owners can update order status"
  ON public.orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = restaurant_id AND r.owner_user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Enable Realtime on orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- 8. Trigger: auto-assign 'customer' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 9. Seed restaurants from existing menu data
INSERT INTO public.restaurants (name, description, logo, location, cuisine, rating, delivery_time, min_order) VALUES
  ('Kitchen', 'Traditional home-cooked meals and local favorites', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400', 'Mfuleni', 'Traditional', 4.8, '30-45 min', 70),
  ('Mdala Tshisanyama', 'Authentic South African braai and grilled meats', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400', 'Mfuleni', 'Braai', 4.7, '20-30 min', 20),
  ('KFC', 'Finger lickin'' good fried chicken', 'https://upload.wikimedia.org/wikipedia/en/b/bf/KFC_logo.svg', 'Mfuleni Area', 'Fast Food', 4.5, '25-35 min', 28),
  ('Debonnairs Pizza', 'Award-winning pizza with bold flavors', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 'Mfuleni Area', 'Pizza', 4.4, '30-40 min', 40),
  ('McDonalds', 'World''s favorite fast food restaurant', 'https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg', 'Mfuleni Area', 'Fast Food', 4.3, '25-35 min', 75),
  ('Pedros', 'Famous flame-grilled chicken', 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400', 'Mfuleni Area', 'Chicken', 4.6, '25-35 min', 50),
  ('BURGER KING', 'Home of the Whopper', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', 'Mfuleni Area', 'Burgers', 4.2, '25-35 min', 44),
  ('Hungry Lion', 'Affordable chicken meals', 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400', 'Mfuleni Area', 'Fast Food', 4.1, '20-30 min', 30),
  ('Fellos Fishery', 'Fresh seafood and fish meals', 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400', 'Mfuleni Area', 'Seafood', 4.5, '30-40 min', 110),
  ('Shop', 'Everyday essentials and drinks', 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400', 'Mfuleni', 'Groceries', 4.0, '15-25 min', 20),
  ('Liquor', 'Beers, wines and spirits', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', 'Mfuleni', 'Liquor', 4.0, '15-25 min', 30),
  ('Steers', 'Flame-grilled burgers', 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400', 'Mfuleni Area', 'Burgers', 4.3, '25-35 min', 40);
