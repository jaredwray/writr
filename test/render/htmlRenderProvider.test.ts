import { Config } from "../../src/config";
import { HtmlRenderProvider } from "../../src/render/htmRenderlProvider";
import { Tag } from "../../src/tag";
import { Post } from "../../src/post";
import { DataService } from "../../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("htmlProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  afterAll( () => {
      //cleanup
      config.loadConfig("./blog_example/config.json");
      if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }
  });

  it("get home template", () => {
    
    let val = new HtmlRenderProvider().getHomeTemplate(config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("{{#each posts}}<p>{{formatDate date \"MM/DD/YYYY\"}}</p><p><a href=\"{{url}}\">{{title}} - {{author}}</a></p>{{/each}}<p>Tags: <br /><ul>{{#each tags}}<li><a href=\"{{id}}\">{{name}}</a></li>{{/each}}</ul></p>{{formatDate \"\" \"YYYY\"}}");
  });

  it("get tag template", () => {
    
    let val = new HtmlRenderProvider().getTagTemplate(config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<p>Tag: {{tag.name}}<br /></p><ul>{{#each tag.posts}}<li>{{title}} - {{author}}</li>{{/each}}</ul>");
  });

  it("get post template", () => {
    
    let val = new HtmlRenderProvider().getPostTemplate(config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<h1>Post</h1>{{> header}}<p>{{post.title}}</p><p>{{post.author}}</p><p>{{{post.body}}}</p><p>{{post.matter.featured_image}}</p><p>{{previousPost.id}}</p><p>{{nextPost.id}}</p><h1>Tags</h1><ul>    {{#each tags}}    <li>{{name}}</li>    {{/each}}</ul>");
  });

  it("render template", () => {
    let htmlProvider = new HtmlRenderProvider();
    let source = htmlProvider.getTagTemplate(config);
    let tag = new Tag("FOO");
    let tags = [tag];

    let val = htmlProvider.renderTemplate(source, {tag: tag, tags: tags}, config);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<p>Tag: FOO<br /></p><ul></ul>");
  });

  it("render post", async () => {
    let htmlProvider = new HtmlRenderProvider();
    let post = new Post();
    post.author = "John Doe";
    post.title = "The John Doe Diary 1";
    post.content = "The long journy is real";

    let tag = new Tag("FOO");
    let tags = [tag];

    let val = await htmlProvider.renderPost(post, tags, config, undefined, undefined,);

    expect(val.replace(/(\r\n|\n|\r)/gm, "")).toBe("<h1>Post</h1>Header: The John Doe Diary 1<p>The John Doe Diary 1</p><p>John Doe</p><p><p>The long journy is real</p></p><p></p><p></p><p></p><h1>Tags</h1><ul>    <li>FOO</li></ul>");
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

    let val = await htmlProvider.renderHome(ds, config);
    val = val.replace(/(\r\n|\n|\r)/gm, "");
    expect(val).toContain("<a href=\"the-largest-whale\">Article One - John Smith</a></p>");
    expect(val).toContain("<p><a href=\"article-simple\">Article Simple - </a></p>");
    expect(val).toContain("Tags: <br /><ul><li><a href=\"aerospace\">aerospace</a></li><li><a href=\"blast\">blast</a></li><li><a href=\"candle\">Candle</a></li><li><a href=\"cool\">cool</a></li><li><a href=\"docula\">Docula</a></li><li><a href=\"facts\">facts</a></li><li><a href=\"foo\">foo</a></li><li><a href=\"github\">Github</a></li><li><a href=\"model-3\">model 3</a></li><li><a href=\"mouse\">mouse</a></li><li><a href=\"muskified\">muskified</a></li><li><a href=\"nice3\">nice3</a></li><li><a href=\"ocean\">ocean</a></li><li><a href=\"open-source\">Open Source</a></li><li><a href=\"tesla\">tesla</a></li><li><a href=\"whale\">Whale</a></li></ul></p>2020");
  });

  it("render (long running)", async () => {
    let htmlProvider = new HtmlRenderProvider();
    
    let ds = new DataService(config);

    let val = await htmlProvider.render(ds, config);

    expect(val).toBe(true);
  });


  it("register partials", async () => {
    let htmlProvider = new HtmlRenderProvider();

    let result = htmlProvider.registerPartials(config);

    expect(result).toBe(true);
  });

  it("register partials on bad path", async () => {
    let htmlProvider = new HtmlRenderProvider();

    let c = new Config();
    c.path = "./foo";

    let result = htmlProvider.registerPartials(c);

    expect(result).toBe(false);
  });

  
});
