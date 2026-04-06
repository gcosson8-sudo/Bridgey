import { z } from "zod";

export const bridgeyErrorCodes = [
  "blocked_domain",
  "invalid_action",
  "invalid_selector",
  "navigation_timeout",
  "login_failed",
  "session_expired",
  "rate_limited"
] as const;

export type BridgeyErrorCode = (typeof bridgeyErrorCodes)[number];

export const bridgeyErrorCodeSchema = z.enum(bridgeyErrorCodes);

export const interactiveHintsSchema = z.object({
  clickable: z.boolean(),
  typeable: z.boolean(),
  formControl: z.boolean(),
  role: z.string().nullish(),
  href: z.string().nullish(),
  inputType: z.string().nullish()
});

export type InteractiveHints = z.infer<typeof interactiveHintsSchema>;

export const layoutBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export type LayoutBox = z.infer<typeof layoutBoxSchema>;

export const computedStyleSchema = z.object({
  display: z.string(),
  visibility: z.string(),
  position: z.string(),
  color: z.string().nullish(),
  backgroundColor: z.string().nullish(),
  fontSize: z.string().nullish(),
  fontWeight: z.string().nullish(),
  textAlign: z.string().nullish(),
  opacity: z.string().nullish(),
  zIndex: z.string().nullish(),
  overflowX: z.string().nullish(),
  overflowY: z.string().nullish()
});

export type ComputedStyle = z.infer<typeof computedStyleSchema>;

const defaultLayoutBox: LayoutBox = {
  x: 0,
  y: 0,
  width: 0,
  height: 0
};

const defaultComputedStyle: ComputedStyle = {
  display: "",
  visibility: "",
  position: "",
  color: null,
  backgroundColor: null,
  fontSize: null,
  fontWeight: null,
  textAlign: null,
  opacity: null,
  zIndex: null,
  overflowX: null,
  overflowY: null
};

export const renderInfoSchema = z.object({
  visible: z.boolean(),
  layout: layoutBoxSchema,
  computedStyle: computedStyleSchema
});

export type RenderInfo = z.infer<typeof renderInfoSchema>;

const defaultRenderInfo: RenderInfo = {
  visible: false,
  layout: defaultLayoutBox,
  computedStyle: defaultComputedStyle
};

export const domNodeSchema: z.ZodType<DomNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    tag: z.string(),
    attributes: z.record(z.string()),
    text: z.string().nullable(),
    interactiveHints: interactiveHintsSchema,
    render: renderInfoSchema.default(defaultRenderInfo),
    children: z.array(domNodeSchema)
  })
);

export interface DomNode {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  text: string | null;
  interactiveHints: InteractiveHints;
  render: RenderInfo;
  children: DomNode[];
}

export const linkSchema = z.object({
  text: z.string(),
  href: z.string(),
  rel: z.string().nullish(),
  target: z.string().nullish()
});

export type LinkRecord = z.infer<typeof linkSchema>;

export const formFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  selector: z.string(),
  required: z.boolean(),
  placeholder: z.string().nullish()
});

export type FormField = z.infer<typeof formFieldSchema>;

export const formSchema = z.object({
  id: z.string(),
  action: z.string().nullish(),
  method: z.string(),
  fields: z.array(formFieldSchema)
});

export type FormRecord = z.infer<typeof formSchema>;

export const textBlockSchema = z.object({
  selector: z.string(),
  text: z.string()
});

export type TextBlock = z.infer<typeof textBlockSchema>;

export const documentMetadataSchema = z.object({
  description: z.string().nullish(),
  lang: z.string().nullish(),
  readyState: z.string(),
  contentType: z.string().nullish(),
  redirectedFrom: z.string().nullish()
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export const scriptAssetSchema = z.object({
  src: z.string().nullish(),
  type: z.string().nullish(),
  async: z.boolean(),
  defer: z.boolean(),
  module: z.boolean(),
  inline: z.boolean(),
  textLength: z.number().int().min(0)
});

export type ScriptAsset = z.infer<typeof scriptAssetSchema>;

export const stylesheetAssetSchema = z.object({
  href: z.string().nullish(),
  media: z.string().nullish(),
  disabled: z.boolean(),
  inline: z.boolean(),
  ruleCount: z.number().int().min(0).nullable()
});

export type StylesheetAsset = z.infer<typeof stylesheetAssetSchema>;

export const viewportSchema = z.object({
  width: z.number(),
  height: z.number(),
  scrollX: z.number(),
  scrollY: z.number(),
  devicePixelRatio: z.number()
});

export type ViewportRecord = z.infer<typeof viewportSchema>;

const defaultViewport: ViewportRecord = {
  width: 0,
  height: 0,
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 1
};

export const documentRuntimeSchema = z.object({
  javascriptExecuted: z.boolean(),
  stylesApplied: z.boolean(),
  viewport: viewportSchema,
  scripts: z.array(scriptAssetSchema),
  stylesheets: z.array(stylesheetAssetSchema)
});

export type DocumentRuntime = z.infer<typeof documentRuntimeSchema>;

const defaultDocumentRuntime: DocumentRuntime = {
  javascriptExecuted: true,
  stylesApplied: true,
  viewport: defaultViewport,
  scripts: [],
  stylesheets: []
};

export const documentSnapshotSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  status: z.number().int().min(0).nullable(),
  metadata: documentMetadataSchema,
  dom: domNodeSchema,
  links: z.array(linkSchema),
  forms: z.array(formSchema),
  textBlocks: z.array(textBlockSchema),
  runtime: documentRuntimeSchema.default(defaultDocumentRuntime),
  timestamp: z.string().datetime()
});

export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;

export const navigateActionSchema = z.object({
  type: z.literal("navigate"),
  url: z.string().url(),
  waitUntil: z.enum(["commit", "domcontentloaded", "load", "networkidle"]).optional(),
  timeoutMs: z.number().int().positive().max(60_000).optional()
});

export const clickActionSchema = z.object({
  type: z.literal("click"),
  selector: z.string().min(1),
  timeoutMs: z.number().int().positive().max(60_000).optional()
});

export const typeActionSchema = z
  .object({
    type: z.literal("type"),
    selector: z.string().min(1),
    value: z.string().optional(),
    credentialField: z.string().min(1).optional(),
    clearBeforeType: z.boolean().optional(),
    timeoutMs: z.number().int().positive().max(60_000).optional()
  })
  .refine(
    (action) =>
      (action.value !== undefined && action.credentialField === undefined) ||
      (action.value === undefined && action.credentialField !== undefined),
    "type actions require either value or credentialField"
  );

export const submitActionSchema = z.object({
  type: z.literal("submit"),
  selector: z.string().min(1),
  timeoutMs: z.number().int().positive().max(60_000).optional()
});

export const waitForSelectorActionSchema = z.object({
  type: z.literal("wait_for_selector"),
  selector: z.string().min(1),
  state: z.enum(["attached", "detached", "visible", "hidden"]).optional(),
  timeoutMs: z.number().int().positive().max(60_000).optional()
});

export const actionSchema = z.union([
  navigateActionSchema,
  clickActionSchema,
  typeActionSchema,
  submitActionSchema,
  waitForSelectorActionSchema
]);

export type Action = z.infer<typeof actionSchema>;

export const sessionStateSchema = z.object({
  sessionId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  lastActivityAt: z.string().datetime()
});

export type SessionState = z.infer<typeof sessionStateSchema>;

export const createSessionRequestSchema = z.object({
  ttlMs: z.number().int().positive().max(3_600_000).optional()
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const createSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  expiresAt: z.string().datetime()
});

export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

export const runActionsRequestSchema = z.object({
  actions: z.array(actionSchema).min(1),
  credentialRef: z.string().uuid().optional()
});

export type RunActionsRequest = z.infer<typeof runActionsRequestSchema>;

export const runActionsResponseSchema = z.object({
  session: sessionStateSchema,
  snapshot: documentSnapshotSchema
});

export type RunActionsResponse = z.infer<typeof runActionsResponseSchema>;

export const getDocumentResponseSchema = z.object({
  session: sessionStateSchema,
  snapshot: documentSnapshotSchema.nullable()
});

export type GetDocumentResponse = z.infer<typeof getDocumentResponseSchema>;

export const closeSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  closedAt: z.string().datetime()
});

export type CloseSessionResponse = z.infer<typeof closeSessionResponseSchema>;

export const credentialPayloadSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  extras: z.record(z.string()).optional()
});

export type CredentialPayload = z.infer<typeof credentialPayloadSchema>;

export const createCredentialRequestSchema = z.object({
  label: z.string().min(1),
  allowedDomains: z.array(z.string().min(1)).min(1),
  payload: credentialPayloadSchema
});

export type CreateCredentialRequest = z.infer<typeof createCredentialRequestSchema>;

export const createCredentialResponseSchema = z.object({
  credentialRef: z.string().uuid(),
  allowedDomains: z.array(z.string())
});

export type CreateCredentialResponse = z.infer<typeof createCredentialResponseSchema>;

export const allowlistMutationRequestSchema = z.object({
  action: z.enum(["add", "remove"]),
  domain: z.string().min(1)
});

export type AllowlistMutationRequest = z.infer<typeof allowlistMutationRequestSchema>;

export const allowlistMutationResponseSchema = z.object({
  domain: z.string(),
  allowed: z.boolean()
});

export type AllowlistMutationResponse = z.infer<typeof allowlistMutationResponseSchema>;

export const bridgeyErrorSchema = z.object({
  code: bridgeyErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional()
});

export type BridgeyErrorBody = z.infer<typeof bridgeyErrorSchema>;
