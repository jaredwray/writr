import { Config } from "../../src/config";
import { HtmlRenderProvider } from "../../src/render/htmRenderlProvider";
import { Tag } from "../../src/tag";
import { Post } from "../../src/post";
import { DataService } from "../../src/data/dataService";

describe("htmlProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render post", async () => {
    let htmlProvider = new HtmlRenderProvider();
    let post = new Post();
    post.author = "John Doe";
    post.title = "The John Doe Diary 1";
    post.content = "The long journy is real";

    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderPost(post, tags, config, undefined, undefined);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toContain("<p>John Doe</p><p><article><p>The long journy is real</p></article>");
  });

  it("render EJS post", async () => {
    let htmlProvider = new HtmlRenderProvider();
    let post = new Post();
    post.author = "John Doe";
    post.title = "The John Doe Diary 1";
    post.content = "The long journy is real";
    post.matter.layout = "post3"

    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderPost(post, tags, config, undefined, undefined);

    expect(val).toContain("The long journy is real");
  });

  it("render tag", async () => {
    let htmlProvider = new HtmlRenderProvider();
    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderTag(tag, tags, config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<p>Tag: FOO<br /></p><ul></ul>");
  });

  it("render tag without data", async () => {
    let htmlProvider = new HtmlRenderProvider();
    let tag = new Tag("");
    let tags = [tag];

    let val = await htmlProvider.renderTag(tag, tags, config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<p>Tag: <br /></p><ul></ul>");
  });

  it("render home", async () => {
    let htmlProvider = new HtmlRenderProvider();
    
    let ds = new DataService(config);

    let fileOutputPath = config.output + "/index.html";

    let val = await htmlProvider.renderHome(ds, config, fileOutputPath);
    val = val.replace(/(\r\n|\n|\r)/gm, "");
    expect(val).toContain("<a href=\"the-largest-whale\">Article One - John Smith</a></p>");
    expect(val).toContain("<p><a href=\"article-simple\">Article Simple - </a></p>");
    expect(val).toContain("<li><a href=\"/tags/aerospace\">aerospace</a></li><li><a href=\"/tags/blast\">blast</a></li><li><a href=\"/tags/candle\">Candle</a></li>");

  });

  
  it("render (long running)", async () => {
    let htmlProvider = new HtmlRenderProvider();
    config.output = config.output + "/html";
    let ds = new DataService(config);

    let val = await htmlProvider.render(ds, config);

    expect(val).toBe(true);
  });
  

  
});
