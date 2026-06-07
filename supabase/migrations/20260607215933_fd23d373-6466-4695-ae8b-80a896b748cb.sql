DELETE FROM menu_items
WHERE created_at >= NOW() - INTERVAL '15 minutes'
  AND restaurant_id IN (
    'aa95b249-a4f4-4667-9853-56a596884ee8',
    '0244645b-721d-4812-b23e-67e64cbf5a1e',
    'f43309c3-a790-4085-8ce6-de0fb1d50775',
    '6ad60ecf-13a1-4111-a078-1d0ae8c038ce',
    '597d0c33-625f-40f6-b2cc-f8ba8ab9566e',
    '4c4d6d95-3f2e-465f-8cef-27d5b4a2c883',
    '51e965c4-7c19-402e-980c-c243e1d249dc',
    '537b8c3f-7955-4e30-937a-11311c5fae32',
    '86c2d555-6ca7-4a60-935d-49bc55538c85'
  );