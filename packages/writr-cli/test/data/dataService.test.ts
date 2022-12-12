import { Config } from "../../src/config";
import { DataService } from "../../src/data/dataService";

describe("Data Service", () => {
  let config: Config = new Config();
  let ds: DataService;

  beforeAll(async () => {
    config.loadConfig("./blog_example/config.json");
    ds = new DataService(config);
  });

  it("get a provider based on the config", () => {
    expect(ds.getProvider()).toBeDefined();
  });

  it("get published posts", async () => {
    let posts = await ds.getPublishedPosts();

    expect(posts.length).toBe(7);
  });

  it("get posts by count", async () => {
    let posts = await ds.getPostsByCount(2);

    expect(posts.length).toBe(2);
  });

  it("get published posts by count", async () => {
    let posts = await ds.getPublishedPostsByCount(7);

    expect(posts.length).toBe(7);
  });

  it("get published posts by count maximum", async () => {
    let posts = await ds.getPublishedPostsByCount(3);

    expect(posts.length).toBe(3);
  });

  it("get posts", async () => {
    let posts = await ds.getPosts();

    expect(posts.length).toBe(8);
  });

  it("get posts from cache", async () => {
    await ds.getPosts();

    let posts2 = await ds.getPosts();

    expect(posts2.length).toBe(8);
  });

  it("get posts with a miss", async () => {

    let config2 = new Config();
    let ds2 = new DataService(config2);

    let posts = await ds2.getPosts();

    expect(posts.length).toBe(0);
  });

  it("get post", async () => {
    let post = await ds.getPost("article-simple");

    if(post) {
      expect(post.title).toBe("Article Simple");
    } else {
      fail();
    }
  });

  it("get post with a miss", async () => {
    let post = await ds.getPost("sdfsfsdfsddfsd");

    expect(post).toBeUndefined();
  });

  it("get published tags", async () => {
    let tags = await ds.getPublishedTags();

    expect(tags.length).toBe(16);
  });


  it("get tags", async () => {
    let tags = await ds.getTags();

    expect(tags.length).toBe(17);
  });

  it("get tags from cache", async () => {
    await ds.getTags();

    let tags = await ds.getTags();

    expect(tags.length).toBe(17);
  });

  it("get tag with a miss", async () => {
    let tag = await ds.getTag("sdfkjslfkjse");

    expect(tag).toBeUndefined();
  });

  it("get tag", async () => {
    let tag = await ds.getTag("tesla");

    if(tag) {
      expect(tag.id).toBe("tesla");
    } else {
      fail();
    }
  });

  it("get tag from cache", async () => {
    await ds.getTag("tesla");
    let tag = await ds.getTag("tesla");

    if(tag) {
      expect(tag.id).toBe("tesla");
    } else {
      fail();
    }
  });

});
