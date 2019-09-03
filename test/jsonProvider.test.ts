import { expect } from "chai";
import { Config, ConfigData } from "../src/config";
import { JSONProvider } from "../src/render/jsonProvider";
import "mocha";
import { DataService } from "../src/data/dataService";
import * as del from "del";
import * as fs from "fs-extra";

describe("jsonProvider", () => {
  let config: Config = new Config();

  beforeEach(() => {
    config.data = new ConfigData();
    config.data.type = "file";
    config.data.postPath = __dirname + "/blog";
    config.data.contentPath = __dirname + "/blog/content";
    config.data.templatePath = __dirname + "/blog/templates";
    config.program.output = "./out"
  });

  it("render (long running)", async () => {
    let jsonProvider = new JSONProvider();
    
    let ds = new DataService(config);

    let val = await jsonProvider.render(ds, config);

    //cleanup
    if (fs.existsSync(config.program.output)) {
        del.sync(config.program.output);
    }

    expect(val).to.equal(true);
  });

  
});
