import { Config } from "../../src/config";
import { AtomRenderProvider } from "../../src/render/atomRenderProvider";
import { DataService } from "../../src/data/dataService";

describe("atomProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render (long running)", async () => {
    let atomProvider = new AtomRenderProvider();
    
    let ds = new DataService(config);

    let val = await atomProvider.render(ds, config);

    expect(val).toBe(true);
  });

  it("render without config defined", async () => {
    let atomProvider = new AtomRenderProvider();
    
    let ds = new DataService(config);

    config.title = "";
    config.url = "";
    config.authorName = "";
    config.authorEmail = "";

    let val = await atomProvider.render(ds, config);

    expect(val).toBe(true);
  });

  
});