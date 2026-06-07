-- Reassign 4 unassigned Mfuleni-area restaurants to the Mfuleni delivery area
UPDATE restaurants SET area_id = '710be50f-0238-4ea2-b492-d565b307a93a'
WHERE id IN (
  '4c4d6d95-3f2e-465f-8cef-27d5b4a2c883', -- Liquor → Mfula Liquor
  '51e965c4-7c19-402e-980c-c243e1d249dc', -- Fellos Fishery
  '537b8c3f-7955-4e30-937a-11311c5fae32', -- Emncimbini Braai Place
  '86c2d555-6ca7-4a60-935d-49bc55538c85'  -- Shop → Mfula Shop
);

-- Rename a couple of generic outlets so they're customer-friendly
UPDATE restaurants SET name = 'Mfula Liquor', cuisine = COALESCE(NULLIF(cuisine,''),'Liquor')
WHERE id = '4c4d6d95-3f2e-465f-8cef-27d5b4a2c883';
UPDATE restaurants SET name = 'Mfula Kitchen', cuisine = COALESCE(NULLIF(cuisine,''),'Local')
WHERE id = '597d0c33-625f-40f6-b2cc-f8ba8ab9566e';
UPDATE restaurants SET name = 'Mfula Shop', cuisine = COALESCE(NULLIF(cuisine,''),'Convenience')
WHERE id = '86c2d555-6ca7-4a60-935d-49bc55538c85';