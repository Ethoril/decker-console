// Moteur de menace — Phase 3 (CDC §3.5 à §3.9) : routage des dégâts,
// attaques des GLACES/Spiders/hackers ennemis, pics de données,
// contre-mesures par niveau de sécurité, Surveillance/DIEU, Reboot, Dumpshock.

import { PERSONA } from '../data/persona';
import { ICE_EFFECTS, ICE_STATS } from '../data/ice';
import { SECURITY_TABLE } from '../data/security';
import { deckerDefaults, useNetworkStore } from '../store/network';
import {
  appendLog,
  createIcon,
  deleteIcon,
  setEnvironment,
  setIntervention,
  updateDecker,
  updateIcon,
} from '../sync/write';
import { countSuccesses, rollDice } from './dice';
import { defensePoolSize } from './pools';
import { MODE_LABELS } from './actions';

const d = () => useNetworkStore.getState().decker;

// ------------------------------------------------------------------ dégâts

export const MONITORS = { stun: 10, physical: 10, deck: PERSONA.deck.monitor } as const;

/**
 * Route les dégâts matriciels selon le mode (CDC §3.5) :
 * RA → moniteur du deck (9 cases) ; RV/Hot-Sim → physique du decker.
 * `forcePhysical` : GLACE Noire (toujours la chair).
 */
export async function applyMatrixDamage(
  code: string,
  amount: number,
  source: string,
  forcePhysical = false,
): Promise<string> {
  if (amount <= 0) return 'aucun dégât';
  const decker = d();
  const mode = decker.mode ?? deckerDefaults.mode;

  if (!forcePhysical && mode === 'AR') {
    const before = decker.deckCondition ?? 0;
    const after = Math.min(MONITORS.deck, before + amount);
    await updateDecker(code, { deckCondition: after });
    await appendLog(code, 'damage', `${source} : ${amount} dégât(s) au deck (${after}/${MONITORS.deck}).`);
    if (after >= MONITORS.deck && before < MONITORS.deck) {
      await appendLog(code, 'alert', 'DECK HS — 1 Karma pour réparation immédiate, ou jet Électronique + Logique.');
    }
    return `${amount} au deck`;
  }
  const before = decker.physical ?? 0;
  const after = Math.min(MONITORS.physical, before + amount);
  await updateDecker(code, { physical: after });
  await appendLog(
    code,
    'damage',
    `${source} : ${amount} dégât(s) physique(s) (${after}/${MONITORS.physical}).`,
  );
  return `${amount} physique`;
}

/** Dégâts étourdissants directs au decker (dumpshock en RA). */
async function applyStun(code: string, amount: number, source: string): Promise<void> {
  const before = d().stun ?? 0;
  const after = Math.min(MONITORS.stun, before + amount);
  await updateDecker(code, { stun: after });
  await appendLog(code, 'damage', `${source} : ${amount} Étourdissant (${after}/${MONITORS.stun}).`);
}

// ----------------------------------------------------- jets « système »

/** Consomme le buff « +N au prochain jet du système » (alarme silencieuse). */
async function consumeSystemBuff(code: string): Promise<number> {
  const buff = useNetworkStore.getState().environment.systemBuff ?? 0;
  if (buff > 0) await setEnvironment(code, { systemBuff: 0 });
  return buff;
}

/** Jet de défense automatique du decker : Logique + (Firewall − Acide). */
function deckerDefenseRoll(): { dice: number[]; successes: number } {
  const dice = rollDice(defensePoolSize(d().firewallPenalty ?? 0));
  return { dice, successes: countSuccesses(dice, 5) };
}

// ------------------------------------------------- attaques des icônes

/**
 * Attaque d'une GLACE/Spider/hacker ennemi sur le decker (bouton MJ).
 * Jet auto « 6+5 » (11D) ou réserve custom ; dégâts = 3 + succès nets ;
 * l'effet du type de GLACE s'applique automatiquement à l'impact (CDC §3.7).
 */
export async function iconAttack(code: string, iconId: string): Promise<string> {
  const icon = useNetworkStore.getState().icons[iconId];
  if (!icon) return 'icône disparue';

  const effect = icon.kind === 'ice' && icon.iceType ? ICE_EFFECTS[icon.iceType] : null;
  const buff = await consumeSystemBuff(code);
  const atkSize =
    (icon.kind === 'enemyHacker' ? (icon.atkPool ?? 10) : ICE_STATS.attackPool) +
    (effect?.attackBonus ?? 0) +
    buff;

  const atk = rollDice(atkSize);
  const atkS = countSuccesses(atk, 5);
  const def = deckerDefenseRoll();
  const net = atkS - def.successes;

  const label = icon.label + (icon.iceType ? ` (${icon.iceType})` : '');
  if (net <= 0) {
    await appendLog(
      code,
      'action',
      `${label} attaque le decker : ${atkS} vs ${def.successes} — esquivé.`,
    );
    return `raté (${atkS} vs ${def.successes})`;
  }

  const damage = ICE_STATS.baseDamage + net;
  await applyMatrixDamage(code, damage, `Attaque de ${label}`, effect?.alwaysPhysical ?? false);

  // Effets à l'impact
  if (icon.kind === 'ice' && icon.iceType) {
    switch (icon.iceType) {
      case 'acide': {
        const penalty = (d().firewallPenalty ?? 0) + 1;
        await updateDecker(code, { firewallPenalty: penalty });
        await appendLog(code, 'alert', `Acide : Firewall du deck −${penalty} (durée scène).`);
        break;
      }
      case 'bloqueuse':
        await updateDecker(code, { debuffs: { ...(d().debuffs ?? {}), bloqueuse: true } });
        await appendLog(code, 'alert', 'Bloqueuse : 1 succès ignoré sur les prochains tests.');
        break;
      case 'brouilleuse':
        await appendLog(code, 'alert', 'Brouilleuse : reboot forcé en fin de tour (bouton MJ « Reboot forcé »).');
        break;
      case 'crash':
        await appendLog(code, 'gm', 'Crash : plantez un programme au choix (toggles programmes).', 'gm');
        break;
      case 'potDeColle':
        await updateDecker(code, { trapped: true });
        await appendLog(code, 'alert', 'Pot de colle : persona PIÉGÉ — déconnexion impossible, fuite = test de Hacking.');
        break;
      default:
        break;
    }
  }
  return `touché : ${damage} dégât(s) (${atkS} vs ${def.successes})`;
}

/**
 * Résout l'attaque de cybercombat du decker sur une icône (après son jet) :
 * défense auto de la cible, dégâts = ⌈Logique/2⌉ + nets (+1 Marteau actif).
 */
export async function applyDeckerAttack(
  code: string,
  iconId: string,
  successes: number,
): Promise<string> {
  const icon = useNetworkStore.getState().icons[iconId];
  if (!icon) return 'cible disparue';

  const defSize = icon.kind === 'enemyHacker' ? (icon.defPool ?? 8) : ICE_STATS.defensePool;
  const def = rollDice(defSize);
  const defS = countSuccesses(def, 5);
  const net = successes - defS;
  const label = icon.label + (icon.iceType ? ` (${icon.iceType})` : '');

  if (net <= 0) return `raté (${successes} vs ${defS})`;

  const marteau = (d().programs?.marteau ?? 'active') === 'active' ? 1 : 0;
  const damage = Math.ceil(PERSONA.logique / 2) + net + marteau;
  const condition = icon.condition - damage;

  if (condition <= 0) {
    await deleteIcon(code, iconId);
    await appendLog(code, 'alert', `${label} DÉTRUITE (${damage} dégâts).`);
    return `${label} détruite (${damage} dégâts)`;
  }
  await updateIcon(code, iconId, { condition });
  await appendLog(code, 'damage', `${label} : ${damage} dégât(s), condition ${condition}/${ICE_STATS.condition}.`);
  return `touché : ${damage} dégât(s) (${successes} vs ${defS})`;
}

// ------------------------------------------------------------ contre-mesures

/** Pic de données : jet système XD (+buff) vs Firewall, dégâts = succès nets. */
async function dataSpike(code: string, diceCount: number, label: string): Promise<void> {
  const buff = await consumeSystemBuff(code);
  const atk = rollDice(diceCount + buff);
  const atkS = countSuccesses(atk, 5);
  const def = deckerDefenseRoll();
  const net = atkS - def.successes;
  if (net <= 0) {
    await appendLog(code, 'action', `${label} : ${atkS} vs ${def.successes} — paré par le Firewall.`);
    return;
  }
  await applyMatrixDamage(code, net, label);
}

/** Déclenche la contre-mesure du niveau de sécurité du nœud (bouton MJ, §3.6). */
export async function triggerCountermeasure(code: string, nodeId: string): Promise<void> {
  const node = useNetworkStore.getState().nodes[nodeId];
  if (!node) return;
  const level = node.security;

  switch (level) {
    case 3: {
      const buff = (useNetworkStore.getState().environment.systemBuff ?? 0) + 2;
      await setEnvironment(code, { systemBuff: buff });
      await appendLog(code, 'gm', `Alarme silencieuse sur « ${node.label} » : +2 au prochain jet système.`, 'gm');
      break;
    }
    case 4:
      await dataSpike(code, 5, 'Pic de données (5D)');
      break;
    case 5:
      await dataSpike(code, 8, 'Pic lourd (8D)');
      break;
    case 6: {
      await appendLog(code, 'alert', `ALARME AUDIBLE sur « ${node.label} » !`);
      await dataSpike(code, 10, 'Pic de données (10D)');
      const buff = (useNetworkStore.getState().environment.systemBuff ?? 0) + 2;
      await setEnvironment(code, { systemBuff: buff });
      break;
    }
    case 7:
      await spawnIcons(code, nodeId, 'ice', 1);
      break;
    case 8:
      await spawnIcons(code, nodeId, 'ice', 3);
      break;
    case 9:
      await spawnIcons(code, nodeId, 'spider', 1);
      break;
    case 10: {
      await appendLog(code, 'alert', `ALARME GÉNÉRALE sur « ${node.label} » — une équipe physique converge !`);
      await spawnIcons(code, nodeId, 'ice', 3);
      await spawnIcons(code, nodeId, 'spider', 1);
      await setIntervention(code, 10);
      break;
    }
    default:
      break; // niveaux 1-2 : aucune contre-mesure
  }
}

async function spawnIcons(
  code: string,
  nodeId: string,
  kind: 'ice' | 'spider',
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const iconId = await createIcon(code, kind, nodeId);
    // Une contre-mesure qui spawn est visible du joueur (elle attaque au tour suivant).
    await updateIcon(code, iconId, { visibleToPlayer: true });
  }
  const node = useNetworkStore.getState().nodes[nodeId];
  await appendLog(
    code,
    'alert',
    `${count} ${kind === 'ice' ? 'GLACE(s)' : 'Spider'} appara${count > 1 ? 'issent' : 'ît'} sur « ${node?.label ?? '?'} » !`,
  );
}

// ------------------------------------------------------ Surveillance / DIEU

export async function setSurveillance(code: string, value: number): Promise<void> {
  await updateDecker(code, { surveillance: Math.max(0, Math.min(3, value)) });
}

/** Action joueur « Vérifier la Surveillance » : révèle la valeur 10 s (CDC §3.9). */
export async function checkSurveillance(code: string): Promise<void> {
  await updateDecker(code, { surveillanceRevealed: true });
  await appendLog(code, 'action', 'Vérification de la Surveillance (coûte le tour).');
  window.setTimeout(() => {
    void updateDecker(code, { surveillanceRevealed: false });
  }, 10_000);
}

/**
 * Séquence DIEU (Surveillance à 3, bouton MJ) : plein écran rouge joueur,
 * dumpshock automatique (3 cases), dégâts massifs au deck (valeur MJ).
 */
export async function triggerConvergence(code: string, deckDamage: number): Promise<void> {
  await appendLog(code, 'alert', 'LE DIEU CONVERGE — position physique compromise.');
  await updateDecker(code, { convergence: true });
  await dumpshock(code); // 3 cases + retour RA
  if (deckDamage > 0) {
    const after = Math.min(MONITORS.deck, (d().deckCondition ?? 0) + deckDamage);
    await updateDecker(code, { deckCondition: after });
    await appendLog(code, 'damage', `Le DIEU grille le deck : ${deckDamage} dégât(s) (${after}/${MONITORS.deck}).`);
  }
}

export async function endConvergence(code: string): Promise<void> {
  await updateDecker(code, { convergence: false });
}

/** Dumpshock (bouton MJ) : 3 cases — Étourdi en RA, Physique en RV — puis RA. */
export async function dumpshock(code: string): Promise<void> {
  const mode = d().mode ?? deckerDefaults.mode;
  if (mode === 'AR') {
    await applyStun(code, 3, 'Dumpshock');
  } else {
    await applyMatrixDamage(code, 3, 'Dumpshock', true);
  }
  await updateDecker(code, { mode: 'AR', trapped: false });
  await appendLog(code, 'alert', `Éjection forcée de la Matrice (retour ${MODE_LABELS.AR}).`);
}

// ------------------------------------------------------------------ reboot

/** Reboot (action joueur, ou forcé par Brouilleuse) : Surveillance → 0,
 *  deck inactif 3 tours. Les effets de scène persistent (CDC §8.4). */
export async function reboot(code: string, forced = false): Promise<void> {
  await updateDecker(code, { surveillance: 0, rebootCountdown: 3 });
  await appendLog(
    code,
    forced ? 'alert' : 'action',
    `${forced ? 'Reboot FORCÉ' : 'Reboot'} du deck : Surveillance purgée, console inactive 3 tours.`,
  );
}

/** Fuite du Pot de colle : appliquée après le jet de Hacking (≥ 2 succès). */
export async function applyEscape(code: string, successes: number): Promise<string> {
  if (successes < 2) return 'échec — toujours piégé';
  await updateDecker(code, { trapped: false });
  await appendLog(code, 'action', 'Le persona s’arrache au Pot de colle !');
  return 'libéré du Pot de colle';
}

/** Réparation du deck : chaque succès restaure 1 case (CDC §3.5). */
export async function applyRepair(code: string, successes: number): Promise<string> {
  if (successes < 1) return 'échec — deck inchangé';
  const before = d().deckCondition ?? 0;
  const after = Math.max(0, before - successes);
  await updateDecker(code, { deckCondition: after });
  await appendLog(code, 'action', `Réparation du deck : ${before - after} case(s) restaurée(s) (${after}/${MONITORS.deck}).`);
  return `${before - after} case(s) restaurée(s)`;
}

// ------------------------------------------------------------- tour suivant

export { setIntervention };

/** Bouton MJ « Tour suivant » : décrémente reboot et compte à rebours (§3.9). */
export async function nextTurn(code: string): Promise<void> {
  const { decker, countdowns } = useNetworkStore.getState();
  const rc = decker.rebootCountdown ?? 0;
  if (rc > 0) {
    await updateDecker(code, { rebootCountdown: rc - 1 });
    if (rc - 1 === 0) await appendLog(code, 'system', 'Deck de nouveau opérationnel.');
  }
  const traceDelay = decker.traceDelay ?? 0;
  if (traceDelay > 0) {
    await updateDecker(code, { traceDelay: traceDelay - 1 });
    if (traceDelay - 1 === 0) {
      await appendLog(code, 'alert', 'Le brouillage expire : la localisation peut reprendre.');
    }
  }
  const iv = countdowns.intervention ?? null;
  if (iv !== null && iv > 0) {
    await setIntervention(code, iv - 1);
    if (iv - 1 === 0) {
      await appendLog(code, 'alert', 'L’ÉQUIPE D’INTERVENTION EST ARRIVÉE — combat physique imminent.');
    } else if (iv - 1 <= 3) {
      await appendLog(code, 'alert', `Équipe d’intervention : ${iv - 1} tour(s).`);
    }
  }
}

/** Rappel MJ : contre-mesure et modificateur du nœud (fiche rapide). */
export function securityInfo(level: number): string {
  const entry = SECURITY_TABLE[level];
  return entry ? entry.countermeasure : '—';
}
