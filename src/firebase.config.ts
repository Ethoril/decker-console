// Configuration Firebase de l'application web.
//
// Où trouver ces valeurs : console Firebase (https://console.firebase.google.com)
// → votre projet → ⚙ Paramètres du projet → Général → « Vos applications »
// → application Web → « SDK setup and configuration » → Config.
//
// Les clés Firebase web sont publiques par nature : elles peuvent être commitées.
// La protection vient des règles RTDB (database.rules.json) + du code de session.

export const firebaseConfig = {
  apiKey: 'AIzaSyDKWhqVqOgvBRZ8p4dwpGoWDQPgSullm_Y',
  authDomain: 'decker-console.firebaseapp.com',
  databaseURL: 'https://decker-console-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'decker-console',
  storageBucket: 'decker-console.firebasestorage.app',
  messagingSenderId: '817419076123',
  appId: '1:817419076123:web:bbf83ff85ef10b0940eebe',
};

/** true tant que la config ci-dessus n'a pas été remplacée par les vraies valeurs. */
export const isConfigPlaceholder = firebaseConfig.apiKey.startsWith('VOTRE_');
