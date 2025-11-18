import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { Writr } from "../src/writr.js";

const examplesDir = "./test/fixtures/examples";

const options = {
	renderOptions: {
		caching: true,
	},
};

describe("Examples Rendering Tests", () => {
	test("should render empty.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "empty.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		// Test async render
		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(writr.cache).toBeDefined();
		expect(writr.cache.store.size).toBe(1);

		// Test async render from cache
		const result2 = await writr.render();
		expect(result2).toBe(result);
		expect(writr.cache.store.size).toBe(1);

		// Test sync render from cache
		const result3 = writr.renderSync();
		expect(result3).toBe(result);
		expect(writr.cache.store.size).toBe(1);
	});

	test("should render docula-readme.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "docula-readme.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		// Test async render
		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache).toBeDefined();
		expect(writr.cache.store.size).toBe(1);

		// Test async render from cache
		const result2 = await writr.render();
		expect(result2).toBe(result);
		expect(writr.cache.store.size).toBe(1);

		// Test sync render from cache
		const result3 = writr.renderSync();
		expect(result3).toBe(result);
		expect(writr.cache.store.size).toBe(1);
	});

	test("should render front-matter.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "front-matter.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render no-front-matter.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "no-front-matter.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render readme-example.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "readme-example.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render single-site.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "single-site.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render index.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "index.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render keyv.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "keyv.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render test-suite.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "test-suite.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-express.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-express.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-fastify.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-fastify.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-javascript.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-javascript.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-koa.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-koa.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-nestjs.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-nestjs.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render caching-node.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "caching-node.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render etcd.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "etcd.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render memcache.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "memcache.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render mongo.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "mongo.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render mysql.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "mysql.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render offline.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "offline.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render postgres.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "postgres.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render redis.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "redis.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render serialize.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "serialize.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render sqlite.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "sqlite.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});

	test("should render tiered.md with async render, sync render, and cache", async () => {
		const filePath = path.join(examplesDir, "tiered.md");
		const content = fs.readFileSync(filePath, "utf-8");
		const writr = new Writr(content, options);

		const result = await writr.render();
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(writr.cache.store.size).toBe(1);

		const result2 = await writr.render();
		expect(result2).toBe(result);

		const result3 = writr.renderSync();
		expect(result3).toBe(result);
	});
});
