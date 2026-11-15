import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import * as fs from "fs";
import * as path from "path";
import {
  LoginSchema,
  CreateUserSchema,
  CreateCommitteeSchema,
  CreateSlotSchema,
  CreateRequestSchema,
  AssignRequestSchema,
  DeclineRequestSchema,
  SeatDecisionSchema,
  CancelSessionSchema,
  CreateMessageSchema,
} from "../src/lib/validations";

const registry = new OpenAPIRegistry();

// Register Bearer Auth
const bearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// Register Endpoints
registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  summary: "Log in with username and password",
  request: {
    body: {
      content: { "application/json": { schema: LoginSchema } },
    },
  },
  responses: {
    200: { description: "Successful login, returns tokens and user info" },
    401: { description: "Wrong credentials or deactivated account or lockout" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/signup",
  summary: "User registration / sign up",
  request: {
    body: {
      content: { "application/json": { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: { description: "Account created and logged in" },
    409: { description: "Username or email or student number already exists" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/me",
  summary: "Current user profile and Bale link status",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: "Profile data" },
    401: { description: "Unauthenticated" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/me/bale/link-code",
  summary: "Request a one-time Bale link code",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: "Returns 8-character code and expiration" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/schedule",
  summary: "Get weekly schedule grid",
  parameters: [
    {
      name: "week",
      in: "query",
      required: false,
      schema: { type: "string", example: "2026-10-24" },
    },
  ],
  responses: {
    200: { description: "Weekly schedule grid" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/schedule.pdf",
  summary: "Download weekly schedule grid as PDF",
  parameters: [
    {
      name: "week",
      in: "query",
      required: false,
      schema: { type: "string", example: "2026-10-24" },
    },
  ],
  responses: {
    200: { description: "PDF binary content" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/slots",
  summary: "Define a single or recurring availability slot",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateSlotSchema } },
    },
  },
  responses: {
    201: { description: "Slot created" },
    409: { description: "Overlap with existing slot" },
    422: { description: "Validation error" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/requests",
  summary: "Student submits a defense request",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateRequestSchema } },
    },
  },
  responses: {
    201: { description: "Defense request submitted" },
    409: { description: "RULE_VIOLATION: active request already exists" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/requests/{id}/assign",
  summary: "Admin assigns request to slot and date",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AssignRequestSchema } },
    },
  },
  responses: {
    200: { description: "Assigned" },
    409: { description: "Occurrence taken or professor overlap" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/requests/{id}/decline",
  summary: "Admin declines request with reason",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: DeclineRequestSchema } },
    },
  },
  responses: {
    200: { description: "Declined" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/seats/{id}/decision",
  summary: "Professor approves or rejects assigned defense seat",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: SeatDecisionSchema } },
    },
  },
  responses: {
    200: { description: "Decision recorded" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/sessions/{id}/cancel",
  summary: "Cancel assigned or confirmed defense session",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CancelSessionSchema } },
    },
  },
  responses: {
    200: { description: "Cancelled" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/sessions/{id}/messages",
  summary: "Post message to confirmed session thread",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateMessageSchema } },
    },
  },
  responses: {
    201: { description: "Message posted" },
    409: { description: "Session not confirmed" },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

const doc = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    version: "2.0.0",
    title: "Thesis Defense Scheduling System API",
    description: "Shared REST API for Thesis Defense Scheduling Web & Android Clients",
  },
  servers: [{ url: "http://localhost:3000" }],
});

const outputPath = path.resolve(process.cwd(), "openapi.json");
fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), "utf-8");
console.log(`Generated OpenAPI specification at: ${outputPath}`);
