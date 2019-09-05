import { expect } from "chai";
import { Config } from "../src/config";
import { AtomProvider } from "../src/render/atomProvider";
import "mocha";
import { DataService } from "../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("atomProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.loadConfig("./blog_example/config.json");
  });

  it("render (long running)", async () => {
    let atomProvider = new AtomProvider();
    
    let ds = new DataService(config);

    let val = await atomProvider.render(ds, config);

    //cleanup
    if (fs.existsSync(config.output)) {
        del.sync(config.output);
    }

    expect(val).to.equal(true);
  });

  
});