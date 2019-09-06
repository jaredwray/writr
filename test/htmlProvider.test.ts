import { expect } from "chai";
import { Config } from "../src/config";
import { HtmlProvider } from "../src/render/htmlProvider";
import "mocha";
import { Tag } from "../src/tag";
import { Post } from "../src/post";
import { DataService } from "../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("htmlProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("get home template", () => {
    
    let val = new HtmlProvider().getHomeTemplate(config);

    expect(val).to.contain("{{title}} - {{author}}</a></p>\n{{/each}}");
  });

  it("get tag template", () => {
    
    let val = new HtmlProvider().getTagTemplate(config);

    expect(val).to.contain("\n\n<p>Tag: \n{{name}}<br /></p>");
  });

  it("get post template", () => {
    
    let val = new HtmlProvider().getPostTemplate(config);

    expect(val).to.contain("<h1>Post</h1>");
  });

  it("render template", () => {
    let htmlProvider = new HtmlProvider();
    let source = htmlProvider.getTagTemplate(config);
    let tag = new Tag("FOO");

    let val = htmlProvider.renderTemplate(source, tag, config);

    expect(val).to.contain("FOO");
  });

  it("render post", async () => {
    let htmlProvider = new HtmlProvider();
    let post = new Post();
    post.author = "John Doe";
    post.title = "The John Doe Diary 1";
    post.content = "The long journy is real";

    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderPost(post, tags, config);

    expect(val).to.contain("John Doe");
  });

  it("render post without data", async () => {
    let htmlProvider = new HtmlProvider();
    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderPost(undefined, tags, config);

    expect(val).to.equal("");
  });

  it("render tag", async () => {
    let htmlProvider = new HtmlProvider();
    let tag = new Tag("FOO");

    let val = await htmlProvider.renderTag(tag, config);

    expect(val).to.contain("FOO");
  });

  it("render tag without data", async () => {
    let htmlProvider = new HtmlProvider();
    let tag = undefined;

    let val = await htmlProvider.renderTag(tag, config);

    expect(val).to.equal("");
  });

  it("render home", async () => {
    let htmlProvider = new HtmlProvider();
    
    let ds = new DataService(config);

    let val = await htmlProvider.renderHome(ds, config);

    expect(val).to.contain("Docula");
  });

  it("render (long running)", async () => {
    let htmlProvider = new HtmlProvider();
    
    let ds = new DataService(config);

    let val = await htmlProvider.render(ds, config);

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

    expect(val).to.equal(true);
  });

  
});
