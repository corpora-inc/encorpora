/**
 * beatlounge — the Actions Picker: a browsable, model-OPTIONAL surface for the
 * command bar.
 *
 * Lists every module's actions grouped by module, each with its human `describe`
 * and a one-tap Run. Actions with simple params expose quick controls (slider /
 * select / toggle); everything else runs on schema defaults. Running routes
 * through the controller's `runAction`, which uses the SAME preview lifecycle as
 * the text bar — one undo step, stochastic = re-rollable.
 *
 * This is the primary surface when no model is loaded: a low-power device still
 * gets the full power of the command bar with zero LLM, and no roadmap copy.
 */

import { useMemo, useState } from "react"
import { Glyph } from "../../bl-ui"
import type { ModuleAction } from "../../contracts/module"
import type { CommandBarController } from "./controller"
import {
  defaultParams,
  groupCatalogActions,
  pickerParams,
  type PickerParam,
} from "./actionCatalog"

export interface ActionsPickerProps {
  controller: CommandBarController
}

/** One param control, mapped from its schema type. Controlled by local state. */
const ParamControl = ({
  param,
  value,
  onChange,
}: {
  param: PickerParam
  value: unknown
  onChange: (v: unknown) => void
}) => {
  const { key, schema } = param
  const id = `bl-param-${key}`
  if (schema.type === "boolean") {
    return (
      <label className="bl-picker-param" htmlFor={id} title={schema.describe}>
        <span className="bl-picker-param-name">{key}</span>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    )
  }
  if (schema.type === "enum" || (schema.type === "string" && schema.options)) {
    return (
      <label className="bl-picker-param" htmlFor={id} title={schema.describe}>
        <span className="bl-picker-param-name">{key}</span>
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {(schema.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }
  // number / int → a range slider with a live read-out.
  const min = schema.min ?? 0
  const max = schema.max ?? 1
  const step = schema.step ?? (schema.type === "int" ? 1 : (max - min) / 100 || 0.01)
  const num = typeof value === "number" ? value : Number(value ?? min)
  return (
    <label className="bl-picker-param" htmlFor={id} title={schema.describe}>
      <span className="bl-picker-param-name">
        {key}
        {schema.unit ? ` (${schema.unit})` : ""}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) =>
          onChange(schema.type === "int" ? Math.round(Number(e.target.value)) : Number(e.target.value))
        }
      />
      <span className="bl-picker-param-val">{schema.type === "int" ? num : Number(num.toFixed(2))}</span>
    </label>
  )
}

/** One expandable action row: describe + Run (+ params when expanded). */
const ActionRow = ({
  action,
  onRun,
}: {
  action: ModuleAction
  onRun: (params: Record<string, unknown>) => void
}) => {
  const params = useMemo(() => pickerParams(action), [action])
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultParams(action))

  const run = () => onRun({ ...values })

  return (
    <li className="bl-picker-row">
      <div className="bl-picker-row-main">
        <button type="button" className="bl-picker-run" onClick={run} title={action.describe}>
          <span className="bl-picker-run-label">{action.name}</span>
          {action.stochastic && (
            <span className="bl-picker-dice" aria-label="varies each run">
              <Glyph name="redo" size={13} />
            </span>
          )}
        </button>
        <p className="bl-picker-describe">{action.describe}</p>
        {params.length > 0 && (
          <button
            type="button"
            className="bl-picker-toggle"
            aria-expanded={open}
            aria-label={open ? "Hide options" : "Options"}
            onClick={() => setOpen((o) => !o)}
          >
            <Glyph name="sliders" size={16} />
          </button>
        )}
      </div>
      {open && params.length > 0 && (
        <div className="bl-picker-params">
          {params.map((p) => (
            <ParamControl
              key={p.key}
              param={p}
              value={values[p.key] ?? defaultParams(action)[p.key]}
              onChange={(v) => setValues((cur) => ({ ...cur, [p.key]: v }))}
            />
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * The picker panel. Reads the registry off the controller; renders nothing if no
 * registry was provided (graceful on surfaces without one). Group-by-module.
 */
export const ActionsPicker = ({ controller }: ActionsPickerProps) => {
  const registry = controller.registry()
  const groups = useMemo(
    () => (registry ? groupCatalogActions(registry, "module") : []),
    [registry],
  )
  if (!registry || groups.length === 0) return null

  return (
    <div className="bl-picker" role="group" aria-label="Browse actions">
      {groups.map((g) => (
        <section key={g.key} className="bl-picker-group">
          <h3 className="bl-picker-group-label">{g.label}</h3>
          <ul className="bl-picker-list">
            {g.actions.map(({ moduleId, action }) => (
              <ActionRow
                key={`${moduleId}.${action.name}`}
                action={action}
                onRun={(params) => controller.runAction(moduleId, action, params)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
