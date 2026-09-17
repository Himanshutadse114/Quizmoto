# OpenAI course generation

LMSGEN course authoring uses OpenAI only. The server keeps the API key private and the browser never receives it.

## Required Render variable

Add this secret to the backend web service and worker service, then redeploy both:

```text
OPENAI_API_KEY=your OpenAI project API key
```

The repository already supplies the operating defaults through `render.yaml`:

- text model: `gpt-5.6-luna`
- image model: `gpt-image-2.5-flare`
- reasoning: none
- one structured course-authoring request
- five low-quality 1536×864 JPEG visuals generated concurrently
- no default image retry loop
- content timeout: 90 seconds
- media deadline: 80 seconds
- target: a normal course ready within 180 seconds
- budget gate: ₹10 per generated course

## Cost envelope

The service records text usage and estimated image cost in generation metadata. With the configured five-image profile, the expected course cost is roughly ₹4–₹7 depending on source length and generated text. The image budget gate reduces the requested image count if measured text cost is unusually high.

AI-authored document courses use locally extracted text capped at 120,000 characters. A scanned PDF with no readable text is rejected with a clear upload message instead of being sent as unpredictable visual-token input. This keeps the ₹10 ceiling enforceable. Fixed-slide PDF courses are unaffected.

## Verification

After deployment, request `GET /api/scorm/author/health` while signed in. It checks that both configured OpenAI models are reachable without creating billable course content. `GET /api/scorm/author/version` reports the active provider, models, ₹10 budget and 180-second target.

The PDF-to-trackable-course workflow remains separate. It preserves fixed PDF pages and only uses OpenAI for the generated quiz, so slide fidelity is unchanged.
