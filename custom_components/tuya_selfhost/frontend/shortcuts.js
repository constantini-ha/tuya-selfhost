// What a button shortcut does, read from and written to an automation's actions.
// The form edits {act, keys, retry}; any saved shape it reads it can write back.

const ACTS = ["toggle", "turn_on", "turn_off"];
const CALL_KEYS = ["action", "service", "target", "data", "metadata", "continue_on_error"];

const list = (value) => (value == null ? [] : [].concat(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const within = (part, whole) =>
  Object.entries(part).every(([key, value]) => same(whole[key], value));

export const sameKeys = (a, b) =>
  a.length === b.length && a.every((id) => b.includes(id));

function readCall(step) {
  if (!step || typeof step !== "object") return null;
  if (Object.keys(step).some((key) => !CALL_KEYS.includes(key))) return null;
  const act = String(step.action || step.service || "").split(".")[1];
  if (!ACTS.includes(act)) return null;
  const { entity_id: ids, ...extra } = { ...(step.data || {}), ...(step.target || {}) };
  const keys = list(ids);
  if (Object.keys(extra).length || !keys.length) return null;
  return { act, keys };
}

// A call alone, or retried until the keys get there (a Wi-Fi key can drop one).
function readStep(step) {
  const call = readCall(step);
  if (call) return { ...call, retry: 0 };
  const repeat = step && step.repeat;
  if (!repeat || Object.keys(step).length !== 1 || typeof repeat.count !== "number") return null;
  const [first, ...rest] = list(repeat.sequence);
  const inner = readCall(first);
  if (!inner || !rest.every((item) => "wait_template" in item || item.condition === "template"))
    return null;
  return { ...inner, retry: repeat.count };
}

function readOnly(steps) {
  const all = list(steps);
  return all.length === 1 ? readStep(all[0]) : null;
}

function readAnyOn(conditions) {
  const all = list(conditions);
  if (all.length !== 1) return null;
  const states = all[0].condition === "or" ? list(all[0].conditions) : all;
  const keys = [];
  for (const state of states) {
    if (state.condition !== "state" || !same(list(state.state), ["on"])) return null;
    if (Object.keys(state).some((key) => !["condition", "entity_id", "state", "match"].includes(key)))
      return null;
    const ids = list(state.entity_id);
    if (ids.length > 1 && state.match !== "any") return null;
    keys.push(...ids);
  }
  return keys;
}

// "If any is on, turn them all off; otherwise turn them all on."
function readTogether(step) {
  if (!step || Object.keys(step).some((key) => !["choose", "default"].includes(key))) return null;
  const options = list(step.choose);
  if (options.length !== 1) return null;
  const [option] = options;
  if (Object.keys(option).some((key) => !["conditions", "sequence", "alias"].includes(key)))
    return null;
  const watched = readAnyOn(option.conditions);
  const off = readOnly(option.sequence);
  const on = readOnly(step.default);
  if (!watched || !off || !on || off.act !== "turn_off" || on.act !== "turn_on") return null;
  if (!sameKeys(watched, on.keys) || !sameKeys(off.keys, on.keys)) return null;
  return { act: "toggle", keys: on.keys, retry: Math.max(off.retry, on.retry) };
}

export function readActions(actions) {
  const steps = list(actions);
  if (steps.length !== 1) return null;
  return readStep(steps[0]) || readTogether(steps[0]);
}

function retried(call, keys, state, count) {
  if (!count) return call;
  const there = keys.map((id) => `is_state('${id}','${state}')`).join(" and ");
  return {
    repeat: {
      count,
      sequence: [
        { ...call, continue_on_error: true },
        { wait_template: `{{ ${there} }}`, timeout: "00:00:03", continue_on_timeout: true },
        {
          condition: "template",
          value_template: `{{ not ${keys.length > 1 ? `(${there})` : there} }}`,
        },
      ],
    },
  };
}

export function writeActions({ act, keys, retry = 0 }) {
  const call = (what) => ({ action: "homeassistant." + what, target: { entity_id: keys } });
  if (act !== "toggle") return [retried(call(act), keys, act === "turn_on" ? "on" : "off", retry)];
  if (keys.length === 1 && !retry) return [call("toggle")];
  // Toggled one by one, keys that were mixed stay mixed; a press switches them together.
  return [
    {
      choose: [
        {
          conditions: [{ condition: "state", entity_id: keys, state: "on", match: "any" }],
          sequence: [retried(call("turn_off"), keys, "off", retry)],
        },
      ],
      default: [retried(call("turn_on"), keys, "on", retry)],
    },
  ];
}
