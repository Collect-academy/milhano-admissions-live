/**
 * Read-only n8n draft compatibility inspection.
 * Reads only workflow topology (node types, versions, credential reference IDs)
 * in memory. Never prints workflow bodies, credentials, tokens or node parameters.
 */
function must(condition, message) {
  if (!condition) throw new Error("n8n preflight: " + message);
}
function getReferences(value) {
  const refs = new Set();
  const text = JSON.stringify(value ?? {});
  const re = /\$\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = re.exec(text)) !== null) refs.add(match[1]);
  return [...refs];
}
export async function auditSofiaDrafts(sources, workflows, getWorkflow) {
  const credReferences = new Set();
  const requestedTypes = new Map();
  const webhookPaths = new Set();
  const diagnostics = [];

  for (const source of sources) {
    const wf = source.target;
    must(wf && typeof wf.name === "string" && Array.isArray(wf.nodes), "invalid workflow payload");
    const byName = new Set();
    const byId = new Set();
    for (const node of wf.nodes) {
      must(node && typeof node.name === "string" && node.name.trim(), "unnamed node");
      must(node.id && typeof node.id === "string" && !byId.has(node.id), "duplicate or missing node ID");
      must(!byName.has(node.name), "duplicate node name in " + wf.name);
      must(typeof node.type === "string" && node.type.startsWith("n8n-nodes-base."),
        "non-core node type " + node.type + " in " + wf.name);
      must(Number.isFinite(Number(node.typeVersion)) && Number(node.typeVersion) > 0,
        "node version not specified in " + wf.name);
      must(Array.isArray(node.position) && node.position.length === 2,
        "node position missing in " + wf.name);
      must(node.parameters && typeof node.parameters === "object",
        "node parameters missing in " + wf.name);
      if(node.type==="n8n-nodes-base.code" && typeof node.parameters.jsCode==="string"){
        try {new Function(node.parameters.jsCode);}
        catch(error){throw new Error("Invalid n8n Code JS in "+wf.name+" / "+node.name+": "+error.message);}
      }
      byName.add(node.name);
      byId.add(node.id);
      const version = Number(node.typeVersion);
      requestedTypes.set(node.type, Math.max(requestedTypes.get(node.type) ?? 0, version));
      for (const value of Object.values(node.credentials ?? {})) {
        must(value && typeof value.id === "string" && value.id && typeof value.name === "string",
          "credential reference missing in " + wf.name);
        credReferences.add(value.id);
      }
      if (node.type === "n8n-nodes-base.webhook") {
        const route = String(node.parameters.path ?? "");
        must(route && !webhookPaths.has(route), "duplicate new webhook path " + route);
        webhookPaths.add(route);
      }
      // Evaluate only literal node references: dynamic expressions and runtime data
      // must still be validated in n8n.
    }
    for (const [src, output] of Object.entries(wf.connections ?? {})) {
      must(byName.has(src), "connection source missing: " + src);
      must(output && Array.isArray(output.main), "malformed connection outputs: " + src);
      for (const branch of output.main) {
        must(Array.isArray(branch), "invalid connection branch from " + src);
        for (const edge of branch) {
          must(byName.has(edge.node), "missing connection target: " + edge.node);
          must(edge.type === "main", "unsupported connection type in " + wf.name);
          must(Number.isInteger(edge.index) && edge.index >= 0,
            "invalid connection index in " + wf.name);
        }
      }
    }
    for (const node of wf.nodes) {
      for (const ref of getReferences(node.parameters)) {
        must(byName.has(ref), "expression references unknown node '" + ref + "' in " + wf.name);
      }
    }
    const schedule = wf.nodes.find((n) => n.name === "Safety | Require Supabase Approval");
    if (schedule) {
      must(schedule.parameters.jsCode.includes("milhano_sofia_scheduler") &&
          wf.nodes.some(n=>n.parameters?.url?.includes("milhano_ai_claim_one_due")),
        "outbound scheduler must use the protected Supabase claim RPC");
    }
    const stage = wf.nodes.find((n) => n.name === "Safety Gate | Stage Writes Controlled");
    if (stage) {
      must(stage.parameters.jsCode.includes("Supabase | Runtime Stage Gate"),
        "stage writes must require the Supabase runtime flag");
    }
    diagnostics.push(wf.name + ": " + wf.nodes.length + " nodes, valid IDs and internal links");
  }

  // Use the live instance itself as the compatibility reference. GET only.
  const installedTypes = new Map();
  const installedCredentialIds = new Set();
  const existingWebhooks = new Set();
  const sourceNames = new Set(sources.map(s=>s.target.name));
  const workflowIds = workflows.map((w) => w.id);
  const concurrency = 4;
  let counter = 0;
  async function worker() {
    while (counter < workflowIds.length) {
      const current = workflowIds[counter++];
      const wf = await getWorkflow(current);
      for (const node of wf.nodes ?? []) {
        installedTypes.set(node.type,
          Math.max(installedTypes.get(node.type) ?? 0, Number(node.typeVersion) || 0));
        for (const v of Object.values(node.credentials ?? {})) {
          if (typeof v.id === "string") installedCredentialIds.add(v.id);
        }
        if (!sourceNames.has(wf.name) && node.type === "n8n-nodes-base.webhook" && node.parameters?.path) {
          existingWebhooks.add(String(node.parameters.path));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const unavailableTypes = [...requestedTypes.entries()].filter(
    ([type, version]) => !installedTypes.has(type) || installedTypes.get(type) < version
  );
  const unreferencedCredentials = [...credReferences].filter((id) => !installedCredentialIds.has(id));
  const overlappingWebhooks = [...webhookPaths].filter((p) => existingWebhooks.has(p));

  for (const message of diagnostics) console.log("Validated:", message);
  console.log("Live node type/version checks:", requestedTypes.size - unavailableTypes.length,
    "/", requestedTypes.size);
  console.log("Live credential reference checks:", credReferences.size - unreferencedCredentials.length,
    "/", credReferences.size);
  console.log("Live webhook path collisions:", overlappingWebhooks.length);

  must(!unavailableTypes.length,
    "Node type/version not observed on this instance: " +
      unavailableTypes.map(([type, version]) => type + "@" + version).join(", ") +
      ". Manual compatibility review needed; no sync.");
  must(!unreferencedCredentials.length,
    "Not all saved credential references were observed in existing n8n workflows. No sync.");
  must(!overlappingWebhooks.length,
    "Webhook path is already used on n8n. No sync.");
  console.log("PREFLIGHT OK: All declared node types/versions and credential references observed.");
}
