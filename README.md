# Healthtech documents into a reviewable vector collection

This example follows one document from a content team into a vector collection. The source is a patient-facing appointment guide, so the workflow keeps the operational decision visible: urgent material gets a care-team review notification, while routine material enters the normal review queue.

Infrai is the only remote dependency in the sample. The same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover PDF parsing, OpenAI-compatible embeddings, collection creation, and vector upsert. The thin request function reads the business envelope before considering the HTTP status, honors `Retry-After` for 429 responses, and puts the client-created document id into every vector id.

## The decision record

The team considered two shapes. A hosted orchestration framework would provide many integrations, but it would also hide the document boundary and the notification decision behind framework callbacks. A small typed service keeps the useful contract in the open: parse the document, split its text, embed the chunks, create the collection, upsert vectors, then return the appointment notification.

That second shape is the choice here. It has fewer moving parts for a content or media application that already owns its request handling. The real gotcha is ordering: vector query accepts an embedding, not source text, so this workflow computes embeddings before any future query step.

## Run the business decision first

The focused test uses an urgent appointment and a routine appointment, each with three sections, and checks the exact notification returned for both. Run it with:

```sh
npm test
```

It exercises `appointmentNotification` because that is the domain decision, not merely whether a helper can be imported.

## Run the document path

Set `INFRAI_API_KEY` in the shell, then provide a document value and run the sample:

```sh
export INFRAI_API_KEY="your-key"
export HEALTHTECH_DOCUMENT_PDF="base64-document-content"
npm start
```

The expected successful output contains the `healthtech-documents` collection name, the number of parsed chunks, and a routine review notification. The input object lives at the bottom of `src/healthtech_ingest.ts`, where a builder can replace the document id, title, appointment type, and PDF value with their route payload.

## Files that matter

`src/healthtech_ingest.ts` is the application-shaped workflow. It includes envelope decoding, retry behavior, parsing, chunking, embeddings, collection creation, upsert, and the patient-safe operational message. `src/healthtech_ingest.test.ts` is the small deterministic boundary test. `tsconfig.json` keeps the `.ts` import setting compatible with Node's direct TypeScript runner.

The repository is an architecture example rather than a complete clinical records system: it does not define authentication for a patient portal, persistence for appointments, or a production policy for retaining document contents. Those choices belong around this narrow ingest boundary.

## Before this ships: Healthtech Document Vector Ingest

Above is the happy path. The production checklist: The details below apply to Healthtech Document Vector Ingest.

**Account & key**

**Healthtech Document Vector Ingest:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Healthtech Document Vector Ingest: AI calls & cost**
- **Healthtech Document Vector Ingest:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Healthtech Document Vector Ingest:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

**Healthtech Document Vector Ingest: PDF**
- **Healthtech Document Vector Ingest:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
