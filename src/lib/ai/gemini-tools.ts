/**
 * Convert the shared Claude tool definitions (§21) into Gemini
 * function-declaration format. The SAME 12 tools, the same descriptions, and
 * the same tool runner back both providers — only the schema dialect differs:
 * Gemini uses uppercase OpenAPI-style types and does not accept
 * `additionalProperties` or numeric bounds (those are re-checked by Zod in the
 * tool runner anyway).
 */

import { TOOL_DEFINITIONS } from "./tool-definitions";

interface GeminiSchema {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
}

interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema;
}

const TYPE_MAP: Record<string, string> = {
  object: "OBJECT",
  array: "ARRAY",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
};

type JsonSchemaNode = {
  type?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
};

function convert(node: JsonSchemaNode): GeminiSchema {
  const type = TYPE_MAP[node.type ?? "string"] ?? "STRING";
  const out: GeminiSchema = { type };
  if (node.description) out.description = node.description;
  if (node.enum) out.enum = node.enum.map((v) => String(v));
  if (type === "OBJECT" && node.properties) {
    out.properties = {};
    for (const [key, value] of Object.entries(node.properties)) {
      out.properties[key] = convert(value);
    }
    if (node.required && node.required.length > 0) out.required = node.required;
  }
  if (type === "ARRAY" && node.items) out.items = convert(node.items);
  return out;
}

function toDeclaration(
  def: (typeof TOOL_DEFINITIONS)[number],
): GeminiFunctionDeclaration {
  const props = def.input_schema.properties ?? {};
  const hasProps = Object.keys(props).length > 0;
  const decl: GeminiFunctionDeclaration = {
    name: def.name,
    description: def.description,
  };
  // Gemini rejects an empty OBJECT parameters block; omit it for no-arg tools.
  if (hasProps) {
    decl.parameters = convert(def.input_schema as unknown as JsonSchemaNode);
  }
  return decl;
}

export const GEMINI_FUNCTION_DECLARATIONS: GeminiFunctionDeclaration[] =
  TOOL_DEFINITIONS.map(toDeclaration);
