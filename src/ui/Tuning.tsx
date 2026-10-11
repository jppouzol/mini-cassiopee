import type { Params } from '../sim/types.ts';

type Key = keyof Params;

const SETTINGS: [Key, string, number, number, number][] = [
  ['thrustFwd', 'Poussée marche avant (N)', 500, 5000, 50],
  ['thrustRev', 'Poussée marche arrière (N)', 500, 5000, 50],
  ['rudderWash', 'Effet du flux d’hélice sur le safran', 0, 1.5, 0.05],
  ['rudderFlow', 'Effet de l’erre sur le safran', 0, 3000, 50],
  ['dragYq', 'Résistance latérale (quille)', 1000, 12000, 100],
  ['windSoutenu', 'Vent soutenu (N)', 300, 4000, 50],
  ['windFaible', 'Vent faible (N)', 100, 2000, 50],
  ['lineK', 'Raideur des aussières (N/m)', 10000, 150000, 1000],
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
