import { Config } from "../../src/config";
import { FileDataProvider } from "../../src/data/fileDataProvider";
import { createLogger, transports } from "winston";

describe("File Data Provider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("config gets setup in init", () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    expect(fileProvider.__postPath).toBe(config.path);
  });

  it("config gets no config.data.postPath in init", () => {
    let fileProvider = new FileDataProvider();

    config.path = "";

    fileProvider.init(config);

    expect(fileProvider.__postPath).toBe(config.path);
  });

  it("should get the posts from the file system", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = await fileProvider.getPosts();

    expect(posts.length).toBe(8);
  });

  it("should get the posts from memory", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    await fileProvider.getPosts();

    let posts = await fileProvider.getPosts();

    expect(posts.length).toBe(8);
  });

  it("should get a valid post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = await fileProvider.getPost("article-simple");

    if(post) {
      expect(post.title).toBe("Article Simple");
    } else {
      fail();
    }
  });

  it("should not get a valid post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = await fileProvider.getPost("article");

    expect(post).toBeUndefined();
  });

  it("should get a post", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let post = await fileProvider.getPost("all-about-the-tesla-model-3");

    if(post) {
      expect(post.title).toBe("Tesla Model 3");
    } else {
      fail();
    }

  });

  it("should get posts", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = await fileProvider.getPosts();

    expect(posts.length).toBe(8);
  });

  it("should get published posts", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = await fileProvider.getPublishedPosts();

    expect(posts.length).toBe(7);

  });

  it("should have a valid tag", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = await fileProvider.getTag("whale");

    if(tag) {
      expect(tag.name).toBe("Whale");
    } else {
      fail();
    }

  });

  it("should have a valid tag and multiple posts", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = await fileProvider.getTag("whale");

    if(tag) {
      expect(tag.posts.length).toBe(3);
    } else {
      fail();
    }
  });

  it("should have a invalid tag", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tag = await fileProvider.getTag("snoopy");

    expect(tag).toBeUndefined();
  });

  it("should get published tags", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let tags = await fileProvider.getPublishedTags();

    expect(tags.length).toBe(16);
  });

  it("should generate the correct amount of tags", async () => {
    let fileProvider = new FileDataProvider();
    fileProvider.init(config);

    let posts = await fileProvider.getPosts();

    let tags = await fileProvider.generateTags(posts);

    expect(tags.length).toBe(17);
  });

  it("parse bad file path post", async () => {
    let fileProvider = new FileDataProvider();
    
    //set the logging level
    fileProvider.log = createLogger({ transports: [new transports.Console()]});
    for (let t of fileProvider.log.transports) {
      t.silent = true;
    }

    let post = await fileProvider.parsePost("../foo.md")

    expect(post).toBeUndefined();
  });
});
