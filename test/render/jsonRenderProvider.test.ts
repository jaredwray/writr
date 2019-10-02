import { expect } from "chai";
import { Config } from "../../src/config";
import { JSONRenderProvider } from "../../src/render/jsonRenderProvider";
import "mocha";
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

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

    expect(val).to.equal(true);
  });

  
});
