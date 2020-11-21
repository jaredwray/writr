import { Config } from "../../src/config";
import { AtomRenderProvider } from "../../src/render/atomRenderProvider";
import { DataService } from "../../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("atomProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render (long running)", async () => {
    let atomProvider = new AtomRenderProvider();
    
    let ds = new DataService(config);

    let val = await atomProvider.render(ds, config);

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

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

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

    expect(val).toBe(true);
  });

  
});