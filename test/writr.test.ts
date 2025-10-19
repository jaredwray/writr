import fs from "node:fs";
import { describe, expect, it, test } from "vitest";
import { Writr, type WritrValidateResult } from "../src/writr.js";
import {
	blogPostWithMarkdown,
	markdownWithBadFrontMatter,
	markdownWithFrontMatter,
	markdownWithFrontMatterAndAdditional,
	markdownWithFrontMatterInOtherPlaces,
	productPageWithMarkdown,
	projectDocumentationWithMarkdown,
} from "./content-fixtures.js";

describe("writr", () => {
	it("should be able to initialize", () => {
		const writr = new Writr();
		expect(writr).toBeDefined();
	});

	it("should be able to set options", () => {
		const options = {
			throwErrors: true,
			renderOptions: {
				toc: false,
				slug: false,
				highlight: false,
				mdx: false,
				gfm: false,
				math: false,
				emoji: false,
				caching: false,
			},
		};
		const writr = new Writr(options);
		expect(writr.options).toBeDefined();
		expect(writr.options.throwErrors).toEqual(true);
		expect(writr.options.renderOptions).toBeInstanceOf(Object);
		expect(writr.options.renderOptions?.emoji).toEqual(false);
		expect(writr.options.renderOptions?.gfm).toEqual(false);
		expect(writr.options.renderOptions?.mdx).toEqual(false);
		expect(writr.options.renderOptions?.highlight).toEqual(false);
		expect(writr.options.renderOptions?.math).toEqual(false);
		expect(writr.options.renderOptions?.slug).toEqual(false);
		expect(writr.options.renderOptions?.toc).toEqual(false);
		expect(writr.options.renderOptions?.caching).toEqual(false);
	});

	it("should be able to set markdown", () => {
		const writr = new Writr("# Hello World");
		expect(writr.markdown).toEqual("# Hello World");
		expect(writr.renderSync()).toEqual('<h1 id="hello-world">Hello World</h1>');
		writr.content = "# Hello World\n\nThis is a test.";
		expect(writr.markdown).toEqual("# Hello World\n\nThis is a test.");
		expect(writr.renderSync()).toEqual(
			'<h1 id="hello-world">Hello World</h1>\n<p>This is a test.</p>',
		);
	});
	it("should be able to set options on emoji", () => {
		const options = {
			renderOptions: {
				emoji: true,
			},
		};
		const writr = new Writr(options);
		expect(writr.options.renderOptions?.emoji).toEqual(true);
	});
	it("should be able to set options on toc", () => {
		const options = {
			renderOptions: {
				toc: true,
			},
		};
		const writr = new Writr(options);
		expect(writr.options.renderOptions?.toc).toEqual(true);
	});
	it("should render a simple markdown example", async () => {
		const writr = new Writr("# Hello World");
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it("should render a simple markdown example via constructor with render options", async () => {
		const writr = new Writr("# Hello World");
		const result = await writr.render({
			emoji: false,
		});
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});

	it("should renderSync a simple markdown example", async () => {
		const writr = new Writr("# Hello World");
		const result = writr.renderSync();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it("should renderSync a simple markdown example via constructor", async () => {
		const writr = new Writr();
		writr.content = "# Hello World";
		const result = writr.renderSync({
			emoji: false,
		});
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
	});
	it("should render a simple markdown example with options - slug", async () => {
		const writr = new Writr("# Hello World", {
			renderOptions: {
				slug: false,
			},
		});
		const result = await writr.render();
		expect(result).toEqual("<h1>Hello World</h1>");
	});
	it("should renderSync a simple markdown example with options - emoji", async () => {
		const writr = new Writr("# Hello World :dog:");
		const options = {
			emoji: false,
		};
		const result = writr.renderSync(options);
		expect(result).toEqual('<h1 id="hello-world-dog">Hello World :dog:</h1>');
	});
	it("should render a simple markdown example with options - emoji", async () => {
		const writr = new Writr("# Hello World :dog:");
		const options = {
			emoji: false,
		};
		const result = await writr.render(options);
		expect(result).toEqual('<h1 id="hello-world-dog">Hello World :dog:</h1>');
	});
	it("should render a simple markdown example with options - gfm", async () => {
		const writr = new Writr("# Hello World :dog:");
		const options = {
			gfm: false,
		};
		const result = await writr.render(options);
		expect(result).toEqual('<h1 id="hello-world-">Hello World 🐶</h1>');
	});
	it("should render GitHub blockquote alerts when gfm is enabled", async () => {
		const writr = new Writr(
			"> [!NOTE]\n> This is a note alert with useful information.",
		);
		const result = await writr.render({ gfm: true });
		expect(result).toContain("NOTE");
		expect(result).toContain("This is a note alert with useful information.");
	});
	it("should not render GitHub blockquote alerts when gfm is disabled", async () => {
		const writr = new Writr(
			"> [!NOTE]\n> This is a note alert with useful information.",
		);
		const result = await writr.render({ gfm: false });
		expect(result).not.toContain('class="markdown-alert');
		expect(result).toContain("[!NOTE]");
	});

	it("should render from cache a simple markdown example with options - gfm", async () => {
		const writr = new Writr("# Hello World :dog:");
		const options = {
			gfm: false,
		};
		const result = await writr.render(options);
		expect(result).toEqual('<h1 id="hello-world-">Hello World 🐶</h1>');
		const result2 = await writr.render(options);
		expect(result2).toEqual('<h1 id="hello-world-">Hello World 🐶</h1>');
	});

	it("should render a simple markdown example with options - toc", async () => {
		const writr = new Writr();
		const options = {
			toc: false,
		};
		const markdownString = `# Pluto\n\nPluto is a dwarf planet in the Kuiper belt.\n\n## Contents\n\n## History
		\n\n### Discovery\n\nIn the 1840s, Urbain Le Verrier used Newtonian mechanics to predict the\nposition of…`;
		writr.content = markdownString;
		const resultToc = await writr.render();
		expect(resultToc).contains('<li><a href="#discovery">Discovery</a></li>');
		const result = await writr.render(options);
		expect(result).not.contain('<li><a href="#discovery">Discovery</a></li>');
	});
	it("should render a simple markdown example with options - code highlight", async () => {
		const writr = new Writr();
		const options = {
			highlight: false,
		};

		const markdownString =
			'# Code Example\n\nThis is an inline code example: `const x = 10;`\n\nAnd here is a multi-line code block:\n\n```javascript\nconst greet = () => {\n  console.log("Hello, world!");\n};\ngreet();\n```';
		writr.content = markdownString;
		const resultFull = await writr.render();
		expect(resultFull).contains(
			'<pre><code class="hljs language-javascript"><span class="hljs-keyword">const</span>',
		);
		const result = await writr.render(options);
		expect(result).contain(
			'<pre><code class="language-javascript">const greet = () => {',
		);
	});
	it("should throw an error on bad plugin or parsing", async () => {
		const writr = new Writr("# Hello World");
		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Required configuration missing.");
		};

		writr.engine.use(customPlugin);
		try {
			await writr.render();
		} catch (error) {
			expect((error as Error).message).toEqual(
				"Failed to render markdown: Custom Plugin Error: Required configuration missing.",
			);
		}
	});
	it("should throw an error on bad plugin or parsing on renderSync", () => {
		const writr = new Writr("# Hello World");
		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Required configuration missing.");
		};

		writr.engine.use(customPlugin);
		try {
			writr.renderSync();
		} catch (error) {
			expect((error as Error).message).toEqual(
				"Failed to render markdown: Custom Plugin Error: Required configuration missing.",
			);
		}
	});
	it("should be able to do math", async () => {
		const writr = new Writr();
		writr.content = "$$\n\\frac{1}{2}\n$$";
		const result = await writr.render();
		expect(result).toContain(
			'<span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"',
		);
	});
	it("should be able to render react components", async () => {
		const writr = new Writr();
		const markdownString = "## Hello World\n\n";
		writr.content = markdownString;
		const result = (await writr.renderReact()) as React.JSX.Element;
		expect(result.type).toEqual("h2");
	});
	it("should be able to render react components sync", async () => {
		const writr = new Writr();
		const markdownString = "## Hello World\n\n";
		writr.content = markdownString;
		const result = writr.renderReactSync() as React.JSX.Element;
		expect(result.type).toEqual("h2");
	});

	it("should be able to get/set cache", async () => {
		const writr = new Writr();
		writr.cache.set("# Hello World", "<h1>Hello World</h1>");
		expect(writr.cache.get("# Hello World")).toEqual("<h1>Hello World</h1>");
	});

	it("should return a valid cached result", async () => {
		const content = "# Hello World";
		const writr = new Writr(content, { renderOptions: { caching: true } }); // By defualt cache is enabled
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
		const hashKey = writr.cache.hash(content);
		expect(writr.cache.store.get(hashKey)).toEqual(result);
	});

	it("should return non cached result via options", async () => {
		const writr = new Writr("# Hello World"); // By defualt cache is enabled
		const result = await writr.render();
		expect(result).toEqual('<h1 id="hello-world">Hello World</h1>');
		const result2 = await writr.render({ caching: false });
		expect(result2).toEqual('<h1 id="hello-world">Hello World</h1>');
	});

	it("should strip out the front matter on render", async () => {
		const writr = new Writr(blogPostWithMarkdown);
		const result = await writr.render();
		expect(result).to.not.contain(
			'title: "Understanding Async/Await in JavaScript"',
		);
		expect(result).to.contain('<h1 id="introduction">Introduction</h1>');
	});
});

describe("WritrFrontMatter", () => {
	test("should initialize with content and work from same object", () => {
		const writr = new Writr(productPageWithMarkdown);
		expect(writr.content).toBe(productPageWithMarkdown);
		const meta = writr.frontMatter;
		meta.title = "New Title 123";
		writr.frontMatter = meta;
		expect(writr.content).to.contain("New Title 123");
	});

	test("should return the raw front matter", () => {
		const writr = new Writr(productPageWithMarkdown);
		expect(writr.frontMatterRaw).to.not.contain("## Description");
		expect(writr.frontMatterRaw).to.contain('title: "Super Comfortable Chair"');
	});

	test("should return blank object with no frontmatter", () => {
		const markdown = "## Description\nThis is a description";
		const writr = new Writr(markdown);
		expect(writr.frontMatterRaw).toBe("");
		expect(writr.frontMatter).toStrictEqual({});
	});

	test("should return the body without front matter", () => {
		const writr = new Writr(blogPostWithMarkdown);
		expect(writr.body).to.contain("# Introduction");
		expect(writr.body).to.contain(
			"Using Async/Await makes your code cleaner and easier to understand by eliminating the need for complex callback chains or .then() methods.",
		);
		expect(writr.body).to.not.contain('title: "Super Comfortable Chair"');
		expect(writr.body.split("\n")).to.not.contain("---");
	});

	test("should return the front matter as an object", () => {
		const writr = new Writr(projectDocumentationWithMarkdown);
		const { frontMatter } = writr;
		expect(frontMatter).to.haveOwnProperty("title", "Project Documentation");
	});

	test("should return the front matter as an object with additional properties", () => {
		const writr = new Writr(markdownWithFrontMatterAndAdditional);
		expect(writr.frontMatter).to.haveOwnProperty("title", "Sample Title");
		expect(writr.frontMatter).to.haveOwnProperty("date", "2024-08-30");
		expect(writr.content).to.contain("---");
		expect(writr.content).to.contain("This is additional content.");
	});

	test("should set the front matter", () => {
		const writr = new Writr(projectDocumentationWithMarkdown);
		const meta = writr.frontMatter;
		meta.title = "New Title";
		if (!Array.isArray(meta.contributors)) {
			meta.contributors = [];
		}

		meta.contributors.push({ name: "Jane Doe", email: "jane@doe.org" });
		writr.frontMatter = meta;
		expect(writr.frontMatter.title).toBe("New Title");
		expect(writr.content).to.contain("New Title");
		expect(writr.content).to.contain("jane@doe.org");
	});

	test("should return a value from the front matter", () => {
		const writr = new Writr(blogPostWithMarkdown);
		expect(writr.getFrontMatterValue<string>("title")).toBe(
			"Understanding Async/Await in JavaScript",
		);
		expect(writr.getFrontMatterValue<string>("author")).toBe("Jane Doe");
		expect(writr.getFrontMatterValue<boolean>("draft")).toBe(false);
		expect(writr.getFrontMatterValue<string[]>("tags")).toStrictEqual([
			"async",
			"await",
			"ES6",
		]);
	});

	test("body should only contain the body", () => {
		const writr = new Writr(blogPostWithMarkdown);
		expect(writr.body.split("\n")[0]).to.contain("# Introduction");
	});

	test("should return the entire content if closing delimiter is not found", () => {
		const markdownWithIncompleteFrontMatter = `
	---
	title: "Sample Title"
	date: "2024-08-30"
	# Missing the closing delimiter
	
	# Markdown Content Here
	`;

		const frontMatter = new Writr(markdownWithIncompleteFrontMatter);
		const { body } = frontMatter;

		// The body should be the entire content since the closing delimiter is missing
		expect(body.trim()).toBe(markdownWithIncompleteFrontMatter.trim());
		expect(frontMatter.frontMatterRaw).toBe("");
	});

	test("should be able to parse front matter and get body", () => {
		const writr = new Writr(markdownWithFrontMatter as string);
		expect(writr.body).to.contain("# Markdown Content Here");
	});
	test("should not parse wrong front matter", () => {
		const writr = new Writr(markdownWithFrontMatterInOtherPlaces as string);
		expect(writr.body).to.contain("---");
	});
	test("should handle windows style line endings in front matter", () => {
		const markdown = "---\r\nfoo: bar\r\n---\r\n\r\n# Heading";
		const writr = new Writr(markdown);
		expect(writr.frontMatterRaw).toBe("---\r\nfoo: bar\r\n---\r\n");
		expect(writr.body).toBe("# Heading");
	});
	test("should handle front matter without trailing newline", () => {
		const markdown = "---\nfoo: bar\n---";
		const writr = new Writr(markdown);
		expect(writr.frontMatterRaw).toBe("---\nfoo: bar\n---");
		expect(writr.body).toBe("");
	});
	test("if frontMatter is not correct yaml it should emit an error and return {}", () => {
		const writr = new Writr(markdownWithBadFrontMatter as string);
		expect(writr.frontMatter).toStrictEqual({});
	});
});

describe("Writr Validation", () => {
	test("should validate valid markdown content", async () => {
		const writr = new Writr("# Hello World\n\nThis is valid markdown");
		const result: WritrValidateResult = await writr.validate();
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should validate valid markdown content synchronously", () => {
		const writr = new Writr("# Hello World\n\nThis is valid markdown");
		const result: WritrValidateResult = writr.validateSync();
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should validate markdown content passed as parameter", async () => {
		const writr = new Writr("# Original Content");
		const result = await writr.validate(
			"## Different Content\n\nThis is different",
		);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
		// Original content should be preserved
		expect(writr.markdown).toBe("# Original Content");
	});

	test("should validate markdown content passed as parameter synchronously", () => {
		const writr = new Writr("# Original Content");
		const result = writr.validateSync(
			"## Different Content\n\nThis is different",
		);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
		// Original content should be preserved
		expect(writr.markdown).toBe("# Original Content");
	});

	test("should handle validation with custom render options", async () => {
		const writr = new Writr("# Hello :smile:");
		const result = await writr.validate(undefined, { emoji: true });
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should validate complex markdown with tables and code blocks", async () => {
		const complexMarkdown = `
# Complex Document

## Table
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |

## Code Block
\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

## Math
$x^2 + y^2 = z^2$
`;
		const writr = new Writr();
		const result = await writr.validate(complexMarkdown);
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should preserve original content after validation with different content", async () => {
		const originalContent = "# Original";
		const testContent = "## Test";
		const writr = new Writr(originalContent);

		await writr.validate(testContent);
		expect(writr.markdown).toBe(originalContent);

		const result = await writr.render();
		expect(result).toContain("<h1");
		expect(result).toContain("Original</h1>");
	});

	test("should preserve original content after validation with different content synchronously", () => {
		const originalContent = "# Original";
		const testContent = "## Test";
		const writr = new Writr(originalContent);

		writr.validateSync(testContent);
		expect(writr.markdown).toBe(originalContent);

		const result = writr.renderSync();
		expect(result).toContain("<h1");
		expect(result).toContain("Original</h1>");
	});

	test("should return error when validation fails", async () => {
		const writr = new Writr("# Valid Content");
		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Validation failed.");
		};

		writr.engine.use(customPlugin);
		const result = await writr.validate();

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.message).toContain(
			"Custom Plugin Error: Validation failed",
		);
	});

	test("should return error when validation fails synchronously", () => {
		const writr = new Writr("# Valid Content");
		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Validation failed.");
		};

		writr.engine.use(customPlugin);
		const result = writr.validateSync();

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.message).toContain(
			"Custom Plugin Error: Validation failed",
		);
	});

	test("should return error when validating external content that fails", async () => {
		const originalContent = "# Original";
		const writr = new Writr(originalContent);
		const customPlugin = () => {
			throw new Error("Plugin Error: Invalid markdown");
		};

		writr.engine.use(customPlugin);
		const result = await writr.validate("## Test Content");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.message).toContain("Plugin Error: Invalid markdown");
		// Original content should be restored even after error
		expect(writr.markdown).toBe(originalContent);
	});

	test("should return error when validating external content that fails synchronously", () => {
		const originalContent = "# Original";
		const writr = new Writr(originalContent);
		const customPlugin = () => {
			throw new Error("Plugin Error: Invalid markdown");
		};

		writr.engine.use(customPlugin);
		const result = writr.validateSync("## Test Content");

		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.message).toContain("Plugin Error: Invalid markdown");
		// Original content should be restored even after error
		expect(writr.markdown).toBe(originalContent);
	});

	test("should properly restore content after validation error with external content", async () => {
		const originalContent = "# Original Content";
		const testContent = "## Test Content";
		const writr = new Writr(originalContent);

		// Add a plugin that fails
		const customPlugin = () => {
			throw new Error("Render failed");
		};
		writr.engine.use(customPlugin);

		// Validate with external content (should fail)
		const result = await writr.validate(testContent);
		expect(result.valid).toBe(false);

		// Original content should be restored
		expect(writr.markdown).toBe(originalContent);
		expect(writr.content).toBe(originalContent);
	});

	test("should properly restore content after validation error with external content synchronously", () => {
		const originalContent = "# Original Content";
		const testContent = "## Test Content";
		const writr = new Writr(originalContent);

		// Add a plugin that fails
		const customPlugin = () => {
			throw new Error("Render failed");
		};
		writr.engine.use(customPlugin);

		// Validate with external content (should fail)
		const result = writr.validateSync(testContent);
		expect(result.valid).toBe(false);

		// Original content should be restored
		expect(writr.markdown).toBe(originalContent);
		expect(writr.content).toBe(originalContent);
	});

	test("should disable caching during validation even with caching options", async () => {
		const writr = new Writr("# Test Content");

		// First render with caching to populate cache
		await writr.render({ caching: true });

		// Modify content
		writr.content = "# Modified Content";

		// Validate with caching option - should still validate the new content
		const result = await writr.validate(undefined, { caching: true });
		expect(result.valid).toBe(true);

		// Verify validation used current content, not cached
		const html = await writr.render();
		expect(html).toContain("Modified Content");
	});

	test("should disable caching during validation even with caching options synchronously", () => {
		const writr = new Writr("# Test Content");

		// First render with caching to populate cache
		writr.renderSync({ caching: true });

		// Modify content
		writr.content = "# Modified Content";

		// Validate with caching option - should still validate the new content
		const result = writr.validateSync(undefined, { caching: true });
		expect(result.valid).toBe(true);

		// Verify validation used current content, not cached
		const html = writr.renderSync();
		expect(html).toContain("Modified Content");
	});
});

describe("Writr Files", async () => {
	test("should be able to save and load a file", async () => {
		const writr = new Writr(productPageWithMarkdown);
		const path = "./test/fixtures/sample.md";
		await writr.saveToFile(path);
		const writr2 = new Writr();
		await writr2.loadFromFile(path);
		expect(writr2.content).to.contain("Super Comfortable Chair");
		await fs.promises.unlink(path);
	});
	test("should be able to save and load a file with front matter sync", () => {
		const writr = new Writr(blogPostWithMarkdown);
		const path = "./test/fixtures/sample2.md";
		writr.saveToFileSync(path);
		const writr2 = new Writr();
		writr2.loadFromFileSync(path);
		expect(writr2.content).to.contain(
			"Understanding Async/Await in JavaScript",
		);
		fs.unlinkSync(path);
	});
});

describe("Writr Error Emission", () => {
	test("should emit error when render fails", async () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Render failed");
		};

		writr.engine.use(customPlugin);

		try {
			await writr.render();
		} catch {
			// Expected to throw
		}

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("Render failed");
	});

	test("should emit error when renderSync fails", () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: RenderSync failed");
		};

		writr.engine.use(customPlugin);

		try {
			writr.renderSync();
		} catch {
			// Expected to throw
		}

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("RenderSync failed");
	});

	test("should emit error when validate fails", async () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: Validation failed");
		};

		writr.engine.use(customPlugin);

		const result = await writr.validate();

		expect(result.valid).toBe(false);
		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("Validation failed");
	});

	test("should emit error when validateSync fails", () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: ValidateSync failed");
		};

		writr.engine.use(customPlugin);

		const result = writr.validateSync();

		expect(result.valid).toBe(false);
		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("ValidateSync failed");
	});

	test("should emit error when renderReact fails", async () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: RenderReact failed");
		};

		writr.engine.use(customPlugin);

		try {
			await writr.renderReact();
		} catch {
			// Expected to throw
		}

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("RenderReact failed");
	});

	test("should emit error when renderReactSync fails", () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: RenderReactSync failed");
		};

		writr.engine.use(customPlugin);

		try {
			writr.renderReactSync();
		} catch {
			// Expected to throw
		}

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("RenderReactSync failed");
	});

	test("should emit error when renderToFile fails", async () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: RenderToFile failed");
		};

		writr.engine.use(customPlugin);

		await writr.renderToFile("./test/fixtures/output.html");

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("RenderToFile failed");
	});

	test("should emit error when renderToFileSync fails", () => {
		const writr = new Writr("# Hello World");
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		const customPlugin = () => {
			throw new Error("Custom Plugin Error: RenderToFileSync failed");
		};

		writr.engine.use(customPlugin);

		writr.renderToFileSync("./test/fixtures/output.html");

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain(
			"RenderToFileSync failed",
		);
	});

	test("should emit error when loadFromFile fails with invalid path", async () => {
		const writr = new Writr();
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		await writr.loadFromFile("./non-existent-file.md");

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("ENOENT");
	});

	test("should emit error when loadFromFileSync fails with invalid path", () => {
		const writr = new Writr();
		let emittedError: unknown;

		writr.on("error", (error) => {
			emittedError = error;
		});

		writr.loadFromFileSync("./non-existent-file.md");

		expect(emittedError).toBeDefined();
		expect((emittedError as Error).message).toContain("ENOENT");
	});
});
