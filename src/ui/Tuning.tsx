import type { Params } from '../sim/types.ts';

type Key = keyof Params;

const SETTINGS: [Key, string, number, number, number][] = [
  ['thrustFwd', 'Poussée marche avant (N)', 500, 5000, 50],
  ['thrustRev', 'Poussée marche arrière (N)', 500, 5000, 50],
  ['idleFactor', 'Ralenti : poussée (× normale)', 0.1, 1, 0.05],
  ['kickFactor', 'Coup de fouet : poussée (× normale)', 1, 4, 0.1],
  ['kickTime', 'Coup de fouet : durée (s)', 0.5, 5, 0.25],
  ['rudderWash', 'Effet du flux d’hélice sur le safran', 0, 1.5, 0.05],
  ['rudderFlow', 'Effet de l’erre sur le safran', 0, 3000, 50],
  ['rudderGrip', 'Tenue du safran au dérapage', 0, 1.5, 0.05],
  ['keelLift', 'Portance de la quille (en route)', 0, 15000, 250],
  ['keelShift', 'Avancée du centre de poussée (m)', 0, 3, 0.1],
  ['dragYq', 'Résistance latérale (dérive à l’arrêt)', 1000, 12000, 100],
  ['dragYCenter', 'Résistance latérale concentrée au milieu', 0, 1, 0.05],
  ['windSoutenu', 'Vent soutenu (N)', 300, 4000, 50],
  ['windFaible', 'Vent faible (N)', 100, 2000, 50],
  ['windageShift', 'Fardage : avancée du vent de face (m)', 0, 5, 0.1],
  ['windageX', 'Fardage : avancée du vent de travers (m)', -1, 2, 0.1],
  ['lineK', 'Raideur des aussières (N/m)', 10000, 150000, 1000],
  ['crewEffort', 'Effort de l’équipier (N)', 100, 2000, 50],
  ['haulSpeed', 'Vitesse de reprise (m/s)', 0.05, 1, 0.05],
  ['crewMargin', 'Marge avant que l’équipier lâche (× effort)', 0, 1, 0.05],
];

/** Réglages physiques, visibles avec l'adresse terminée par #reglages. */
export function Tuning({ params, onChange }: { params: Params; onChange: (p: Params) => void }) {
  return (
    <details>
      <summary>Réglages physiques</summary>
      <div className="tune">
        {SETTINGS.map(([key, label, min, max, step]) => (
          <div key={key} className="tune-row">
            <label htmlFor={`t-${key}`}>{label}</label>
            <output>{params[key]}</output>
            <input id={`t-${key}`} type="range" min={min} max={max} step={step} value={params[key]}
              onChange={(e) => onChange({ ...params, [key]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <p className="hint">Un changement efface la suite de la manœuvre enregistrée.</p>
    </details>
  );
}
