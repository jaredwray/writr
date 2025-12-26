export const benchmarkContents: string[] = [
	// Blog posts (1-30)
	`---
title: "Getting Started with TypeScript"
date: "2024-01-15"
author: "Alex Johnson"
categories:
  - "TypeScript"
  - "Programming"
tags:
  - "beginner"
  - "tutorial"
---

# Getting Started with TypeScript

TypeScript is a strongly typed programming language that builds on JavaScript.

## Why TypeScript?

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Enhanced autocomplete and refactoring
- **Modern Features**: Use the latest JavaScript features

## Installation

\`\`\`bash
npm install -g typescript
\`\`\`

## Your First Program

\`\`\`typescript
function greet(name: string): string {
    return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`
`,

	`---
title: "Understanding React Hooks"
date: "2024-02-20"
author: "Sarah Chen"
categories:
  - "React"
  - "JavaScript"
tags:
  - "hooks"
  - "useState"
  - "useEffect"
---

# Understanding React Hooks

React Hooks revolutionized how we write components.

## useState

The most basic hook for managing state:

\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

## useEffect

For side effects in your components:

\`\`\`javascript
useEffect(() => {
    document.title = \`Count: \${count}\`;
}, [count]);
\`\`\`

> "Hooks let you use state and other React features without writing a class."
`,

	`---
title: "CSS Grid Layout Complete Guide"
date: "2024-03-10"
author: "Maria Garcia"
categories:
  - "CSS"
  - "Web Design"
---

# CSS Grid Layout Complete Guide

CSS Grid is a two-dimensional layout system.

## Basic Grid

\`\`\`css
.container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}
\`\`\`

## Grid Areas

\`\`\`css
.container {
    grid-template-areas:
        "header header header"
        "sidebar main main"
        "footer footer footer";
}
\`\`\`

### Key Benefits

1. Two-dimensional control
2. Simplified responsive design
3. No more float hacks
`,

	`---
title: "Node.js Best Practices"
date: "2024-04-05"
author: "David Kim"
tags:
  - "nodejs"
  - "backend"
  - "best-practices"
---

# Node.js Best Practices

Building scalable Node.js applications requires following best practices.

## Error Handling

Always handle errors properly:

\`\`\`javascript
async function fetchData() {
    try {
        const data = await api.get('/users');
        return data;
    } catch (error) {
        logger.error('Failed to fetch users', error);
        throw new AppError('User fetch failed', 500);
    }
}
\`\`\`

## Environment Variables

Never hardcode secrets:

\`\`\`javascript
const config = {
    port: process.env.PORT || 3000,
    dbUrl: process.env.DATABASE_URL
};
\`\`\`
`,

	`---
title: "Introduction to Docker"
date: "2024-05-12"
author: "Emma Wilson"
categories:
  - "DevOps"
  - "Containers"
---

# Introduction to Docker

Docker simplifies application deployment through containerization.

## Dockerfile Example

\`\`\`dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## Common Commands

- \`docker build -t myapp .\` - Build an image
- \`docker run -p 3000:3000 myapp\` - Run a container
- \`docker ps\` - List running containers

> Containers are lightweight, standalone, executable packages.
`,

	`---
title: "GraphQL vs REST API"
date: "2024-06-08"
author: "James Brown"
tags:
  - "api"
  - "graphql"
  - "rest"
---

# GraphQL vs REST API

Understanding when to use each approach.

## REST API

\`\`\`javascript
// Multiple endpoints
GET /users/1
GET /users/1/posts
GET /users/1/followers
\`\`\`

## GraphQL

\`\`\`graphql
query {
    user(id: 1) {
        name
        posts {
            title
        }
        followers {
            name
        }
    }
}
\`\`\`

### Comparison Table

| Feature | REST | GraphQL |
|---------|------|---------|
| Endpoints | Multiple | Single |
| Over-fetching | Common | Avoided |
| Learning Curve | Low | Medium |
`,

	`---
title: "Python for Data Science"
date: "2024-07-14"
author: "Lisa Zhang"
categories:
  - "Python"
  - "Data Science"
---

# Python for Data Science

Python is the leading language for data science.

## Essential Libraries

- **NumPy**: Numerical computing
- **Pandas**: Data manipulation
- **Matplotlib**: Visualization

## Quick Example

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv')
df.groupby('category').sum().plot(kind='bar')
plt.show()
\`\`\`

## Data Analysis Workflow

1. Load and clean data
2. Explore and visualize
3. Build models
4. Interpret results
`,

	`---
title: "Kubernetes for Beginners"
date: "2024-08-20"
author: "Michael Lee"
tags:
  - "kubernetes"
  - "k8s"
  - "devops"
---

# Kubernetes for Beginners

Kubernetes orchestrates containerized applications at scale.

## Key Concepts

- **Pod**: Smallest deployable unit
- **Service**: Stable network endpoint
- **Deployment**: Manages replica sets

## Sample Deployment

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: my-app:1.0
        ports:
        - containerPort: 80
\`\`\`
`,

	`---
title: "Machine Learning Fundamentals"
date: "2024-09-05"
author: "Rachel Adams"
categories:
  - "AI"
  - "Machine Learning"
---

# Machine Learning Fundamentals

Understanding the basics of ML algorithms.

## Types of Learning

1. **Supervised Learning**: Labeled data
2. **Unsupervised Learning**: Pattern discovery
3. **Reinforcement Learning**: Reward-based

## Simple Classification

\`\`\`python
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)
predictions = model.predict(X_test)
\`\`\`

> "Machine learning is the science of getting computers to act without being explicitly programmed." - Andrew Ng
`,

	`---
title: "Vue 3 Composition API"
date: "2024-10-01"
author: "Sophie Martin"
tags:
  - "vue"
  - "javascript"
  - "frontend"
---

# Vue 3 Composition API

The Composition API provides better code organization.

## Setup Function

\`\`\`javascript
import { ref, computed, onMounted } from 'vue';

export default {
    setup() {
        const count = ref(0);
        const doubled = computed(() => count.value * 2);

        onMounted(() => {
            console.log('Component mounted');
        });

        return { count, doubled };
    }
};
\`\`\`

## Composables

Extract reusable logic into composable functions:

\`\`\`javascript
function useCounter() {
    const count = ref(0);
    const increment = () => count.value++;
    return { count, increment };
}
\`\`\`
`,

	`---
title: "Building REST APIs with Go"
date: "2024-10-15"
author: "Kevin O'Brien"
categories:
  - "Go"
  - "Backend"
---

# Building REST APIs with Go

Go is excellent for building high-performance APIs.

## Simple HTTP Server

\`\`\`go
package main

import (
    "encoding/json"
    "net/http"
)

type User struct {
    ID   int    \`json:"id"\`
    Name string \`json:"name"\`
}

func getUsers(w http.ResponseWriter, r *http.Request) {
    users := []User{{1, "Alice"}, {2, "Bob"}}
    json.NewEncoder(w).Encode(users)
}

func main() {
    http.HandleFunc("/users", getUsers)
    http.ListenAndServe(":8080", nil)
}
\`\`\`
`,

	`---
title: "Git Workflow Strategies"
date: "2024-11-01"
author: "Tom Anderson"
tags:
  - "git"
  - "version-control"
---

# Git Workflow Strategies

Choosing the right Git workflow for your team.

## Git Flow

- **main**: Production code
- **develop**: Integration branch
- **feature/***: New features
- **release/***: Release preparation
- **hotfix/***: Emergency fixes

## Common Commands

\`\`\`bash
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
\`\`\`

## Branch Naming

- \`feature/user-authentication\`
- \`bugfix/login-error\`
- \`hotfix/security-patch\`
`,

	`---
title: "Web Security Essentials"
date: "2024-11-15"
author: "Nina Patel"
categories:
  - "Security"
  - "Web Development"
---

# Web Security Essentials

Protecting your web applications from common threats.

## OWASP Top 10

1. Injection attacks
2. Broken authentication
3. Sensitive data exposure
4. XML external entities
5. Broken access control

## Preventing XSS

\`\`\`javascript
// Bad - vulnerable to XSS
element.innerHTML = userInput;

// Good - safe
element.textContent = userInput;
\`\`\`

## Security Headers

\`\`\`
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
\`\`\`
`,

	`---
title: "AWS Lambda Functions"
date: "2024-12-01"
author: "Chris Taylor"
tags:
  - "aws"
  - "serverless"
  - "lambda"
---

# AWS Lambda Functions

Serverless computing with AWS Lambda.

## Handler Function

\`\`\`javascript
exports.handler = async (event) => {
    const name = event.queryStringParameters?.name || 'World';

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: \`Hello, \${name}!\`
        })
    };
};
\`\`\`

## Benefits

- **No servers to manage**
- **Automatic scaling**
- **Pay per execution**
- **Built-in high availability**
`,

	`---
title: "Testing with Jest"
date: "2024-12-15"
author: "Amy Roberts"
categories:
  - "Testing"
  - "JavaScript"
---

# Testing with Jest

Writing effective tests with Jest.

## Basic Test

\`\`\`javascript
describe('Calculator', () => {
    test('adds two numbers', () => {
        expect(add(2, 3)).toBe(5);
    });

    test('handles negative numbers', () => {
        expect(add(-1, 1)).toBe(0);
    });
});
\`\`\`

## Mocking

\`\`\`javascript
jest.mock('./api');

test('fetches user data', async () => {
    api.getUser.mockResolvedValue({ name: 'John' });
    const user = await fetchUser(1);
    expect(user.name).toBe('John');
});
\`\`\`
`,

	`---
title: "Microservices Architecture"
date: "2025-01-05"
author: "Daniel White"
tags:
  - "architecture"
  - "microservices"
---

# Microservices Architecture

Building scalable distributed systems.

## Key Principles

- **Single Responsibility**: Each service does one thing well
- **Loose Coupling**: Services are independent
- **Autonomous**: Teams can deploy independently

## Communication Patterns

### Synchronous
\`\`\`
Service A --HTTP--> Service B
\`\`\`

### Asynchronous
\`\`\`
Service A --Message Queue--> Service B
\`\`\`

## Challenges

1. Distributed tracing
2. Data consistency
3. Service discovery
4. Network latency
`,

	`---
title: "PostgreSQL Performance Tips"
date: "2025-01-15"
author: "Julia Martinez"
categories:
  - "Database"
  - "PostgreSQL"
---

# PostgreSQL Performance Tips

Optimizing your PostgreSQL database.

## Indexing

\`\`\`sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_date ON orders(created_at DESC);
\`\`\`

## Query Optimization

\`\`\`sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 123
AND created_at > '2024-01-01';
\`\`\`

## Connection Pooling

Use PgBouncer for connection pooling:

- Reduces connection overhead
- Handles more concurrent clients
- Improves response times
`,

	`---
title: "Redux Toolkit Guide"
date: "2025-02-01"
author: "Mark Thompson"
tags:
  - "redux"
  - "react"
  - "state-management"
---

# Redux Toolkit Guide

Modern Redux with Redux Toolkit.

## Creating a Slice

\`\`\`javascript
import { createSlice } from '@reduxjs/toolkit';

const counterSlice = createSlice({
    name: 'counter',
    initialState: { value: 0 },
    reducers: {
        increment: state => { state.value += 1 },
        decrement: state => { state.value -= 1 },
        incrementByAmount: (state, action) => {
            state.value += action.payload;
        }
    }
});

export const { increment, decrement } = counterSlice.actions;
export default counterSlice.reducer;
\`\`\`
`,

	`---
title: "MongoDB Aggregation Pipeline"
date: "2025-02-15"
author: "Olivia Brown"
categories:
  - "MongoDB"
  - "Database"
---

# MongoDB Aggregation Pipeline

Powerful data processing with aggregation.

## Pipeline Stages

\`\`\`javascript
db.orders.aggregate([
    { $match: { status: 'completed' } },
    { $group: {
        _id: '$customerId',
        totalSpent: { $sum: '$amount' },
        orderCount: { $sum: 1 }
    }},
    { $sort: { totalSpent: -1 } },
    { $limit: 10 }
]);
\`\`\`

## Common Operators

- \`$match\`: Filter documents
- \`$group\`: Group by field
- \`$project\`: Reshape documents
- \`$lookup\`: Join collections
`,

	`---
title: "WebSocket Real-time Apps"
date: "2025-03-01"
author: "Ryan Scott"
tags:
  - "websocket"
  - "real-time"
  - "javascript"
---

# WebSocket Real-time Apps

Building real-time applications with WebSockets.

## Server Side (Node.js)

\`\`\`javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Broadcast to all clients
        wss.clients.forEach(client => {
            client.send(message);
        });
    });
});
\`\`\`

## Client Side

\`\`\`javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
    console.log('Received:', event.data);
};

ws.send('Hello Server!');
\`\`\`
`,

	`---
title: "Tailwind CSS Tips"
date: "2025-03-15"
author: "Hannah Green"
categories:
  - "CSS"
  - "Tailwind"
---

# Tailwind CSS Tips

Mastering utility-first CSS with Tailwind.

## Responsive Design

\`\`\`html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div class="p-4 bg-white rounded-lg shadow">Card 1</div>
    <div class="p-4 bg-white rounded-lg shadow">Card 2</div>
    <div class="p-4 bg-white rounded-lg shadow">Card 3</div>
</div>
\`\`\`

## Custom Configurations

\`\`\`javascript
// tailwind.config.js
module.exports = {
    theme: {
        extend: {
            colors: {
                brand: '#5c6ac4'
            }
        }
    }
};
\`\`\`
`,

	`---
title: "Clean Code Principles"
date: "2025-04-01"
author: "Steve Miller"
tags:
  - "clean-code"
  - "best-practices"
---

# Clean Code Principles

Writing maintainable, readable code.

## Naming Conventions

\`\`\`javascript
// Bad
const d = new Date();
const x = users.filter(u => u.a > 18);

// Good
const currentDate = new Date();
const adultUsers = users.filter(user => user.age > 18);
\`\`\`

## Single Responsibility

Each function should do one thing:

\`\`\`javascript
// Bad - does too much
function processUser(user) {
    validateUser(user);
    saveToDatabase(user);
    sendEmail(user);
}

// Good - single responsibility
function saveUser(user) {
    return database.save(user);
}
\`\`\`
`,

	`---
title: "CI/CD with GitHub Actions"
date: "2025-04-15"
author: "Emily Davis"
categories:
  - "DevOps"
  - "CI/CD"
---

# CI/CD with GitHub Actions

Automating your development workflow.

## Basic Workflow

\`\`\`yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
\`\`\`

## Deployment

Add deployment steps after successful build and test.
`,

	`---
title: "Next.js App Router"
date: "2025-05-01"
author: "Jason Clark"
tags:
  - "nextjs"
  - "react"
  - "fullstack"
---

# Next.js App Router

The new App Router in Next.js 13+.

## File-based Routing

\`\`\`
app/
  page.tsx          # /
  about/
    page.tsx        # /about
  blog/
    [slug]/
      page.tsx      # /blog/:slug
\`\`\`

## Server Components

\`\`\`typescript
async function BlogPage({ params }: { params: { slug: string } }) {
    const post = await getPost(params.slug);

    return (
        <article>
            <h1>{post.title}</h1>
            <div>{post.content}</div>
        </article>
    );
}

export default BlogPage;
\`\`\`
`,

	`---
title: "Error Handling Patterns"
date: "2025-05-15"
author: "Laura Wilson"
categories:
  - "Programming"
  - "Best Practices"
---

# Error Handling Patterns

Robust error handling strategies.

## Custom Error Classes

\`\`\`typescript
class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public isOperational = true
    ) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends AppError {
    constructor(resource: string) {
        super(\`\${resource} not found\`, 404);
    }
}
\`\`\`

## Global Error Handler

\`\`\`javascript
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});
\`\`\`
`,

	`---
title: "Rust for Systems Programming"
date: "2025-06-01"
author: "Peter Hansen"
tags:
  - "rust"
  - "systems"
---

# Rust for Systems Programming

Memory safety without garbage collection.

## Ownership

\`\`\`rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is moved to s2
    // println!("{}", s1); // Error: s1 no longer valid
    println!("{}", s2); // Works!
}
\`\`\`

## Borrowing

\`\`\`rust
fn calculate_length(s: &String) -> usize {
    s.len()
}

fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);
    println!("Length of '{}' is {}", s, len);
}
\`\`\`
`,

	`---
title: "OAuth 2.0 Implementation"
date: "2025-06-15"
author: "Michelle Lee"
categories:
  - "Security"
  - "Authentication"
---

# OAuth 2.0 Implementation

Secure authorization for your applications.

## Authorization Code Flow

1. User clicks "Login with Google"
2. Redirect to authorization server
3. User grants permission
4. Receive authorization code
5. Exchange code for tokens

## Token Exchange

\`\`\`javascript
const response = await fetch('https://oauth.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        grant_type: 'authorization_code',
        code: authorizationCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
    })
});

const { access_token, refresh_token } = await response.json();
\`\`\`
`,

	`---
title: "Functional Programming in JS"
date: "2025-07-01"
author: "Andrew Park"
tags:
  - "functional"
  - "javascript"
---

# Functional Programming in JS

Embracing functional paradigms in JavaScript.

## Pure Functions

\`\`\`javascript
// Pure - same input always gives same output
const add = (a, b) => a + b;

// Impure - depends on external state
let total = 0;
const addToTotal = (x) => total += x;
\`\`\`

## Composition

\`\`\`javascript
const compose = (...fns) => (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

const addOne = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const transform = compose(square, double, addOne);
console.log(transform(2)); // 36
\`\`\`
`,

	`---
title: "Svelte Basics"
date: "2025-07-15"
author: "Karen White"
categories:
  - "Svelte"
  - "Frontend"
---

# Svelte Basics

A compiler-based approach to UI.

## Reactive Declarations

\`\`\`svelte
<script>
    let count = 0;
    $: doubled = count * 2;
    $: if (count > 10) {
        alert('Count is getting high!');
    }
</script>

<button on:click={() => count++}>
    Clicked {count} times
</button>
<p>Doubled: {doubled}</p>
\`\`\`

## Stores

\`\`\`javascript
import { writable } from 'svelte/store';

export const count = writable(0);

// In component
$count // Auto-subscribe with $ prefix
\`\`\`
`,

	`---
title: "API Rate Limiting"
date: "2025-08-01"
author: "Brian Moore"
tags:
  - "api"
  - "security"
  - "nodejs"
---

# API Rate Limiting

Protecting your APIs from abuse.

## Token Bucket Algorithm

\`\`\`javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', limiter);
\`\`\`

## Response Headers

\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
\`\`\`
`,

	// Product pages (31-50)
	`---
title: "Pro Wireless Headphones"
product_id: "HP-PRO-001"
price: 299.99
availability: "In Stock"
rating: 4.8
categories:
  - "Electronics"
  - "Audio"
---

# Pro Wireless Headphones

## Overview

Experience premium sound quality with our Pro Wireless Headphones. Featuring active noise cancellation and 40-hour battery life.

## Features

- **Active Noise Cancellation**: Block out distractions
- **40-Hour Battery**: All-day listening
- **Premium Drivers**: 40mm custom drivers
- **Comfortable Fit**: Memory foam ear cushions

## Specifications

| Spec | Value |
|------|-------|
| Driver Size | 40mm |
| Frequency | 20Hz - 20kHz |
| Battery | 40 hours |
| Weight | 250g |

## Price

**$299.99** with free shipping

> "Best headphones I've ever owned!" — *Verified Buyer*
`,

	`---
title: "Ultra-Light Laptop Stand"
product_id: "LS-UL-002"
price: 49.99
availability: "In Stock"
featured: true
---

# Ultra-Light Laptop Stand

## Description

The **Ultra-Light Laptop Stand** elevates your laptop to the perfect viewing angle while improving airflow.

## Benefits

- Reduces neck strain
- Improves laptop cooling
- Portable and foldable
- Fits all laptop sizes (up to 17")

## Materials

- Aerospace-grade aluminum
- Non-slip silicone pads
- Anodized finish

## What's Included

1. Laptop stand
2. Carrying pouch
3. Quick start guide

**Only $49.99** - [Buy Now](https://example.com/laptop-stand)
`,

	`---
title: "Smart Home Hub"
product_id: "SH-HUB-003"
price: 129.99
availability: "Pre-order"
categories:
  - "Smart Home"
  - "Electronics"
---

# Smart Home Hub

## Control Your Entire Home

The Smart Home Hub connects all your smart devices in one place.

## Compatible With

- Philips Hue
- Ring
- Nest
- Samsung SmartThings
- And 100+ more brands

## Voice Assistants

Works with:
- Amazon Alexa
- Google Assistant
- Apple HomeKit

## Setup

\`\`\`
1. Download the app
2. Plug in the hub
3. Scan the QR code
4. Add your devices
\`\`\`

**Pre-order now for $129.99**
`,

	`---
title: "Ergonomic Office Chair"
product_id: "CH-ERG-004"
price: 599.99
availability: "In Stock"
warranty: "10 years"
---

# Ergonomic Office Chair

## Designed for All-Day Comfort

Our Ergonomic Office Chair supports proper posture during long work sessions.

## Adjustable Features

- Lumbar support height and depth
- Armrest height, width, and angle
- Seat depth and tilt
- Headrest height and angle

## Materials

- Breathable mesh back
- High-density foam seat
- Aluminum base
- Smooth-rolling casters

## Reviews

> "My back pain is gone after switching to this chair." — *Sarah M.*

> "Worth every penny for remote workers." — *John D.*

**$599.99** | 10-Year Warranty | Free Assembly
`,

	`---
title: "4K Webcam Pro"
product_id: "WC-4K-005"
price: 179.99
availability: "In Stock"
---

# 4K Webcam Pro

## Crystal Clear Video Calls

Upgrade your video conferencing with 4K resolution and auto-focus.

## Specifications

| Feature | Detail |
|---------|--------|
| Resolution | 4K @ 30fps |
| Field of View | 90 degrees |
| Auto Focus | Yes |
| Microphone | Dual stereo |
| Mount | Universal clip |

## Perfect For

- Remote work
- Streaming
- Content creation
- Video calls

**$179.99** - Plug and play, no drivers needed
`,

	`---
title: "Mechanical Keyboard RGB"
product_id: "KB-MEC-006"
price: 149.99
availability: "In Stock"
categories:
  - "Peripherals"
  - "Gaming"
---

# Mechanical Keyboard RGB

## Type in Style

Premium mechanical switches with per-key RGB lighting.

## Switch Options

- **Blue**: Clicky and tactile
- **Red**: Linear and smooth
- **Brown**: Tactile and quiet

## Features

- Hot-swappable switches
- PBT keycaps
- Aluminum frame
- Detachable USB-C cable
- N-key rollover

## Lighting Modes

1. Static colors
2. Breathing effect
3. Rainbow wave
4. Reactive typing
5. Custom profiles

**$149.99**
`,

	`---
title: "Portable SSD 2TB"
product_id: "SSD-2TB-007"
price: 199.99
availability: "In Stock"
---

# Portable SSD 2TB

## Speed Meets Capacity

Transfer files at lightning speed with our 2TB portable SSD.

## Performance

- Read speed: up to 1050 MB/s
- Write speed: up to 1000 MB/s
- USB 3.2 Gen 2

## Durability

- Drop resistant (up to 2m)
- Shock resistant
- IP55 water resistant

## Compatibility

Works with:
- Windows
- macOS
- PlayStation 5
- Xbox Series X

**$199.99** | 5-Year Warranty
`,

	`---
title: "Smart Watch Series 5"
product_id: "SW-S5-008"
price: 399.99
availability: "In Stock"
colors:
  - "Black"
  - "Silver"
  - "Gold"
---

# Smart Watch Series 5

## Your Health Companion

Track fitness, monitor health, and stay connected.

## Health Features

- Heart rate monitoring
- Blood oxygen sensor
- ECG app
- Sleep tracking
- Stress monitoring

## Fitness Tracking

- 100+ workout types
- GPS tracking
- Water resistant (50m)
- Automatic workout detection

## Battery

- Up to 18 hours typical use
- Fast charging: 80% in 45 minutes

**$399.99** - Available in Black, Silver, and Gold
`,

	`---
title: "Wireless Charging Pad"
product_id: "WC-PAD-009"
price: 39.99
availability: "In Stock"
---

# Wireless Charging Pad

## Cut the Cord

Fast wireless charging for all Qi-enabled devices.

## Features

- 15W fast charging
- Compatible with all Qi devices
- LED indicator
- Non-slip surface
- Slim design (7mm thick)

## Compatibility

| Device | Charging Speed |
|--------|---------------|
| iPhone 15 | 15W |
| Samsung S24 | 15W |
| AirPods Pro | 5W |
| Pixel 8 | 12W |

**Only $39.99**
`,

	`---
title: "USB-C Hub 7-in-1"
product_id: "HUB-7IN1-010"
price: 59.99
availability: "In Stock"
---

# USB-C Hub 7-in-1

## Expand Your Connectivity

One cable, endless possibilities.

## Ports

1. HDMI 4K @ 60Hz
2. USB-A 3.0 x 2
3. USB-C data
4. USB-C PD 100W
5. SD card reader
6. microSD card reader

## Compatible Devices

- MacBook Pro/Air
- iPad Pro
- Windows laptops
- Chromebooks
- Steam Deck

## Build Quality

- Aluminum housing
- Braided cable
- Compact design

**$59.99** - 2 Year Warranty
`,

	`---
title: "Noise Cancelling Earbuds"
product_id: "EB-NC-011"
price: 199.99
availability: "In Stock"
---

# Noise Cancelling Earbuds

## Immersive Sound, Anywhere

Premium earbuds with adaptive noise cancellation.

## Audio Quality

- Custom 11mm drivers
- Hi-Res Audio certified
- Spatial audio support
- 3 ANC levels

## Battery Life

- Earbuds: 8 hours
- With case: 32 hours total
- 10-minute charge: 2 hours playback

## Comfort

- 3 ear tip sizes
- Lightweight design (5.4g per earbud)
- IPX4 water resistant

**$199.99** - Free leather case included
`,

	`---
title: "Smart Doorbell Camera"
product_id: "DB-CAM-012"
price: 149.99
availability: "In Stock"
---

# Smart Doorbell Camera

## See Who's at Your Door

HD video doorbell with two-way audio and motion detection.

## Features

- 1080p HD video
- 180° wide-angle lens
- Night vision
- Two-way audio
- Motion zones
- Package detection

## Smart Integration

- Works with Alexa
- Works with Google Home
- IFTTT compatible

## Installation

\`\`\`
No wiring required!
1. Charge the battery
2. Mount the doorbell
3. Connect to WiFi
4. Done!
\`\`\`

**$149.99**
`,

	`---
title: "Electric Standing Desk"
product_id: "DESK-EL-013"
price: 699.99
availability: "In Stock"
---

# Electric Standing Desk

## Work at Your Perfect Height

Motorized height adjustment for the healthiest workday.

## Specifications

| Feature | Value |
|---------|-------|
| Height Range | 28" - 48" |
| Desktop Size | 60" x 30" |
| Weight Capacity | 300 lbs |
| Motor | Dual motor |
| Speed | 1.5"/second |

## Presets

- 4 programmable heights
- One-touch adjustment
- Anti-collision system
- Memory display

## Colors

Available in:
- White frame + white top
- Black frame + walnut top
- Gray frame + bamboo top

**$699.99** - Free shipping & assembly tools
`,

	`---
title: "WiFi 6 Mesh Router"
product_id: "RT-MESH-014"
price: 299.99
availability: "In Stock"
---

# WiFi 6 Mesh Router

## Whole-Home WiFi Coverage

Eliminate dead zones with our 3-pack mesh system.

## Coverage

- Up to 6,000 sq ft
- 200+ devices
- Seamless roaming

## Speed

- WiFi 6 (802.11ax)
- Up to 5.4 Gbps
- Tri-band technology

## Security

- WPA3 encryption
- Automatic updates
- Built-in antivirus
- Parental controls

**$299.99** for 3-pack
`,

	`---
title: "4K Monitor 32-inch"
product_id: "MON-32-015"
price: 449.99
availability: "In Stock"
---

# 4K Monitor 32-inch

## Stunning Visual Clarity

Professional-grade 4K display for work and play.

## Display Specs

- Resolution: 3840 x 2160
- Panel: IPS
- Refresh: 60Hz
- Response: 5ms
- HDR400 certified

## Color Accuracy

- 99% sRGB
- 95% DCI-P3
- Factory calibrated
- Delta E < 2

## Connectivity

- HDMI 2.0 x 2
- DisplayPort 1.4
- USB-C 65W PD
- USB hub (3 ports)

**$449.99**
`,

	`---
title: "Compact Air Purifier"
product_id: "AP-COMP-016"
price: 129.99
availability: "In Stock"
---

# Compact Air Purifier

## Breathe Clean Air

HEPA filtration for rooms up to 400 sq ft.

## Filtration

- True HEPA H13 filter
- Activated carbon layer
- Pre-filter
- Captures 99.97% of particles

## Features

- 3 fan speeds
- Sleep mode (24 dB)
- Filter life indicator
- Timer function
- Auto mode with air quality sensor

## Perfect For

- Bedrooms
- Home offices
- Nurseries
- Small living rooms

**$129.99** - Replacement filters: $29.99
`,

	`---
title: "Espresso Machine Pro"
product_id: "ESP-PRO-017"
price: 799.99
availability: "In Stock"
---

# Espresso Machine Pro

## Barista-Quality at Home

Professional espresso with precision temperature control.

## Features

- 15-bar Italian pump
- PID temperature control
- Pre-infusion function
- Steam wand
- Built-in grinder

## Included Accessories

1. Single & double portafilter
2. Tamper
3. Milk pitcher
4. Cleaning kit
5. Water filter

## Capacity

- Water tank: 2.5L
- Bean hopper: 250g

> "Better than my local coffee shop!" — *Mike R.*

**$799.99** - Free 1kg coffee beans
`,

	`---
title: "Electric Bike Commuter"
product_id: "BIKE-EC-018"
price: 1499.99
availability: "Pre-order"
---

# Electric Bike Commuter

## Your New Daily Ride

Pedal-assist electric bike for urban commuting.

## Specifications

| Spec | Value |
|------|-------|
| Range | Up to 50 miles |
| Top Speed | 28 mph |
| Motor | 500W hub motor |
| Battery | 48V 14Ah |
| Weight | 55 lbs |

## Features

- 7-speed Shimano gears
- Hydraulic disc brakes
- Integrated lights
- LCD display
- USB charging port
- Removable battery

**$1,499.99** - Pre-order now, ships in 4 weeks
`,

	`---
title: "Robot Vacuum Pro"
product_id: "RV-PRO-019"
price: 599.99
availability: "In Stock"
---

# Robot Vacuum Pro

## Smart Cleaning, Zero Effort

LiDAR navigation with self-emptying base.

## Cleaning Power

- 5000Pa suction
- Multi-surface brush
- Edge cleaning mode
- Carpet detection

## Smart Features

- LiDAR mapping
- Room recognition
- No-go zones
- Schedule cleaning
- Voice control

## Self-Emptying Base

- 60-day capacity
- Auto-empty after cleaning
- HEPA filtration

**$599.99** - Includes self-emptying base
`,

	`---
title: "Premium Yoga Mat"
product_id: "YM-PREM-020"
price: 89.99
availability: "In Stock"
colors:
  - "Ocean Blue"
  - "Forest Green"
  - "Sunset Orange"
---

# Premium Yoga Mat

## Elevate Your Practice

Professional-grade mat with superior grip and cushioning.

## Features

- 6mm thickness
- Non-slip surface
- Alignment markers
- Antimicrobial
- Eco-friendly materials

## Dimensions

- Length: 72 inches
- Width: 26 inches
- Weight: 5.5 lbs

## Includes

- Carrying strap
- Storage bag
- Care guide

> "The alignment markers transformed my practice." — *Elena S.*

**$89.99** - Available in 3 colors
`,

	// Documentation (51-70)
	`---
title: "API Reference v2.0"
version: "2.0.0"
last_updated: "2024-12-01"
---

# API Reference v2.0

## Authentication

All API requests require a Bearer token:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_TOKEN" \\
     https://api.example.com/v2/users
\`\`\`

## Endpoints

### Users

#### Get All Users

\`GET /v2/users\`

\`\`\`json
{
    "data": [
        {"id": 1, "name": "John", "email": "john@example.com"}
    ],
    "meta": {
        "total": 100,
        "page": 1
    }
}
\`\`\`

### Rate Limits

- 1000 requests per hour
- 100 requests per minute
`,

	`---
title: "Installation Guide"
version: "1.0.0"
platform: "All"
---

# Installation Guide

## Prerequisites

- Node.js 18 or higher
- npm or pnpm
- Git

## Quick Install

\`\`\`bash
npm install -g our-cli
\`\`\`

## Verify Installation

\`\`\`bash
our-cli --version
\`\`\`

## Configuration

Create a config file:

\`\`\`bash
our-cli init
\`\`\`

This generates \`.ourclirc\`:

\`\`\`json
{
    "project": "my-project",
    "environment": "development"
}
\`\`\`

## Next Steps

1. [Quick Start Guide](./quickstart.md)
2. [Configuration Options](./config.md)
3. [CLI Commands](./commands.md)
`,

	`---
title: "Database Schema"
version: "3.0.0"
database: "PostgreSQL"
---

# Database Schema

## Tables Overview

### Users Table

\`\`\`sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

### Posts Table

\`\`\`sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

## Indexes

\`\`\`sql
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_published ON posts(published_at DESC);
\`\`\`
`,

	`---
title: "Deployment Guide"
environment: "Production"
---

# Deployment Guide

## Environments

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | dev.example.com | develop |
| Staging | staging.example.com | staging |
| Production | example.com | main |

## Deploy to Production

### 1. Run Tests

\`\`\`bash
npm test
npm run lint
\`\`\`

### 2. Build

\`\`\`bash
npm run build
\`\`\`

### 3. Deploy

\`\`\`bash
./scripts/deploy.sh production
\`\`\`

## Rollback

In case of issues:

\`\`\`bash
./scripts/rollback.sh production
\`\`\`
`,

	`---
title: "Contributing Guidelines"
---

# Contributing Guidelines

Thank you for contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a branch

\`\`\`bash
git checkout -b feature/your-feature
\`\`\`

## Code Style

- Use ESLint configuration
- Run Prettier before committing
- Follow existing patterns

## Pull Request Process

1. Update documentation
2. Add tests for new features
3. Ensure all tests pass
4. Update the CHANGELOG
5. Request review

## Commit Messages

Follow conventional commits:

- \`feat:\` New feature
- \`fix:\` Bug fix
- \`docs:\` Documentation
- \`refactor:\` Code refactoring
`,

	`---
title: "Environment Variables"
---

# Environment Variables

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | Database connection | postgres://... |
| API_KEY | API authentication | sk_live_... |
| NODE_ENV | Environment | production |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| LOG_LEVEL | info | Logging level |
| CACHE_TTL | 3600 | Cache duration |

## Example .env

\`\`\`bash
DATABASE_URL=postgres://user:pass@localhost:5432/db
API_KEY=sk_live_abcd1234
NODE_ENV=development
PORT=3000
\`\`\`
`,

	`---
title: "Testing Guide"
---

# Testing Guide

## Running Tests

\`\`\`bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
\`\`\`

## Test Structure

\`\`\`javascript
describe('UserService', () => {
    beforeEach(() => {
        // Setup
    });

    afterEach(() => {
        // Cleanup
    });

    describe('createUser', () => {
        it('should create a user with valid data', async () => {
            const user = await UserService.createUser({
                email: 'test@example.com',
                name: 'Test User'
            });

            expect(user.id).toBeDefined();
            expect(user.email).toBe('test@example.com');
        });
    });
});
\`\`\`
`,

	`---
title: "Troubleshooting"
---

# Troubleshooting

## Common Issues

### Connection Refused

**Problem**: Cannot connect to the server

**Solution**:
1. Check if server is running
2. Verify port configuration
3. Check firewall settings

\`\`\`bash
# Check if port is in use
lsof -i :3000
\`\`\`

### Authentication Errors

**Problem**: 401 Unauthorized

**Solution**:
1. Verify API key is correct
2. Check token expiration
3. Ensure proper header format

\`\`\`bash
# Correct format
Authorization: Bearer <token>
\`\`\`

### Memory Issues

**Problem**: Out of memory errors

**Solution**:
\`\`\`bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
\`\`\`
`,

	`---
title: "Migration Guide v1 to v2"
---

# Migration Guide v1 to v2

## Breaking Changes

### API Changes

**v1:**
\`\`\`javascript
import { createClient } from 'our-lib';
const client = createClient(apiKey);
\`\`\`

**v2:**
\`\`\`javascript
import { Client } from 'our-lib';
const client = new Client({ apiKey });
\`\`\`

### Configuration

**v1:** JSON config file
**v2:** JavaScript/TypeScript config

\`\`\`javascript
// our-lib.config.js
export default {
    apiKey: process.env.API_KEY,
    timeout: 5000
};
\`\`\`

## Deprecated Features

- \`client.fetchAll()\` → Use \`client.list()\`
- \`client.remove()\` → Use \`client.delete()\`
`,

	`---
title: "Security Best Practices"
---

# Security Best Practices

## Authentication

### Password Hashing

Always use bcrypt:

\`\`\`javascript
const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
}
\`\`\`

### JWT Tokens

\`\`\`javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
);
\`\`\`

## Input Validation

Always validate user input:

\`\`\`javascript
const { z } = require('zod');

const userSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
\`\`\`
`,

	`---
title: "Performance Optimization"
---

# Performance Optimization

## Database Queries

### Use Indexes

\`\`\`sql
CREATE INDEX idx_users_email ON users(email);
\`\`\`

### Avoid N+1 Queries

**Bad:**
\`\`\`javascript
const users = await User.findAll();
for (const user of users) {
    user.posts = await Post.findAll({ where: { userId: user.id } });
}
\`\`\`

**Good:**
\`\`\`javascript
const users = await User.findAll({
    include: [{ model: Post }]
});
\`\`\`

## Caching

\`\`\`javascript
const cache = new Map();

async function getCachedUser(id) {
    if (cache.has(id)) {
        return cache.get(id);
    }
    const user = await User.findById(id);
    cache.set(id, user);
    return user;
}
\`\`\`
`,

	`---
title: "Logging Guide"
---

# Logging Guide

## Log Levels

| Level | Use Case |
|-------|----------|
| error | Application errors |
| warn | Warnings, deprecations |
| info | General information |
| debug | Debugging details |

## Setup

\`\`\`javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});
\`\`\`

## Usage

\`\`\`javascript
logger.info('User logged in', { userId: user.id });
logger.error('Database connection failed', { error: err.message });
\`\`\`
`,

	`---
title: "Webhook Integration"
---

# Webhook Integration

## Receiving Webhooks

Set up an endpoint:

\`\`\`javascript
app.post('/webhooks', (req, res) => {
    const signature = req.headers['x-webhook-signature'];

    if (!verifySignature(req.body, signature)) {
        return res.status(401).send('Invalid signature');
    }

    // Process webhook
    const { event, data } = req.body;

    switch (event) {
        case 'user.created':
            handleUserCreated(data);
            break;
        case 'order.completed':
            handleOrderCompleted(data);
            break;
    }

    res.status(200).send('OK');
});
\`\`\`

## Signature Verification

\`\`\`javascript
const crypto = require('crypto');

function verifySignature(payload, signature) {
    const expected = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}
\`\`\`
`,

	`---
title: "Error Codes Reference"
---

# Error Codes Reference

## HTTP Status Codes

### 4xx Client Errors

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid request body |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |

### 5xx Server Errors

| Code | Name | Description |
|------|------|-------------|
| 500 | Internal Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Temporary outage |

## Error Response Format

\`\`\`json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid email format",
        "details": {
            "field": "email",
            "value": "invalid"
        }
    }
}
\`\`\`
`,

	`---
title: "CLI Commands Reference"
---

# CLI Commands Reference

## Global Options

- \`--help\`: Show help
- \`--version\`: Show version
- \`--verbose\`: Verbose output
- \`--config\`: Config file path

## Commands

### init

Initialize a new project:

\`\`\`bash
our-cli init [project-name]
\`\`\`

### build

Build the project:

\`\`\`bash
our-cli build [--production]
\`\`\`

### deploy

Deploy to environment:

\`\`\`bash
our-cli deploy [environment] [--force]
\`\`\`

### logs

View application logs:

\`\`\`bash
our-cli logs [--follow] [--lines=100]
\`\`\`
`,

	`---
title: "Plugin Development"
---

# Plugin Development

## Plugin Structure

\`\`\`
my-plugin/
├── package.json
├── src/
│   └── index.ts
└── README.md
\`\`\`

## Creating a Plugin

\`\`\`typescript
import { Plugin, PluginContext } from 'our-lib';

export default class MyPlugin implements Plugin {
    name = 'my-plugin';

    async setup(ctx: PluginContext) {
        ctx.hooks.on('beforeBuild', async () => {
            console.log('Running before build');
        });
    }

    async teardown() {
        // Cleanup
    }
}
\`\`\`

## Publishing

\`\`\`bash
npm publish --access public
\`\`\`
`,

	`---
title: "Monitoring Setup"
---

# Monitoring Setup

## Metrics

### Application Metrics

\`\`\`javascript
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests',
    labelNames: ['method', 'route', 'status']
});

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        httpRequestDuration.observe(
            { method: req.method, route: req.path, status: res.statusCode },
            (Date.now() - start) / 1000
        );
    });
    next();
});
\`\`\`

## Health Checks

\`\`\`javascript
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    };
    res.json(health);
});
\`\`\`
`,

	`---
title: "Data Export Guide"
---

# Data Export Guide

## Export Formats

### CSV Export

\`\`\`javascript
const { Parser } = require('json2csv');

async function exportToCSV(data) {
    const fields = ['id', 'name', 'email', 'createdAt'];
    const parser = new Parser({ fields });
    return parser.parse(data);
}
\`\`\`

### JSON Export

\`\`\`javascript
async function exportToJSON(data) {
    return JSON.stringify(data, null, 2);
}
\`\`\`

## Batch Export

For large datasets:

\`\`\`javascript
async function* batchExport(query, batchSize = 1000) {
    let offset = 0;
    while (true) {
        const batch = await db.query(query, { limit: batchSize, offset });
        if (batch.length === 0) break;
        yield batch;
        offset += batchSize;
    }
}
\`\`\`
`,

	`---
title: "Backup and Recovery"
---

# Backup and Recovery

## Database Backups

### Automated Backups

\`\`\`bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://backups/database/
rm backup_$DATE.sql
\`\`\`

### Manual Backup

\`\`\`bash
pg_dump -h localhost -U postgres mydb > backup.sql
\`\`\`

## Recovery

### Restore from Backup

\`\`\`bash
psql -h localhost -U postgres mydb < backup.sql
\`\`\`

### Point-in-Time Recovery

1. Stop the database
2. Restore base backup
3. Apply WAL logs
4. Start the database
`,

	`---
title: "Rate Limiting Configuration"
---

# Rate Limiting Configuration

## Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/* | 1000 | 1 hour |
| /auth/* | 20 | 15 min |
| /upload/* | 10 | 1 hour |

## Configuration

\`\`\`javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    skipSuccessfulRequests: true
});
\`\`\`

## Custom Response

\`\`\`javascript
{
    "error": "Too Many Requests",
    "retryAfter": 3600
}
\`\`\`
`,

	// Technical articles (71-85)
	`---
title: "Building a Task Queue with Redis"
date: "2024-11-01"
author: "Jake Williams"
---

# Building a Task Queue with Redis

## Architecture Overview

A task queue processes jobs asynchronously:

\`\`\`
Producer → Redis Queue → Worker → Result
\`\`\`

## Producer

\`\`\`javascript
const Redis = require('ioredis');
const redis = new Redis();

async function enqueue(queue, job) {
    const id = Date.now().toString(36);
    await redis.lpush(queue, JSON.stringify({ id, ...job }));
    return id;
}

// Usage
await enqueue('emails', { to: 'user@example.com', template: 'welcome' });
\`\`\`

## Worker

\`\`\`javascript
async function processQueue(queue, handler) {
    while (true) {
        const result = await redis.brpop(queue, 0);
        const job = JSON.parse(result[1]);

        try {
            await handler(job);
            console.log(\`Completed: \${job.id}\`);
        } catch (error) {
            await redis.lpush(\`\${queue}:failed\`, JSON.stringify({ ...job, error: error.message }));
        }
    }
}
\`\`\`
`,

	`---
title: "Implementing JWT Refresh Tokens"
date: "2024-11-15"
author: "Maria Santos"
---

# Implementing JWT Refresh Tokens

## Token Strategy

- Access token: Short-lived (15 minutes)
- Refresh token: Long-lived (7 days)

## Implementation

\`\`\`javascript
const jwt = require('jsonwebtoken');

function generateTokens(userId) {
    const accessToken = jwt.sign(
        { userId, type: 'access' },
        process.env.ACCESS_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        process.env.REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
}
\`\`\`

## Refresh Endpoint

\`\`\`javascript
app.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    try {
        const payload = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

        // Check if token is in blacklist
        if (await isBlacklisted(refreshToken)) {
            throw new Error('Token revoked');
        }

        const tokens = generateTokens(payload.userId);
        res.json(tokens);
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});
\`\`\`
`,

	`---
title: "Database Connection Pooling"
date: "2024-12-01"
author: "Alex Kim"
---

# Database Connection Pooling

## Why Connection Pooling?

Creating connections is expensive:
- TCP handshake
- Authentication
- Session initialization

## Pool Configuration

\`\`\`javascript
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: 5432,
    database: 'myapp',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,                    // Max connections
    idleTimeoutMillis: 30000,   // Close idle connections
    connectionTimeoutMillis: 2000
});
\`\`\`

## Usage

\`\`\`javascript
async function getUser(id) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}
\`\`\`

## Pool Events

\`\`\`javascript
pool.on('connect', () => console.log('New connection'));
pool.on('error', (err) => console.error('Pool error', err));
\`\`\`
`,

	`---
title: "Building a WebSocket Chat Server"
date: "2024-12-15"
author: "Sarah Johnson"
---

# Building a WebSocket Chat Server

## Server Setup

\`\`\`javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'join':
                joinRoom(ws, message.room);
                break;
            case 'message':
                broadcast(message.room, message.text, ws);
                break;
            case 'leave':
                leaveRoom(ws, message.room);
                break;
        }
    });
});
\`\`\`

## Room Management

\`\`\`javascript
function joinRoom(ws, roomName) {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, new Set());
    }
    rooms.get(roomName).add(ws);
    ws.room = roomName;
}

function broadcast(roomName, text, sender) {
    const room = rooms.get(roomName);
    if (!room) return;

    room.forEach(client => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'message', text }));
        }
    });
}
\`\`\`
`,

	`---
title: "Implementing Circuit Breaker Pattern"
date: "2025-01-01"
author: "Tom Chen"
---

# Implementing Circuit Breaker Pattern

## States

- **Closed**: Normal operation
- **Open**: Failing, reject calls
- **Half-Open**: Testing recovery

## Implementation

\`\`\`javascript
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000;
        this.state = 'CLOSED';
        this.failures = 0;
        this.lastFailure = null;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure >= this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
}
\`\`\`
`,

	`---
title: "File Upload with Multipart"
date: "2025-01-15"
author: "Emily Park"
---

# File Upload with Multipart

## Server Setup

\`\`\`javascript
const express = require('express');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
        const uniqueName = \`\${Date.now()}-\${file.originalname}\`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});
\`\`\`

## Upload Endpoint

\`\`\`javascript
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
});
\`\`\`
`,

	`---
title: "Building a Full-Text Search"
date: "2025-02-01"
author: "David Lee"
---

# Building a Full-Text Search

## PostgreSQL Full-Text Search

### Creating the Index

\`\`\`sql
ALTER TABLE articles ADD COLUMN search_vector tsvector;

UPDATE articles SET search_vector =
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));

CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);
\`\`\`

### Search Query

\`\`\`sql
SELECT title, ts_rank(search_vector, query) as rank
FROM articles, to_tsquery('english', 'javascript & async') query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
\`\`\`

## In Application

\`\`\`javascript
async function search(term) {
    const query = term.split(' ').join(' & ');
    const result = await db.query(\`
        SELECT id, title,
               ts_headline('english', content, to_tsquery($1)) as excerpt
        FROM articles
        WHERE search_vector @@ to_tsquery('english', $1)
        ORDER BY ts_rank(search_vector, to_tsquery('english', $1)) DESC
        LIMIT 20
    \`, [query]);

    return result.rows;
}
\`\`\`
`,

	`---
title: "Streaming Large Files"
date: "2025-02-15"
author: "Julia Martinez"
---

# Streaming Large Files

## The Problem

Loading large files into memory causes issues.

## Stream-Based Solution

\`\`\`javascript
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

async function processLargeFile(inputPath, outputPath) {
    const readStream = fs.createReadStream(inputPath);
    const writeStream = fs.createWriteStream(outputPath);

    const transform = new Transform({
        transform(chunk, encoding, callback) {
            // Process chunk
            const processed = chunk.toString().toUpperCase();
            callback(null, processed);
        }
    });

    await pipeline(readStream, transform, writeStream);
}
\`\`\`

## Streaming HTTP Response

\`\`\`javascript
app.get('/download/:fileId', async (req, res) => {
    const filePath = await getFilePath(req.params.fileId);
    const stat = await fs.promises.stat(filePath);

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});
\`\`\`
`,

	`---
title: "Implementing Pagination"
date: "2025-03-01"
author: "Chris Taylor"
---

# Implementing Pagination

## Offset-Based Pagination

\`\`\`javascript
async function getUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
        db.query('SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]),
        db.query('SELECT COUNT(*) FROM users')
    ]);

    return {
        data: users.rows,
        meta: {
            total: parseInt(total.rows[0].count),
            page,
            limit,
            pages: Math.ceil(total.rows[0].count / limit)
        }
    };
}
\`\`\`

## Cursor-Based Pagination

Better for large datasets:

\`\`\`javascript
async function getUsers(cursor, limit = 20) {
    const query = cursor
        ? 'SELECT * FROM users WHERE id > $1 ORDER BY id LIMIT $2'
        : 'SELECT * FROM users ORDER BY id LIMIT $1';

    const params = cursor ? [cursor, limit + 1] : [limit + 1];
    const result = await db.query(query, params);

    const hasMore = result.rows.length > limit;
    const users = hasMore ? result.rows.slice(0, -1) : result.rows;

    return {
        data: users,
        nextCursor: hasMore ? users[users.length - 1].id : null
    };
}
\`\`\`
`,

	`---
title: "Implementing Soft Deletes"
date: "2025-03-15"
author: "Amanda Brown"
---

# Implementing Soft Deletes

## Schema

\`\`\`sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NULL;
\`\`\`

## Model Methods

\`\`\`javascript
class User {
    static async findAll() {
        return db.query('SELECT * FROM users WHERE deleted_at IS NULL');
    }

    static async findWithDeleted() {
        return db.query('SELECT * FROM users');
    }

    static async delete(id) {
        return db.query(
            'UPDATE users SET deleted_at = NOW() WHERE id = $1',
            [id]
        );
    }

    static async restore(id) {
        return db.query(
            'UPDATE users SET deleted_at = NULL WHERE id = $1',
            [id]
        );
    }

    static async forceDelete(id) {
        return db.query('DELETE FROM users WHERE id = $1', [id]);
    }
}
\`\`\`

## Automatic Filtering

\`\`\`javascript
// Middleware to filter deleted records
function excludeDeleted(queryBuilder) {
    return queryBuilder.whereNull('deleted_at');
}
\`\`\`
`,

	`---
title: "Building Event Sourcing"
date: "2025-04-01"
author: "Robert Wilson"
---

# Building Event Sourcing

## Event Store

\`\`\`sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    data JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_events_aggregate_version
    ON events(aggregate_id, version);
\`\`\`

## Appending Events

\`\`\`javascript
async function appendEvent(aggregateId, aggregateType, eventType, data) {
    const version = await getNextVersion(aggregateId);

    await db.query(\`
        INSERT INTO events (aggregate_id, aggregate_type, event_type, data, version)
        VALUES ($1, $2, $3, $4, $5)
    \`, [aggregateId, aggregateType, eventType, data, version]);
}
\`\`\`

## Rebuilding State

\`\`\`javascript
async function rebuildAggregate(aggregateId) {
    const events = await db.query(
        'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY version',
        [aggregateId]
    );

    return events.rows.reduce((state, event) => {
        return applyEvent(state, event);
    }, {});
}
\`\`\`
`,

	`---
title: "Implementing Retry Logic"
date: "2025-04-15"
author: "Jennifer Adams"
---

# Implementing Retry Logic

## Exponential Backoff

\`\`\`javascript
async function withRetry(fn, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) break;
            if (!isRetryable(error)) throw error;

            const delay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 1000;
            await sleep(delay + jitter);
        }
    }

    throw lastError;
}

function isRetryable(error) {
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
    return retryableCodes.includes(error.code) || error.status >= 500;
}
\`\`\`

## Usage

\`\`\`javascript
const result = await withRetry(
    () => fetchFromAPI('/users'),
    { maxRetries: 5, baseDelay: 500 }
);
\`\`\`
`,

	`---
title: "Database Transactions"
date: "2025-05-01"
author: "Michael Scott"
---

# Database Transactions

## Basic Transaction

\`\`\`javascript
async function transferFunds(fromId, toId, amount) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
            [amount, fromId]
        );

        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [amount, toId]
        );

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
\`\`\`

## Transaction Helper

\`\`\`javascript
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
\`\`\`
`,

	`---
title: "Implementing Webhooks"
date: "2025-05-15"
author: "Lisa Chen"
---

# Implementing Webhooks

## Webhook Sender

\`\`\`javascript
const axios = require('axios');
const crypto = require('crypto');

async function sendWebhook(url, event, data, secret) {
    const payload = { event, data, timestamp: Date.now() };
    const signature = createSignature(payload, secret);

    try {
        await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature
            },
            timeout: 5000
        });
    } catch (error) {
        await queueRetry(url, payload, secret);
    }
}

function createSignature(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
}
\`\`\`

## Retry Queue

\`\`\`javascript
const retryQueue = [];

async function processRetries() {
    while (retryQueue.length > 0) {
        const { url, payload, secret, attempts } = retryQueue.shift();

        if (attempts >= 5) continue;

        try {
            await sendWebhook(url, payload.event, payload.data, secret);
        } catch {
            retryQueue.push({ url, payload, secret, attempts: attempts + 1 });
        }

        await sleep(Math.pow(2, attempts) * 1000);
    }
}
\`\`\`
`,

	`---
title: "Request Validation with Zod"
date: "2025-06-01"
author: "Kevin Brown"
---

# Request Validation with Zod

## Schema Definition

\`\`\`typescript
import { z } from 'zod';

const createUserSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2).max(100),
    age: z.number().int().positive().optional(),
    role: z.enum(['user', 'admin']).default('user')
});

type CreateUserInput = z.infer<typeof createUserSchema>;
\`\`\`

## Validation Middleware

\`\`\`typescript
function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues
            });
        }

        req.body = result.data;
        next();
    };
}
\`\`\`

## Usage

\`\`\`typescript
app.post('/users', validate(createUserSchema), async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(user);
});
\`\`\`
`,

	`---
title: "Building a Cache Layer"
date: "2025-06-15"
author: "Nancy White"
---

# Building a Cache Layer

## Multi-Level Cache

\`\`\`javascript
class CacheManager {
    constructor() {
        this.memory = new Map();
        this.redis = new Redis();
    }

    async get(key) {
        // Level 1: Memory
        if (this.memory.has(key)) {
            return this.memory.get(key);
        }

        // Level 2: Redis
        const cached = await this.redis.get(key);
        if (cached) {
            const value = JSON.parse(cached);
            this.memory.set(key, value);
            return value;
        }

        return null;
    }

    async set(key, value, ttl = 3600) {
        this.memory.set(key, value);
        await this.redis.setex(key, ttl, JSON.stringify(value));
    }

    async invalidate(key) {
        this.memory.delete(key);
        await this.redis.del(key);
    }
}
\`\`\`

## Cache-Aside Pattern

\`\`\`javascript
async function getUser(id) {
    const cacheKey = \`user:\${id}\`;
    let user = await cache.get(cacheKey);

    if (!user) {
        user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        await cache.set(cacheKey, user, 3600);
    }

    return user;
}
\`\`\`
`,

	// Simple content (86-100)
	`---
title: "Welcome to Our Platform"
---

# Welcome to Our Platform

We're excited to have you here!

## Getting Started

1. Create your account
2. Complete your profile
3. Start exploring

Need help? Contact support@example.com
`,

	`---
title: "System Maintenance Notice"
date: "2024-12-01"
---

# Scheduled Maintenance

Our systems will be undergoing maintenance on **December 15th, 2024** from 2:00 AM to 6:00 AM UTC.

## What to Expect

- Brief service interruptions
- Some features may be unavailable

We apologize for any inconvenience.
`,

	`---
title: "New Feature Announcement"
---

# Introducing Dark Mode

We've added dark mode to our application!

## How to Enable

1. Go to Settings
2. Click on Appearance
3. Select "Dark Mode"

Enjoy the new look!
`,

	`---
title: "Privacy Policy Update"
date: "2024-11-01"
---

# Privacy Policy Update

We've updated our privacy policy to be more transparent.

## Key Changes

- Clearer data usage explanations
- Enhanced user controls
- Updated third-party disclosures

Read the full policy [here](/privacy).
`,

	`---
title: "Quick Start Guide"
---

# Quick Start

Get up and running in 5 minutes.

\`\`\`bash
npm install our-package
npm start
\`\`\`

That's it! Visit http://localhost:3000
`,

	`---
title: "FAQ"
---

# Frequently Asked Questions

## How do I reset my password?

Click "Forgot Password" on the login page.

## Can I export my data?

Yes, go to Settings > Export.

## How do I delete my account?

Contact support@example.com
`,

	`---
title: "Release Notes v2.1"
version: "2.1.0"
---

# Release Notes v2.1

## New Features

- Dark mode support
- Export to PDF
- Keyboard shortcuts

## Bug Fixes

- Fixed login timeout issue
- Corrected date formatting
- Improved error messages
`,

	`---
title: "Thank You"
---

# Thank You for Your Support

We appreciate your continued trust in our platform.

Your feedback helps us improve every day.

— The Team
`,

	`---
title: "Contact Us"
---

# Contact Us

## Support

Email: support@example.com
Phone: 1-800-EXAMPLE

## Office Hours

Monday - Friday: 9 AM - 5 PM EST

## Address

123 Main Street
New York, NY 10001
`,

	`---
title: "Holiday Hours"
---

# Holiday Hours

Our office will be closed:

- December 25 - Christmas
- December 26 - Boxing Day
- January 1 - New Year's Day

Happy Holidays!
`,

	`---
title: "Server Status"
status: "operational"
---

# Server Status

All systems operational.

| Service | Status |
|---------|--------|
| API | Online |
| Website | Online |
| Database | Online |
`,

	`---
title: "Meeting Notes"
date: "2024-11-20"
---

# Meeting Notes - November 20

## Attendees

- Alice, Bob, Charlie

## Discussion

- Q4 goals review
- New hire onboarding
- Budget planning

## Action Items

- [ ] Alice: Send report
- [ ] Bob: Schedule training
`,

	`---
title: "Quick Reference"
---

# Quick Reference

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | Ctrl+S |
| Copy | Ctrl+C |
| Paste | Ctrl+V |
| Undo | Ctrl+Z |
`,

	`---
title: "About Us"
---

# About Us

We build tools that help developers work smarter.

## Our Mission

To simplify software development.

## Founded

2020

## Team Size

50+ employees worldwide
`,

	`---
title: "Changelog"
---

# Changelog

## 2024-12-01

- Added new dashboard
- Fixed export bug

## 2024-11-15

- Performance improvements
- Updated dependencies

## 2024-11-01

- Initial release
`,
];
