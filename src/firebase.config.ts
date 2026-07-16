// Configuration Firebase de l'application web.
//
// Où trouver ces valeurs : console Firebase (https://console.firebase.google.com)
// → votre projet → ⚙ Paramètres du projet → Général → « Vos applications »
// → application Web → « SDK setup and configuration » → Config.
//
// Les clés Firebase web sont publiques par nature : elles peuvent être commitées.
// La protection vient des règles RTDB (database.rules.json) + du code de session.

export const firebaseConfig = {
  apiKey: 'VOTRE_API_KEY',
  authDomain: 'VOTRE_PROJET.firebaseapp.com',
  databaseURL: 'https://VOTRE_PROJET-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'VOTRE_PROJET',
  storageBucket: 'VOTRE_PROJET.appspot.com',
  messagingSenderId: 'VOTRE_SENDER_ID',
  appId: 'VOTRE_APP_ID',
};

/** true tant que la config ci-dessus n'a pas été remplacée par les vraies valeurs. */
export const isConfigPlaceholder = firebaseConfig.apiKey.startsWith('VOTRE_');
