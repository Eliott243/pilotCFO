-- Permet à un utilisateur authentifié de créer sa propre ligne users si le trigger signup n'a pas tourné
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid());
