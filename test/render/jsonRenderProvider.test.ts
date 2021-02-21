import { Config } from "../../src/config";
import { JSONRenderProvider } from "../../src/render/jsonRenderProvider";
import { DataService } from "../../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("jsonProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render (long running)", async () => {
    let jsonProvider = new JSONRenderProvider();
    
    let ds = new DataService(config);

    let val = await jsonProvider.render(ds, config);

    expect(val).toBe(true);
  });

  
});
