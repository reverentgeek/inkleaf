import { MongoClient } from "mongodb";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

const uri = process.env.MONGODB_URI!;
const dbName = "inkleaf";

const sampleNotes = [
  {
    title: "Getting Started with MongoDB Atlas",
    markdown: `# Getting Started with MongoDB Atlas

MongoDB Atlas is a fully managed cloud database service that handles the complexity of deploying, managing, and healing your deployments on your chosen cloud provider.

## Key Features

- **Global Clusters**: Deploy across multiple regions and cloud providers
- **Automated Backups**: Continuous backups with point-in-time recovery
- **Performance Advisor**: Real-time performance suggestions
- **Atlas Search**: Full-text search powered by Apache Lucene

## Quick Setup

1. Create an Atlas account
2. Deploy a free M0 cluster
3. Configure network access (IP whitelist)
4. Create a database user
5. Get your connection string

\`\`\`javascript
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
\`\`\`

Atlas provides a generous free tier that's perfect for development and small applications.`,
    tags: ["mongodb", "atlas", "getting-started", "cloud"],
    notebookId: "learning",
  },
  {
    title: "Understanding MongoDB Aggregation Pipeline",
    markdown: `# Understanding MongoDB Aggregation Pipeline

The aggregation pipeline is one of MongoDB's most powerful features. It processes documents through a series of stages, where each stage transforms the documents.

## Common Stages

### \`$match\`
Filters documents, similar to \`find()\`. Place early in the pipeline for performance.

\`\`\`javascript
{ $match: { status: "active", age: { $gte: 18 } } }
\`\`\`

### \`$group\`
Groups documents by a specified expression and applies accumulators.

\`\`\`javascript
{
  $group: {
    _id: "$department",
    totalSalary: { $sum: "$salary" },
    avgAge: { $avg: "$age" },
    count: { $sum: 1 }
  }
}
\`\`\`

### \`$lookup\`
Performs a left outer join with another collection. Essential for combining related data.

### \`$unwind\`
Deconstructs an array field into separate documents — one per array element.

### \`$project\`
Reshapes documents by including, excluding, or computing new fields.

## Performance Tips

- Use \`$match\` early to reduce documents flowing through the pipeline
- Create indexes that support your \`$match\` and \`$sort\` stages
- Use \`$project\` to remove unnecessary fields early
- Consider \`allowDiskUse\` for large datasets`,
    tags: ["mongodb", "aggregation", "pipeline", "performance"],
    notebookId: "learning",
  },
  {
    title: "Atlas Search: Full-Text Search in MongoDB",
    markdown: `# Atlas Search: Full-Text Search in MongoDB

Atlas Search brings Apache Lucene-powered full-text search directly into MongoDB, eliminating the need for a separate search engine.

## Why Atlas Search?

- No need to sync data to Elasticsearch or Solr
- Query with the same MongoDB driver
- Integrated into the aggregation pipeline via \`$search\`
- Supports fuzzy matching, autocomplete, facets, and highlighting

## Creating a Search Index

In the Atlas UI or via the API:

\`\`\`json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "title": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "content": {
        "type": "string",
        "analyzer": "lucene.english"
      }
    }
  }
}
\`\`\`

## Using \`$search\` in Aggregation

\`\`\`javascript
db.articles.aggregate([
  {
    $search: {
      text: {
        query: "database performance",
        path: ["title", "content"],
        fuzzy: { maxEdits: 1 }
      }
    }
  },
  { $limit: 10 },
  {
    $project: {
      title: 1,
      score: { $meta: "searchScore" }
    }
  }
]);
\`\`\`

## Highlighting

Atlas Search can return highlighted snippets showing where matches occurred, which is perfect for search result UIs.`,
    tags: ["mongodb", "atlas-search", "full-text", "lucene"],
    notebookId: "learning",
  },
  {
    title: "Vector Search and Semantic Retrieval",
    markdown: `# Vector Search and Semantic Retrieval

MongoDB Atlas Vector Search enables you to search data based on meaning rather than exact keywords. This is foundational for RAG (Retrieval-Augmented Generation) and AI-powered applications.

## How It Works

1. Generate vector embeddings from your text using a model like OpenAI's \`text-embedding-3-small\`
2. Store the embedding array in your MongoDB documents
3. Create a vector search index on the embedding field
4. Query using \`$vectorSearch\` in the aggregation pipeline

## Creating a Vector Index

\`\`\`json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1536,
    "similarity": "cosine"
  }]
}
\`\`\`

## Querying with \`$vectorSearch\`

\`\`\`javascript
db.documents.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 100,
      limit: 10
    }
  }
]);
\`\`\`

## Use Cases

- **Semantic search**: Find documents by meaning, not keywords
- **Recommendation engines**: Find similar products or content
- **RAG applications**: Retrieve relevant context for LLMs
- **Anomaly detection**: Find outliers in high-dimensional data`,
    tags: ["mongodb", "vector-search", "ai", "embeddings", "rag"],
    notebookId: "learning",
  },
  {
    title: "Client-Side Field Level Encryption (CSFLE)",
    markdown: `# Client-Side Field Level Encryption (CSFLE)

MongoDB CSFLE encrypts sensitive data in your application before it's sent to the server. Even database administrators with full access cannot read encrypted fields.

## How CSFLE Works

1. **Key Management**: A Customer Master Key (CMK) protects Data Encryption Keys (DEKs)
2. **Automatic Encryption**: The MongoDB driver encrypts specified fields before sending to the server
3. **Transparent Decryption**: Authorized clients decrypt data automatically on read
4. **Server Never Sees Plaintext**: The server only ever stores and processes ciphertext

## Encryption Algorithms

### Deterministic
- Same plaintext always produces the same ciphertext
- Supports equality queries on encrypted fields
- Use for fields you need to query (e.g., SSN lookup)

### Random
- Same plaintext produces different ciphertext each time
- More secure but doesn't support queries
- Use for highly sensitive fields (e.g., medical records)

## Schema Map Example

\`\`\`javascript
const schemaMap = {
  "mydb.patients": {
    bsonType: "object",
    properties: {
      ssn: {
        encrypt: {
          bsonType: "string",
          algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic"
        }
      },
      medicalRecord: {
        encrypt: {
          bsonType: "object",
          algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random"
        }
      }
    }
  }
};
\`\`\`

## Key Benefits

- Zero-trust data protection
- Compliance with GDPR, HIPAA, PCI-DSS
- Defense in depth — encryption at rest AND in the client`,
    tags: ["mongodb", "csfle", "encryption", "security"],
    notebookId: "learning",
  },
  {
    title: "React Hooks Best Practices",
    markdown: `# React Hooks Best Practices

Hooks changed how we write React components. Here are patterns I've found effective.

## Custom Hooks

Extract reusable logic into custom hooks. A custom hook is just a function that calls other hooks.

\`\`\`tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
\`\`\`

## useCallback and useMemo

Don't wrap everything — only memoize when:
- Passing callbacks to optimized child components
- Computing expensive derived values
- The function is a dependency of another hook

## State Management

- **useState** for simple, component-local state
- **useReducer** for complex state logic
- **Zustand/Jotai** for shared state (simpler than Redux)
- **React Query** for server state

## Common Pitfalls

1. Missing dependency arrays in useEffect
2. Stale closures from outdated references
3. Infinite re-render loops from object/array dependencies
4. Not cleaning up effects (timers, subscriptions, event listeners)`,
    tags: ["react", "hooks", "javascript", "best-practices"],
    notebookId: "work",
  },
  {
    title: "TypeScript Utility Types Cheat Sheet",
    markdown: `# TypeScript Utility Types Cheat Sheet

TypeScript provides several utility types for common type transformations.

## Partial<T>
Makes all properties optional.
\`\`\`typescript
type User = { name: string; age: number; };
type PartialUser = Partial<User>;
// { name?: string; age?: number; }
\`\`\`

## Required<T>
Makes all properties required (opposite of Partial).

## Pick<T, K>
Creates a type with only the specified properties.
\`\`\`typescript
type UserName = Pick<User, 'name'>;
// { name: string; }
\`\`\`

## Omit<T, K>
Creates a type without the specified properties.
\`\`\`typescript
type UserWithoutAge = Omit<User, 'age'>;
// { name: string; }
\`\`\`

## Record<K, V>
Creates a type with keys of type K and values of type V.
\`\`\`typescript
type PageInfo = Record<string, { title: string; url: string }>;
\`\`\`

## Readonly<T>
Makes all properties readonly.

## ReturnType<T>
Extracts the return type of a function type.
\`\`\`typescript
function getUser() { return { name: "Alice", age: 30 }; }
type UserReturn = ReturnType<typeof getUser>;
\`\`\`

## Extract and Exclude
Filter union types:
\`\`\`typescript
type T = Extract<"a" | "b" | "c", "a" | "f">; // "a"
type U = Exclude<"a" | "b" | "c", "a">; // "b" | "c"
\`\`\``,
    tags: ["typescript", "types", "cheat-sheet"],
    notebookId: "learning",
  },
  {
    title: "Building REST APIs with Express",
    markdown: `# Building REST APIs with Express

Express.js remains the most popular Node.js web framework. Here's a structured approach to building APIs.

## Project Structure

\`\`\`
src/
  routes/       # Route definitions
  services/     # Business logic
  middleware/   # Auth, validation, error handling
  db/           # Database connection + queries
  types/        # TypeScript interfaces
  index.ts      # App entry point
\`\`\`

## Route Pattern

\`\`\`typescript
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await itemService.list();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

export default router;
\`\`\`

## Error Handling

Always use a global error handler middleware:

\`\`\`typescript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});
\`\`\`

## Middleware Order Matters

1. CORS
2. Body parsing
3. Authentication
4. Routes
5. Error handler (always last)

## Tips

- Use \`express.json()\` with a size limit
- Set proper CORS origins (don't use \`*\` in production)
- Validate request bodies with Zod or Joi
- Use helmet for security headers`,
    tags: ["express", "nodejs", "api", "rest"],
    notebookId: "work",
  },
  {
    title: "Git Workflow: Conventional Commits",
    markdown: `# Git Workflow: Conventional Commits

Conventional Commits is a specification for adding structured meaning to commit messages.

## Format

\`\`\`
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
\`\`\`

## Types

| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| style | Formatting, missing semicolons |
| refactor | Code change that neither fixes nor adds |
| perf | Performance improvement |
| test | Adding missing tests |
| chore | Maintenance tasks |
| ci | CI configuration changes |

## Examples

\`\`\`
feat(auth): add OAuth2 login with Google
fix(api): handle null response from payment gateway
docs: update API documentation for v2 endpoints
refactor!: drop support for Node 14
\`\`\`

## Why Use It?

- Automatically generate changelogs
- Determine semantic version bumps
- Communicate the nature of changes to teammates
- Trigger CI/CD pipelines based on commit type

## Tools

- **commitlint**: Lint commit messages
- **husky**: Git hooks made easy
- **standard-version**: Automate versioning and changelog`,
    tags: ["git", "workflow", "conventions"],
    notebookId: "work",
  },
  {
    title: "Tauri v2: Building Desktop Apps with Web Tech",
    markdown: `# Tauri v2: Building Desktop Apps with Web Tech

Tauri is a toolkit for building desktop applications using web technologies for the frontend and Rust for the backend. Version 2 brings major improvements.

## Why Tauri over Electron?

- **Smaller binaries**: ~10MB vs ~150MB for Electron
- **Lower memory usage**: Uses the OS webview, not bundled Chromium
- **Better security**: Rust backend, permissions-based API access
- **Faster startup**: No Chromium to initialize

## Architecture

\`\`\`
┌──────────────────────┐
│   Webview (Frontend) │  ← HTML/CSS/JS (React, Vue, etc.)
├──────────────────────┤
│   Tauri Core (Rust)  │  ← System APIs, file access, etc.
├──────────────────────┤
│   Operating System   │
└──────────────────────┘
\`\`\`

## What's New in v2

- **Mobile support**: iOS and Android targets
- **Plugin system**: Modular, composable architecture
- **Capabilities**: Fine-grained permission system
- **Multi-window**: Better multi-window management
- **IPC improvements**: Typed commands, events, and channels

## Getting Started

\`\`\`bash
npm create tauri-app@latest
\`\`\`

Choose your frontend framework (React, Vue, Svelte, etc.) and start building. The dev experience is smooth — hot reload works for both the web frontend and Rust backend.`,
    tags: ["tauri", "desktop", "rust", "electron-alternative"],
    notebookId: "learning",
  },
  {
    title: "CSS Grid vs Flexbox: When to Use What",
    markdown: `# CSS Grid vs Flexbox: When to Use What

Both CSS Grid and Flexbox are powerful layout systems, but they excel in different scenarios.

## Flexbox: One-Dimensional Layout

Use Flexbox when you're arranging items in a single row or column.

\`\`\`css
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spacer { flex: 1; }
\`\`\`

**Best for:** Navigation bars, toolbars, card rows, centering content, distributing space.

## Grid: Two-Dimensional Layout

Use Grid when you need control over both rows and columns simultaneously.

\`\`\`css
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr 300px;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  height: 100vh;
}
\`\`\`

**Best for:** Page layouts, dashboards, card grids, form layouts, any 2D arrangement.

## They Work Together

The best layouts often combine both:

\`\`\`css
/* Grid for page layout */
.page { display: grid; grid-template-columns: 1fr 3fr; }

/* Flexbox for components within grid areas */
.sidebar { display: flex; flex-direction: column; }
.header { display: flex; justify-content: space-between; }
\`\`\`

## Quick Decision

- Laying out items in a line? → **Flexbox**
- Laying out items in a grid? → **Grid**
- Not sure? → Start with Flexbox, switch to Grid if you need 2D control`,
    tags: ["css", "layout", "flexbox", "grid"],
    notebookId: "learning",
  },
  {
    title: "MongoDB Change Streams for Real-Time Data",
    markdown: `# MongoDB Change Streams for Real-Time Data

Change Streams allow applications to access real-time data changes without polling. They're built on top of the oplog.

## Basic Usage

\`\`\`javascript
const changeStream = collection.watch();

changeStream.on('change', (change) => {
  console.log('Change detected:', change.operationType);
  console.log('Document:', change.fullDocument);
});
\`\`\`

## Operation Types

- \`insert\` — New document added
- \`update\` — Document modified
- \`replace\` — Document replaced
- \`delete\` — Document removed
- \`drop\` — Collection dropped
- \`invalidate\` — Change stream invalidated

## Filtering Changes

Use an aggregation pipeline to filter:

\`\`\`javascript
const pipeline = [
  { $match: {
    operationType: { $in: ['insert', 'update'] },
    'fullDocument.status': 'urgent'
  }}
];

const changeStream = collection.watch(pipeline);
\`\`\`

## Resume Tokens

Change streams are resumable. Store the resume token to pick up where you left off after a restart:

\`\`\`javascript
const token = change._id;
// Later...
const stream = collection.watch([], { resumeAfter: token });
\`\`\`

## Use Cases

- Real-time notifications
- Cache invalidation
- Data synchronization between services
- Audit logging
- Triggering workflows on data changes`,
    tags: ["mongodb", "change-streams", "real-time", "events"],
    notebookId: "learning",
  },
  {
    title: "Docker Compose for Development",
    markdown: `# Docker Compose for Development

Docker Compose simplifies multi-container development environments. Define your entire stack in a single YAML file.

## Basic Structure

\`\`\`yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/myapp
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
\`\`\`

## Useful Commands

\`\`\`bash
docker compose up -d          # Start in background
docker compose logs -f app    # Follow logs
docker compose exec app bash  # Shell into container
docker compose down -v        # Stop and remove volumes
\`\`\`

## Tips for Development

1. **Volume mount your source code** for hot reload
2. **Exclude node_modules** with a named volume
3. **Use depends_on** with health checks for startup order
4. **Define profiles** for optional services (like monitoring)

## Health Checks

\`\`\`yaml
mongo:
  image: mongo:7
  healthcheck:
    test: mongosh --eval "db.adminCommand('ping')"
    interval: 10s
    timeout: 5s
    retries: 3
\`\`\``,
    tags: ["docker", "compose", "development", "devops"],
    notebookId: "work",
  },
  {
    title: "Zustand: Lightweight State Management",
    markdown: `# Zustand: Lightweight State Management

Zustand is a small, fast state management library for React. It's simpler than Redux while being just as powerful for most use cases.

## Creating a Store

\`\`\`typescript
import { create } from 'zustand';

interface BearStore {
  bears: number;
  increase: () => void;
  reset: () => void;
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}));
\`\`\`

## Using in Components

\`\`\`tsx
function BearCounter() {
  const bears = useBearStore((state) => state.bears);
  return <h1>{bears} bears</h1>;
}

function Controls() {
  const increase = useBearStore((state) => state.increase);
  return <button onClick={increase}>Add bear</button>;
}
\`\`\`

## Why Zustand?

- **No providers**: No wrapping your app in context providers
- **Selective subscriptions**: Components only re-render when their selected state changes
- **TypeScript-first**: Excellent type inference
- **Middleware**: persist, devtools, immer integration
- **Tiny**: ~1KB gzipped

## Async Actions

\`\`\`typescript
const useStore = create((set) => ({
  data: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    const data = await fetchData();
    set({ data, loading: false });
  },
}));
\`\`\``,
    tags: ["react", "zustand", "state-management", "typescript"],
    notebookId: "learning",
  },
  {
    title: "MongoDB Schema Design Patterns",
    markdown: `# MongoDB Schema Design Patterns

Schema design in MongoDB is fundamentally different from relational databases. The key principle: **model your data for how your application accesses it**.

## Embedding vs Referencing

### Embed When:
- Data is accessed together (one-to-few relationships)
- Child data doesn't make sense without the parent
- Data is relatively static

### Reference When:
- Data is accessed independently
- Many-to-many relationships
- Data grows unboundedly

## Common Patterns

### Subset Pattern
Store frequently accessed data in the main document, full data in a separate collection.

\`\`\`javascript
// Product document (fast reads)
{
  name: "Widget",
  price: 9.99,
  reviews_summary: { avg: 4.5, count: 128 },
  recent_reviews: [ /* last 10 reviews */ ]
}

// Reviews collection (full history)
{ product_id: ObjectId("..."), text: "Great!", rating: 5 }
\`\`\`

### Bucket Pattern
Group related time-series data into "buckets" to reduce document count.

### Computed Pattern
Pre-compute values (sums, averages, counts) on write to avoid expensive reads.

### Polymorphic Pattern
Store documents with different shapes in the same collection, using a discriminator field.

\`\`\`javascript
{ type: "book", title: "...", author: "...", isbn: "..." }
{ type: "movie", title: "...", director: "...", runtime: 120 }
\`\`\`

## Anti-Patterns to Avoid

- Unbounded array growth
- Massive documents (>16MB limit)
- Normalizing everything like a relational DB
- Using ObjectId strings instead of ObjectId types`,
    tags: ["mongodb", "schema-design", "patterns", "data-modeling"],
    notebookId: "learning",
  },
  {
    title: "Keyboard-Driven Development Setup",
    markdown: `# Keyboard-Driven Development Setup

Maximizing keyboard usage dramatically improves development speed. Here's my setup.

## Editor: VS Code / Neovim

### Essential VS Code Shortcuts
| Shortcut | Action |
|----------|--------|
| Cmd+P | Quick file open |
| Cmd+Shift+P | Command palette |
| Cmd+D | Select next occurrence |
| Cmd+Shift+L | Select all occurrences |
| Cmd+B | Toggle sidebar |
| Ctrl+\` | Toggle terminal |
| Cmd+K Cmd+S | Open keyboard shortcuts |

## Terminal: Warp / iTerm2 + zsh

### Aliases
\`\`\`bash
alias g="git"
alias gc="git commit"
alias gp="git push"
alias gco="git checkout"
alias gs="git status"
alias ll="ls -la"
alias dc="docker compose"
\`\`\`

## Window Management

**Raycast** (macOS) or **i3** (Linux) for window tiling:
- Hyper+H/L: Move window left/right half
- Hyper+F: Fullscreen
- Hyper+1-9: Switch spaces

## Browser

- Cmd+L: Focus URL bar
- Cmd+T: New tab
- Cmd+W: Close tab
- Cmd+Shift+T: Reopen closed tab

## Philosophy

The goal isn't to never touch the mouse — it's to minimize context switches. Every time you reach for the mouse, you break flow. Build muscle memory incrementally: learn 2-3 new shortcuts per week.`,
    tags: ["productivity", "keyboard", "workflow", "tools"],
    notebookId: "personal",
  },
  {
    title: "Understanding JWT Authentication",
    markdown: `# Understanding JWT Authentication

JSON Web Tokens (JWT) are a compact, URL-safe way to represent claims between two parties.

## Structure

A JWT has three parts separated by dots:

\`\`\`
header.payload.signature
\`\`\`

### Header
\`\`\`json
{ "alg": "HS256", "typ": "JWT" }
\`\`\`

### Payload
\`\`\`json
{
  "sub": "user123",
  "name": "Alice",
  "iat": 1700000000,
  "exp": 1700086400
}
\`\`\`

### Signature
\`\`\`
HMACSHA256(base64(header) + "." + base64(payload), secret)
\`\`\`

## Auth Flow

1. User sends credentials to login endpoint
2. Server validates, creates JWT, returns it
3. Client stores JWT (memory > httpOnly cookie > localStorage)
4. Client sends JWT in Authorization header: \`Bearer <token>\`
5. Server verifies signature and checks expiration

## Access + Refresh Token Pattern

- **Access token**: Short-lived (15 min), used for API requests
- **Refresh token**: Long-lived (7 days), stored securely, used to get new access tokens

## Security Considerations

- Always verify the signature on the server
- Check the \`exp\` claim
- Use HTTPS only
- Don't store sensitive data in the payload (it's only base64 encoded, not encrypted)
- Prefer httpOnly cookies over localStorage to prevent XSS
- Implement token revocation for logout`,
    tags: ["security", "jwt", "authentication", "nodejs"],
    notebookId: "work",
  },
  {
    title: "Performance Monitoring with MongoDB Atlas",
    markdown: `# Performance Monitoring with MongoDB Atlas

Atlas provides built-in monitoring tools that help you understand and optimize your database performance.

## Real-Time Performance Panel

The Performance Tab shows live metrics:
- Operations per second (reads, writes, commands)
- Active connections
- Network I/O
- Query targeting ratio

## Performance Advisor

Atlas automatically analyzes your query patterns and suggests indexes:
- Identifies slow queries
- Recommends optimal indexes
- Shows the impact of adding suggested indexes

## Profiler

The Query Profiler captures slow operations:

\`\`\`javascript
// Programmatic equivalent
db.setProfilingLevel(1, { slowms: 100 });
db.system.profile.find().sort({ ts: -1 }).limit(5);
\`\`\`

## Key Metrics to Watch

1. **Query Targeting**: Ratio of documents examined to returned. Ideal: close to 1.0
2. **Opcounters**: Track operation distribution
3. **Connections**: Monitor connection pool usage
4. **Replication Lag**: Important for read preferences
5. **Disk IOPS**: Storage performance

## Alerts

Set up alerts for:
- High CPU utilization (>80%)
- Connections approaching limit
- Replication lag exceeding threshold
- Disk usage nearing capacity

Atlas integrates with PagerDuty, Slack, email, and webhooks for alert notifications.`,
    tags: ["mongodb", "atlas", "monitoring", "performance"],
    notebookId: "work",
  },
];

async function main() {
  if (!uri) {
    console.error("MONGODB_URI is required in .env");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // Clear existing notes
    await db.collection("notes").deleteMany({});
    console.log("Cleared existing notes");

    // Insert seed notes
    const now = new Date();
    const notesWithDates = sampleNotes.map((note, i) => ({
      ...note,
      createdAt: new Date(now.getTime() - i * 3600000), // 1 hour apart
      updatedAt: new Date(now.getTime() - i * 1800000), // 30 min apart
    }));

    const result = await db.collection("notes").insertMany(notesWithDates);
    console.log(`Inserted ${result.insertedCount} sample notes`);

    // Generate embeddings if OpenAI key is available
    if (process.env.OPENAI_API_KEY) {
      console.log("\nGenerating embeddings (this may take a moment)...");
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const ids = Object.values(result.insertedIds);
      for (let i = 0; i < notesWithDates.length; i++) {
        const note = notesWithDates[i];
        const text = [note.title, note.markdown, note.tags.join(", ")]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 8000);

        try {
          const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
          });

          await db
            .collection("notes")
            .updateOne(
              { _id: ids[i] },
              { $set: { embedding: response.data[0].embedding } },
            );

          process.stdout.write(`  ✓ ${note.title}\n`);
        } catch (err) {
          console.error(`  ✗ Failed to embed: ${note.title}`, err);
        }
      }
      console.log("Embeddings generated!");
    } else {
      console.log(
        "\nSkipping embedding generation (OPENAI_API_KEY not set)",
      );
    }

    console.log("\nSeed complete!");
  } finally {
    await client.close();
  }
}

main().catch(console.error);
