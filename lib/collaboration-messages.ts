// Messages de collaboration partagés entre le serveur (lib/collaboration-beat.ts)
// et le client (BeatForm.tsx) — fichier volontairement sans aucune dépendance
// serveur pour rester importable tel quel dans un composant 'use client'.

// Message volontairement neutre : il ne dit jamais POURQUOI l'adresse est
// refusée (sinon A pourrait deviner quelles adresses appartiennent à des
// artistes/clients).
export const MESSAGE_ADRESSE_REFUSEE =
  'Cette adresse ne peut pas recevoir d’invitation. Invite la personne par son @slug si elle a un compte beatmaker, ou utilise une autre adresse.'
