
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete app settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Seed default About content
INSERT INTO public.app_settings (key, value)
VALUES (
  'about_page',
  jsonb_build_object(
    'title', 'About Mfula Deliveries',
    'description', 'Mfula Deliveries is a fast, reliable food delivery service connecting local restaurants with customers in Mfuleni and surrounding areas. Our mission is to make ordering food simple, affordable, and convenient while supporting local businesses.',
    'mission', 'To deliver quality meals quickly while empowering local restaurants and creating opportunities for drivers.',
    'services', jsonb_build_array(
      'Food delivery from multiple restaurants',
      'Real-time order tracking',
      'Fast and secure checkout',
      'Dedicated driver network'
    ),
    'service_area', 'Currently serving Mfuleni and nearby areas.',
    'phone', '068 676 8409',
    'email', 'mfuladeliveries@gmail.com'
  )
)
ON CONFLICT (key) DO NOTHING;
