export const productPageWithMarkdown = `
---
title: "Super Comfortable Chair"
product_id: "CHAIR12345"
price: 149.99
availability: "In Stock"
featured: true
categories:
  - "Furniture"
  - "Chairs"
tags:
  - "comfort"
  - "ergonomic"
  - "home office"
---

# Super Comfortable Chair

## Description

The **Super Comfortable Chair** is designed with ergonomics in mind, providing maximum comfort for long hours of sitting. Whether you're working from home or gaming, this chair has you covered.

## Features

- Ergonomic design to reduce strain on your back.
- Adjustable height and recline for personalized comfort.
- Durable materials that stand the test of time.

## Price

At just **$149.99**, this chair is a steal! 

## Reviews

> "This chair has completely changed my home office setup. I can work for hours without feeling fatigued." — *Jane Doe*

> "Worth every penny! The comfort is unmatched." — *John Smith*

## Purchase

Don't miss out on the opportunity to own the **Super Comfortable Chair**. Click [here](https://example.com/product/CHAIR12345) to purchase now!
`;

export const projectDocumentationWithMarkdown = `
---
title: "Project Documentation"
version: "1.0.0"
contributors:
  - name: "John Smith"
    email: "john.smith@example.com"
  - name: "Alice Johnson"
    email: "alice.johnson@example.com"
license: "MIT"
---

# Overview

This project aims to create a scalable and maintainable web application using modern technologies like React, Node.js, and MongoDB.

## Installation

To install the project, clone the repository and run the following command:

\`\`\`bash
npm install
\`\`\`

## Usage

Start the development server by running:

\`\`\`bash
npm start
\`\`\`

## Contributing

We welcome contributions! Please follow the guidelines outlined in the \`CONTRIBUTING.md\` file.

## License

This project is licensed under the MIT License. See the \`LICENSE\` file for more details.
`;

export const blogPostWithMarkdown = `---
title: "Understanding Async/Await in JavaScript"
date: "2024-08-30"
author: "Jane Doe"
categories:
  - "JavaScript"
  - "Programming"
tags:
  - "async"
  - "await"
  - "ES6"
draft: false
---

# Introduction

Async/Await is a powerful feature introduced in ES6 that allows you to write asynchronous code in a synchronous manner.

## Why Use Async/Await?

Using Async/Await makes your code cleaner and easier to understand by eliminating the need for complex callback chains or .then() methods.

## Example

Here’s a simple example:

\`\`\`javascript
async function fetchData() {
    try {
        const response = await fetch('https://api.example.com/data');
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData();
\`\`\`
`;

export const markdownWithFrontMatter = `
---
title: "Sample Title"
date: "2024-08-30"
---

# Markdown Content Here
`;

export const markdownWithFrontMatterAndAdditional = `
---
title: "Sample Title"
date: "2024-08-30"
---

# Markdown Content Here

---

This is additional content.
`;

export const markdownWithFrontMatterInOtherPlaces = `
# Markdown Content Here

---

This is additional content.

---
title: "Sample Is Wrong"
date: "2024-08-30"
---

Did this work?
`;

export const markdownWithBadFrontMatter = `
# Markdown Content Here
---
title: My Awesome Blog Post
date: 2024/10/30
tags: 
  - blog
  - markdown, yaml
description This is an awesome blog post.
published: yes
author:
  - name: Jane Doe
    email: jane@example.com
summary: "A brief summary
  of the post.
---

This is additional content.

---
title: "Sample Is Wrong"
date: "2024-08-30"
---

Did this work?
`;
